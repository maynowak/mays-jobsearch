# Build

## Local development

```bash
npm install
npm run dev        # Vite dev server on http://localhost:5173
```

To run everything together (frontend + serverless functions):

```bash
npm i -g vercel    # once
vercel login       # once
vercel dev         # http://localhost:3000
```

## Local validation

```bash
npm run build      # tsc -b && vite build (type check + production build)
```

## Production deploy

```bash
vercel --prod
```

## Current status

- Build successful (`npm run build` verified)
- TypeScript strict mode enabled
- Production deployment on Vercel (static + functions)
- Live: https://mays-job-matcher.vercel.app
- Frontend: React + TypeScript + Vite (rebuilt on branch `feature/react-rebuild`)
- Backend: serverless functions under `api/**/*.mjs` (unchanged)
- Remaining TODOs: activate Upstash + Resend keys for real digest delivery; final accessibility audit

## Expected artifacts

- `dist/` — production build output (HTML, JS, CSS)
- `api/**/*.mjs` — serverless functions deployed by Vercel