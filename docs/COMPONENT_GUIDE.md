# Component Guide

#beschreibt Verhalten und Aufbau der UI-Komponenten.

## Component status (Stand 2026-10-02; vollständig: `ls src/components/*.tsx`)

Hero / Header
✅ Complete

Landing hero / Navbar
✅ Complete

Search form
✅ Complete (inkl. Umkreis/Arbeitsmodell/Arbeitszeit, Multi-City, CV-Profil/targetRoles)

CV upload (+ CV-Workflow: `CvConsentGate`, `CvAnonymizationChoice`, `CvModelSelector`, `CvProcessingStatus/Steps`, `CvProfileResult`, `CvGoalSelection`, `CvDocumentList`, `CvProfilesOverlay`)
✅ Complete

Model selector (`ModelSelector` für Matching, `CvModelSelector` für CV-Flow)
✅ Complete

Job sources (inkl. `disabledSources`/`sourceReasons`, Cut-Rows, `SourcesInfo`, `SourceBadge`)
✅ Complete

Alert form (daily digest)
✅ Complete

Status / alert messages (+ `ErrorBoundary`, `RemainingCard`)
✅ Complete

Match cards
✅ Complete

Results (top-5 + expand)
✅ Complete

Score badge
✅ Complete

Cover-letter modal (`LetterModal`, inkl. Prep-Antwort)
✅ Complete

Footer (+ `Imprint`, `PrivacyNotice`, `ConsentGate`, `FieldClear`)
✅ Complete

ATS overlay (`AtsOverlay`/`ATSDetails`)
✅ Complete

---

## Search form

Behavior

- collects `skills`, `targetRole`/`targetRoles`, `city`, `radiusKm` (Umkreis), `workMode` (remote/hybrid/onsite, multi), `employmentType`, multi-city, CV-Profil
- requires at least one of skills or target role
- validated in `App.tsx` (`runSearch`)
- calls `GET /api/jobs` then `POST /api/match`

State

- default → button label "Find my matches"
- searching → "Searching the job board…"
- scoring → "Scoring your matches with AI…"

---

## CV upload

Behavior

- drop zone + file input accept only PDF (drag & drop, keyboard, click)
- validates file type and size (max 10 MB)
- reads the PDF in the browser with PDF.js (`src/lib/pdf.ts`)
- normalizes the extracted text and computes a SHA-256 hash (`crypto.subtle`)
- checks the profile cache (localStorage L1, then `/api/profile` with the hash → Redis L2)
- on cache hit the stored profile is shown; on miss the AI builds one
- `EditableProfile` lets the user edit skills, experience level, target roles and city (with autocomplete) before confirming

Privacy

- the PDF is never uploaded as a file; only extracted text is sent once
- cache stores only the hash and the structured profile, never raw CV text

State

- idle → reading (PDF parse) → creating (AI) → ready (editable profile)
- error states: not a PDF, too large, scanned/unreadable, model unavailable

---

## Model selector

(`ModelSelector.tsx` für Matching — `CvModelSelector.tsx` ist die CV-Flow-Variante.)

Behavior

- custom listbox (ARIA combobox/listbox) replacing the native select
- shows a recommended-model section plus the other free models from `/api/models`
- models are labeled "Provider · Modellname" (`modelDisplayName`), because the catalogue aggregates multiple AI providers (OpenRouter first, EdenAI second)
- keyboard navigation: Arrow keys, Home/End, Enter/Space, Escape, Tab
- outside-click and Escape close the popover
- popover flips upward when there is not enough space below the trigger
- selection is passed to `/api/match`, `/api/profile` and `/api/cover-letter`

State

- loading → disabled trigger with "Loading…"
- ready → interactive listbox; **disabled (locked) while a search/scoring is running** (`disabled` prop from `App`, driven by `isSearching`), re-enabled once the search completes
- error / empty → disabled trigger with a hint

---

## Job sources

Behavior

- small module directly below the search button, clearly separated from the AI model selector
- computes real per-source counts from the delivered jobs' `source[]` arrays (source ids: `arbeitnow`, `arbeitsagentur`, `adzuna`, `jobspipe`, `theirstack`, `greenhouse` + Public-ATS)
- only sources with a count > 0 are shown; a total line summarizes all delivered jobs
- zusätzlich: Cut-Rows für liefernde, aber herausgefilterte Quellen (`deliveredCounts`) sowie inaktive Zeilen für `disabledSources`/`sourceReasons` (seit JOB-SOURCES-01) — keine liefernde oder fehlende Quelle bleibt kommentarlos
- pure frontend computation over the delivered `foundJobs` — no additional request
- label mapping is data-driven with a fallback to the raw source id for future sources (no code changes needed when a new source is added)

---

## Match card

Props / data

- rank
- score (0–100)
- job: title, company, location[], remote, tags[], url, source[]
- why (two sentences)
- prepare (one question)

Actions

- "View original posting →" link
- "Bewerbung generieren" button → opens the cover-letter modal

---

## Results

Behavior

- shows the top 5 matches initially (`INITIAL_MATCHES = 5`)
- if more than 5 evaluated matches exist, a toggle expands the list locally to all evaluated matches
- expanding/collapsing is local — it never triggers another `/api/match` request
- heading reflects the count ("Deine besten Matches", "Top 5 von 10", "Alle 10 bewerteten Treffer")

---

## Score badge

Colors

- `>= 75` green (`score-high`)
- `50–74` amber (`score-mid`)
- `< 50` red (`score-low`)

---

## Cover-letter modal (`LetterModal.tsx`)

Behavior

- hidden by default
- opens via the card button
- fetches `POST /api/cover-letter`
- shows loading spinner, then the letter text **plus Prep-Antwort**
- buttons: Kopieren, Download .txt
- closes via ✕, backdrop click, or Escape

---

## Alert form

Behavior

- email field
- "Subscribe to daily digest" → `POST /api/alerts`
- "Cancel my alert" → `DELETE /api/alerts`
- status line shows success or error
