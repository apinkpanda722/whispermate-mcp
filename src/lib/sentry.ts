import * as Sentry from '@sentry/react'
import { init as initElectronRenderer } from '@sentry/electron/renderer'

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN

  if (!dsn) {
    if (import.meta.env.PROD) {
      console.warn('VITE_SENTRY_DSN is not set; Sentry error tracking is disabled.')
    }
    return
  }

  const options = {
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: true,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  }

  // In the Electron desktop app, events are relayed through the main process
  // over IPC so the main process's Sentry client (and DSN) does the actual
  // reporting. window.electron only exists there (see preload.cts); in the
  // plain web build we fall back to the regular browser SDK.
  //
  // @sentry/react is pinned to the exact @sentry/core version @sentry/electron
  // 7.x bundles (10.62.0, see package.json) — mismatched versions break
  // @sentry/electron's Node SDK at runtime, not just its types.
  if (window.electron) {
    initElectronRenderer(options, Sentry.init)
  } else {
    Sentry.init(options)
  }
}
