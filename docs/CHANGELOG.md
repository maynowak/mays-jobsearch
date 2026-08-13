# Changelog

1.0

Initial Project — core job matching.

1.1

Model info display under the search button.

1.2

Multi-city search, AI cover-letter generator, daily email alerts.

1.3

Modal visibility fix (`[hidden]` display handling).

2.0

Frontend rebuilt: React + TypeScript + Vite (replaces vanilla HTML/CSS/JS).

## Unreleased — 2026-08-13

Frontend migrated to React + TypeScript + Vite.

- New `src/` structure: typed components, `api.ts` client, `types.ts`.
- `App.tsx` holds state (phase, status, matches, profile, modal).
- Components: `Hero`, `SearchForm`, `ModelInfo`, `AlertCard`, `Status`, `Results`, `MatchCard`, `ScoreBadge`, `LetterModal`.
- Serverless functions (`api/**`) unchanged and reused as-is.
- Build: `tsc -b && vite build` with strict TypeScript.
- Git branch `feature/react-rebuild` created from the vanilla baseline.

## Unreleased — 2026-08-13

Sprint 1.2 completed and verified.

- Multi-city search: comma-separated cities (e.g. `Berlin, München, Hamburg`) with remote jobs still included.
- AI cover-letter generator: `POST /api/cover-letter` writes a personalized German cover letter with a suggested answer to the interview question; modal UI with copy + download `.txt`.
- Daily job alerts: subscription form, `/api/alerts` with Upstash Redis storage, Vercel Cron `/api/cron/digest` sending via Resend.
- Shared OpenRouter client extracted to `api/_lib/ai.mjs` with consistent friendly errors (401/402/429/network/malformed).
- Model resolution centralized in `api/_lib/model.mjs`.
- Project documentation added under `docs/`.

## Unreleased — 2026-08-13

Sprint 1.3 completed.

- Fixed the cover-letter modal opening on page load: added `[hidden] { display: none !important }` so CSS `display` rules no longer override the `hidden` attribute.

## Release notes

- The application is deployed to production and all endpoints verified live.
- Remaining work: Upstash + Resend keys for real digest delivery, final accessibility audit, candidate profile persistence (roadmap).
