# My Job Matcher

Find live jobs that actually fit you. You type your **skills**, **target role** and **city**, and the app:

1. Fetches current openings from the free [Arbeitnow job API](https://www.arbeitnow.com/api/job-board-api) (no key needed).
2. Filters them by your keywords and city (`/api/jobs`).
3. Sends the filtered jobs + your profile to the OpenRouter chat API (`/api/match`), which scores each job **0–100** and returns the **top 5** with:
   - the score,
   - **two sentences on why** it fits you,
   - **one question** to prepare for the interview.

Your OpenRouter API key lives **only** on the server (`/api/match`) — it is never exposed to the browser.

## Project structure

```
├── api/
│   ├── _lib/filter.mjs   # shared Arbeitnow fetching + filtering
│   ├── jobs.mjs          # GET /api/jobs  → filtered jobs from Arbeitnow
│   └── match.mjs         # POST /api/match → AI-scored top 5 matches (uses OPENROUTER_API_KEY)
├── index.html            # form + results UI
├── app.js                # frontend logic
├── styles.css
└── vercel.json           # function timeout config
```

## Run locally

1. Install the Vercel CLI (once): `npm i -g vercel`
2. `npm run dev` → opens the app at `http://localhost:3000` (functions run at `/api/jobs` and `/api/match`).
3. For AI scores to work locally, create `.env` with your key (see `.env.example`).

## Setting up OpenRouter

1. Create an account at <https://openrouter.ai> and grab an API key from <https://openrouter.ai/keys>.
2. The model defaults to `openai/gpt-4o-mini`; override with an `OPENROUTER_MODEL` env var if you like.

## Deploying to Vercel + adding the environment variable

**Option A — using the Vercel dashboard:**

1. Push this folder to a GitHub repo.
2. Go to <https://vercel.com/new>, click **Import** on the repo.
3. Before or after deploying, open **Project → Settings → Environment Variables** and add:
   | Name | Value |
   |---|---|
   | `OPENROUTER_API_KEY` | `sk-or-v1-…` (your key) |
4. Click **Deploy**. Add the variable to **Production** (and Preview if you want it there too), then redeploy if the variable was added after the first build.

**Option B — using the CLI:**

```bash
npm i -g vercel
vercel login
vercel link
vercel env add OPENROUTER_API_KEY   # paste your key, choose production/preview/development
vercel --prod
```

After deployment, the app is live at `https://<project>.vercel.app`.

## Error handling

- Job board unreachable rate-limited / broken → friendly message, no crash.
- Missing `OPENROUTER_API_KEY` → the site tells you the server isn't configured yet.
- Invalid key (401) / out of credits (402) / AI rate limit (429) / malformed AI response → each gets its own clear message.

## Example

```
Skills:        JavaScript, React, Node.js
Target role:   Frontend Developer
City:          Berlin
```

→ `Find my matches` → ranked cards with scores, short "why this fits", and a prep question for each.