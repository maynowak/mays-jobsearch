# Architecture

# My Job Matcher

## Overview

The project is a React + TypeScript + Vite frontend plus serverless functions on Vercel.

```
         USER
          │
  ┌───────┴────────┐
  │                │
Manual CV      CV Upload (PDF)
  │                │
  │          PDF.js browser (pdfjs-dist)
  │                │
  │          SHA-256 hash (crypto.subtle)
  │                │
  │        Profile Cache (L1 localStorage + L2 Redis)
  │                │
  │          /api/profile (only on cache miss → AI)
  │                │
  └────────┬───────┘
           │
      Search Profile (editable, user confirms)
           │
           ▼
     /api/jobs → Job Search
           │
  ┌────────┴──────────┐
  │                   │
Arbeitnow          Apify (Arbeitsagentur)
                      │
                Dataset L2 (24 h reuse)
                      │
                 Redis L1 (10 min)
  │                   │
  └────────┬──────────┘
           │
      Combined Pool (cross-source dedup)
           │
     keywordHits preselection
           │
      max 10 candidates
           │
      /api/match (AI evaluation)
           │
           ▼
      Ranked matches
           │
      Top 5 initially displayed
           │
     Expand locally (no second request)
```

The browser (`src/`) talks to Vercel Functions (`api/*.mjs`) on the same origin.

```
Browser (src/ React app)
        │
        │ fetch (same origin)
        ▼
Vercel Functions (api/*.mjs)
        │
        ├── Arbeitnow Job Board API          (GET /api/jobs)
        ├── Apify Actor (Arbeitsagentur)     (GET /api/jobs, async run + dataset)
        ├── OpenRouter Chat API              (POST /api/match, /api/profile,
        │                                     /api/cover-letter)
        ├── Upstash Redis REST               (caches + POST/DELETE/GET /api/alerts)
        └── Resend API                       (POST /api/cron/digest)
```

## Frontend

- `src/main.tsx` — React entry, mounts `App`.
- `src/App.tsx` — root component and central state: route, phase, status, matches, profile, letter modal, selected model.
- `src/api.ts` — typed fetch wrappers for all endpoints.
- `src/types.ts` — shared TypeScript contracts (`Job`, `Profile`, `Match`, `ModelsResponse`, …).
- `src/hooks/useAvailableModels.ts` — loads the free-model catalogue (`/api/models`, with a module-level cache and a `/api/model` fallback).
- `src/styles.css` — design tokens and global styles.

Flow:

1. The user either fills the manual search form (`SearchForm`) or uploads a CV (`CvUpload`).
2. For a CV upload, `CvUpload` extracts the text in the browser (PDF.js), hashes it, checks the profile cache, and only calls `/api/profile` on a cache miss.
3. `App` calls `fetchJobs` (`GET /api/jobs?skills=&targetRole=&city=`), which combines both job sources.
4. `App` calls `fetchMatches` (`POST /api/match`) with the profile + the combined jobs; the function evaluates at most 10 preselected candidates.
5. `Results` renders the top 5 `MatchCard`s initially; the user can expand locally to all evaluated matches (no second `/api/match` request).
6. "Bewerbung generieren" opens `LetterModal`, which calls `generateCoverLetter` (`POST /api/cover-letter`) and shows the letter with copy/download.

## Model selection

Free OpenRouter models are discovered dynamically from OpenRouter's model metadata instead of being hardcoded:

- `api/_lib/models.mjs` fetches the OpenRouter model catalogue (`https://openrouter.ai/api/v1/models`) and keeps an in-memory cache (10 min).
- A model is eligible if its pricing is free (`prompt`, `completion`, `request` all `"0"`), it supports text input and text output modalities, and it is not expired.
- There is no hardcoded provider/model blacklist, and structured-output support is tracked but **not** required for eligibility (some working free models do not advertise it).
- `api/_lib/model.mjs` resolves the configured default (`OPENROUTER_MODEL` env, falling back to a default model constant) — the recommended model is always resolved dynamically against the current free catalogue and may change.
- `api/models.mjs` exposes `GET /api/models` → `{ models, defaultModel, fallbackModel, recommendedModel }`.
- `api/model.mjs` exposes `GET /api/model` → `{ model }` (resolved default).

Frontend behavior:

