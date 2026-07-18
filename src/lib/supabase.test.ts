import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const createClientMock = vi.hoisted(() => vi.fn(() => ({ __mocked: 'supabase-client' })))

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}))

describe('lib/supabase', () => {
  beforeEach(() => {
    vi.resetModules()
    createClientMock.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('creates a client using the configured URL and anon key', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')

    const { supabase } = await import('./supabase')

    expect(createClientMock).toHaveBeenCalledWith('https://example.supabase.co', 'anon-key')
    expect(supabase).toEqual({ __mocked: 'supabase-client' })
  })

  it('throws when VITE_SUPABASE_URL is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')

    await expect(import('./supabase')).rejects.toThrow(
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.',
    )
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it('throws when VITE_SUPABASE_ANON_KEY is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')

    await expect(import('./supabase')).rejects.toThrow(
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.',
    )
    expect(createClientMock).not.toHaveBeenCalled()
  })
})
