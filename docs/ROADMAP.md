# Roadmap & Sprint Backlog

This document defines the project phases and the sprint backlog aligned with the project's matching and UX goals. Treat this file as the official development roadmap; all work should align with `docs/AI_CONTEXT.md` and `docs/ARCHITECTURE.md`.

---

## Project Phases

- **Version 1.0 — Core Matching**: live jobs, keyword/city filter, AI scoring, top-5 cards.
- **Version 1.1 — Model Transparency**: show the model in use under the search button.
- **Version 1.2 — Match to Application**: multi-city, AI cover-letter generator, daily digest alerts.
- **Version 1.3 — Polish**: bug fixes and refinement.
- **Version 2.0 — Release**: real email delivery active, accessibility audit, saved profiles.

---

## Current Sprint Status

## Sprint 1.0 Core Matching

✅ Completed

- ✅ Arbeitnow job fetch
- ✅ keyword + city filtering
- ✅ AI scoring (top 5 with why + prepare question)
- ✅ friendly error handling
- ✅ Vercel deployment

---

## Sprint 1.1 Model Transparency

✅ Completed

- ✅ `GET /api/model`
- ✅ model line under the search button

---

## Sprint 1.2 Match to Application

✅ Completed

- ✅ multi-city search (`Berlin, München, Hamburg`)
- ✅ AI cover-letter generator (`/api/cover-letter` + modal + download)
- ✅ daily digest alerts (`/api/alerts`, `/api/cron/digest`)
- ✅ project documentation (`docs/`)

---

## Sprint 1.3 Polish

✅ Completed

- ✅ modal no longer opens on page load (`[hidden]` fix)

---

## Sprint 2.0 Release

🚧 In Progress

- Activate `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` on Vercel.
- Activate `RESEND_API_KEY` + `DIGEST_FROM` (verified Resend domain).
- Verify a real digest email delivery end-to-end.
- Final accessibility audit.
- Add candidate profile persistence.

---

## Sprint 2.1 Automation & Tracking

🟡 Planned

- Auto-drafted application packages (letter + CV placeholder + pre-filled checklist).
- Application tracker with follow-up reminders.
- Email verification on alert signup.

---

## Notes

- Follow the rules in `docs/PROJECT_RULES.md` and `docs/AI_CONTEXT.md`.
- Keep serverless functions dependency-free.
- After each sprint update, summarize modified files in `docs/CHANGELOG.md` and verify endpoints.
