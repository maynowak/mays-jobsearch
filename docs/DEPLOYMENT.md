# Deployment

#Vercel

#Serverless Functions

#Vercel Cron

#Environment Variables

## Deploy

```bash
npm i -g vercel
vercel login
vercel link
vercel --prod
```

## Project

Vercel project: `maymilly/mays-job-matcher`

Live URL: https://mays-job-matcher.vercel.app

## Environment variables (all server-side)

| Variable | Purpose |
|---|---|
| `OPENROUTER_API_KEY` | AI scoring + cover letters |
| `OPENROUTER_MODEL` (optional) | Override default model |
| `APIFY_API_TOKEN` (optional) | Second job source: Arbeitsagentur feed via Apify. Without it, only Arbeitnow is used. |
| `UPSTASH_REDIS_REST_URL` | Alert subscriptions |
| `UPSTASH_REDIS_REST_TOKEN` | Alert subscriptions |
| `RESEND_API_KEY` | Digest emails |
| `DIGEST_FROM` | Sender address (verified Resend domain) |
| `CRON_SECRET` | Protects `/api/cron/digest` |

## Add an environment variable (CLI)

```bash
vercel env add OPENROUTER_API_KEY   # then choose production / preview / development
vercel --prod                        # redeploy so the variable is used
```

## Cron

Defined in `vercel.json`:

- path: `/api/cron/digest`
- schedule: `0 7 * * *` (daily 07:00 UTC)
- protected via `Authorization: Bearer <CRON_SECRET>` or the `x-vercel-cron` header

## CI/CD

- Not yet automated.
- Recommended: push to GitHub → import in Vercel → auto-deploy on push.

#Domain

- Custom domain not yet configured.

#CI/CD

- Planned (GitHub + Vercel auto-deploy).
