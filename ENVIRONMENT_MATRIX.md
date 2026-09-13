# Vercel Development/Preview Test-Environment Matrix
# ==================================================
# Environment Variable and API Dependencies Matrix
# Based on codebase analysis of mays-job-matcher v2.0.0
# ==================================================

# Legend:
# - : Required for basic function
# - : Optional / conditional
# - : Not used in this environment
# - : Secret / sensitive (do not commit)

# Environment: Development (local vim run)
# Environment: Preview (Vercel Preview Deployment)
# Environment: Production (Production Deployment)

## 1. Frontend Environment Variables (Vite/dev server)
- Port configuration: PORT (default 5173)
- NODE_ENV: development | production
- VERCEL_ENV: development | preview | production
- VERCEL_URL: auto-assigned by Vercel
- VERCEL_COMMIT_REF: git ref (branch name)
- VERCEL_COMMIT_SHA: git commit SHA

## 2. Backend/API Variables (server-side only)
- EDENAI_ENV: production | development | (empty for auto-detect)
- EDENAI_API_KEY / EDENAI_DEV_API_KEY: : (secret - Vercel dashboard)
- EDENAI_MODEL : (optional model selection)
- OPENROUTER_API_KEY: : (secret - Vercel dashboard)
- OPENROUTER_ENV : production | development | (empty)
- UPSTASH_REDIS_REST_URL : (optional - Redis for alerts)
- UPSTASH_REDIS_REST_TOKEN : : (secret - Vercel dashboard)
- RESEND_API_KEY : : (secret - email provider)
- DIGEST_FROM : email address format
- CRON_SECRET : : (secret - cron endpoint protection)
- MODEL_FALLBACK_MAX_ATTEMPTS : number (default 3)
- JOB_SOURCE_ARBEITNOW_ENABLED : true/false
- JOB_SOURCE_ARBEITSAGENTUR_ENABLED : true/false

## 3. Feature Flags / Conditional Variables
- OPENROUTER_ENABLED : true/false
- EDENAI_ENABLED : true/false
- JOB_SOURCE_ARBEITNOW_ENABLED : true/false
- JOB_SOURCE_ARBEITSAGENTUR_ENABLED : true/false

## 4. Cost/Usage Guards (optional)
- OPENROUTER_MONTHLY_SOFT_LIMIT_USD : number (USD)
- APIFY_MONTHLY_SOFT_LIMIT_USD : number (USD) (default: 4.0)
- EDENAI_MONTHLY_MAX_REQUESTS : number (default 200)
- APIFY_MONTHLY_MAX_RUNS : number (default 30)
- EDENAI_MONTHLY_MAX_REQUESTS : number (default 200)
- APIFY_MONTHLY_MAX_RUNS : number (default 30)
- EDENAI_MONTHLY_SOFT_LIMIT_USD : number (USD) (default 1.0)
- APIFY_MONTHLY_MAX_RUNS : number (default 30)
- APIFY_DATASET_REFRESH_PEAK_HOURS : number (hours) (default 6)
- APIFY_DATASET_REFRESH_OFFPEAK_HOURS : number (hours) (default 12)
- APIFY_DATASET_REFRESH_TIMEZONE : timezone (default Europe/Berlin)
- APIFY_DATASET_REFRESH_PEAK_START : time (default 08:00)
- APIFY_DATASET_REFRESH_PEAK_END : time (default 18:00)
- OPENROUTER_MONTHLY_MAX_REQUESTS : number (default 1000)
- EDENAI_MONTHLY_MAX_REQUESTS : number (default 200)
- APIFY_MONTHLY_MAX_RUNS : number (default 30)

## 5. Application Configuration
- MODEL_FALLBACK_MAX_ATTEMPTS : number (default 3)
- OPENROUTER_MONTHLY_MAX_REQUESTS : number (default 1000)

## 5. Secrets (NEVER commit these - use Vercel Dashboard)
- OPENROUTER_API_KEY: : : :: : (secret - set via Vercel Dashboard)
- RESEND_API_KEY: : : :: : (secret - set via Vercel Dashboard)
- DIGEST_FROM: : : :: : (secret - set via Vercel Dashboard)
## 6. Optional / Feature Flags
- UPSTASH_REDIS_REST_URL: : : :: : (feature flag - toggle in Vercel or code)
- UPSTASH_REDIS_REST_TOKEN: : : :: : (feature flag - toggle in Vercel or code)
## 7. Development Workflow Notes
- Local development: use .env.local or set vars in terminal
- Vercel Preview: vars set via Vercel Dashboard or vercel CLI
- Production: vars set via Vercel Dashboard (never in code)
- Never commit .env files to git (already gitignored)
- Use .env.example to document required vars for new contributors

## 7. API Endpoints Overview
- GET /api/jobs : Fetch job listings (requires OPENROUTER_API_KEY)
- POST /api/match : AI matching endpoint (requires OPENROUTER_API_KEY)
- POST /api/cover-letter : Cover letter generation (requires OPENROUTER_API_KEY)
- GET /api/model : Model endpoint
- GET /api/model : Model endpoint
- POST /api/alerts : Alert management
- GET /api/model : Model endpoint