- The `ModelSelector` shows a recommended-model section plus the other free models.
- The user can select any available free model; the selection is passed to `/api/match`, `/api/profile` and `/api/cover-letter`.
- The selector is a custom accessible listbox (ARIA combobox/listbox semantics, keyboard navigation, type-ahead, outside-click close).
- The popover flips upward automatically when there is not enough space below the trigger.
- The model ID is not presented as a large technical UI element — the friendly model name is shown.
- Automatic fallback (`withModelFallback` in `src/api.ts`): if the selected model fails with `model_unavailable`, the same operation is retried with up to two other eligible free models (deterministic order: selected → recommended → remaining catalogue order). The attempt cap defaults to 3 and is configurable via `MODEL_FALLBACK_MAX_ATTEMPTS`, which `/api/models` exposes as `fallbackMaxAttempts` (no source edit needed). A subtle notice is shown when a fallback was used; the user's selection is never permanently changed. Applies to `/api/profile`, `/api/match` and `/api/cover-letter`. The catalogue's presence of a model only means "currently eligible per metadata" — availability is discovered at runtime.

## CV upload + profile extraction

PDF → browser-side PDF.js → text extraction → normalized text → SHA-256 hash → profile cache lookup → (on miss) `/api/profile` → AI → structured editable search profile → user confirms/edits → matching flow.

- `src/lib/pdf.ts` extracts text with `pdfjs-dist` entirely in the browser. **The PDF is never uploaded as a file.**
- `src/components/CvUpload.tsx` normalizes the extracted text, computes a SHA-256 hash via `crypto.subtle`, and looks up the profile cache.
- Cache hit (local or server) → the stored profile is shown immediately, no AI call.
- Cache miss → `POST /api/profile` with `{ text, hash }` → `api/profile.mjs` runs the AI extraction (`chat` with a JSON shape contract) and returns a `SuggestedProfile` (`skills[]`, `experienceLevel`, `targetRoles[]`, `location`).
- The user edits/confirms the proposed profile (`EditableProfile`) before the search runs.

Privacy behavior:

- Raw CV text is never stored anywhere — only the hash and the derived structured profile are cached.
- The server never receives the PDF file, only the extracted text (which is used once and discarded).

### CV profile cache

Two layers, both keyed by the CV hash (`cv-profile:<hash>`):

- L1 — browser `localStorage` (`mj-cv-profile:<hash>`, TTL 30 days).
- L2 — Upstash Redis (`cv-profile:<hash>`, TTL 30 days), set by `api/profile.mjs` (`CV_PROFILE_CACHE_TTL_SEC = 30 * 24 * 60 * 60`).

The key contains only the hash; it does **not** include a prompt or model version. The cache avoids repeated paid AI profile parsing for identical CV content.

Observed verification (not guaranteed performance):

- Uncached AI request ≈ 11.7 s.
- Repeated request with the same CV (hash cache hit) ≈ 0.3 s.

## Job sources

The combined job pool comes from two sources, normalized into the same job model:

1. **Arbeitnow** (`api/_lib/filter.mjs`, source label `"existing"`) — public API, no key; one page ≈ 176 jobs; filtered by location + keyword hits, capped at 40 jobs.
2. **Apify Actor `blackfalcondata~arbeitsagentur-jobs-feed`** (`api/_lib/apify.mjs`, source label `"apify-arbeitsagentur"`) — the German Arbeitsagentur feed; requires `APIFY_API_TOKEN`; capped at 40 jobs.

`api/_lib/jobs.mjs` fetches both sources in parallel (`Promise.allSettled`) and merges them:

- Source metadata is preserved per job (`job.source: ["existing" | "apify-arbeitsagentur", …]`) and exposed to the frontend; recommendation cards show their source (e.g. "Arbeitnow" / "Arbeitsagentur").
- Cross-source deduplication is active: jobs matching on `title | company | location` are merged and their sources combined.
- If the Apify source is disabled or fails, the app keeps working with Arbeitnow only.

## Apify cache architecture

The Apify source uses a two-layer cache to avoid unnecessary paid Actor runs.

Key concept: the cache keys are built from the normalized **query + location**:

- L1 key: `apify-jobs:<query>|<location>` — Redis job-record cache, TTL **600 seconds (10 min)** (`APIFY_CACHE_TTL_SEC`).
- L2 key: `apify-dataset:<query>|<location>` — Apify Dataset reuse metadata `{ datasetId, createdAt }`; the application freshness window is **time-of-day aware** (see below).

