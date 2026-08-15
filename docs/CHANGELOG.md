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

## Unreleased — 2026-08-15

Model selection, CV upload and second job source.

- Dynamic OpenRouter free-model selection: `/api/models` exposes the current free-model catalogue (determined from OpenRouter pricing/metadata, not hardcoded) plus `defaultModel`, `fallbackModel` and `recommendedModel`; `/api/model` returns the resolved default.
- Accessible model selector: custom listbox with ARIA semantics, keyboard navigation, recommended-model section, popover that flips upward when space is tight.
- CV upload + profile extraction: browser-side PDF.js text extraction, normalized text → SHA-256 hash → profile cache lookup → `/api/profile` (AI) on miss → editable structured profile → matching. The PDF file is never uploaded and raw CV text is never stored.
- CV profile caching: two layers (browser `localStorage` L1 + Upstash Redis L2), keyed by CV hash, TTL 30 days; repeated identical CVs hit the cache instead of re-running the AI.
- Apify Arbeitsagentur source: job pool now combines Arbeitnow and the Apify Actor `blackfalcondata~arbeitsagentur-jobs-feed`; source metadata is preserved per job and cross-source dedup is active.
- Redis Apify cache: L1 job-record cache (`apify-jobs:<query>|<location>`, 600 s) + L2 Apify dataset reuse (`apify-dataset:<query>|<location>`, 24 h freshness) to avoid unnecessary paid Actor runs.
- Apify async run/polling: the Actor's `run-sync` returned an empty body, so runs are started asynchronously and polled to completion before reading the dataset.
- Apify dataset reuse fix: dataset age was compared in seconds against a millisecond timestamp, shrinking the 24 h reuse window to ~86 s; introduced `APIFY_DATASET_MAX_AGE_MS` — 24 h reuse now works.
- Matching candidate preselection: the combined pool is narrowed to max 10 candidates via `keywordHits` before AI evaluation, keeping requests within the Vercel function timeout.
- Top-5 / Top-10 result presentation: the UI shows the top 5 initially and expands locally to all evaluated matches without a second request.
- Found/evaluated/displayed metadata: `/api/match` returns `totalFound`, `evaluated` and `displayedInitially`; the status line reports them honestly (e.g. "52 Jobs gefunden · 10 passende Kandidaten mit KI bewertet").
- CV matching loading state: the confirm button shows a loading state while the profile is being matched.
