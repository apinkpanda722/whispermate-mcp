import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

import { useTranscriptionStats } from './useTranscriptionStats'

interface SelectOptions {
  count?: 'exact'
  head?: boolean
}

function mockQueryResults(todayCount: number | null, durationRows: Array<{ audio_duration_seconds: number | null }> | null) {
  mockFrom.mockImplementation((table: string) => {
    expect(table).toBe('transcriptions')
    return {
      select: vi.fn((_columns: string, options?: SelectOptions) => {
        if (options?.count === 'exact' && options?.head) {
          return { gte: vi.fn().mockResolvedValue({ count: todayCount, error: null }) }
        }
        return Promise.resolve({ data: durationRows, error: null })
      }),
    }
  })
}

describe('useTranscriptionStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('오늘 변환 횟수와 총 녹음 시간을 계산한다', async () => {
    mockQueryResults(3, [
      { audio_duration_seconds: 30 },
      { audio_duration_seconds: 45 },
      { audio_duration_seconds: null },
    ])

    const { result } = renderHook(() => useTranscriptionStats(0))

    await waitFor(() => expect(result.current).not.toBeNull())

    expect(result.current).toEqual({ todayCount: 3, totalDurationSeconds: 75 })
  })

  it('refreshKey가 바뀌면 통계를 다시 불러온다', async () => {
    mockQueryResults(1, [])

    const { result, rerender } = renderHook(({ key }) => useTranscriptionStats(key), {
      initialProps: { key: 0 },
    })

    await waitFor(() => expect(result.current?.todayCount).toBe(1))

    mockQueryResults(5, [{ audio_duration_seconds: 100 }])
    rerender({ key: 1 })

    await waitFor(() => expect(result.current?.todayCount).toBe(5))
    expect(result.current?.totalDurationSeconds).toBe(100)
  })

  it('count와 duration 데이터가 없으면 0으로 기본 처리한다', async () => {
    mockQueryResults(null, null)

    const { result } = renderHook(() => useTranscriptionStats(0))

    await waitFor(() => expect(result.current).not.toBeNull())

    expect(result.current).toEqual({ todayCount: 0, totalDurationSeconds: 0 })
  })
})
