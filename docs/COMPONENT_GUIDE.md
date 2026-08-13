# Component Guide

#beschreibt Verhalten und Aufbau der UI-Komponenten.

## Component status

Hero / Header
✅ Complete

Search form
✅ Complete

Alert form (daily digest)
✅ Complete

Status / alert messages
✅ Complete

Match cards
✅ Complete

Score badge
✅ Complete

Cover-letter modal
✅ Complete

Footer
✅ Complete

---

## Search form

Behavior

- collects `skills`, `targetRole`, `city`
- requires at least one of skills or target role
- validates in `app.js`
- calls `GET /api/jobs` then `POST /api/match`

State

- default → button label "Find my matches"
- searching → "Searching the job board…"
- scoring → "Scoring your matches with AI…"

---

## Match card

Props / data

- rank
- score (0–100)
- job: title, company, location[], remote, tags[], url
- why (two sentences)
- prepare (one question)

Actions

- "View original posting →" link
- "Bewerbung generieren" button → opens the cover-letter modal

---

## Score badge

Colors

- `>= 75` green (`score-high`)
- `50–74` amber (`score-mid`)
- `< 50` red (`score-low`)

---

## Cover-letter modal

Behavior

- hidden by default
- opens via the card button
- fetches `POST /api/cover-letter`
- shows loading spinner, then the letter text
- buttons: Kopieren, Download .txt
- closes via ✕, backdrop click, or Escape

---

## Alert form

Behavior

- email field
- "Subscribe to daily digest" → `POST /api/alerts`
- "Cancel my alert" → `DELETE /api/alerts`
- status line shows success or error
