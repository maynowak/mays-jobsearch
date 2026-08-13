# Architecture

# My Job Matcher

## Overview

The project is a static frontend plus serverless functions on Vercel.

No framework, no build step, no npm dependencies.

```
Browser (index.html + app.js)
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

- `index.html` — single page: hero, search form, alert form, results list, letter modal.
- `styles.css` — design tokens, layout, cards, modal, alerts.
- `app.js` — form handling, API calls, result rendering, modal logic, alert subscription.

Flow:

1. User submits the search form.
2. `app.js` calls `GET /api/jobs?skills=&targetRole=&city=`.
3. `app.js` calls `POST /api/match` with the profile + filtered jobs.
4. Matches render as ranked cards.
5. "Bewerbung generieren" calls `POST /api/cover-letter` and shows the letter in a modal.

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
