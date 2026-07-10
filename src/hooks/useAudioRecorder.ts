import { useCallback, useRef, useState } from 'react'
import * as Sentry from '@sentry/react'

export type AudioRecorderErrorType = 'permission-denied' | 'device-unavailable' | 'unknown'

export interface AudioRecorderError {
  type: AudioRecorderErrorType
  message: string
}

const PREFERRED_MIME_TYPES = ['audio/webm', 'audio/mp4', 'audio/ogg']

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type))
}

async function pickPreferredDeviceId(): Promise<string | undefined> {
  if (!navigator.mediaDevices?.enumerateDevices) return undefined

  const devices = await navigator.mediaDevices.enumerateDevices()
  const externalInput = devices.find(
    (device) =>
      device.kind === 'audioinput' &&
      device.deviceId !== 'default' &&
      device.deviceId !== 'communications' &&
      !device.label.includes('Built-in') &&
      !device.label.includes('내장'),
  )

  return externalInput?.deviceId
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
      const preferredDeviceId = await pickPreferredDeviceId()
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: preferredDeviceId ? { deviceId: { exact: preferredDeviceId } } : true,
        })
      } catch (err) {
        if (!preferredDeviceId) throw err
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      }
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
