# Build

## Local development

```bash
npm i -g vercel   # once
vercel login      # once
vercel dev        # start local server on http://localhost:3000
```

## Local validation

```bash
node --check app.js
node --check api/jobs.mjs
node --check api/match.mjs
node --check api/cover-letter.mjs
node --check api/alerts.mjs
node --check api/cron/digest.mjs
node --check api/_lib/*.mjs
```

## Production deploy

```bash
vercel --prod
```

## Current status

- Build successful (Vercel build, ~10s)
- Production deployment verified
- Live: https://mays-job-matcher.vercel.app
- Deployed: core matching, multi-city, cover-letter generator, daily alerts, model info display
- Remaining TODOs: activate Upstash + Resend keys for real digest delivery; final accessibility audit

## Expected artifacts

The deployment consists of:

- static files: `index.html`, `styles.css`, `app.js`
- serverless functions under `api/**/*.mjs`

No build output directory is generated (static + functions setup).