Behavior:

1. First search (Redis miss, no usable dataset) → start an Apify Actor run → dataset created → `datasetId` retained in Redis → records read → L1 populated.
2. Repeated search within 10 minutes → L1 Redis hit → no dataset read, no Actor run.
3. After L1 expiry but within the dataset freshness window → Redis miss → existing Apify dataset is reused → no new Actor run.
4. Dataset no longer available (read returns `404` / `410`) → cache entry removed → new Actor run.

Cost policy:

- Only `404` / `410` (dataset truly gone) triggers a refresh.
- Transient errors (`429`, other 5xx, network, parse) **keep** the existing `datasetId` and return an empty result instead of discarding the dataset. The point is to avoid unnecessary paid Actor runs — dataset reuse avoids new Actor compute (dataset reads are the low-cost path).

### Time-of-day dataset refresh

The L2 dataset freshness window depends on the current time in a configurable **IANA timezone** (`api/_lib/config.mjs`):

- Peak window: `APIFY_DATASET_REFRESH_PEAK_START`–`APIFY_DATASET_REFRESH_PEAK_END`, default **08:00–18:00** in `APIFY_DATASET_REFRESH_TIMEZONE` (default **`Europe/Berlin`**) → reuse window `APIFY_DATASET_REFRESH_PEAK_HOURS` (default **6 h**) — fresher data during high-traffic time.
- Off-peak (outside that window) → reuse window `APIFY_DATASET_REFRESH_OFFPEAK_HOURS` (default **12 h**) — longer reuse, fewer paid runs.

The wall-clock time in the configured zone is computed with `Intl.DateTimeFormat` (`hourCycle: "h23"`), so summer/winter time (DST) is resolved automatically from the IANA timezone — no hardcoded UTC+1/UTC+2 offsets. `datasetRefreshHours(date)` / `datasetRefreshMs(date)` compute the window; `isPeakTime(date)` decides which one applies. The Redis TTL written for the dataset metadata matches the same window.

## Apify async run architecture

Important implementation detail: the Actor's synchronous run endpoint returned an **empty body** for this Actor, so the implementation uses:

1. `POST /v2/acts/{actorId}/runs` — start an asynchronous run.
2. Poll `GET /v2/actor-runs/{runId}` every 3 s until `SUCCEEDED` (fail on `FAILED` / `ABORTED` / `TIMED-OUT`; timeout after `APIFY_SYNC_TIMEOUT_SEC = 50`).
3. Read the resulting `defaultDatasetId` via `GET /v2/datasets/{id}/items`.

This is why the code uses async runs + polling rather than `run-sync`.

## Match pipeline

Problem: a large job pool cannot be sent entirely through the free AI model within the Vercel function timeout (`maxDuration: 60`). Measured behavior: ~52 jobs as a full set → timeout/504; ~10 candidates → successful response.

Current production strategy (`api/match.mjs`):

```
Combined job pool
  → keywordHits preselection (heuristic, keyword overlap)
  → max 10 candidates (MATCH_EVAL_LIMIT = 10)
  → AI evaluation (0–100, why + prepare)
  → sorted matches
  → frontend shows Top 5 initially
  → user expands locally to all evaluated matches
```

- The initial candidate selection is **heuristic/keyword-based**; the AI performs the deeper evaluation on the selected candidates. It does **not** evaluate all found jobs.
- The prompt passes only the compact candidate list (bounded input), requests at most the first 5 with full `why`/`prepare`, and caps output (`maxTokens: 2500`).
- Meta returned by `/api/match`: `totalFound` (pool size), `evaluated` (actually scored), `displayedInitially` (5).
- Expanding the list is purely local (`Results`); it never triggers a second `/api/match` request.

### Why K=10 (match cost / latency design)

The cap exists to bound:

- AI input size (compact jobs only),
- AI output size (`maxTokens` + only 5 detailed entries),
- Vercel execution time (fits within the function timeout),
- free-model instability/timeouts,
- unnecessary AI cost.

## Results UI / wording

The UI distinguishes three numbers honestly:

- **Found** — number of jobs returned by job-source filtering (`/api/jobs` meta `totalFiltered`).
- **Evaluated** — number of candidates actually sent through AI evaluation (`/api/match` meta `evaluated`).
- **Displayed** — number initially visible in the UI (`displayedInitially` = 5).

