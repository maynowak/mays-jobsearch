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

Free AI models are discovered dynamically from provider metadata instead of being hardcoded. The app supports multiple AI providers behind a single provider router:

- `api/_lib/providers/index.mjs` is the **provider router**: it owns `chat()`, aggregates the free-model catalogue across providers, resolves which provider owns a given model ID, and performs provider-level fallback.
- `api/_lib/providers/openrouter.mjs` — the OpenRouter provider (catalogue from `https://openrouter.ai/api/v1/models`, chat via `https://openrouter.ai/api/v1/chat/completions`).
- `api/_lib/providers/edenai.mjs` — the EdenAI provider (V3 OpenAI-compatible catalogue `https://api.edenai.run/v3/models` and chat `https://api.edenai.run/v3/chat/completions`).
- `api/_lib/ai.mjs` and `api/_lib/models.mjs` are thin facades re-exporting the router for backward compatibility.
- Each provider keeps an in-memory catalogue cache (10 min) and exposes the same interface: `enabled()`, `getModels()`, `ownsModel(id)`, `getEligibleModel(preferred)`, `getDefaultModel()`, `chat()`, `limitReached()`, `countRequest/countFailure/countAttempt`.

Eligibility rules:

- **OpenRouter:** a model is eligible if its pricing is free (`prompt`, `completion`, `request` all `"0"`), it supports text input and text output modalities, and it is not expired.
- **EdenAI:** a model is eligible if its catalogue `pricing` is zero-cost (`input_cost_per_token` and `output_cost_per_token` are `"0"` — no name-based heuristic), it supports text input and text output, and the output modalities do not include audio.
- There is no hardcoded provider/model blacklist. Structured-output support is tracked per model (`structured` flag) but **not** required for eligibility.

Provider resolution and fallback:

- `/api/models` aggregates the eligible free models of all **enabled** providers and deduplicates by model ID (OpenRouter first). Each entry carries `provider: { id, name }`; the response also contains a `providers[]` array.
- When a request sends a `model`, the router resolves the owning provider via catalogue membership (`ownsModel`). If no provider owns the ID, the request is rejected with `model_not_free`.
- **Provider-level fallback:** if the primary provider reports a provider-exhausted error (`free_quota_exceeded`, `quota_exhausted`, `insufficient_credits`, `limit_reached`), the router retries the same operation on the next enabled provider with that provider's own eligible model. The number of attempts is bounded by the number of enabled providers (no infinite loop) and capped at `MODEL_FALLBACK_MAX_ATTEMPTS`. There are **no parallel** AI requests.
- Model-level errors (`model_unavailable`, timeout, network, bad response) are **not** treated as provider exhaustion — they propagate so the client's `withModelFallback` can retry with another model ID. Only provider-exhaustion categories switch the provider.

Normalized error codes (`api/_lib/providers/errors.mjs`): `model_unavailable`, `quota_exhausted`, `free_quota_exceeded`, `rate_limited`, `timeout`, `network_error`, `authentication_failed`, `model_invalid`, `bad_request`, `bad_ai_response`, `key_invalid`, `insufficient_credits`, `limit_reached`, `missing_key`, `models_unavailable`, `model_not_free`. The existing frontend codes are preserved unchanged.

- `api/_lib/model.mjs` resolves the configured defaults (`OPENROUTER_MODEL` / `EDENAI_MODEL` env, falling back to default constants) — the recommended model is always resolved dynamically against the current free catalogue and may change.
- `api/models.mjs` exposes `GET /api/models` → `{ models, providers, defaultModel, fallbackModel, recommendedModel, fallbackMaxAttempts }`.
- `api/model.mjs` exposes `GET /api/model` → `{ model }` (resolved default).

Frontend behavior:

