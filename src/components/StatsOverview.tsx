import { AudioLines, CalendarClock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useTranscriptionStats } from '@/hooks/useTranscriptionStats'

function formatDuration(totalSeconds: number): string {
  const seconds = Math.round(totalSeconds)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (hours > 0) return `${hours}시간 ${minutes}분`
  if (minutes > 0) return `${minutes}분 ${remainingSeconds}초`
  return `${remainingSeconds}초`
}

interface StatItemProps {
  icon: React.ReactNode
  label: string
  value: string
}

function StatItem({ icon, label, value }: StatItemProps) {
  return (
    <Card className="flex flex-row items-center gap-3 p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-chart-2/20 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold leading-tight">{value}</p>
      </div>
    </Card>
  )
}

interface StatsOverviewProps {
  refreshKey: number
}

export function StatsOverview({ refreshKey }: StatsOverviewProps) {
  const stats = useTranscriptionStats(refreshKey)

  return (
    <div className="grid w-full grid-cols-2 gap-3">
      <StatItem
        icon={<AudioLines className="size-5" />}
        label="오늘의 녹음"
        value={stats ? `${stats.todayCount}건` : '—'}
      />
      <StatItem
        icon={<CalendarClock className="size-5" />}
        label="총 녹음 시간"
        value={stats ? formatDuration(stats.totalDurationSeconds) : '—'}
      />
    </div>
  )
}