Example: "52 Jobs gefunden · 10 passende Kandidaten mit KI bewertet", then "Top 5 von 10", and after expansion "Alle 10 bewerteten Treffer".

## Cost guard & usage

The app keeps its own monthly usage counters (Upstash Redis, month-scoped keys `mj-usage:<name>:<YYYY-MM>`) and a read-only diagnostics endpoint `GET /api/usage`.

### Central configuration (`api/_lib/config.mjs`)

All tunables are environment variables with safe defaults (see `docs/DEPLOYMENT.md`). `getConfig()` reads the env on every call, so values can be changed on Vercel without touching source code:

| Config | Env var | Default |
|---|---|---|
| OpenRouter advisory spend limit (USD) | `OPENROUTER_MONTHLY_SOFT_LIMIT_USD` | 0.80 |
| Apify advisory spend limit (USD) | `APIFY_MONTHLY_SOFT_LIMIT_USD` | 4.00 |
| Max AI fallback attempts | `MODEL_FALLBACK_MAX_ATTEMPTS` | 3 |
| Apify dataset reuse window, peak hours | `APIFY_DATASET_REFRESH_PEAK_HOURS` | 6 |
| Apify dataset reuse window, off-peak hours | `APIFY_DATASET_REFRESH_OFFPEAK_HOURS` | 12 |
| Apify peak window IANA timezone | `APIFY_DATASET_REFRESH_TIMEZONE` | `Europe/Berlin` |
| Apify peak window start | `APIFY_DATASET_REFRESH_PEAK_START` | `08:00` |
| Apify peak window end | `APIFY_DATASET_REFRESH_PEAK_END` | `18:00` |
| AI request-count backstop | `OPENROUTER_MONTHLY_MAX_REQUESTS` | 1000 |
| Apify run-count backstop | `APIFY_MONTHLY_MAX_RUNS` | 30 |
| Diagnostics token for `GET /api/usage` | `USAGE_DIAGNOSTICS_TOKEN` | unset → endpoint disabled |

### Counters (`api/_lib/usage.mjs`)

