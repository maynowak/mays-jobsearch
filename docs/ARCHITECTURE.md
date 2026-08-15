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
- L2 key: `apify-dataset:<query>|<location>` — Apify Dataset reuse metadata `{ datasetId, createdAt }`, TTL 24 h; freshness window **24 hours** (`APIFY_DATASET_MAX_AGE_SEC` / `APIFY_DATASET_MAX_AGE_MS`).

Behavior:

1. First search (Redis miss, no usable dataset) → start an Apify Actor run → dataset created → `datasetId` retained in Redis → records read → L1 populated.
2. Repeated search within 10 minutes → L1 Redis hit → no dataset read, no Actor run.
3. After L1 expiry but within the dataset age window → Redis miss → existing Apify dataset is reused → no new Actor run.
4. Dataset no longer available (read returns `404` / `410`) → cache entry removed → new Actor run.

Cost policy:

- Only `404` / `410` (dataset truly gone) triggers a refresh.
- Transient errors (`429`, other 5xx, network, parse) **keep** the existing `datasetId` and return an empty result instead of discarding the dataset. The point is to avoid unnecessary paid Actor runs — dataset reuse avoids new Actor compute (dataset reads are the low-cost path).

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

## Redis (Upstash)

Redis serves multiple, distinct purposes with different TTLs — do not treat them as one cache:

| Purpose | Key pattern | Retention |
|---|---|---|
| Apify job-record cache (L1) | `apify-jobs:<query>\|<location>` | Redis TTL 600 s (10 min) |
| Apify dataset reuse metadata (L2) | `apify-dataset:<query>\|<location>` | Redis TTL 24 h; application freshness window 24 h |
| CV profile cache | `cv-profile:<hash>` | Redis TTL 30 days |
| Alert subscriptions | `alerts` (hash) | persistent (no TTL) |

Clearly distinguish:

- **Redis TTL** — how long the value stays in Redis (`SETEX`).
- **Apify dataset age** — application freshness check against `dataset.createdAt` (24 h).
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

### `api/_lib/cache.mjs`

- Upstash Redis REST helpers: `cacheGet`, `cacheSet` (`SETEX`, default TTL 600 s), `cacheDel`.

### `api/_lib/apify.mjs`

- Apify Arbeitsagentur source: async run + polling, dataset read, two-layer cache, 404/410-only refresh policy.

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

### `/api/models` → `{ models[], defaultModel, fallbackModel, recommendedModel }`

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
