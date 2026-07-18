import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Sentry from '@sentry/react'
import { init as initElectronRenderer } from '@sentry/electron/renderer'
import { initSentry } from './sentry'

vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  browserTracingIntegration: vi.fn(() => 'browserTracingIntegration'),
  replayIntegration: vi.fn(() => 'replayIntegration'),
}))

vi.mock('@sentry/electron/renderer', () => ({
  init: vi.fn(),
}))

describe('initSentry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete (window as unknown as { electron?: unknown }).electron
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('initializes the browser Sentry SDK directly when a DSN is configured (non-Electron)', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://examplePublicKey@o0.ingest.sentry.io/0')

    initSentry()

    expect(Sentry.init).toHaveBeenCalledTimes(1)
    const options = vi.mocked(Sentry.init).mock.calls[0][0] as { dsn?: string }
    expect(options.dsn).toBe('https://examplePublicKey@o0.ingest.sentry.io/0')
    expect(initElectronRenderer).not.toHaveBeenCalled()
  })

  it('no-ops when VITE_SENTRY_DSN is not set', () => {
    vi.stubEnv('VITE_SENTRY_DSN', '')

    initSentry()

    expect(Sentry.init).not.toHaveBeenCalled()
    expect(initElectronRenderer).not.toHaveBeenCalled()
  })

  it('relays through the Electron main process when window.electron exists', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://examplePublicKey@o0.ingest.sentry.io/0')
    Object.defineProperty(window, 'electron', { value: {}, configurable: true })

    initSentry()

    expect(initElectronRenderer).toHaveBeenCalledTimes(1)
    expect(initElectronRenderer).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0' }),
      Sentry.init,
    )
    expect(Sentry.init).not.toHaveBeenCalled()
  })

  it('warns in production when no DSN is configured', () => {
    vi.stubEnv('VITE_SENTRY_DSN', '')
    vi.stubEnv('PROD', true)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    initSentry()

    expect(warnSpy).toHaveBeenCalledWith(
      'VITE_SENTRY_DSN is not set; Sentry error tracking is disabled.',
    )

    warnSpy.mockRestore()
  })
})