- OpenRouter: `requests`, `failures`, `fallbackAttempts` (from the client's `x-mj-attempt` header, attempt > 1), plus a per-model hash.
- Apify: `runs`, `datasetReuses`, `cacheHits`, `cacheMisses`.

Counters are incremented with atomic Redis `INCR` / `HINCRBY` (helpers in `api/_lib/cache.mjs`); TTL is set only on first write.

### What the guards do (and do not)

- These are **application-side counters, not provider billing**. The OpenRouter and Apify dashboards remain authoritative for real spend.
- The `*_SOFT_LIMIT_USD` values are advisory operator thresholds surfaced in `/api/usage`; the app does **not** block on them (it cannot derive exact spend from its own counters).
- **OpenRouter:** before each AI call, `openRouterLimitReached()` checks the monthly request count. At the backstop it throws `503 limit_reached` (fail fast — no provider call, no counter increment). The client's `withModelFallback` stays bounded by `MODEL_FALLBACK_MAX_ATTEMPTS`, which the server exposes via `/api/models` (`fallbackMaxAttempts`).
- **Apify:** before starting a new Actor run, `apifyRunLimitReached()` checks the monthly run count. At the backstop, no new paid run is started and the source returns `emptyResult("limit_reached")` — cached and dataset-reused searches keep working; Arbeitnow is unaffected.
- A missing Redis connection degrades gracefully: `cacheCommand` returns `null`, so counters read as `0` and the guards never block.

### Diagnostics (`/api/usage`)

`GET /api/usage` is **protected**. It requires `USAGE_DIAGNOSTICS_TOKEN` (server-side secret) sent via the `x-usage-token` header or `Authorization: Bearer <token>`:

- Token not configured → endpoint disabled, HTTP **403** (secure default; no accidental public diagnostics endpoint).
- Wrong/missing token → HTTP **401**.
- Correct token → HTTP 200 with the snapshot from `getUsageSnapshot()`.

The token is compared with a constant-time string comparison, is never logged, never returned in a response, and never sent to the browser. The response itself contains **no secrets** (no API keys, no tokens, no Redis credentials). Example shape:

```json
{ "generatedAt": "...", "month": "2026-08",
  "openRouter": { "requestCount": 1, "failureCount": 0, "fallbackAttempts": 0, "byModel": { "openai/gpt-4o-mini": 1 } },
  "apify": { "actorRuns": 1, "datasetReuses": 0, "cacheHits": 0, "cacheMisses": 1 },
  "limits": { "openRouterMonthlySoftLimitUsd": 0.8, "apifyMonthlySoftLimitUsd": 4.0,
               "openRouterMonthlyMaxRequests": 1000, "apifyMonthlyMaxRuns": 30,
               "modelFallbackMaxAttempts": 3,
               "apifyDatasetRefreshPeakHours": 6, "apifyDatasetRefreshOffpeakHours": 12,
               "apifyDatasetRefreshTimezone": "Europe/Berlin",
               "apifyDatasetRefreshPeakStart": "08:00", "apifyDatasetRefreshPeakEnd": "18:00" },
  "notes": { "openRouter": "...", "apify": "...", "limits": "..." } }
```

## Redis (Upstash)

Redis serves multiple, distinct purposes with different TTLs — do not treat them as one cache:

| Purpose | Key pattern | Retention |
|---|---|---|
| Apify job-record cache (L1) | `apify-jobs:<query>\|<location>` | Redis TTL 600 s (10 min) |
| Apify dataset reuse metadata (L2) | `apify-dataset:<query>\|<location>` | Redis TTL + application freshness window: peak 6 h / off-peak 12 h (configurable, timezone-aware via `Europe/Berlin`) |
| CV profile cache | `cv-profile:<hash>` | Redis TTL 30 days |
| Alert subscriptions | `alerts` (hash) | persistent (no TTL) |
| Usage counters (monthly) | `mj-usage:<name>:<YYYY-MM>` (+ `mj-usage:openrouter:model:<YYYY-MM>` hash) | Redis TTL 62 days; month-scoped, reset by month rollover |

Clearly distinguish:

- **Redis TTL** — how long the value stays in Redis (`SETEX`).
- **Apify dataset age** — application freshness check against `dataset.createdAt` (time-of-day window).
- **Application refresh policy** — only `404`/`410` dataset reads trigger a new Actor run.

## State model (`App.tsx`)

- `route`: `landing | matcher` (determined by path).
- `phase`: `idle | searching | scoring` → drives the button label and spinner.
- `status`: `StatusMessage | null` → rendered by `Status`.
- `matches`: `Match[]` → rendered by `Results`.
- `profile`: last submitted `Profile` → reused by alerts and cover letters.
- `letterJob`: `{ job, prepare } | null` → modal open state.
- `modelsState` / `models` / `defaultModel` / `fallbackModel` / `recommendedModel` / `selectedModel` → model selection.

## Serverless functions

### `api/_lib/filter.mjs`

Shared job logic:

- `fetchArbeitnow()` — fetches one page (~176 jobs) from the Arbeitnow API with friendly error mapping.
- `fetchFilteredJobs({ skills, targetRole, city })` — filters by location (multi-city or remote) and keyword hits (title + tags + description), ranks by hits, caps at 40 jobs.
- `keywordHits(job, tokens)` / `locationMatches(job, cityQueries)` — shared by matching and the Apify filter.
- `HttpError` — error class carrying `status`, `code`, and a human-readable message.
- Source constants `SOURCE_ARBEITNOW` (`"existing"`) and `SOURCE_APIFY_ARBEITSAGENTUR` (`"apify-arbeitsagentur"`).

### `api/_lib/models.mjs`

- `getFreeModels()` — eligible free models from OpenRouter metadata (pricing free + text in/out + not expired), cached 10 min in-memory.
- `assertFreeModel(id)` — rejects model IDs not currently in the free catalogue.
- `getCompatibleFallback(preferred)` — prefers `:free` models, then structured-output support, then name.
- `resolveDefaultModel()` — fallback or configured default.

### `api/_lib/model.mjs`

- `getOpenRouterModel()` — `OPENROUTER_MODEL` env or a default model constant.

### `api/_lib/ai.mjs`

- `chat(...)` — one shared OpenRouter call with consistent error mapping (401 / 402 / 429 / network / malformed); resolves/validates a free model per request.
- Cost guard: checks `openRouterLimitReached()` before each call and throws `503 limit_reached` when the monthly request backstop is hit; increments the monthly request counter (and per-model hash), counts failures, and counts fallback attempts when `attempt > 1`.

### `api/_lib/cache.mjs`

- Upstash Redis REST helpers: `cacheGet`, `cacheSet` (`SETEX`, default TTL 600 s), `cacheDel`, plus counter primitives `cacheIncr`, `cacheHIncrBy`, `cacheHGetAll`.

### `api/_lib/apify.mjs`

- Apify Arbeitsagentur source: async run + polling, dataset read, two-layer cache, 404/410-only refresh policy.
- Time-of-day dataset freshness (`datasetRefreshMs`), usage counters (cache hit/miss, dataset reuse, Actor runs), and the `apifyRunLimitReached()` guard that stops new paid runs at the monthly run backstop.

### `api/_lib/config.mjs`

- `getConfig()` — central env configuration with safe defaults (see Cost guard & usage).
- `isPeakTime(date)` / `datasetRefreshHours(date)` / `datasetRefreshMs(date)` — time-of-day Apify refresh policy. The peak window and timezone are configurable (`APIFY_DATASET_REFRESH_TIMEZONE`, `APIFY_DATASET_REFRESH_PEAK_START`/`_END`, default `Europe/Berlin` 08:00–18:00); wall-clock time is resolved via `Intl.DateTimeFormat`, so DST is handled automatically.

### `api/_lib/usage.mjs`

- Monthly Redis usage counters (OpenRouter + Apify), guard checks (`openRouterLimitReached`, `apifyRunLimitReached`), and `getUsageSnapshot()` for `/api/usage`.

### `api/_lib/jobs.mjs`

- `fetchAllJobs(...)` — parallel fetch of both sources, cross-source dedup, combined meta (`sources`, `apify.enabled`/`reason`, `totalScanned`, `totalFiltered`).

### `api/_lib/alerts.mjs`

- Upstash Redis REST storage for subscriptions (`HGETALL`, `HSET`, `HDEL`).

### Endpoints

| Route | Method | Purpose |
|---|---|---|
| `/api/jobs` | GET | Combined, filtered jobs from Arbeitnow + Apify |
| `/api/profile` | POST | Extract structured search profile from CV text (cached by hash) |
| `/api/models` | GET | Free model catalogue + default/fallback/recommended |
| `/api/model` | GET | Resolved default model |
| `/api/match` | POST | AI scores max 10 preselected candidates; meta distinguishes found/evaluated/displayed |
| `/api/cover-letter` | POST | AI cover letter for one job |
| `/api/alerts` | POST / DELETE / GET | Manage digest subscriptions |
| `/api/cron/digest` | POST | Daily email digest (cron protected) |
| `/api/usage` | GET | Protected usage counters + configured limits (`USAGE_DIAGNOSTICS_TOKEN`; no secrets in the response) |

## Data contracts

### `/api/jobs` → `{ jobs, meta }`

`jobs[]` is a compact shape:

```
{ slug, title, company_name, location[], remote, tags[], url, created_at, source[] }
```

`meta`: `{ totalScanned, totalFiltered, city[], keywords[], sources, jobsCombined, apify: { enabled, reason } }`.

### `/api/profile` → `SuggestedProfile`

```
{ skills[], experienceLevel, targetRoles[], location }
```

(returns the cached profile on hash hit).

### `/api/models` → `{ models[], defaultModel, fallbackModel, recommendedModel, fallbackMaxAttempts }`

`fallbackMaxAttempts` mirrors `MODEL_FALLBACK_MAX_ATTEMPTS` (default 3) and configures the client's `withModelFallback` attempt cap without editing source code.

### `/api/match` → `{ matches[], meta }`

`matches[]`:

```
{ score, why, prepare, job }
```

`meta`: `{ evaluated, totalFound, displayedInitially, note? }`. `job` is the compact job shape (or `null` if the AI referenced an unknown slug).

### `/api/cover-letter` → `{ letter, meta }`

### `/api/alerts` → `{ ok, message }`

### `/api/cron/digest` → `{ ok, checked, sent, skipped, errors[] }`

## Configuration

All configuration arrives as environment variables (see `docs/DEPLOYMENT.md`).

## Cron

`vercel.json` schedules `/api/cron/digest` daily at 07:00 UTC.

The endpoint checks the `Authorization: Bearer <CRON_SECRET>` header (or `x-vercel-cron`).
