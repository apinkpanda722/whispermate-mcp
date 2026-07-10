---
name: verify
description: How to run and drive whisper-mate-mcp to observe a change working (this repo's runtime verification recipe)
---

# Verifying whisper-mate-mcp changes at runtime

This is a Vite + React SPA backed by Supabase (auth + DB + edge function for STT).

## Launch

```bash
npm run dev   # http://localhost:5173, auto-signs in anonymously via Supabase
```

`.env` must have `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` set (it is in this
repo already) or the app hangs on "로딩 중...".

## Gotcha: the `claude-in-chrome` extension can't reach localhost

The Chrome extension used for `mcp__claude-in-chrome__*` tools is blocked by an
org policy from navigating to `localhost`/`127.0.0.1`. Use the **Playwright MCP**
tools (`mcp__playwright__browser_*`) instead — Playwright launches its own
Chromium instance and isn't subject to that policy.

## Driving the recording → transcription flow

The app records real mic audio via `getUserMedia` + `MediaRecorder`, then POSTs
to the Supabase edge function `transcribe`. Playwright's default browser does
grant a fake mic stream without a permission prompt in this project (no special
launch flags needed for the MCP playwright tool) — clicking "녹음 시작" actually
starts `MediaRecorder` and enters the "녹음 중..." state.

Flow to drive:
1. `browser_click` "녹음 시작" (mic icon button) — starts recording.
2. `browser_wait_for time: 1.5` or so — give MediaRecorder a moment to buffer.
3. `browser_click` "녹음 중지" — stops recording, triggers `handleTranscription`.

## Forcing/observing STT success or failure

To exercise the error/retry path (or just avoid depending on a real edge
function round-trip), monkeypatch `window.fetch` before starting the recording,
via `browser_evaluate`:

```js
() => {
  window.__origFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0] instanceof Request ? args[0].url : String(args[0]);
    if (url.includes('/functions/v1/transcribe')) {
      // reject to simulate failure, or return Promise.resolve(new Response(...))
      // with JSON {text, language, duration} to simulate success
      return Promise.reject(new Error('simulated failure'));
    }
    return window.__origFetch.apply(this, args);
  };
}
```

`transcribeAudioWithRetry` (src/services/transcription.ts) retries 3x with
2s/4s/8s exponential backoff, so a forced-failure run takes ~14s before the
error card + "다시 시도" button (src/App.tsx) appears — `browser_wait_for` with a
generous `time` (20s+) is needed, not just `text:`.

Swap the mock to resolve successfully and click "다시 시도" to verify recovery —
the transcription result card should populate and the stats tiles ("오늘의
녹음"/"총 녹음 시간") should increment, confirming `saveTranscription` and the
stats refresh both ran.

## Build/lint (not a substitute for driving the app, but useful sanity checks)

```bash
npm run build   # tsc -b && vite build
npm run lint    # oxlint
```
