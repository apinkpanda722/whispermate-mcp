import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FunctionsHttpError } from '@supabase/supabase-js'

const mocks = vi.hoisted(() => {
  const getSession = vi.fn()
  const getUser = vi.fn()
  const invoke = vi.fn()
  const single = vi.fn()
  const select = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select }))
  const from = vi.fn(() => ({ insert }))
  const captureException = vi.fn()
  return { getSession, getUser, invoke, single, select, insert, from, captureException }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: mocks.getSession, getUser: mocks.getUser },
    functions: { invoke: mocks.invoke },
    from: mocks.from,
  },
}))

vi.mock('@sentry/react', () => ({
  captureException: mocks.captureException,
}))

import { transcribeAudio, transcribeAudioWithRetry, saveTranscription, TranscriptionError } from './transcription'

describe('transcription service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('transcribeAudio', () => {
    it('returns the transcription result and authorizes with the session token', async () => {
      mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'token-123' } } })
      mocks.invoke.mockResolvedValue({
        data: { text: '안녕하세요', language: 'ko', duration: 3.2 },
        error: null,
      })

      const blob = new Blob(['audio-bytes'], { type: 'audio/webm' })
      const result = await transcribeAudio(blob, 'ko', 'custom prompt')

      expect(result).toEqual({ text: '안녕하세요', language: 'ko', duration: 3.2 })
      expect(mocks.invoke).toHaveBeenCalledWith(
        'transcribe',
        expect.objectContaining({ headers: { Authorization: 'Bearer token-123' } }),
      )
      const callArgs = mocks.invoke.mock.calls[0][1] as { body: FormData }
      expect(callArgs.body).toBeInstanceOf(FormData)
      expect(callArgs.body.get('language')).toBe('ko')
      expect(callArgs.body.get('prompt')).toBe('custom prompt')
    })

    it('throws and reports to Sentry when there is no authenticated session', async () => {
      mocks.getSession.mockResolvedValue({ data: { session: null } })

      const blob = new Blob(['audio-bytes'], { type: 'audio/webm' })

      await expect(transcribeAudio(blob)).rejects.toThrow('User not authenticated')
      expect(mocks.captureException).toHaveBeenCalledWith(
        expect.any(TranscriptionError),
        expect.objectContaining({ tags: { service: 'transcription' } }),
      )
      expect(mocks.invoke).not.toHaveBeenCalled()
    })

    it('extracts the server-provided error message from a FunctionsHttpError body', async () => {
      mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'token-123' } } })
      const httpError = new FunctionsHttpError({
        json: async () => ({ error: '지원하지 않는 오디오 형식입니다' }),
      })
      mocks.invoke.mockResolvedValue({ data: null, error: httpError })

      const blob = new Blob(['audio-bytes'], { type: 'audio/webm' })

      await expect(transcribeAudio(blob)).rejects.toThrow('지원하지 않는 오디오 형식입니다')
    })
  })

  describe('transcribeAudioWithRetry', () => {
    it('returns immediately without retrying when the first attempt succeeds', async () => {
      mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'token-123' } } })
      mocks.invoke.mockResolvedValue({ data: { text: 'hi' }, error: null })

      const result = await transcribeAudioWithRetry(new Blob(['x']))

      expect(result.text).toBe('hi')
      expect(mocks.invoke).toHaveBeenCalledTimes(1)
    })

    it('retries after a transient failure and succeeds on the second attempt', async () => {
      vi.useFakeTimers()
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      try {
        mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'token-123' } } })
        mocks.invoke
          .mockResolvedValueOnce({ data: null, error: new Error('network blip') })
          .mockResolvedValueOnce({ data: { text: 'retried result' }, error: null })

        const promise = transcribeAudioWithRetry(new Blob(['x']), 'ko', 3)
        await vi.runAllTimersAsync()
        const result = await promise

        expect(result.text).toBe('retried result')
        expect(mocks.invoke).toHaveBeenCalledTimes(2)
      } finally {
        warnSpy.mockRestore()
        vi.useRealTimers()
      }
    })

    it('throws the last error after exhausting all retries', async () => {
      vi.useFakeTimers()
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      try {
        mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'token-123' } } })
        mocks.invoke.mockResolvedValue({ data: null, error: new Error('always down') })

        const promise = transcribeAudioWithRetry(new Blob(['x']), 'ko', 2)
        const assertion = expect(promise).rejects.toThrow('always down')
        await vi.runAllTimersAsync()
        await assertion

        expect(mocks.invoke).toHaveBeenCalledTimes(2)
      } finally {
        warnSpy.mockRestore()
        vi.useRealTimers()
      }
    })
  })

  describe('saveTranscription', () => {
    it('inserts the transcription and returns its id', async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
      mocks.single.mockResolvedValue({ data: { id: 'trans-1' }, error: null })

      const id = await saveTranscription('안녕하세요', 'ko', 12.5)

      expect(id).toBe('trans-1')
      expect(mocks.from).toHaveBeenCalledWith('transcriptions')
      expect(mocks.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          raw_text: '안녕하세요',
          edited_text: null,
          audio_duration_seconds: 12.5,
          language: 'ko',
        }),
      )
    })

    it('throws without inserting when there is no authenticated user', async () => {
      mocks.getUser.mockResolvedValue({ data: { user: null } })

      await expect(saveTranscription('안녕하세요')).rejects.toThrow('User not authenticated')
      expect(mocks.insert).not.toHaveBeenCalled()
    })

    it('reports to Sentry and rethrows when the insert fails', async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
      const dbError = new Error('insert failed')
      mocks.single.mockResolvedValue({ data: null, error: dbError })

      await expect(saveTranscription('안녕하세요')).rejects.toThrow(dbError)
      expect(mocks.captureException).toHaveBeenCalledWith(dbError, {
        tags: { service: 'transcription', action: 'save' },
      })
    })
  })
})
