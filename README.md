# May's Job Matcher

A job search assistant that matches your profile (typed or extracted from a CV) against live job
openings and scores them 0–100 with free AI models — right in the browser.

- **Live Demo:** <https://mays-job-matcher.vercel.app>
- **Status:** live in production — core matching, AI cover letters and daily digest alerts implemented
- **Stack:** React + TypeScript + Vite · Node.js serverless functions (ESM) · Vercel Functions + Cron
- **AI:** free models via OpenRouter (primary) and EdenAI (optional second provider), dynamic model catalogue

---

## What it does

Find live jobs that actually fit you. You either upload a **CV (PDF)** or type your **skills**, **target role** and **city** (multiple cities allowed, e.g. `Berlin, München, Hamburg`), and the app:

1. **CV upload (optional):** the PDF is read in the browser (PDF.js), text-extracted and turned into an editable search profile by the AI (`/api/profile`). The profile is cached per CV hash, so repeated uploads of the same CV are instant. The PDF file itself is never sent to the server, and raw CV text is never stored.
2. **Model selection:** the app dynamically shows the currently available free AI models and preselects a recommended one. The user can switch to any other free model (`/api/models`). Models come from a provider router with **OpenRouter** as the primary provider and **EdenAI** as an optional second provider; when one provider reports a quota exhaustion the router automatically falls back to the other. During a running search/scoring the selector is locked so the chosen model cannot be changed mid-flight.
3. Fetches current openings from two sources — the free [Arbeitnow job API](https://www.arbeitnow.com/api/job-board-api) and the German Arbeitsagentur feed via an [Apify Actor](https://apify.com) (`blackfalcondata~arbeitsagentur-jobs-feed`) — and filters them by your keywords and cities (`/api/jobs`). The job pool is cached (Redis + Apify dataset reuse) to avoid unnecessary paid Apify runs. Once jobs are delivered, a small "Jobquellen" module directly below the search button shows the real per-source counts (e.g. "Arbeitnow 26 Stellen · Arbeitsagentur 40 Stellen"), computed dynamically from the delivered jobs and clearly separated from the AI model selector.
4. Sends the filtered pool + your profile to the AI provider (`/api/match`). To stay within the function timeout, the pool is narrowed to **max 10 candidates** by keyword hits, the AI scores those **0–100** and the **top 5** are shown with:
   - the score,
   - **two sentences on why** it fits you,
   - **one question** to prepare for the interview.
   The status line reports honestly how many were found vs. evaluated ("52 Jobs gefunden · 10 passende Kandidaten mit KI bewertet"); the list can be expanded locally without another AI request.
5. **AI-Bewerbungsgenerator:** on any match card, click "Bewerbung generieren" — the AI writes a personalized cover letter (with a suggested answer to the prep question) that you can copy or download (`/api/cover-letter`).
6. **Daily job alerts:** subscribe with your email to get a morning digest of new matches (`/api/alerts` + `/api/cron/digest`).

Your API keys (OpenRouter, Apify, Upstash, Resend) live **only** on the server — they are never exposed to the browser.

The app also tracks its own OpenRouter/Apify usage and can refuse new paid calls once an operator-configured monthly threshold is reached — see **Cost guard & usage** below.

## 🤖 Documentation

Project documentation lives in [`docs/`](docs/):

- [AGENTS.md](docs/AGENTS.md) — project overview, stack, coding rules
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — system structure & data flow
- [AI_PROVIDERS.md](docs/AI_PROVIDERS.md) — AI provider architecture, keys, fallback, error codes
- [DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md) — mandatory feature/release workflow
- [DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) — visual design & components
- [BUILD.md](docs/BUILD.md) — local dev, validation, deploy
- [DEPLOYMENT.md](docs/DEPLOYMENT.md) — Vercel + environment variables
- [ROADMAP.md](docs/ROADMAP.md) — phases & sprint backlog
- [CHANGELOG.md](docs/CHANGELOG.md) — version history
- [AI_CONTEXT.md](docs/AI_CONTEXT.md) — context for AI assistants
- [CERTIFICATION_SUBMISSION.md](docs/CERTIFICATION_SUBMISSION.md) — full project evidence for review/certification
- Feature reports: [`docs/reports/`](docs/reports/) — step-by-step evidence per feature (e.g. `FEATURE_AI_MATCHING_TIMEOUT.md`)

## Project structure

```
├── api/                       # Vercel serverless functions (JSON only)
│   ├── _lib/                  # shared helpers (filter, jobs, model(s), ai, providers, cache, apify, alerts)
│   ├── jobs.mjs               # GET /api/jobs    → combined filtered jobs (Arbeitnow + Apify)
│   ├── profile.mjs            # POST /api/profile → AI search profile from CV text (cached by hash)
│   ├── match.mjs              # POST /api/match  → AI-scored top matches (max 10 evaluated)
│   ├── cover-letter.mjs       # POST /api/cover-letter → AI cover letter
│   ├── models.mjs             # GET /api/models  → free model catalogue + recommended model
│   ├── model.mjs              # GET /api/model   → model currently in use
│   ├── alerts.mjs             # POST/DELETE/GET /api/alerts → digest subscriptions
│   └── cron/digest.mjs        # POST /api/cron/digest → daily email digest
├── src/                       # React + TypeScript + Vite frontend
│   ├── App.tsx                # root component + state
│   ├── api.ts                 # typed API client
│   ├── types.ts               # shared types
│   ├── styles.css             # design system (CSS)
│   ├── hooks/                 # useAvailableModels, useCityAutocomplete
│   ├── lib/                   # pdf.ts (browser-side PDF text extraction)
│   └── components/
│       ├── Hero.tsx
│       ├── LandingHero.tsx
│       ├── Navbar.tsx
│       ├── SearchForm.tsx
│       ├── JobSources.tsx     # per-source counts (Arbeitnow / Arbeitsagentur) from delivered jobs
│       ├── CvUpload.tsx       # PDF upload → extract → hash → profile cache → /api/profile
│       ├── ModelSelector.tsx  # accessible free-model listbox with recommended section
│       ├── AlertCard.tsx
│       ├── Status.tsx
│       ├── Results.tsx        # top-5 initial view + local expand
│       ├── MatchCard.tsx
│       ├── ScoreBadge.tsx
│       └── LetterModal.tsx
├── index.html                 # Vite entry
└── vercel.json                # function timeout + daily cron schedule
```

## Environment variables

All keys are server-side only.

| Variable | Needed for | Where to get it |
|---|---|---|
| `OPENROUTER_API_KEY` | Matching, CV profile extraction, cover letters (primary provider) | <https://openrouter.ai/keys> |
| `OPENROUTER_MODEL` (optional) | Override the default model | — |
| `EDENAI_API_KEY` (optional) | Second AI provider, production key | <https://www.edenai.co> |
| `EDENAI_DEV_API_KEY` (optional) | EdenAI sandbox token for dev/preview (simulated responses, no cost) | EdenAI |
| `EDENAI_ENV` (optional) | Force EdenAI key mode (`production` or sandbox); defaults to `VERCEL_ENV` | — |
| `EDENAI_MODEL` (optional) | Override the default EdenAI model | — |
| `APIFY_API_TOKEN` (optional) | Second job source: Arbeitsagentur feed via Apify | <https://console.apify.com/settings/integrations> |
| `UPSTASH_REDIS_REST_URL` | Apify job cache, CV profile cache, alert subscriptions | <https://upstash.com> (free Redis) |
| `UPSTASH_REDIS_REST_TOKEN` | Same as above | Upstash |
| `RESEND_API_KEY` | Sending digest emails | <https://resend.com> (free) |
| `DIGEST_FROM` | Sender address (verified domain in Resend) | Resend |
| `CRON_SECRET` | Protects `/api/cron/digest` | any random string |
| `OPENROUTER_MONTHLY_MAX_REQUESTS` (optional) | OpenRouter AI request-count backstop for the cost guard (default `1000`/month) | — |
| `EDENAI_MONTHLY_MAX_REQUESTS` (optional) | EdenAI request-count backstop (default `200`/month) | — |
| `OPENROUTER_ENABLED` / `EDENAI_ENABLED` (optional) | Enable/disable each AI provider (default `true`) | — |
| `APIFY_MONTHLY_MAX_RUNS` (optional) | Apify Actor-run backstop for the cost guard (default `30`/month) | — |
| `MODEL_FALLBACK_MAX_ATTEMPTS` (optional) | Max AI fallback attempts, exposed to the client (default `3`) | — |
| `APIFY_DATASET_REFRESH_PEAK_HOURS` (optional) | Apify dataset reuse window during peak hours (default `6`) | — |
| `APIFY_DATASET_REFRESH_OFFPEAK_HOURS` (optional) | Apify dataset reuse window off-peak (default `12`) | — |
| `APIFY_DATASET_REFRESH_TIMEZONE` (optional) | IANA timezone for the peak window (default `Europe/Berlin`; DST handled automatically) | — |
| `APIFY_DATASET_REFRESH_PEAK_START` / `APIFY_DATASET_REFRESH_PEAK_END` (optional) | Peak window start/end (default `08:00` / `18:00`) | — |
| `USAGE_DIAGNOSTICS_TOKEN` (optional) | Token required to read `GET /api/usage`; without it the endpoint is disabled (403) | any random string |
| `OPENROUTER_MONTHLY_SOFT_LIMIT_USD` / `EDENAI_MONTHLY_SOFT_LIMIT_USD` / `APIFY_MONTHLY_SOFT_LIMIT_USD` (optional) | Advisory spend limits (operator reference only, shown in `/api/usage`) | — |

## Cost guard & usage

The app keeps its own monthly usage counters (in Upstash Redis) and exposes them read-only via `GET /api/usage`. It contains **no secrets** — only counters and configured limits:

```json
{ "month": "2026-08", "openRouter": { "requestCount": 12, "failureCount": 0, "fallbackAttempts": 0, "byModel": {} },
  "edenai": { "requestCount": 0, "failureCount": 0, "fallbackAttempts": 0, "byModel": {} },
  "apify": { "actorRuns": 1, "datasetReuses": 2, "cacheHits": 3, "cacheMisses": 1 },
  "limits": { "openRouterMonthlySoftLimitUsd": 0.8, "edenaiMonthlySoftLimitUsd": 1.0, "apifyMonthlySoftLimitUsd": 4, ... } }
```

Important — these are **application-side counters, not provider billing**:

- The provider dashboards (OpenRouter, Apify console) remain authoritative for real spend.
- `GET /api/usage` is **protected**: it requires the `USAGE_DIAGNOSTICS_TOKEN` (sent via the `x-usage-token` header or `Authorization: Bearer <token>`). Without a token configured the endpoint is disabled (HTTP 403); a wrong/missing token returns HTTP 401. The token is server-side only and never appears in the response or any client bundle.
- The `*_SOFT_LIMIT_USD` values are advisory operator thresholds shown in `/api/usage`; the app cannot derive exact spend from its counters and therefore does **not** block on them.
- The guards use the counter backstops instead:
  - **AI providers:** once a provider's monthly request count reaches its backstop (`OPENROUTER_MONTHLY_MAX_REQUESTS` default `1000`, `EDENAI_MONTHLY_MAX_REQUESTS` default `200`), the router fails fast for that provider (`503 limit_reached`) and automatically tries the next enabled provider; only when all are exhausted does the request fail with the existing friendly UX. Client-side fallbacks stay bounded by `MODEL_FALLBACK_MAX_ATTEMPTS`.
  - **Apify:** once the monthly Actor-run count reaches `APIFY_MONTHLY_MAX_RUNS` (default `30`), no new paid Actor runs are started. Cached / dataset-reused results keep working; only brand-new searches that would need a run return empty for the Apify source (Arbeitnow still works).
- Apify dataset reuse is **time-of-day aware** in a configurable IANA timezone: during the peak window (`APIFY_DATASET_REFRESH_PEAK_START`–`APIFY_DATASET_REFRESH_PEAK_END`, default 08:00–18:00 `Europe/Berlin`) the dataset refresh window is `APIFY_DATASET_REFRESH_PEAK_HOURS` (default 6 h); off-peak it is `APIFY_DATASET_REFRESH_OFFPEAK_HOURS` (default 12 h). Longer off-peak reuse means fewer paid runs. Summer/winter time is resolved automatically from the IANA timezone (no hardcoded UTC offset).
- The Redis L1 job cache (10 min), the Apify L2 dataset reuse, the CV-profile cache and the automatic model fallback are all unchanged.

## Run locally

```bash
npm i -g vercel
npm install
vercel login
vercel dev        # local server on http://localhost:3000 (React + functions)
```

Build and type-check:

```bash
npm run build
```

## Deploying to Vercel + environment variables

**Option A — dashboard:** push the folder to GitHub → import on <https://vercel.com/new> → add the env vars in **Project → Settings → Environment Variables** → Deploy/Redeploy.

**Option B — CLI:**

```bash
npm i -g vercel
vercel login
vercel link
vercel env add OPENROUTER_API_KEY          # + the other vars above
vercel --prod --scope maymilly              # --scope is required for this project
```

The project does not rely on automatic Vercel Git deployment — production is deployed explicitly with the CLI.

The daily digest runs automatically via the cron in `vercel.json` (07:00 UTC).

## Error handling

- Job board unreachable / rate-limited / broken → friendly message, no crash.
- Missing keys (both AI providers, Upstash, Resend) → clear "not configured yet" message.
- Invalid key (401) / out of credits (402) / AI rate limit (429) / malformed AI response → each gets its own clear message.
- OpenRouter's daily free-model quota (`free-models-per-day`) is detected on the server and shown as a specific friendly message ("Die kostenlosen KI-Anfragen für heute sind aufgebraucht…") — the client does **not** try further free models, because the account-wide daily limit affects all of them; the server may transparently fall back to the EdenAI provider instead.
- See [`docs/AI_PROVIDERS.md`](docs/AI_PROVIDERS.md) for the full provider architecture, key selection and error codes.

## Example

```
Skills:        JavaScript, React, Node.js
Target role:   Frontend Developer
City:          Berlin, München
```

→ `Find my matches` → ranked cards with scores, short "why this fits", a prep question, and a "Bewerbung generieren" button.

## Testing

- **116/116 tests passing** (`npm test`, Vitest) across frontend, serverless functions and provider integration.
- `npx tsc -b` — strict TypeScript build, PASS.
- `npm run build` — Vite production build, PASS.
- Live endpoint verification against the deployed Vercel functions where possible.

## Development workflow

The project follows a strict, verifiable feature workflow (`docs/DEVELOPMENT_WORKFLOW.md`):

```
main → feature/<name> → Development → Preview → Abnahme → Merge → Production → Branch schließen
```

- Every feature runs on its own branch; `main` stays the integration/release branch.
- Each step produces a checkpoint: report → tests → `git status` → `git diff --check` → secret audit → commit → push.
- Recovery is based on a documented recovery file per feature (`docs/reports/FEATURE_*.md`).
- Deployment identity is verified against the actual built commit (Deployment Commit / Build Identity), not assumed from `git HEAD`.
- Example: the **AI Matching Timeout & Fallback** feature (Steps 1–10, including a controlled production AI test) is fully documented in `docs/reports/FEATURE_AI_MATCHING_TIMEOUT.md`.

## Current status

| Area | Status |
|---|---|
| Core matching (jobs + AI scoring) | ✅ live |
| Multi-city search | ✅ live |
| AI cover-letter generator | ✅ live |
| Daily digest alerts | ✅ implemented (needs Upstash + Resend keys for real delivery) |
| Model selection (dynamic free-model catalogue) | ✅ live |
| AI provider fallback (OpenRouter ↔ EdenAI) | ✅ live |
| AI timeout / error-code handling | ✅ live (verified in production) |
| Model availability / health check | 🟡 planned — see below |

## Planned

- **Model Availability / Health Check** (backlog): UI loads immediately, an availability check runs in
  the background, the result is cached, and the model combobox shows the real status of each model —
  instead of deriving availability only from the catalogue. Free models are preferred and costs
  controlled; no unnecessary provider requests and no artificial load.
- **Matching UI lock:** disable the model combobox while a matching search is running and re-enable it
  after completion.
- Final accessibility audit and candidate profile persistence (roadmap, see `docs/ROADMAP.md`).
