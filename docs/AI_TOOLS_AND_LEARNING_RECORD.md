# AI Tools & Learning Record

This file records which AI tools were used on **My Job Matcher** and what was learned.

## 2026-08-13

**Tool:** DeepSeek V4 Flash Free (opencode)

**Work performed:**

- Built the full application (frontend + serverless functions).
- Implemented Arbeitnow fetching and multi-city/keyword filtering in `api/_lib/filter.mjs`.
- Implemented AI scoring (`/api/match`) and cover-letter generation (`/api/cover-letter`) via OpenRouter with a shared `chat()` helper in `api/_lib/ai.mjs`.
- Implemented digest alerts (`/api/alerts`, `/api/cron/digest`) with Upstash Redis storage and Resend email, using only global `fetch` (no npm dependencies).
- Deployed to Vercel, added `OPENROUTER_API_KEY` as a production environment variable, verified endpoints live.

**Lessons learned:**

- A CSS `display` rule overrides the HTML `hidden` attribute; fix with `[hidden] { display: none !important }`.
- The Arbeitnow API returns `location` as either an array or a string — normalize before use.
- Multi-word keyword phrases must be tokenized per field, not concatenated, or no jobs match.
- AI score strings like `"87/100"` need dedicated parsing, not generic digit stripping.
- Vercel deploys a directory named `Mays-Jobsearch` only after an explicit `--name`, and nested `api/cron/*.mjs` needs `api/**/*.mjs` in the functions config.
- Keys shared in chat should be rotated if there is any concern.

## 2026-09-29

**Tools:** Google AI (suggestion: Nominatim geocoding + text-based work-mode detection) + Muse Spark (review, corrected implementation, tests, docs)

**Work performed:**

- New `api/_lib/geo.mjs`: `geocodeCity()` via Nominatim (fixed endpoint URL, valid User-Agent, 8s timeout, 30-day Redis cache, graceful `null` fallback) + `haversineKm()` for future per-job radius filtering.
- Geo integration: `fetchAllJobs` resolves the search city once per request (only when city + numeric radius are set), passes `geo` to sources, exposes `meta.geo`; Apify actor input receives additive `latitude`/`longitude`/`radiusKm` (actors ignore unknown fields).
- New `deriveWorkMode()` in `api/_lib/filter.mjs` (remote → hybrid → onsite keyword detection, provider metadata first, onsite default) + strict matching in `workModeMatches` (remote-only fast path preserved).
- Tests: `tests/api/geo.test.mjs` (8, mocked Nominatim/cache), `deriveWorkMode`/`workModeMatches` cases in `tests/api/filter.test.js`.
- Report: `docs/reports/GEO-WORKMODE-GOOGLE-AI-01-EXECUTION_LOG.md`.

**Lessons learned:**

- Google AI's Nominatim snippet had a broken URL (`openstreetmap.org{encodeURIComponent(...)}` → must be `nominatim.openstreetmap.org/search?q=...`) and a malformed contact in the User-Agent — always verify generated endpoint code against the provider docs.
- Nominatim usage policy requires a valid User-Agent and ~1 req/sec; server-side caching is mandatory, never call per job.
- Per-job radius filtering is impossible without job coordinates — geocode the search city (cheap, cacheable), pass coordinates additively, document the rest as upgrade point.
- Text-derived `onsite` default + strict multi-select matching changes filter semantics: verify existing tests first (remote-only/empty selections were unaffected here).

## 2026-10-05

**Tool:** Space Bunny (opencode, Modell `space-bunny-free`)

**Work performed:**

- Read-only Discovery-/Gap-Audits (RIS-JOBSEARCH-04, PROFILE-HIERARCHY-01 bis -05): Identity-/Produktverträge, Profil-Datenmodell, Migrations-Gap, Search-/ATS-Flow mit Code-, Test- und Browser-Belegen; Kapazitätsfestlegung 10/2/5 als Produktvorgabe.
- Reine Frontend-GUI-Schritte ohne Backend (REGISTRATION-UI-01, AUTH-UI-01): Login-/Registrierungsmasken mit Frontend-Validierung, Platzhalter-Zuständen, i18n DE/EN, SPA-Routen und Tests.
- Visuelle Verpackung des Search-Bereichs (SEARCH-HERO-BG-01/-02/-03, SEARCH-BG-POSITION-01, SEARCH-WORLD-01/-02): Atrium-Bild als Hintergrund-Layer statt Streifen, „Future Search World" mit Intelligence-Deck, Top-Light-Portal und halbrundem Boden; responsive Layering per z-index, ohne Animation.
- Strukturierte Regressionstests für die Layout-Reihenfolge; Execution Logs nach AI_AUDITLOG-Template.

**Lessons learned:**

- Ein Feature kann strukturell bereits korrekt sein und trotzdem als „falsch" wirken: Erst die tatsächliche Reihenfolge im Browser messen (auch mit Ergebnissen, nicht nur im Leerzustand), dann entscheiden — hier ersetzte die Messung eine vermeintlich nötige Änderung.
- Production muss gegen den echten Build geprüft werden, nicht gegen den Push: Vercel-Deploys laufen in diesem Projekt explizit über CLI.
- Hintergrundbilder als `cover`-Layer brauchen einen Höhen-Deckel, sonst überdehnt das Bild bei langen Ergebnislisten (Über-Zoom).
- Wo eine Auftragsprämisse (z. B. „10 × 10 × 10") nicht im Code existiert, gehört das als Befund dokumentiert, nicht als Ist-Zustand behauptet.
- Bei reinen Darstellungsaufgaben: bestehende Regressionstests mit Struktur-Assertions absichern, damit die Komposition nicht unbemerkt verrutscht.

## Future record

Add entries here after each meaningful AI-assisted work session.
