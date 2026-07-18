import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { StatsOverview } from '@/components/StatsOverview'
import { useTranscriptionStats } from '@/hooks/useTranscriptionStats'

vi.mock('@/hooks/useTranscriptionStats', () => ({
  useTranscriptionStats: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('StatsOverview', () => {
  it('통계가 아직 없을 때 두 항목 모두 대시(—)로 표시한다', () => {
    vi.mocked(useTranscriptionStats).mockReturnValue(null)

    render(<StatsOverview refreshKey={0} />)

    expect(screen.getByText('오늘의 녹음')).toBeInTheDocument()
    expect(screen.getByText('총 녹음 시간')).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(2)
  })

  it('통계 데이터를 건수와 시간 형식으로 렌더링한다', () => {
    vi.mocked(useTranscriptionStats).mockReturnValue({
      todayCount: 3,
      totalDurationSeconds: 125,
    })

    render(<StatsOverview refreshKey={0} />)

    expect(screen.getByText('3건')).toBeInTheDocument()
    expect(screen.getByText('2분 5초')).toBeInTheDocument()
  })

  it('총 녹음 시간이 1시간을 넘으면 시간 단위까지 표시한다', () => {
    vi.mocked(useTranscriptionStats).mockReturnValue({
      todayCount: 10,
      totalDurationSeconds: 3661,
    })

    render(<StatsOverview refreshKey={0} />)

    expect(screen.getByText('1시간 1분')).toBeInTheDocument()
  })

  it('refreshKey prop을 그대로 훅에 전달한다', () => {
    vi.mocked(useTranscriptionStats).mockReturnValue(null)

    render(<StatsOverview refreshKey={7} />)

    expect(useTranscriptionStats).toHaveBeenCalledWith(7)
  })
})
