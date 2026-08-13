# AI Tools & Learning Record

This file records which AI tools were used on **My Job Matcher** and what was learned.

## 2026-08-13

**Tool:** DeepSeek V4 Flash Free (opencode)

**Work performed:**

- Built the full application (frontend + serverless functions).
- Implemented Arbeitnow fetching and multi-city/keyword filtering in `api/_lib/filter.mjs`.
- Implemented AI scoring (`/api/match`) and cover-letter generation (`/api/cover-letter`) via OpenRouter with a shared `chat()` helper in `api/_lib/ai.mjs`.
- Implemented digest alerts (`/api/alerts`, `/api/cron/digest`) with Upstash Redis storage and Resend email, using only global `fetch` (no npm dependencies).
- Deployed to Vercel, added `OPENROUTER_API_KEY` as a production environment variable, verified endpoints live.

**Lessons learned:**

- A CSS `display` rule overrides the HTML `hidden` attribute; fix with `[hidden] { display: none !important }`.
- The Arbeitnow API returns `location` as either an array or a string — normalize before use.
- Multi-word keyword phrases must be tokenized per field, not concatenated, or no jobs match.
- AI score strings like `"87/100"` need dedicated parsing, not generic digit stripping.
- Vercel deploys a directory named `Mays-Jobsearch` only after an explicit `--name`, and nested `api/cron/*.mjs` needs `api/**/*.mjs` in the functions config.
- Keys shared in chat should be rotated if there is any concern.

## Future record

Add entries here after each meaningful AI-assisted work session.
