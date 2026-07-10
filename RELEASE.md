# Release process

## Local builds

```bash
npm run electron:build:mac   # dmg + zip, output in release/
npm run electron:build:win   # nsis installer + portable exe, output in release/
```

Both scripts run `npm run build` (renderer) and `npm run build:electron` (main/preload)
first, then invoke `electron-builder`. Artifacts land in `release/`.

Windows builds can't be produced on macOS without Wine installed, so `electron:build:win`
has only been verified via the CI matrix (see below), not locally.

## Environment variables

`build:electron` copies the repo-root `.env` into `dist-electron/runtime.env`, which the
main process loads via `dotenv` at startup (see `electron/main.ts`). Set
`VITE_SENTRY_DSN`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in `.env` before building
so both the renderer (Vite's `import.meta.env`) and the main process pick them up. In CI
these are exported as job-level env vars from repo secrets instead of a checked-in `.env`
file — `dotenv.config()` doesn't overwrite variables that are already set, so either path
works.

## Code signing / notarization

Builds are **unsigned** by default — electron-builder falls back to an ad-hoc/unsigned
build when it can't find a signing identity, which is fine for local testing but will
trigger Gatekeeper ("unidentified developer") and SmartScreen warnings for anyone else who
installs the app.

To produce signed, notarized builds, set these before running `electron-builder` (locally
or as CI secrets):

- **macOS signing**: `CSC_LINK` (path or base64 of a `.p12` cert) and `CSC_KEY_PASSWORD`.
- **macOS notarization**: `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` —
  electron-builder notarizes automatically when these are present and `hardenedRuntime` is
  `true` (already set in `electron-builder.json`).
- **Windows signing**: `CSC_LINK` and `CSC_KEY_PASSWORD` for an Authenticode cert.

None of these are configured yet since the project doesn't have a signing certificate.
`.github/workflows/build.yml` is ready to pick them up as secrets once one is available —
no workflow changes needed, just add the secrets.

## CI

`.github/workflows/build.yml` builds on every `v*` tag push (and via manual
`workflow_dispatch`), matrix over `macos-latest` (dmg/zip) and `windows-latest`
(nsis/portable), and uploads the `release/` artifacts. Requires these repo secrets:
`VITE_SENTRY_DSN`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, plus the signing secrets
above if/when code signing is set up.

## Known gaps

- Sourcemaps are generated (`tsconfig.electron.json` / `vite.config.ts`) but excluded from
  the packaged app (`electron-builder.json` `files`) and not yet uploaded to Sentry — that
  needs a `sentry-cli`/`@sentry/vite-plugin` release step with a `SENTRY_AUTH_TOKEN`, not
  wired up yet.
- No code signing certificate yet; see above.
- `electron:build:win` is only verified through CI, not locally (no Wine on the dev
  machine used for this project).

## Troubleshooting

- **`Application entry file ... does not exist`**: run `npm run build:electron` before
  `electron-builder` — the scripts above already do this, but if you invoke
  `electron-builder` directly, the `dist-electron/` output needs to exist first.
- **Codesign errors on macOS** (`Command failed: codesign ...`): you likely have a stale
  `CSC_LINK`/`CSC_KEY_PASSWORD` set without a matching keychain identity. Unset them for an
  unsigned local build.
- **Mic permission prompt never appears**: check `NSMicrophoneUsageDescription` in
  `electron-builder.json`'s `mac.extendInfo` and `electron/entitlements.mac.plist` — both
  are required for the OS to grant/prompt for audio input on a hardened-runtime build.
