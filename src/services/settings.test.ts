import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn()
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const upsert = vi.fn()
  const from = vi.fn(() => ({ select, upsert }))
  const getUser = vi.fn()
  const captureException = vi.fn()
  return { maybeSingle, eq, select, upsert, from, getUser, captureException }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  },
}))

vi.mock('@sentry/react', () => ({
  captureException: mocks.captureException,
}))

import { getSettings, updateSettings } from './settings'

describe('settings service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getSettings', () => {
    it('returns the settings row for the authenticated user', async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
      const row = {
        user_id: 'user-1',
        default_language: 'ko',
        shortcut_key: null,
        updated_at: '2026-01-01T00:00:00.000Z',
      }
      mocks.maybeSingle.mockResolvedValue({ data: row, error: null })

      const result = await getSettings()

      expect(result).toEqual(row)
      expect(mocks.from).toHaveBeenCalledWith('settings')
      expect(mocks.eq).toHaveBeenCalledWith('user_id', 'user-1')
    })

    it('returns null without querying settings when there is no authenticated user', async () => {
      mocks.getUser.mockResolvedValue({ data: { user: null } })

      const result = await getSettings()

      expect(result).toBeNull()
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('reports to Sentry and rethrows when the query fails', async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
      const dbError = new Error('select failed')
      mocks.maybeSingle.mockResolvedValue({ data: null, error: dbError })

      await expect(getSettings()).rejects.toThrow(dbError)
      expect(mocks.captureException).toHaveBeenCalledWith(dbError, {
        tags: { service: 'settings', action: 'get' },
      })
    })
  })

  describe('updateSettings', () => {
    it('upserts settings for the authenticated user', async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
      mocks.upsert.mockResolvedValue({ error: null })

      await updateSettings({ default_language: 'en' })

      expect(mocks.from).toHaveBeenCalledWith('settings')
      expect(mocks.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          default_language: 'en',
          updated_at: expect.any(String),
        }),
      )
    })

    it('throws when there is no authenticated user', async () => {
      mocks.getUser.mockResolvedValue({ data: { user: null } })

      await expect(updateSettings({ default_language: 'en' })).rejects.toThrow(
        'User not authenticated',
      )
      expect(mocks.upsert).not.toHaveBeenCalled()
    })

    it('reports to Sentry and rethrows when the upsert fails', async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
      const dbError = new Error('db down')
      mocks.upsert.mockResolvedValue({ error: dbError })

      await expect(updateSettings({ default_language: 'en' })).rejects.toThrow(dbError)
      expect(mocks.captureException).toHaveBeenCalledWith(dbError, {
        tags: { service: 'settings', action: 'update' },
      })
    })
  })
})
