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
- Automatic model fallback: when the selected/recommended free model is temporarily unavailable (`model_unavailable`), the client retries the same operation with up to two other eligible free models from the `/api/models` catalogue (max 3 attempts), shows a subtle notice when a fallback was used, and never permanently changes the user's model selection. Applies to `/api/profile`, `/api/match` and `/api/cover-letter`.

## Unreleased — 2026-08-15

Cost control & usage guard.

- Central server-side configuration (`api/_lib/config.mjs`): env vars with safe defaults — `OPENROUTER_MONTHLY_SOFT_LIMIT_USD=0.80`, `APIFY_MONTHLY_SOFT_LIMIT_USD=4.00`, `MODEL_FALLBACK_MAX_ATTEMPTS=3`, `APIFY_DATASET_REFRESH_PEAK_HOURS=6`, `APIFY_DATASET_REFRESH_OFFPEAK_HOURS=12`, plus counter backstops `OPENROUTER_MONTHLY_MAX_REQUESTS=1000` and `APIFY_MONTHLY_MAX_RUNS=30`.
- Monthly usage counters in Upstash Redis (`api/_lib/usage.mjs`, month-scoped keys): OpenRouter requests/failures/fallback attempts/per-model and Apify Actor runs/dataset reuses/cache hits/misses.
- Read-only diagnostics endpoint `GET /api/usage` — counters + configured limits, no secrets.
- OpenRouter guard: at the monthly request backstop, AI endpoints fail fast with `503 limit_reached` (no provider call); fallback stays bounded by `MODEL_FALLBACK_MAX_ATTEMPTS`.
- Apify guard: at the monthly run backstop no new paid Actor runs are started (graceful empty result); cached and dataset-reused searches keep working.
- Time-of-day Apify dataset refresh: peak hours (08:00–18:00 server local time) reuse the dataset up to 6 h, off-peak up to 12 h (configurable) — fewer paid runs.
- The soft limits are explicitly NOT billing: the app cannot compute exact provider spend from its own counters, so the provider dashboards remain authoritative and the USD limits only surface in `/api/usage`.
- `MODEL_FALLBACK_MAX_ATTEMPTS` is exposed to the client via `/api/models` (`fallbackMaxAttempts`) so the attempt cap is configurable without editing source; the client forwards the fallback attempt index via the `x-mj-attempt` header for counting.

## Unreleased — 2026-08-15

UX / Datenquellen-Runde.

- **Jobquellen module:** new `JobSources` component directly below the search button shows real, dynamically computed per-source counts (Arbeitnow / Arbeitsagentur) from the delivered jobs; sources with zero jobs are omitted and a total line is shown. Clearly separated from the AI model selector. Pure frontend computation over `foundJobs` — no extra request.
- **Found jobs stay visible:** `Results` shows all delivered (found) jobs — evaluated matches as `MatchCard`s and the rest as `RemainingCard`s (`computeRemainingJobs`) — even when the AI evaluated only a subset (or none). Expanding the found list is local and never triggers a second `/api/jobs` or `/api/match` request.
- **Model selector lock:** `ModelSelector` accepts a `disabled` prop; the trigger is disabled (locked) while a search/scoring runs and re-enables after completion. UI-only — fallback logic unchanged.
- **OpenRouter 429 free-models-per-day UX:** `api/_lib/ai.mjs` detects the provider's daily free-quota message and returns a distinct `429 free_quota_exceeded` error. The client maps it to a specific friendly message ("Die kostenlosen KI-Anfragen für heute sind aufgebraucht…") and treats it as **not** `model_unavailable`, so the fallback stops immediately instead of futilely retrying other free models (account-wide daily limit). `isFreeQuotaExceeded` helper added to `src/api.ts`; handling in `App.tsx`, `CvUpload.tsx` and `LetterModal.tsx`.
- Tests: Results found/evaluated/displayed counts (A/B), JobSources counts + zero-source omission (C/D), selector lock during searching/scoring/after (E/F/G), quota message (K), existing `model_unavailable` fallback intact (L), no extra requests when expanding found jobs (M), plus `free_quota_exceeded` fallback-stop in `api.test.ts` and a server-side 429 detection test (`tests/api/quota-429.test.mjs`).

## Unreleased — 2026-08-15

Multi-Provider AI-Architektur + EdenAI-Integration.

