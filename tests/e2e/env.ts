import fs from 'node:fs'
import path from 'node:path'

function loadDotEnv(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return {}

  const env: Record<string, string> = {}
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1)
  }
  return env
}

const dotEnv = loadDotEnv()

export const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? dotEnv.VITE_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ?? dotEnv.VITE_SUPABASE_ANON_KEY ?? ''

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set to run E2E tests.')
}
