import { useCallback, useRef, useState } from 'react'
import * as Sentry from '@sentry/react'

export type AudioRecorderErrorType = 'permission-denied' | 'device-unavailable' | 'unknown'

export interface AudioRecorderError {
  type: AudioRecorderErrorType
  message: string
}

const PREFERRED_MIME_TYPES = ['audio/webm', 'audio/mp4', 'audio/ogg']
const SILENCE_PROBE_MS = 200
const SILENCE_POLL_INTERVAL_MS = 20

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type))
}

function stopStream(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop())
}

// A genuinely dead input (e.g. some MacBooks' built-in mic, see #43) resolves
// getUserMedia successfully but every sample is exactly 0 — unlike a working
// mic in a quiet room, which always has some non-zero electrical noise floor.
// Checking for bit-exact zero (rather than a near-zero threshold) avoids
// false positives on quiet/well-isolated setups where the user just hasn't
// started talking yet.
async function isStreamDead(stream: MediaStream): Promise<boolean> {
  const AudioContextCtor = window.AudioContext
  if (!AudioContextCtor) return false

  const audioContext = new AudioContextCtor()
  try {
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 2048
    source.connect(analyser)

    const data = new Float32Array(analyser.fftSize)
    const deadline = Date.now() + SILENCE_PROBE_MS
    let sawSignal = false

    while (Date.now() < deadline && !sawSignal) {
      analyser.getFloatTimeDomainData(data)
      sawSignal = data.some((sample) => sample !== 0)
      if (!sawSignal) await new Promise((resolve) => setTimeout(resolve, SILENCE_POLL_INTERVAL_MS))
    }

    return !sawSignal
  } finally {
    await audioContext.close()
  }
}

async function pickWorkingStream(): Promise<MediaStream> {
  const defaultStream = await navigator.mediaDevices.getUserMedia({ audio: true })
  if (!(await isStreamDead(defaultStream))) return defaultStream

  if (!navigator.mediaDevices?.enumerateDevices) return defaultStream
  stopStream(defaultStream)

  const devices = await navigator.mediaDevices.enumerateDevices()
  const candidates = devices.filter(
    (device) =>
      device.kind === 'audioinput' &&
      device.deviceId !== 'default' &&
      device.deviceId !== 'communications' &&
      !device.label.includes('Built-in') &&
      !device.label.includes('내장'),
  )

  for (const device of candidates) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: device.deviceId } },
      })
      if (!(await isStreamDead(stream))) return stream
      stopStream(stream)
    } catch {
      // Device unavailable/busy — try the next candidate.
    }
  }

  // Nothing produced a signal; fall back to the (silent) default rather than
  // failing outright, since the user may still be able to work around it.
  return navigator.mediaDevices.getUserMedia({ audio: true })
}

function toRecorderError(err: unknown): AudioRecorderError {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return {
        type: 'permission-denied',
        message: '마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크 접근을 허용해주세요.',
      }
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return {
        type: 'device-unavailable',
        message: '사용 가능한 마이크를 찾을 수 없습니다.',
      }
    }
  }
  return { type: 'unknown', message: '녹음을 시작할 수 없습니다. 다시 시도해주세요.' }
}

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<AudioRecorderError | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const startRecording = useCallback(async () => {
    setError(null)
    setAudioBlob(null)

    let stream: MediaStream
    try {
      stream = await pickWorkingStream()
    } catch (err) {
      const recorderError = toRecorderError(err)
      setError(recorderError)
      Sentry.captureException(err, {
        tags: { feature: 'audio-recorder', errorType: recorderError.type },
      })
      throw err
    }

    streamRef.current = stream
    const mimeType = pickSupportedMimeType()
    const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)

    chunksRef.current = []
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data)
      }
    }
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType })
      setAudioBlob(blob)
      chunksRef.current = []
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    mediaRecorder.onerror = (event) => {
      const domError = (event as Event & { error?: DOMException }).error
      const recorderError = toRecorderError(domError)
      setError(recorderError)
      Sentry.captureException(domError ?? new Error('MediaRecorder error'), {
        tags: { feature: 'audio-recorder', errorType: recorderError.type },
      })
    }

    mediaRecorder.start()
    mediaRecorderRef.current = mediaRecorder
    setIsRecording(true)
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [])

  return { isRecording, audioBlob, error, startRecording, stopRecording }
}
