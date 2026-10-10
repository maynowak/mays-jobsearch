# AGENTS.md — May's Job Matcher

Compact, repo-specific guidance for OpenCode sessions. Only keep what changes behavior.

**AI Audit Rule:** Bitte die AI_AUDITLOG.md befolgen. Bei jedem Implementation-/Execution-Gate AI_AUDITLOG.md prüfen, AI-/Privacy-/Data-Flow-Auswirkung bewerten, Execution Log dokumentieren. AI_AUDITLOG.md nur bei tatsächlich erforderlicher Ergänzung ändern.

## Quick commands
- Install: `npm install`
- Frontend dev: `npm run dev` — Vite on http://localhost:5173 (port from `PORT` env)
- Full local stack: `npm i -g vercel && vercel login && vercel dev` — http://localhost:3000, React + serverless functions
- Type-check + build: `npm run build` → `tsc -b && vite build`
- Tests: `npm test` → `vitest run` (jsdom, excludes `api/**`)
- API syntax check: `node --check api/**/*.mjs`
- Production deploy: `vercel --prod --scope maymilly` (project uses explicit CLI deploy, no auto Git deploy)

## Repo structure & boundaries
- Frontend: `src/` React + TypeScript + Vite, entry `src/main.tsx`, root state `src/App.tsx`, API client `src/api.ts`, types `src/types.ts`
- Serverless: `api/**/*.mjs` ESM, `api/_lib/` shared helpers
- Functions maxDuration 60s: `vercel.json:3-5`
- Cron: `/api/cron/digest` daily `0 7 * * *` → `vercel.json:7-12`
- Build identity injected via `buildInfo.ts` into Vite/vitest (`__APP_VERSION__`, `__APP_ENV__`, `__APP_COMMIT_SHA__`, `__APP_BRANCH__`)

## Architecture quirks
- Provider router: `api/_lib/providers/index.mjs` aggregates free models from OpenRouter (primary) and EdenAI (optional). Provider-level fallback on quota exhaustion only; model-level errors propagate.
- Model selection is locked while search/scoring runs (`ModelSelector` disables during phase).
- CV upload: PDF processed in-browser with `pdfjs-dist`. PDF never uploaded. Text hashed via `crypto.subtle`, profile cached L1 `localStorage` 30d + L2 Upstash Redis `cv-profile:<hash>` 30d. `POST /api/profile` only on cache miss.
- Job sources: modular registry `api/_lib/sources/`. Enabled via `JOB_SOURCE_*_ENABLED`. Default sources: Arbeitnow, Arbeitsagentur via Apify Actor `blackfalcondata~arbeitsagentur-jobs-feed`.
- Apify cache: L1 Redis `job-source:<sourceId>:<query>|<location>` TTL 600s. L2 dataset reuse metadata with time-of-day window: peak 08:00-18:00 Europe/Berlin → reuse `APIFY_DATASET_REFRESH_PEAK_HOURS` default 6h, off-peak default 12h. Refresh only on dataset 404/410.
- Matching pipeline: `/api/jobs` → keyword preselection → max 10 candidates → `/api/match` AI scores. Frontend shows top 5 initially, expands locally without re-request.
- Search parameters `Umkreis` / `Arbeitsmodell` / `Arbeitszeit` filtered server-side best-effort; `radiusKm` geocoded via Nominatim.

## Config & env
All keys server-side only. Key vars:
- AI: `OPENROUTER_API_KEY`, optional `EDENAI_API_KEY`/`EDENAI_DEV_API_KEY`, `EDENAI_ENV`
- Jobs: `APIFY_API_TOKEN`, optional Adzuna/JobsPipe/Theirstack keys
- Cache/alerts: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- Email: `RESEND_API_KEY`, `DIGEST_FROM`, `CRON_SECRET`
- Guards: `OPENROUTER_MONTHLY_MAX_REQUESTS` default 1000, `EDENAI_MONTHLY_MAX_REQUESTS` 200, `APIFY_MONTHLY_MAX_RUNS` 100, `MODEL_FALLBACK_MAX_ATTEMPTS` 3
- Diagnostics: `USAGE_DIAGNOSTICS_TOKEN` protects `GET /api/usage` via `x-usage-token` or `Authorization: Bearer`
`.env` and `.vercel/` are gitignored. Never commit secrets.

## Coding rules
- Frontend: functional components, hooks only, strict TS, no `any`, interfaces for props, single quotes, semicolons. Arrow functions.
- API: ESM `.mjs`, `export default async function handler(req, res)`, friendly errors `{ error, code }`. No new npm deps without approval; prefer global `fetch`.
- Reuse `api/_lib/` helpers. Do not duplicate logic. Follow naming in `src/types.ts`.

## Testing quirks
- Vitest config excludes `api/**`. API tests are not run by `npm test`.
- Setup `vitest.setup.ts` polyfills `DOMMatrix` for `pdfjs-dist`.
- Run single test file: `npx vitest run src/components/Foo.test.tsx`
- CI runs `npm ci`, `npm run build`, `node --check` on all `api/**/*.mjs`, then `npm test -- --run`.

## Development workflow constraints
- Feature branches: `feature/<name>` from `main`. `main` is integration/release.
- Each feature requires a recovery report `docs/reports/FEATURE_<NAME>.md` with step matrix. After each step: update report, `npm test`, `git status`, `git diff --check`, secret audit, commit, push.
- No rebase/merge/rewrite without explicit release step. Production deploy is `vercel --prod` from `main` only.
- Deployment identity must match: Vercel deployment commit == footer Build SHA. Do not assume Git HEAD equals deployed artifact.

## Error handling & UX specifics
- Job source down → friendly message, no crash.
- Missing/invalid keys → clear "not configured yet" messages.
- OpenRouter daily free quota exhausted → specific message, provider may fallback to EdenAI transparently.
- Model selector shows provider name + model name, accessible listbox with keyboard navigation, flips upward when needed.

## Important files
- `docs/AI_AUDITLOG.md` — mandatory step tamplate auditlog workflow
- `docs/DEVELOPMENT_WORKFLOW.md` — mandatory step workflow
- `docs/ARCHITECTURE.md` — system wiring
- `docs/DEPLOYMENT.md` — env vars
- `README.md` — up-to-date feature status and env table