- The `ModelSelector` shows a recommended-model section plus the other free models.
- While a search/scoring is running, the selector is disabled (locked) so the model cannot be changed mid-flight; it re-enables once the search completes.
- The user can select any available free model; the selection is passed to `/api/match`, `/api/profile` and `/api/cover-letter`.
- The selector is a custom accessible listbox (ARIA combobox/listbox semantics, keyboard navigation, type-ahead, outside-click close).
- The popover flips upward automatically when there is not enough space below the trigger.
- The model ID is not presented as a large technical UI element — the friendly model name is shown.
- Automatic fallback (`withModelFallback` in `src/api.ts`): if the selected model fails with `model_unavailable`, the same operation is retried with up to two other eligible free models (deterministic order: selected → recommended → remaining catalogue order). The attempt cap defaults to 3 and is configurable via `MODEL_FALLBACK_MAX_ATTEMPTS`, which `/api/models` exposes as `fallbackMaxAttempts` (no source edit needed). A subtle notice is shown when a fallback was used; the user's selection is never permanently changed. Applies to `/api/profile`, `/api/match` and `/api/cover-letter`. The catalogue's presence of a model only means "currently eligible per metadata" — availability is discovered at runtime.
- The model selector displays "Provider · Model name" (e.g. "OpenRouter · GPT-OSS 20B" / "EdenAI · Gemma") so users can see which provider a model belongs to.

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

The combined job pool comes from a **modular Job Source Registry** (`api/_lib/sources/`) with pluggable sources:

1. **Arbeitnow** (`api/_lib/sources/arbeitnow.mjs`, source id `"arbeitnow"`, provider `"direct-api"`) — public API, no key; one page ≈ 176 jobs; filtered by location + keyword hits, capped at 40 jobs.
2. **Arbeitsagentur** via Apify Actor (`api/_lib/sources/apify/actors.mjs`, source id `"arbeitsagentur"`, provider `"apify"`, actor `blackfalcondata~arbeitsagentur-jobs-feed`) — the German Arbeitsagentur feed; requires `APIFY_API_TOKEN`; capped at 40 jobs.

The registry (`api/_lib/sources/index.mjs`) fetches all **enabled** sources in parallel (`Promise.allSettled`), merges them, and returns a combined pool:

- Source metadata is preserved per job (`job.source: ["arbeitnow" | "arbeitsagentur", …]`) and exposed to the frontend; recommendation cards show their source (e.g. "Arbeitnow" / "Arbeitsagentur").
- Cross-source deduplication is active: jobs matching on `title | company | location` are merged and their sources combined.
- Each source can be **enabled/disabled** independently via env vars (`JOB_SOURCE_ARBEITNOW_ENABLED`, `JOB_SOURCE_ARBEITSAGENTUR_ENABLED`). Disabled sources produce no requests, no cost, no jobs. Other sources keep working. If all disabled → clean empty state.
- `api/_lib/jobs.mjs` is now a thin facade re-exporting `fetchAllJobs` from the registry.

## Apify cache architecture

The Apify source uses a two-layer cache to avoid unnecessary paid Actor runs.

Key concept: the cache keys are built from the normalized **query + location**, **scoped by source id** to avoid collisions between multiple Actors:

- L1 key: `job-source:<sourceId>:<query>|<location>` — Redis job-record cache, TTL **600 seconds (10 min)** (`APIFY_CACHE_TTL_SEC`).
- L2 key: `job-source:<sourceId>:dataset:<query>|<location>` — Apify Dataset reuse metadata `{ datasetId, createdAt }`; the application freshness window is **time-of-day aware** (see below).

The cache keys include the source id (e.g. `job-source:arbeitsagentur:...`) so multiple Actors can coexist without key collisions. Existing keys (`apify-jobs:...`, `apify-dataset:...`) are no longer written; on first deploy after this change a one-time cache miss is expected (harmless).

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

Separately, the sidebar shows the delivered-job counts per source (`.job-sources` / `JobSources`): it counts the `source[]` arrays of the actual delivered jobs, lists only sources with a count > 0, and shows a total. This is purely computed on the frontend from the delivered `foundJobs` — it is **not** taken from `/api/jobs` `meta.sources` and makes no additional request.

## Cost guard & usage

