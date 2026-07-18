# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Vite dev server (default http://localhost:5173/)
- `npm run build` — type-check via `tsc -b` (project references: `tsconfig.app.json` + `tsconfig.node.json`), then `vite build`
- `npm run lint` — run Oxlint (config in `.oxlintrc.json`)
- `npm run preview` — preview the production build locally
- `npm run test:unit` — run unit tests once with Vitest
- `npm run test:unit:watch` — run unit tests in watch mode
- `npm run test:e2e` — run Playwright end-to-end tests (`tests/e2e/*.spec.ts`)

Unit tests (Vitest + `@testing-library/react`, jsdom environment) are configured in the `test`
block of `vite.config.ts`, with `src/test/setup.ts` loading `@testing-library/jest-dom` matchers.
Unit test files are colocated next to their source as `*.test.ts`/`*.test.tsx` (matched by the
`src/**/*.test.{ts,tsx}` include glob) — this is separate from the Playwright e2e suite in
`tests/e2e/`. The `unit-test-writer` subagent (`.claude/agents/unit-test-writer.md`) is set up to
write these tests following this repo's conventions.

## Architecture

This is a minimal Vite + React 19 + TypeScript single-page app, bootstrapped from the standard Vite React template and layered with shadcn/Tailwind v4 and Sentry.

- **Entry point**: `src/main.tsx` mounts `<App />` into `#root`. It calls `initSentry()` before rendering and wraps the tree in `Sentry.ErrorBoundary` so render-time errors are captured.
- **Sentry integration**: `src/lib/sentry.ts` reads the DSN from `import.meta.env.VITE_SENTRY_DSN` (see `.env` / `.env.example`) and no-ops if unset. It enables `browserTracingIntegration` and `replayIntegration` with tracing/replay sample rates set for development; treat these as needing adjustment before a real production rollout. Environment variable typing lives in `src/vite-env.d.ts`.
- **Styling**: Tailwind CSS v4 is wired in via `@tailwindcss/vite` (see `vite.config.ts`) rather than a `tailwind.config.js`. Theme tokens (colors, radii, shadows) are defined as CSS custom properties in `src/index.css` under `:root` and `.dark`, then re-exposed through the `@theme inline` block for Tailwind's `--color-*` utilities. Component-specific styles (e.g. the Vite/React template hero/nav) live in `src/App.css`.
- **shadcn/ui**: configured via `components.json` (`style: base-nova`, base color `neutral`, icon library `lucide`). Path aliases follow shadcn conventions: `@/components`, `@/components/ui`, `@/lib`, `@/hooks` all resolve under `src/` (see `@` alias in `vite.config.ts` and `tsconfig.app.json`). `src/lib/utils.ts` exports the `cn()` helper (clsx + tailwind-merge) used throughout for conditional class names.
- **React Compiler**: enabled via `babel-plugin-react-compiler` (through `@rolldown/plugin-babel` in the Vite React plugin). Keep components compatible with the compiler's rules (e.g. don't rely on patterns it can't safely memoize).

## Sentry project

The Sentry organization is `papa-jg`, project slug `whisper-mate-mcp` (team `papa`). The project ships with a default issue alert rule ("Send a notification for high priority issues") that emails active project members immediately on new/existing high-priority issues. Creating additional alert rules (e.g. Slack routing, non-priority-filtered rules) currently requires the Sentry web console — the connected Sentry MCP tools can only read/search alert rules, not create them.

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md
