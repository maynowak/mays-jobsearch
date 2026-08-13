# Project Resources

This document contains the official external resources, reference material and permanent project references for **My Job Matcher**.

It is intended for all AI assistants working on this repository.

---

## Documentation Index

All permanent documentation files for this project:

- `AGENTS.md`
- `AI_CONTEXT.md`
- `AI_TEAM.md`
- `AI_AGENT_PLAYBOOK.md`
- `AI_DEVELOPMENT_GUIDE.md`
- `AI_TOOLS_AND_LEARNING_RECORD.md`
- `ARCHITECTURE.md`
- `BUILD.md`
- `CHANGELOG.md`
- `COMPONENT_GUIDE.md`
- `CONTRIBUTING.md`
- `DEPLOYMENT.md`
- `DESIGN_SYSTEM.md`
- `PROJECT_RESOURCES.md`
- `PROJECT_RULES.md`
- `ROADMAP.md`

---

## Current Project Status

**Current Sprint**

Sprint 1.3 – Polish (modal fix deployed)

**Overall Progress**

approximately 80%

**Current Build Status**

Production build verified

**Live URL**

https://mays-job-matcher.vercel.app

---

## Official Project

**Project Name**

My Job Matcher

**Project Type**

Static frontend + Vercel serverless functions

**Owner**

Maymilly Nowak

---

## Official Deployment

**Vercel Project**

maymilly/mays-job-matcher

**Live**

https://mays-job-matcher.vercel.app

---

## External APIs

**Arbeitnow Job Board**

https://www.arbeitnow.com/api/job-board-api

- public, no key
- one page = 176 jobs, updated hourly
- terms: "please do not abuse"

**OpenRouter**

https://openrouter.ai

- keys: https://openrouter.ai/keys
- default model: `openai/gpt-4o-mini`
- env: `OPENROUTER_API_KEY`, optional `OPENROUTER_MODEL`

**Upstash Redis (alerts)**

https://upstash.com

- env: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

**Resend (digest emails)**

https://resend.com

- env: `RESEND_API_KEY`, `DIGEST_FROM`

---

## Technology Stack

**Frontend**

- HTML
- CSS (custom properties / design tokens)
- Vanilla JavaScript

**Backend**

- Node.js serverless functions (`.mjs`, ESM)
- global `fetch` (no npm dependencies)

**Deployment**

- Vercel Functions
- Vercel Cron (`vercel.json`)

---

## Design References

**Atmosphere**

- modern
- clear
- trustworthy
- motivating

**Colors**

- Indigo `#4f46e5`
- Cyan `#22d3ee`
- Ink `#1b2333`
- Slate `#64748b`

**Scores**

- 75+ green
- 50–74 amber
- below 50 red

---

## Accessibility

Always preserve

- semantic HTML
- keyboard navigation
- visible focus states
- `aria-live` for statuses
- sufficient color contrast

---

## Security

- keys are server-side only (`process.env`)
- `.env` and `.vercel/` are gitignored
- never log or expose secrets

---

## AI Entry Point

**Planning**

1. `AI_CONTEXT.md`
2. `AI_TEAM.md`
3. `PROJECT_RESOURCES.md`
4. `ROADMAP.md`

**After planning**

5. `DESIGN_SYSTEM.md`
6. `ARCHITECTURE.md`

Only afterwards inspect source code.

---

## Notes

This document contains only permanent project resources.

Implementation rules belong to:

- `AI_CONTEXT.md`

Team responsibilities belong to:

- `AI_TEAM.md`

Sprint planning belongs to:

- `ROADMAP.md`