The app keeps its own monthly usage counters (Upstash Redis, month-scoped keys `mj-usage:<name>:<YYYY-MM>`) and a read-only diagnostics endpoint `GET /api/usage`.

### Central configuration (`api/_lib/config.mjs`)

All tunables are environment variables with safe defaults (see `docs/DEPLOYMENT.md`). `getConfig()` reads the env on every call, so values can be changed on Vercel without touching source code:

| Config | Env var | Default |
|---|---|---|
| OpenRouter advisory spend limit (USD) | `OPENROUTER_MONTHLY_SOFT_LIMIT_USD` | 0.80 |
| EdenAI advisory spend limit (USD) | `EDENAI_MONTHLY_SOFT_LIMIT_USD` | 1.00 |
| Apify advisory spend limit (USD) | `APIFY_MONTHLY_SOFT_LIMIT_USD` | 4.00 |
| Max AI fallback attempts | `MODEL_FALLBACK_MAX_ATTEMPTS` | 3 |
| OpenRouter provider enabled | `OPENROUTER_ENABLED` | true |
| EdenAI provider enabled | `EDENAI_ENABLED` | true |
| Apify dataset reuse window, peak hours | `APIFY_DATASET_REFRESH_PEAK_HOURS` | 6 |
| Apify dataset reuse window, off-peak hours | `APIFY_DATASET_REFRESH_OFFPEAK_HOURS` | 12 |
| Apify peak window IANA timezone | `APIFY_DATASET_REFRESH_TIMEZONE` | `Europe/Berlin` |
| Apify peak window start | `APIFY_DATASET_REFRESH_PEAK_START` | `08:00` |
| Apify peak window end | `APIFY_DATASET_REFRESH_PEAK_END` | `18:00` |
| AI request-count backstop | `OPENROUTER_MONTHLY_MAX_REQUESTS` | 1000 |
| EdenAI request-count backstop | `EDENAI_MONTHLY_MAX_REQUESTS` | 200 |
| Apify run-count backstop | `APIFY_MONTHLY_MAX_RUNS` | 30 |
| Diagnostics token for `GET /api/usage` | `USAGE_DIAGNOSTICS_TOKEN` | unset → endpoint disabled |

### Counters (`api/_lib/usage.mjs`)

- Per AI provider (`openrouter`, `edenai`): `requests`, `failures`, `fallbackAttempts` (from the client's `x-mj-attempt` header, attempt > 1), plus a per-model hash. OpenRouter keeps its existing Redis keys (`mj-usage:openrouter:*`); EdenAI uses `mj-usage:ai:edenai:*`.
- Apify (global legacy counters, kept for backward compat): `runs`, `datasetReuses`, `cacheHits`, `cacheMisses`.
- **Per job source** (`api/_lib/sources/`): each registered source gets its own `requests` counter; Apify-based sources additionally get `runs`, `datasetReuses`, `cacheHits`, `cacheMisses`. Keys: `mj-usage:jobs:<sourceId>:<counter>`. The `/api/usage` snapshot includes a `jobSources` object with these per-source counters.

Counters are incremented with atomic Redis `INCR` / `HINCRBY` (helpers in `api/_lib/cache.mjs`); TTL is set only on first write.

### What the guards do (and do not)

- These are **application-side counters, not provider billing**. The OpenRouter and Apify dashboards remain authoritative for real spend.
- The `*_SOFT_LIMIT_USD` values are advisory operator thresholds surfaced in `/api/usage`; the app does **not** block on them (it cannot derive exact spend from its own counters).
- **AI providers (per provider):** before each AI call, the provider's `limitReached()` checks the monthly request count. At the backstop it throws `503 limit_reached` (fail fast — no provider call, no counter increment). If one provider is at its backstop, the router continues with the next enabled provider; only when all enabled providers are at their backstop does the request fail. The client's `withModelFallback` stays bounded by `MODEL_FALLBACK_MAX_ATTEMPTS`, which the server exposes via `/api/models` (`fallbackMaxAttempts`).
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
  "edenai": { "requestCount": 0, "failureCount": 0, "fallbackAttempts": 0, "byModel": {} },
  "apify": { "actorRuns": 1, "datasetReuses": 0, "cacheHits": 0, "cacheMisses": 1 },
  "jobSources": {
    "arbeitnow": { "requests": 5 },
    "arbeitsagentur": { "requests": 3, "runs": 1, "datasetReuses": 0, "cacheHits": 2, "cacheMisses": 1 }
  },
  "limits": { "openRouterMonthlySoftLimitUsd": 0.8, "edenaiMonthlySoftLimitUsd": 1.0, "apifyMonthlySoftLimitUsd": 4.0,
               "openRouterMonthlyMaxRequests": 1000, "edenaiMonthlyMaxRequests": 200, "apifyMonthlyMaxRuns": 30,
               "modelFallbackMaxAttempts": 3,
               "apifyDatasetRefreshPeakHours": 6, "apifyDatasetRefreshOffpeakHours": 12,
               "apifyDatasetRefreshTimezone": "Europe/Berlin",
               "apifyDatasetRefreshPeakStart": "08:00", "apifyDatasetRefreshPeakEnd": "18:00" },
  "notes": { "openRouter": "...", "edenai": "...", "apify": "...", "limits": "..." } }
