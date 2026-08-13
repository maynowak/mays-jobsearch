# Architecture

# My Job Matcher

## Overview

The project is a React + TypeScript + Vite frontend plus serverless functions on Vercel.

```
Browser (src/ React app)
        │
        │ fetch (same origin)
        ▼
Vercel Functions (api/*.mjs)
        │
        ├── Arbeitnow Job Board API  (GET /api/jobs)
        ├── OpenRouter Chat API      (POST /api/match, /api/cover-letter)
        ├── Upstash Redis REST       (POST/DELETE /api/alerts)
        └── Resend API               (POST /api/cron/digest)
```

## Frontend

- `src/main.tsx` — React entry, mounts `App`.
- `src/App.tsx` — root component and central state: phase, status, matches, profile, letter modal.
- `src/api.ts` — typed fetch wrappers for all endpoints.
- `src/types.ts` — shared TypeScript contracts (`Job`, `Profile`, `Match`, …).
- `src/styles.css` — design tokens and global styles.

Flow:

1. User submits the search form (`SearchForm`).
2. `App` calls `fetchJobs` (`GET /api/jobs?skills=&targetRole=&city=`).
3. `App` calls `fetchMatches` (`POST /api/match`) with the profile + filtered jobs.
4. `Results` renders `MatchCard`s.
5. "Bewerbung generieren" opens `LetterModal`, which calls `generateCoverLetter` (`POST /api/cover-letter`) and shows the letter with copy/download.

## State model (`App.tsx`)

- `phase`: `idle | searching | scoring` → drives the button label and spinner.
- `status`: `StatusMessage | null` → rendered by `Status`.
- `matches`: `Match[]` → rendered by `Results`.
- `profile`: last submitted `Profile` → reused by alerts and cover letters.
- `letterJob`: `{ job, prepare } | null` → modal open state.

## Serverless functions

### `api/_lib/filter.mjs`

Shared logic:

- `fetchArbeitnow()` — fetches one page (176 jobs) from the Arbeitnow API with friendly error mapping.
- `fetchFilteredJobs({ skills, targetRole, city })` — filters by location (multi-city or remote) and keyword hits (title + tags + description), ranks by hits, caps at 40 jobs.
- `HttpError` — error class carrying `status`, `code`, and a human-readable message.

### `api/_lib/model.mjs`

- `getOpenRouterModel()` — returns `OPENROUTER_MODEL` env or the default `openai/gpt-4o-mini`.

### `api/_lib/ai.mjs`

- `chat(...)` — one shared OpenRouter call with consistent error mapping (401 / 402 / 429 / network / malformed).
- `requireOpenRouterKey()` — friendly error if the key is missing.

### `api/_lib/alerts.mjs`

- Upstash Redis REST storage for subscriptions (`HGETALL`, `HSET`, `HDEL`).

### Endpoints

| Route | Method | Purpose |
|---|---|---|
| `/api/jobs` | GET | Filtered jobs from Arbeitnow |
| `/api/match` | POST | AI-scored top 5 matches |
| `/api/cover-letter` | POST | AI cover letter for one job |
| `/api/model` | GET | Model currently in use |
| `/api/alerts` | POST / DELETE / GET | Manage digest subscriptions |
| `/api/cron/digest` | POST | Daily email digest (cron protected) |

## Data contracts

### `/api/jobs` → `{ jobs, meta }`

`jobs[]` is a compact shape:

```
{ slug, title, company_name, location[], remote, tags[], url, created_at }
```

### `/api/match` → `{ matches, meta }`

`matches[]`:

```
{ score, why, prepare, job }
```

`job` is the compact job shape (or `null` if the AI referenced an unknown slug).

### `/api/cover-letter` → `{ letter, meta }`

### `/api/alerts` → `{ ok, message }`

### `/api/cron/digest` → `{ ok, checked, sent, skipped, errors[] }`

## Configuration

All configuration arrives as environment variables (see `docs/DEPLOYMENT.md`).

## Cron

`vercel.json` schedules `/api/cron/digest` daily at 07:00 UTC.

The endpoint checks the `Authorization: Bearer <CRON_SECRET>` header (or `x-vercel-cron`).
