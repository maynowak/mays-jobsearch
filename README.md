# My Job Matcher

Find live jobs that actually fit you. You type your **skills**, **target role** and **city** (multiple cities allowed, e.g. `Berlin, München, Hamburg`), and the app:

1. Fetches current openings from the free [Arbeitnow job API](https://www.arbeitnow.com/api/job-board-api) (no key needed).
2. Filters them by your keywords and cities (`/api/jobs`).
3. Sends the filtered jobs + your profile to the OpenRouter chat API (`/api/match`), which scores each job **0–100** and returns the **top 5** with:
   - the score,
   - **two sentences on why** it fits you,
   - **one question** to prepare for the interview.
4. **AI-Bewerbungsgenerator:** on any match card, click "Bewerbung generieren" — the AI writes a personalized cover letter (with a suggested answer to the prep question) that you can copy or download (`/api/cover-letter`).
5. **Daily job alerts:** subscribe with your email to get a morning digest of new matches (`/api/alerts` + `/api/cron/digest`).

Your OpenRouter API key lives **only** on the server — it is never exposed to the browser.

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
├── api/                       # Vercel serverless functions (unchanged, JSON only)
│   ├── _lib/                  # shared helpers (filter, model, ai, alerts)
│   ├── jobs.mjs               # GET /api/jobs  → filtered jobs from Arbeitnow
│   ├── match.mjs              # POST /api/match → AI-scored top 5 matches
│   ├── cover-letter.mjs       # POST /api/cover-letter → AI cover letter
│   ├── model.mjs              # GET /api/model → model currently in use
│   ├── alerts.mjs             # POST/DELETE/GET /api/alerts → digest subscriptions
│   └── cron/digest.mjs        # POST /api/cron/digest → daily email digest
├── src/                       # React + TypeScript + Vite frontend
│   ├── App.tsx                # root component + state
│   ├── api.ts                 # typed API client
│   ├── types.ts               # shared types
│   ├── styles.css             # design system (CSS)
│   └── components/
│       ├── Hero.tsx
│       ├── SearchForm.tsx
│       ├── ModelInfo.tsx
│       ├── AlertCard.tsx
│       ├── Status.tsx
│       ├── Results.tsx
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
| `OPENROUTER_API_KEY` | Scoring + cover letters | <https://openrouter.ai/keys> |
| `OPENROUTER_MODEL` (optional) | Override the model | — |
| `UPSTASH_REDIS_REST_URL` | Alert subscriptions | <https://upstash.com> (free Redis) |
| `UPSTASH_REDIS_REST_TOKEN` | Alert subscriptions | Upstash |
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
vercel --prod
```

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