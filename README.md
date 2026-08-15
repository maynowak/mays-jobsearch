# My Job Matcher

Find live jobs that actually fit you. You either upload a **CV (PDF)** or type your **skills**, **target role** and **city** (multiple cities allowed, e.g. `Berlin, München, Hamburg`), and the app:

1. **CV upload (optional):** the PDF is read in the browser (PDF.js), text-extracted and turned into an editable search profile by the AI (`/api/profile`). The profile is cached per CV hash, so repeated uploads of the same CV are instant. The PDF file itself is never sent to the server, and raw CV text is never stored.
2. **Model selection:** the app dynamically shows the currently available free OpenRouter models and preselects a recommended one. The user can switch to any other free model (`/api/models`).
3. Fetches current openings from two sources — the free [Arbeitnow job API](https://www.arbeitnow.com/api/job-board-api) and the German Arbeitsagentur feed via an [Apify Actor](https://apify.com) (`blackfalcondata~arbeitsagentur-jobs-feed`) — and filters them by your keywords and cities (`/api/jobs`). The job pool is cached (Redis + Apify dataset reuse) to avoid unnecessary paid Apify runs.
4. Sends the filtered pool + your profile to the OpenRouter chat API (`/api/match`). To stay within the function timeout, the pool is narrowed to **max 10 candidates** by keyword hits, the AI scores those **0–100** and the **top 5** are shown with:
   - the score,
   - **two sentences on why** it fits you,
   - **one question** to prepare for the interview.
   The status line reports honestly how many were found vs. evaluated ("52 Jobs gefunden · 10 passende Kandidaten mit KI bewertet"); the list can be expanded locally without another AI request.
5. **AI-Bewerbungsgenerator:** on any match card, click "Bewerbung generieren" — the AI writes a personalized cover letter (with a suggested answer to the prep question) that you can copy or download (`/api/cover-letter`).
6. **Daily job alerts:** subscribe with your email to get a morning digest of new matches (`/api/alerts` + `/api/cron/digest`).

Your API keys (OpenRouter, Apify, Upstash, Resend) live **only** on the server — they are never exposed to the browser.

## 🤖 Documentation

Project documentation lives in [`docs/`](docs/):

- [AGENTS.md](docs/AGENTS.md) — project overview, stack, coding rules
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — system structure & data flow
- [DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) — visual design & components
- [BUILD.md](docs/BUILD.md) — local dev, validation, deploy
- [DEPLOYMENT.md](docs/DEPLOYMENT.md) — Vercel + environment variables
- [ROADMAP.md](docs/ROADMAP.md) — phases & sprint backlog
- [CHANGELOG.md](docs/CHANGELOG.md) — version history
- [AI_CONTEXT.md](docs/AI_CONTEXT.md) — context for AI assistants

## Project structure

```
├── api/                       # Vercel serverless functions (JSON only)
│   ├── _lib/                  # shared helpers (filter, jobs, model(s), ai, cache, apify, alerts)
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
| `OPENROUTER_API_KEY` | Matching, CV profile extraction, cover letters | <https://openrouter.ai/keys> |
| `OPENROUTER_MODEL` (optional) | Override the default model | — |
| `APIFY_API_TOKEN` (optional) | Second job source: Arbeitsagentur feed via Apify | <https://console.apify.com/settings/integrations> |
| `UPSTASH_REDIS_REST_URL` | Apify job cache, CV profile cache, alert subscriptions | <https://upstash.com> (free Redis) |
| `UPSTASH_REDIS_REST_TOKEN` | Same as above | Upstash |
| `RESEND_API_KEY` | Sending digest emails | <https://resend.com> (free) |
| `DIGEST_FROM` | Sender address (verified domain in Resend) | Resend |
| `CRON_SECRET` | Protects `/api/cron/digest` | any random string |

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
- Missing keys (`OPENROUTER_API_KEY`, Upstash, Resend) → clear "not configured yet" message.
- Invalid key (401) / out of credits (402) / AI rate limit (429) / malformed AI response → each gets its own clear message.

## Example

```
Skills:        JavaScript, React, Node.js
Target role:   Frontend Developer
City:          Berlin, München
```

→ `Find my matches` → ranked cards with scores, short "why this fits", a prep question, and a "Bewerbung generieren" button.