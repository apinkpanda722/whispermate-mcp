import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))

import { captureException } from '@sentry/react'
import { useAudioRecorder } from './useAudioRecorder'

let createdRecorders: MockMediaRecorder[] = []

class MockMediaRecorder {
  static isTypeSupported = vi.fn(() => true)

  stream: MediaStream
  state: 'inactive' | 'recording' = 'inactive'
  mimeType: string
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  onstop: (() => void) | null = null

  constructor(stream: MediaStream, options?: { mimeType?: string }) {
    this.stream = stream
    this.mimeType = options?.mimeType ?? ''
    createdRecorders.push(this)
  }

  start(_timeslice?: number) {
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    this.onstop?.()
  }
}

function createMockStream(stopTrack = vi.fn()): MediaStream {
  return { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream
}

let mockGetUserMedia: ReturnType<typeof vi.fn>

describe('useAudioRecorder', () => {
  beforeEach(() => {
    createdRecorders = []
    vi.clearAllMocks()

    mockGetUserMedia = vi.fn().mockResolvedValue(createMockStream())
    Object.assign(navigator, {
      mediaDevices: { getUserMedia: mockGetUserMedia },
    })

    vi.stubGlobal('MediaRecorder', MockMediaRecorder)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('마이크 스트림을 얻어 녹음을 시작하고 isRecording을 true로 만든다', async () => {
    const onChunk = vi.fn()
    const { result } = renderHook(() => useAudioRecorder(onChunk))

    await act(async () => {
      await result.current.startRecording()
    })

    expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(result.current.isRecording).toBe(true)
    expect(result.current.error).toBeNull()
    expect(createdRecorders).toHaveLength(1)
    expect(createdRecorders[0].state).toBe('recording')
  })

  it('첫 데이터는 헤더로 저장하고, 이후 청크는 헤더와 합쳐서 onChunk로 전달한다', async () => {
    const onChunk = vi.fn()
    const { result } = renderHook(() => useAudioRecorder(onChunk))

    await act(async () => {
      await result.current.startRecording()
    })

    const recorder = createdRecorders[0]
    const firstBlob = new Blob(['header'], { type: 'audio/webm' })
    act(() => {
      recorder.ondataavailable?.({ data: firstBlob })
    })

    expect(onChunk).toHaveBeenNthCalledWith(1, { blob: firstBlob, index: 1 })

    const secondBlob = new Blob(['tail'], { type: 'audio/webm' })
    act(() => {
      recorder.ondataavailable?.({ data: secondBlob })
    })

    expect(onChunk).toHaveBeenCalledTimes(2)
    const secondCallArg = onChunk.mock.calls[1][0]
    expect(secondCallArg.index).toBe(2)
    expect(secondCallArg.blob).toBeInstanceOf(Blob)
    expect(secondCallArg.blob).not.toBe(firstBlob)
  })

  it('중지하면 스트림 트랙을 정지하고 isRecording을 false로 되돌린다', async () => {
    const stopTrack = vi.fn()
    mockGetUserMedia.mockResolvedValue(createMockStream(stopTrack))
    const onChunk = vi.fn()
    const { result } = renderHook(() => useAudioRecorder(onChunk))

    await act(async () => {
      await result.current.startRecording()
    })

    await act(async () => {
      await result.current.stopRecording()
    })

    expect(stopTrack).toHaveBeenCalled()
    expect(result.current.isRecording).toBe(false)
  })

  it('마이크 권한이 거부되면 permission-denied 에러를 설정하고 Sentry에 보고한 뒤 다시 던진다', async () => {
    const permissionError = new DOMException('denied', 'NotAllowedError')
    mockGetUserMedia.mockRejectedValue(permissionError)
    const onChunk = vi.fn()
    const { result } = renderHook(() => useAudioRecorder(onChunk))

    await act(async () => {
      await expect(result.current.startRecording()).rejects.toThrow()
    })

    expect(result.current.error).toEqual({
      type: 'permission-denied',
      message: '마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크 접근을 허용해주세요.',
    })
    expect(result.current.isRecording).toBe(false)
    expect(captureException).toHaveBeenCalledWith(permissionError, {
      tags: { feature: 'audio-recorder', errorType: 'permission-denied' },
    })
  })

  it('알 수 없는 에러가 발생하면 unknown 타입으로 처리한다', async () => {
    const genericError = new Error('boom')
    mockGetUserMedia.mockRejectedValue(genericError)
    const onChunk = vi.fn()
    const { result } = renderHook(() => useAudioRecorder(onChunk))

    await act(async () => {
      await expect(result.current.startRecording()).rejects.toThrow('boom')
    })

    expect(result.current.error).toEqual({
      type: 'unknown',
      message: '녹음을 시작할 수 없습니다. 다시 시도해주세요.',
    })
  })

  it('녹음 중이 아닐 때 stopRecording을 호출해도 에러 없이 즉시 완료된다', async () => {
    const onChunk = vi.fn()
    const { result } = renderHook(() => useAudioRecorder(onChunk))

    await act(async () => {
      await expect(result.current.stopRecording()).resolves.toBeUndefined()
    })

    expect(result.current.isRecording).toBe(false)
  })
})
