# Deployment

#Vercel

#Serverless Functions

#Vercel Cron

#Environment Variables

## Deploy

The project does **not** rely on automatic Vercel Git deployment — production is deployed explicitly.

```bash
npm i -g vercel
vercel login
vercel link
vercel --prod --scope maymilly
```

`--scope maymilly` is required because the local CLI token is associated with another Vercel account/team (`gregornowak-6756`), while the project lives in the `maymilly` team.

## Project

Vercel project: `maymilly/mays-job-matcher`

Live URL: https://mays-job-matcher.vercel.app

## Environment variables (all server-side)

| Variable | Purpose | Where used | Required? | Secret? |
|---|---|---|---|---|
| `OPENROUTER_API_KEY` | OpenRouter authentication for all AI calls (matching, profile extraction, cover letters) | `api/_lib/ai.mjs` | Required for AI features | Yes |
| `OPENROUTER_MODEL` (optional) | Override the default/fallback model resolution | `api/_lib/model.mjs` | Optional (default model constant used if unset) | No |
| `APIFY_API_TOKEN` (optional) | Apify authentication for the Arbeitsagentur job source | `api/_lib/apify.mjs` | Optional — without it only Arbeitnow is used | Yes |
| `UPSTASH_REDIS_REST_URL` | Upstash REST endpoint for Apify job cache, CV profile cache and alert subscriptions | `api/_lib/cache.mjs`, `api/_lib/alerts.mjs` | Required for caching and alerts | Credentials — server-side only |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash REST token (same uses as above) | `api/_lib/cache.mjs`, `api/_lib/alerts.mjs` | Required for caching and alerts | Yes |
| `RESEND_API_KEY` | Resend authentication for the daily digest emails | `api/cron/digest.mjs` | Required for digest emails | Yes |
| `DIGEST_FROM` | Sender address (verified Resend domain) | `api/cron/digest.mjs` | Required for digest emails | No |
| `CRON_SECRET` | Protects `/api/cron/digest` (Bearer auth) | `api/cron/digest.mjs` | Optional (cron also trusts `x-vercel-cron`) | Yes |
| `OPENROUTER_MONTHLY_MAX_REQUESTS` | AI request-count backstop for the cost guard (default `1000`/month) | `api/_lib/config.mjs` / `api/_lib/usage.mjs` | Optional (safe default) | No |
| `APIFY_MONTHLY_MAX_RUNS` | Apify Actor-run backstop for the cost guard (default `30`/month) | `api/_lib/config.mjs` / `api/_lib/usage.mjs` | Optional (safe default) | No |
| `MODEL_FALLBACK_MAX_ATTEMPTS` | Max AI fallback attempts, exposed to the client via `/api/models` (default `3`) | `api/_lib/config.mjs` / `api/models.mjs` / client | Optional (safe default) | No |
| `APIFY_DATASET_REFRESH_PEAK_HOURS` | Apify dataset reuse window during peak hours 08:00–18:00 (default `6`) | `api/_lib/config.mjs` / `api/_lib/apify.mjs` | Optional (safe default) | No |
| `APIFY_DATASET_REFRESH_OFFPEAK_HOURS` | Apify dataset reuse window off-peak (default `12`) | `api/_lib/config.mjs` / `api/_lib/apify.mjs` | Optional (safe default) | No |
| `APIFY_DATASET_REFRESH_TIMEZONE` | IANA timezone for the Apify peak window (default `Europe/Berlin`; DST handled automatically, no hardcoded UTC offset) | `api/_lib/config.mjs` / `api/_lib/apify.mjs` | Optional (safe default) | No |
| `APIFY_DATASET_REFRESH_PEAK_START` | Apify peak window start, `HH:MM` (default `08:00`) | `api/_lib/config.mjs` / `api/_lib/apify.mjs` | Optional (safe default) | No |
| `APIFY_DATASET_REFRESH_PEAK_END` | Apify peak window end, `HH:MM` (default `18:00`) | `api/_lib/config.mjs` / `api/_lib/apify.mjs` | Optional (safe default) | No |
| `USAGE_DIAGNOSTICS_TOKEN` | Protects `GET /api/usage` (via `x-usage-token` header or `Authorization: Bearer`). Unset → endpoint disabled (403). Must be set to enable reading usage diagnostics | `api/usage.mjs` | Optional — recommended for operators (secure default: disabled) | Yes |
| `OPENROUTER_MONTHLY_SOFT_LIMIT_USD` | Advisory OpenRouter spend limit (USD), shown in `/api/usage`; does NOT block (provider dashboard is authoritative) | `api/_lib/config.mjs` | Optional (default `0.80`) | No |
| `APIFY_MONTHLY_SOFT_LIMIT_USD` | Advisory Apify spend limit (USD), shown in `/api/usage`; does NOT block | `api/_lib/config.mjs` | Optional (default `4.00`) | No |

`.env.example` contains placeholders only. Real credentials are never committed to Git.

### Setting `USAGE_DIAGNOSTICS_TOKEN` on Vercel (Production)

The `/api/usage` diagnostics endpoint is **disabled (HTTP 403) until this token is set**. To enable it:

```bash
# generate a random secret once, e.g.:
openssl rand -hex 32          # or: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
vercel env add USAGE_DIAGNOSTICS_TOKEN   # select Production
vercel --prod --scope maymilly            # redeploy so the variable is used
```

Then read the diagnostics with:

```bash
curl -H "x-usage-token: <your-token>" https://mays-job-matcher.vercel.app/api/usage
```

The token is a server-side secret: it must never be added to the frontend bundle, `.env.example` is only a placeholder, and it never appears in responses or logs.

## Add an environment variable (CLI)

```bash
vercel env add OPENROUTER_API_KEY   # then choose production / preview / development
vercel --prod --scope maymilly      # redeploy so the variable is used
```

## Cron

Defined in `vercel.json`:

- path: `/api/cron/digest`
- schedule: `0 7 * * *` (daily 07:00 UTC)
- protected via `Authorization: Bearer <CRON_SECRET>` or the `x-vercel-cron` header

## Function runtime

`vercel.json` sets `maxDuration: 60` for all `api/**/*.mjs` functions. The match pipeline keeps the AI evaluation to at most 10 candidates so requests complete within this limit.

## Cost guard & usage

- The app tracks its own monthly usage counters in Upstash Redis and exposes them via `GET /api/usage` (no secrets in the response). The endpoint is protected by `USAGE_DIAGNOSTICS_TOKEN`; without it, it is disabled (403). See `README.md` → "Cost guard & usage" and `ARCHITECTURE.md` → "Cost guard & usage".
- Guards use counter-based backstops (`OPENROUTER_MONTHLY_MAX_REQUESTS`, `APIFY_MONTHLY_MAX_RUNS`). The `*_SOFT_LIMIT_USD` values are advisory and never block.
- Apify dataset reuse is time-of-day aware in `Europe/Berlin` (default): peak 08:00–18:00 uses the peak reuse window (6 h), off-peak the off-peak window (12 h). Summer/winter time is resolved automatically via the IANA timezone.

## CI/CD

- Not automated — deployments are performed explicitly via the CLI (see above).
- Recommended: push to GitHub → import in Vercel → auto-deploy on push.

#Domain

- Custom domain not yet configured.

#CI/CD

- Planned (GitHub + Vercel auto-deploy).