```

## Redis (Upstash)

Redis serves multiple, distinct purposes with different TTLs — do not treat them as one cache:

| Purpose | Key pattern | Retention |
|---|---|---|
| Apify job-record cache (L1) | `job-source:<sourceId>:<query>\|<location>` | Redis TTL 600 s (10 min) |
| Apify dataset reuse metadata (L2) | `job-source:<sourceId>:dataset:<query>\|<location>` | Redis TTL + application freshness window: peak 6 h / off-peak 12 h (configurable, timezone-aware via `Europe/Berlin`) |
| CV profile cache | `cv-profile:<hash>` | Redis TTL 30 days |
| Alert subscriptions | `alerts` (hash) | persistent (no TTL) |
| Usage counters (monthly) | `mj-usage:<name>:<YYYY-MM>` (+ `mj-usage:openrouter:model:<YYYY-MM>` and `mj-usage:ai:edenai:model:<YYYY-MM>` hashes) | Redis TTL 62 days; month-scoped, reset by month rollover |
| Job source usage (monthly) | `mj-usage:jobs:<sourceId>:<counter>:<YYYY-MM>` | Redis TTL 62 days; month-scoped |

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

Shared job logic (generic utilities, no source-specific code):

- `tokenize(input)` / `stripHtml(html)` / `locationMatches(job, cityQueries)` / `keywordHits(job, keywordTokens)` — used by all job sources.
- `HttpError` — error class carrying `status`, `code`, and a human-readable message.
- `fetchFilteredJobs` moved to `api/_lib/sources/arbeitnow.mjs` (Arbeitnow source). The legacy `fetchArbeitnow` is also there for backwards compatibility.

### `api/_lib/providers/index.mjs`

Provider router:

- `enabledProviders()` / `allProvidersInfo()` — which providers are configured and enabled.
- `providerForModel(model)` — resolves the owning provider via catalogue membership (OpenRouter first for deduplicated IDs).
- `chat(...)` — picks the primary provider (owning provider of the requested model, or the first enabled provider), then performs bounded **provider-level fallback** on provider-exhausted errors (`free_quota_exceeded`, `quota_exhausted`, `insufficient_credits`, `limit_reached`) using each next provider's eligible model. Model-level errors propagate unchanged. Cost guard per provider: `limitReached()` → `503 limit_reached` before the call; counts requests/failures/attempts per provider.
- `getFreeModels()` / `assertFreeModel(id)` / `getCompatibleFallback(preferred)` / `resolveDefaultModel()` — aggregated across providers, deduplicated by model ID (OpenRouter first), each model tagged with `provider: { id, name }`.
- `isFreeDailyQuotaError(text)` — forwarded from the OpenRouter provider.

### `api/_lib/providers/errors.mjs`

- `AiError` (extends `HttpError`) with a `category` (`model` / `provider` / `client`) plus the normalized `ERROR_CODES`.
- `isProviderExhausted(err)` — true only for the provider-exhaustion codes that trigger provider fallback.

### `api/_lib/providers/openrouter.mjs`

- OpenRouter provider: catalogue fetch + free eligibility (pricing free, text in/out, not expired), cached 10 min in-memory.
- `chat(...)` with consistent error mapping (401 → `key_invalid`, 402 → `insufficient_credits`, 429 with `free-models-per-day` → `free_quota_exceeded`, other 429 → `model_unavailable`, timeout → `timeout` (504), network → `network_error` (502)).
- Cost guard + per-provider usage counters (requests, failures, fallback attempts, per-model hash).

### `api/_lib/providers/edenai.mjs`

- EdenAI provider: V3 OpenAI-compatible catalogue (`/v3/models`, public) + chat (`/v3/chat/completions`).
- Free eligibility via zero-cost `pricing` metadata (no name heuristic); structured output via `capabilities.supports_response_schema`. Reasoning models (`capabilities.supports_reasoning`) are ranked last for the fallback/default choice: their internal thinking can exhaust the token budget before any usable content is produced, so non-reasoning free models are preferred for reliability.
- Key selection: `EDENAI_ENV` overrides the mode, otherwise `VERCEL_ENV === "production"` → `EDENAI_API_KEY`, else `EDENAI_DEV_API_KEY` preferred (sandbox, simulated responses, no cost). Missing keys only disable this provider.
- Error mapping: 401/403 → `key_invalid`, 402 → `insufficient_credits`, 429 → `quota_exhausted` (quota hint) or `rate_limited`, 400/422 → `model_invalid` (model hint) or `bad_request`, timeout → `timeout` (504), network → `network_error` (502), other 5xx → `model_unavailable`.

### `api/_lib/ai.mjs`

Facade that re-exports `chat(...)` and `isFreeDailyQuotaError(...)` from the provider router. All endpoints import from here; tests mock this module.

### `api/_lib/models.mjs`

Facade that re-exports `getFreeModels`, `assertFreeModel`, `getCompatibleFallback`, `resolveDefaultModel` from the provider router.

### `api/_lib/model.mjs`

- `getOpenRouterModel()` — `OPENROUTER_MODEL` env or a default model constant.
- `getEdenaiModel()` — `EDENAI_MODEL` env or a default EdenAI constant.

### `api/_lib/cache.mjs`

- Upstash Redis REST helpers: `cacheGet`, `cacheSet` (`SETEX`, default TTL 600 s), `cacheDel`, plus counter primitives `cacheIncr`, `cacheHIncrBy`, `cacheHGetAll`.

### `api/_lib/sources/index.mjs`

Job Source Registry (router):

- `SOURCES` — ordered list of all registered sources (Arbeitnow + Apify actors).
- `enabledSources()` / `disabledSources()` / `sourceDetails()` — registry queries.
- `fetchAllJobs({ skills, targetRole, city })` — parallel fetch of enabled sources, cross-source dedup, combined meta (`sources`, `sourceCounts`, `disabledSources`, `sourceDetails`, `jobsCombined`, `apify`).
- `jobKey(job)` / `dedupJobs(jobs)` — cross-source deduplication by `title | company | location`.

### `api/_lib/sources/arbeitnow.mjs`

Arbeitnow source module (`id: "arbeitnow"`, `provider: "direct-api"`, `critical: true`):

- `fetchJobs(params)` — fetches, filters, normalizes Arbeitnow jobs; source label `"arbeitnow"`.
- `fetchFilteredJobs` — legacy export for cron digest compatibility.
- Throws `HttpError` on failure (critical source → propagates to caller).

### `api/_lib/sources/apify/index.mjs`

Generic Apify infrastructure (shared by all Apify actors):

- `fetchActorJobs(actor, params)` — full L1/L2 cache flow, dataset reuse, time-of-day refresh, 404/410-only refresh, cost guard (`apifyRunLimitReached`).
- `createApifySource(actor)` — factory producing a JobSource from an actor config.
- Cache keys: `job-source:<sourceId>:<query>|<location>` (L1), `job-source:<sourceId>:dataset:<query>|<location>` (L2).
- Usage counters per source: `countJobSourceRun`, `countJobSourceDatasetReuse`, `countJobSourceCacheHit`, `countJobSourceCacheMiss` (plus global legacy counters for backward compat).

### `api/_lib/sources/apify/actors.mjs`

Apify Actor Registry (config-driven, no code changes to add actors):

- `APIFY_ACTORS` array — each entry: `sourceId`, `displayName`, `actorId`, `enabled()`, `maxJobs`, `buildInput()`, `normalize()`.
- Currently one actor: `"arbeitsagentur"` → `blackfalcondata~arbeitsagentur-jobs-feed`.
- Adding a new actor = add one config object to this array.

### `api/_lib/sources/apify/client.mjs`

Low-level Apify API client: `startApifyRun`, `waitForRun`, `readDataset`.

### `api/_lib/config.mjs`

- `getConfig()` — central env configuration with safe defaults (see Cost guard & usage).
- `isPeakTime(date)` / `datasetRefreshHours(date)` / `datasetRefreshMs(date)` — time-of-day Apify refresh policy. The peak window and timezone are configurable (`APIFY_DATASET_REFRESH_TIMEZONE`, `APIFY_DATASET_REFRESH_PEAK_START`/`_END`, default `Europe/Berlin` 08:00–18:00); wall-clock time is resolved via `Intl.DateTimeFormat`, so DST is handled automatically.

### `api/_lib/usage.mjs`

- Monthly Redis usage counters (AI providers + Apify), generic `aiLimitReached(provider)` / `countAiRequest|Failure|Attempt(provider)` (OpenRouter maps onto the legacy `mj-usage:openrouter:*` keys, EdenAI onto `mj-usage:ai:edenai:*`), the Apify guard (`apifyRunLimitReached`), and `getUsageSnapshot()` for `/api/usage`.

### `api/_lib/jobs.mjs`

- Thin facade re-exporting `fetchAllJobs`, `jobKey`, `dedupJobs` from `api/_lib/sources/index.mjs`.

### `api/_lib/alerts.mjs`

- Upstash Redis REST storage for subscriptions (`HGETALL`, `HSET`, `HDEL`).

### Endpoints

| Route | Method | Purpose |
|---|---|---|
| `/api/jobs` | GET | Combined, filtered jobs from all enabled job sources |
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

`meta`: `{ totalScanned, totalFiltered, city[], keywords[], sources, sourceCounts, disabledSources, sourceDetails, jobsCombined, apify: { enabled, reason } }`.

- `sources` — per-source job counts from the source fetch (pre-dedup).
- `sourceCounts` — per-source job counts from the final deduped pool (post-dedup, derived from `job.source[]`).
- `disabledSources` — array of registered source ids that are currently disabled.
- `sourceDetails` — array of `{ id, displayName, provider, enabled, actorId? }` for all registered sources.
- `apify` — legacy field for the Arbeitsagentur source (`enabled`, `reason`); retained for backward compatibility.

### `/api/profile` → `SuggestedProfile`

```
{ skills[], experienceLevel, targetRoles[], location }
```

(returns the cached profile on hash hit).

### `/api/models` → `{ models[], providers[], defaultModel, fallbackModel, recommendedModel, fallbackMaxAttempts }`

- `models[]`: `{ id, name, provider: { id, name } }` — aggregated across enabled providers, deduplicated by ID (OpenRouter first).
- `providers[]`: `{ id, name, enabled, configured }` — provider status.
- `fallbackMaxAttempts` mirrors `MODEL_FALLBACK_MAX_ATTEMPTS` (default 3) and configures the client's `withModelFallback` attempt cap without editing source code.

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
