# AGENTS.md

# My Job Matcher

## Project Overview

My Job Matcher is a job search assistant built as a static frontend with serverless backend functions.

The app:

- fetches live job openings from the free Arbeitnow API
- filters them by skills, target role, and one or more cities
- scores the filtered jobs (0–100) with an AI via OpenRouter
- returns the top 5 matches with a "why it fits" explanation and a preparation question
- generates a personalized cover letter for any match
- offers daily email digests for saved search profiles

The project focuses on:

- fast, dependency-free serverless functions
- a clean, readable single-page UI
- friendly error handling
- secure handling of API keys (server-side only)

---

# Tech Stack

- React
- TypeScript (strict)
- Vite
- CSS (custom properties / design tokens)
- Node.js serverless functions (ESM, `.mjs`)
- Vercel Functions + Vercel Cron
- OpenRouter Chat API (scoring + cover letters)
- Arbeitnow Job Board API (job listings)
- Upstash Redis REST (alert subscriptions)
- Resend API (digest emails)
- Git / GitHub

---

# Coding Style

## TypeScript / React

- Functional components, hooks only
- Strict mode, no `any`
- Prefer interfaces for component props
- Explicit types for API contracts (`src/types.ts`)
- Arrow functions, semicolons, single quotes
- Readable over clever

## Serverless functions

- ESM modules (`.mjs` extension)
- `export default async function handler(req, res)` signature
- Friendly JSON errors: `{ error, code }`
- No new npm dependencies without approval (global `fetch` is preferred)

## HTML / CSS

- Semantic HTML
- Design tokens via CSS custom properties in `:root`
- Mobile-first responsive layout
- Visible focus states

---

# Folder Structure

```
api/                          serverless functions
  _lib/                       shared helpers (filter, model, ai, alerts)
  jobs.mjs                    GET /api/jobs
  match.mjs                   POST /api/match
  cover-letter.mjs            POST /api/cover-letter
  model.mjs                   GET /api/model
  alerts.mjs                  POST/DELETE/GET /api/alerts
  cron/digest.mjs             POST /api/cron/digest

src/                          React frontend
  App.tsx                     root component + state
  api.ts                      typed API client
  types.ts                    shared types
  styles.css                  design system
  main.tsx                    entry
  components/
    Hero.tsx       SearchForm.tsx   ModelInfo.tsx
    AlertCard.tsx  Status.tsx       Results.tsx
    MatchCard.tsx  ScoreBadge.tsx   LetterModal.tsx

index.html
vite.config.ts
vercel.json
```

---

# Error Handling Rules

- The job board is reachable / rate-limited / broken → friendly message, never a crash.
- Missing keys (`OPENROUTER_API_KEY`, Upstash, Resend) → clear "not configured yet" message.
- Invalid key (401) / no credits (402) / AI rate limit (429) / malformed AI response → dedicated message each.

---

# Security Rules

- API keys are read from `process.env` only.
- Keys are never sent to the browser.
- `.env` and `.vercel/` are gitignored.
- No secrets in documentation or committed files.

---

# Git Workflow

Feature branches

```
feature/multi-city
feature/cover-letter
feature/alerts
feature/polish
```

Commit style

```
feat:
fix:
refactor:
docs:
style:
test:
chore:
```

---

# Validation

- `npm run build` (type check + production build) after frontend changes
- live endpoint checks with `curl` against the deployed functions
- `vercel --prod` to deploy

---

# Future Roadmap

Phase 1 ✅ Core matching (jobs + AI scoring)

Phase 2 ✅ Multi-city + cover letter + alerts

Phase 3 🚧 Polish & release

Phase 4 Planned

- real authentication
- saved candidate profiles
- application tracker

---

# AI Instructions

When generating code:

- preserve the existing architecture
- reuse `api/_lib/` helpers
- avoid new dependencies
- prefer readable code
- avoid duplicate logic
- follow existing naming conventions
- optimize for maintainability
- keep the UI consistent with `docs/DESIGN_SYSTEM.md`

Never replace working code unless requested.

Always validate changes (`node --check`, live endpoint test) before reporting success.