- **Provider-Router:** neue `api/_lib/providers/`-Schicht — `index.mjs` (Router: `chat()`, Katalog-Aggregation, Provider-Fallback), `openrouter.mjs` (bestehende Logik aus `ai.mjs`/`models.mjs` extrahiert, Funktionsverhalten identisch), `edenai.mjs` (neuer Provider), `errors.mjs` (`AiError` mit `category` + normalisierte Codes).
- **Fassaden erhalten:** `api/_lib/ai.mjs` und `api/_lib/models.mjs` re-exportieren jetzt vom Router — Endpunkte und bestehende Test-Mocks (`{ chat: vi.fn() }`, `isFreeDailyQuotaError`) bleiben unverändert.
- **EdenAI-Provider:** OpenAI-kompatible V3-API (`/v3/chat/completions`, Katalog `/v3/models` öffentlich). Free-Eligibility über **0-Kosten-Pricing-Metadaten** (kein Namens-Heuristik), strukturierte Ausgabe über `capabilities.supports_response_schema`. Fehler-Mapping: 401/403 → `key_invalid`, 402 → `insufficient_credits`, 429 → `quota_exhausted`/`rate_limited`, 400/422 → `model_invalid`/`bad_request`, 5xx/Timeout/Netz → `model_unavailable`.
- **Dev/Prod-Key-Trennung:** `EDENAI_API_KEY` (Production) vs. `EDENAI_DEV_API_KEY` (Sandbox, simulierte Antworten, keine Kosten, gleicher Endpoint). Auswahl via `EDENAI_ENV`-Override oder `VERCEL_ENV=production`; fehlender Key deaktiviert nur diesen Provider.
- **Provider-Fallback (Server):** bei Provider-Exhaustion (`free_quota_exceeded`, `quota_exhausted`, `insufficient_credits`, `limit_reached`) versucht der Router sequenziell den nächsten enabled Provider mit dessen eigenem eligible Model — begrenzt durch Anzahl der Provider und `MODEL_FALLBACK_MAX_ATTEMPTS`, keine parallelen Requests, keine Endlosschleife. Model-Level-Fehler (z. B. `model_unavailable`) werden weiterhin an den Client-Fallback durchgereicht.
- **Katalog-Aggregation:** `/api/models` liefert jetzt `models[]` mit `provider: { id, name }` (dedupliziert nach Modell-ID, OpenRouter zuerst) plus `providers[]`; `/api/usage` enthält zusätzlich die EdenAI-Counter (`mj-usage:ai:edenai:*`) und Limits.
- **Usage-Counter generisch:** `countAiRequest/Failure/Attempt(provider)` und `aiLimitReached(provider)` in `usage.mjs`; OpenRouter mappt auf die bisherigen Keys (`mj-usage:openrouter:*`, Semantik unverändert).
- **Frontend:** `ModelOption.provider` + `providers[]` in `types.ts`, „Provider · Modellname“-Anzeige im `ModelSelector` (`modelDisplayName`), `quota_exhausted`/`authentication_failed` als NON_TRANSIENT, `isFreeQuotaExceeded` erkennt auch `quota_exhausted`.
- **Config:** `OPENROUTER_ENABLED`/`EDENAI_ENABLED`, `EDENAI_API_KEY`/`EDENAI_DEV_API_KEY`, `EDENAI_ENV`, `EDENAI_MODEL`, `EDENAI_MONTHLY_MAX_REQUESTS=200`, `EDENAI_MONTHLY_SOFT_LIMIT_USD=1.00` (Platzhalter in `.env.example`).
- **Tests:** `tests/api/providers.test.mjs` (Router: Katalog-Aggregation/Dedup, Provider-Zuordnung, Provider-Fallback bei Quota, Durchreichen von `model_unavailable`, `limit_reached`, `missing_key`) und `tests/api/edenai-provider.test.mjs` (Key-Auswahl, Pricing-basierte Free-Eligibility, Fallback-Präferenz, Chat-Request, `response_format` nur bei strukturierten Modellen, 401/402/429/5xx-Mapping). Alle bestehenden Tests bleiben grün (69 gesamt).
- **Docs:** neue `docs/AI_PROVIDERS.md`; ARCHITECTURE, COMPONENT_GUIDE, DEPLOYMENT, README und CHANGELOG aktualisiert.
