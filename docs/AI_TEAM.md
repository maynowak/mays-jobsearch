# AI Team

## Human Developer

**Maymilly Nowak**

- Product Owner
- defines goals and vision
- final technical decisions
- browser testing and QA
- Git checkpoints and releases
- deployment decisions

## AI Collaborators

**GPT (OpenAI) — Chief Architect / Planung / Review**

- architecture and UX consultation
- requirement refinement
- technical review of changes (git diff / code review)
- process guidance before implementation and deployment
- planning and review authority for technical decisions

**DeepSeek V4 Flash Free (opencode) — Implementation / Engineering**

- full application implementation
- serverless functions and shared helpers
- frontend build
- error handling design
- multi-city filtering
- cover-letter generator
- alert system + cron digest
- Vercel deployment and environment setup
- live endpoint verification
- project documentation

**Nemotron — Analyse / Gegenprüfung / technische Zweitmeinung**

- analysis and cross-checking of existing decisions and implementations
- technical second opinion and plausibility control
- documentation review (consistency, completeness, risks)
- points out inconsistencies, risks and missing documentation

Nemotron may review existing decisions and flag problems. Nemotron must **not** independently:

- deploy to production
- change secrets
- modify provider configuration
- bypass safety rules
- override a BLOCKED step on its own
- continue the workflow without approval

The role integrates into the existing team structure; no existing role is renamed.

**Kimi K3 (opencode) — UX-Umsetzung / CV-Workflow / Recovery & Audit-Doku**

- Crash-/Verbindungsabbruch-Recovery: Rekonstruktion des Arbeitsstands aus AI_AUDITLOG.md + Git-Status
- CV-Upload-Prozessanalyse (Pfad A/B, Schritt-Tabellen der Workflow-Zustände)
- CV-UPLOAD-UX-01: Workflow-Overlay (Pfad B) direkt nach dem Upload (Consent-Overlap-Fix; Menü nach dem Schließen unter der Suchmaske)
- CV-UPLOAD-UX-02: Workflow-Overlay auf allen Viewports (Mobile-Vollbild-Sheet statt Inline)
- CV-UPLOAD-UX-03: Schritt-Reihenfolge — Anonymisierung vor Modellwahl (Privacy Boundary in Ablauf + Anzeige)
- CV-UPLOAD-UX-04: Skills-Bestätigung vor ATS-Analyse (Analysebasis = bestätigte Skills)
- Testanpassung (vitest) und Validierung (Tests / TypeScript / Build / git diff --check)
- Audit-Logging nach Template (docs/AI_AUDITLOG.md + docs/reports/…-EXECUTION_LOG.md)

Kimi K3 arbeitet nach dem Working Agreement: Commits/Pushes nur nach ausdrücklicher Freigabe; Audit-Einträge nach Muster in AI_AUDITLOG.md. Stand der Beiträge: 2026-09-26.

**Muse Spark (opencode) — Job-Source-Konsolidierung / Live-Verifikation / Audit-Doku**

- CV-SEARCH-SILENT-01: stiller Abbruch beim Saved-Profile-Suchstart → sichtbare Fehlermeldung, `arraysEqual`-Härtung, `findSavedSearchProfile`-Helper + Tests
- JOB-SOURCES-01: ehrliches `enabled()` (Flag + Config) für Adzuna/Jooble/Theirstack/Greenhouse/Arbeitsagentur, Apify-Skill-Query Space-Join, `disabledSources`/`sourceReasons` in der JobSources-UI (DE/EN) + Tests
- JOB-SOURCES-LIVE-01: Vercel-Dev-Weg per CLI (`vercel link`, `env pull`, `vercel dev`), gated Live-Test `tests/api/sources-live.test.mjs`, Vorher-/Nachher-Beweise (Prod-curl + lokaler Handler + Dev-Runtime mit echten Dev-Keys)
- Adzuna-Alias `ADZUNA_APPLICATION_ID`/`ADZUNA_APPLICATION_KEY` in `getConfig()` + Doku (End-to-End-Nachweis: Adzuna liefert live)
- Audit-Logging nach Template (docs/AI_AUDITLOG.md + docs/reports/…-EXECUTION_LOG.md)

Muse Spark arbeitet nach dem Working Agreement: Commits/Pushes nur nach ausdrücklicher Freigabe; keine Secrets in Code, Logs oder Doku. Stand der Beiträge: 2026-10-01.

**Space Bunny (opencode, Modell `space-bunny-free`) — Discovery-/Gap-Audits / Profil-Datenmodell / Auth-GUI / Search-World-Visualisierung**

- RIS-JOBSEARCH-04: Discovery-/Gap-Report zu IdP, Login/Auth, JWT/Claims, User-/Tenant-Identity, UserProfile, JobSearch ↔ RIS, Google-Federation, Account Linking (read-only, Gate-Frage mit belastbarer Evidenz beantwortet)
- PROFILE-HIERARCHY-01 bis -05: IST-Audit der CV-/SearchProfile-/ATS-Hierarchie (Code, Tests, Browser-Beleg), Datenmodell- und Migrations-Gap, Flow-Audit CV → SearchProfile → ATS-Suche, Target-Spezifikation, Kapazitätsfestlegung 10/2/5
- REGISTRATION-UI-01 + AUTH-UI-01: Login- und Registrierungsmaske als reine Frontend-GUI (Validierung, Platzhalter statt Backend, i18n DE/EN, Routen, Tests) — bewusst ohne Cognito/API/Persistenz
- SEARCH-HERO-BG-01/-02/-03, SEARCH-BG-POSITION-01, SEARCH-WORLD-01/-02: visuelle Verpackung des Search-Bereichs (Atrium-Hintergrund als Layer, „Future Search World", Top-Light-Portal, Intelligence-Deck, halbrunder Boden) inkl. Responsive- und Browser-Verifikation
- Strukturierte Regressionstests (`SearchLayout.test.tsx`) zur Absicherung der Layout-Reihenfolge
- Audit-Logging nach Template (docs/AI_AUDITLOG.md + docs/reports/…-EXECUTION_LOG.md)

Space Bunny arbeitet nach dem Working Agreement: Commits/Pushes nur nach ausdrücklicher Freigabe; keine Secrets in Code, Logs oder Doku; keine Architektur- oder Produktentscheidung ohne belastbare Quelle. Stand der Beiträge: 2026-10-05.

## Working Agreement

- AI contributions are proposals.
- Human verifies everything against the real application.
- AI never commits or pushes without explicit approval.
- AI never exposes or logs secrets.

## Collaboration Loop

**Human idea → AI proposal → technical check → human review → Git checkpoint**
