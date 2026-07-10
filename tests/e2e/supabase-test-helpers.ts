import type { Page } from '@playwright/test'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env'

interface AnonSession {
  accessToken: string
  userId: string
}

export async function waitForAnonSession(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const key = Object.keys(localStorage).find((k) => k.endsWith('-auth-token'))
    if (!key) return false
    try {
      const parsed = JSON.parse(localStorage.getItem(key)!)
      return Boolean(parsed?.access_token && parsed?.user?.id)
    } catch {
      return false
    }
  })
}

export async function getAnonSession(page: Page): Promise<AnonSession> {
  await waitForAnonSession(page)
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.endsWith('-auth-token'))!
    const parsed = JSON.parse(localStorage.getItem(key)!)
    return { accessToken: parsed.access_token as string, userId: parsed.user.id as string }
  })
}

// A freshly issued anon JWT's `iat` can momentarily read as "in the future"
// to PostgREST due to clock skew, causing a spurious PGRST303. Retry once.
async function fetchWithClockSkewRetry(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, init)
  if (res.status === 401) {
    const body = await res.clone().text()
    if (body.includes('PGRST303')) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      return fetch(url, init)
    }
  }
  return res
}

export async function seedTranscription(page: Page, rawText: string): Promise<string> {
  const { accessToken, userId } = await getAnonSession(page)

  const res = await fetchWithClockSkewRetry(`${SUPABASE_URL}/rest/v1/transcriptions`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ user_id: userId, raw_text: rawText, language: 'ko' }),
  })

  if (!res.ok) {
    throw new Error(`Failed to seed transcription: ${res.status} ${await res.text()}`)
  }

  const [row] = (await res.json()) as { id: string }[]
  return row.id
}

export async function cleanupTranscriptions(page: Page): Promise<void> {
  const { accessToken, userId } = await getAnonSession(page)

  await fetchWithClockSkewRetry(
    `${SUPABASE_URL}/rest/v1/transcriptions?user_id=eq.${userId}`,
    {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )
}
