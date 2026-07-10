import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface TranscriptionStats {
  todayCount: number
  totalDurationSeconds: number
}

export function useTranscriptionStats(refreshKey: number) {
  const [stats, setStats] = useState<TranscriptionStats | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)

      const [{ count: todayCount }, { data: durationRows }] = await Promise.all([
        supabase
          .from('transcriptions')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startOfToday.toISOString()),
        supabase.from('transcriptions').select('audio_duration_seconds'),
      ])

      if (cancelled) return

      const totalDurationSeconds = (durationRows ?? []).reduce(
        (sum, row) => sum + (row.audio_duration_seconds ?? 0),
        0,
      )

      setStats({ todayCount: todayCount ?? 0, totalDurationSeconds })
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return stats
}
