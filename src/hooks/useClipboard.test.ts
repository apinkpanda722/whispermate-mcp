import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))

import { captureException } from '@sentry/react'
import { useClipboard } from './useClipboard'

describe('useClipboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    delete (window as unknown as { electron?: unknown }).electron
    Reflect.deleteProperty(navigator, 'clipboard')
  })

  it('electron API가 없으면 navigator.clipboard.writeText로 복사하고 true를 반환한다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    const { result } = renderHook(() => useClipboard())

    let success: boolean | undefined
    await act(async () => {
      success = await result.current.copyToClipboard('hello')
    })

    expect(success).toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('electron 클립보드 API가 있으면 이를 통해 복사하고 true를 반환한다', async () => {
    const write = vi.fn().mockResolvedValue({ success: true })
    Object.assign(window, { electron: { clipboard: { write } } })

    const { result } = renderHook(() => useClipboard())

    let success: boolean | undefined
    await act(async () => {
      success = await result.current.copyToClipboard('hello')
    })

    expect(success).toBe(true)
    expect(write).toHaveBeenCalledWith('hello')
  })

  it('navigator.clipboard.writeText가 실패하면 false를 반환하고 Sentry에 보고한다', async () => {
    const clipboardError = new Error('denied')
    const writeText = vi.fn().mockRejectedValue(clipboardError)
    Object.assign(navigator, { clipboard: { writeText } })

    const { result } = renderHook(() => useClipboard())

    let success: boolean | undefined
    await act(async () => {
      success = await result.current.copyToClipboard('hello')
    })

    expect(success).toBe(false)
    expect(captureException).toHaveBeenCalledWith(clipboardError, {
      tags: { feature: 'clipboard' },
      contexts: { clipboard: { textLength: 5 } },
    })
  })

  it('electron write가 success: false를 반환하면 false를 반환하고 Sentry에 보고한다', async () => {
    const write = vi.fn().mockResolvedValue({ success: false, error: 'native failure' })
    Object.assign(window, { electron: { clipboard: { write } } })

    const { result } = renderHook(() => useClipboard())

    let success: boolean | undefined
    await act(async () => {
      success = await result.current.copyToClipboard('abc')
    })

    expect(success).toBe(false)
    expect(captureException).toHaveBeenCalledTimes(1)
    const [reportedError] = vi.mocked(captureException).mock.calls[0]
    expect((reportedError as Error).message).toBe('native failure')
  })
})
