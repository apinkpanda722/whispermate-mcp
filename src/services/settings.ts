import { supabase } from '@/lib/supabase'
import * as Sentry from '@sentry/react'
import type { Database } from '@/types/supabase'

export type Settings = Database['public']['Tables']['settings']['Row']
type SettingsUpdate = Database['public']['Tables']['settings']['Update']

export async function getSettings(): Promise<Settings | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    Sentry.captureException(error, {
      tags: { service: 'settings', action: 'get' },
    })
    throw error
  }

  return data
}

export async function updateSettings(settings: Partial<SettingsUpdate>): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('User not authenticated')

  const { error } = await supabase.from('settings').upsert({
    user_id: user.id,
    ...settings,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    Sentry.captureException(error, {
      tags: { service: 'settings', action: 'update' },
    })
    throw error
  }
}
