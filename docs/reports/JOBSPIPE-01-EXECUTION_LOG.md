# JOBSPIPE-01 — Jooble durch JobsPipe ersetzen (JOBSPIPE_API_KEY vorhanden)

## Current status
IMPLEMENTED + VERIFIED (Code) — Adapter, Registry-Swap, Jooble-Entfernung, Tests, Doku fertig; Suite 657 passed / 4 skipped, Build OK. Normalisierung am echten JobsPipe-Schema (Sandbox) bewiesen. LIVE-KEY BLOCKIERT: `JOBSPIPE_API_KEY` (Dev) wird als "Invalid API key … may have been revoked" abgelehnt (401; teils 504 auf schwere Queries) — User-Aktion nötig (Key im JobsPipe-Dashboard prüfen/erneuern).

## Audit date/time
2026-10-01 13:10:00 CET

## Git branch and HEAD
- Branch: main
- HEAD: f43e0b5 (plus uncommitted JOB-SOURCES-01 + JOB-SOURCES-LIVE-01 + Adzuna-Alias + AI_TEAM-Eintrag)

## Audit scope
User-Vorgabe: Die Source soll nicht Jooble, sondern JobsPipe heißen; dafür existiert `JOBSPIPE_API_KEY` ("das mit 200 pro Monat"). Vollständiger Ersatz (kein Parallelbetrieb): neuer `jobspipe`-Adapter nach JobsPipe-Doku, Registry-Swap, Jooble-Code/Tests/Doku entfernen bzw. umstellen, UI-Labels, Credit-Guards analog TheirStack (Default 200/Monat global, 20/User), Live-Beweis in Dev-Umgebung. Vorgabe: `docs/AI_AUDITLOG.md` befolgen.

## Completed audit sections
1. **Anbieter identifiziert**: JobsPipe (`jobspipe.dev`, `POST https://api.jobspipe.dev/v1/jobs/search`, Bearer `jp_live_…` oder `x-api-key`). Doku per Fetch verifiziert: Filter (`job_title_or`, `description_or`, `skills_or`, `job_country_code_or`, `posted_at_max_age_days`, `limit` …), Job-Schema (Titel, Firma, Location/Cities, Remote, `technology_slugs`/`keyword_slugs`, `employment_statuses`, Salary-Felder, `date_posted`, `url`/`source_url`, `description`), Fehler via Standard-Mapping (401/403 Key, 402 Credits, 429).
2. **Key-Lage geprüft** (`vercel env ls`, nur Namen): `JOBSPIPE_API_KEY` in Production + Development (frisch gesetzt). Jooble-Key bleibt in Vercel ungenutzt zurück (harmlos).
3. **Jooble-Referenzen inventarisiert**: `api/_lib/sources/jooble.mjs`, `tests/api/jooble-source.test.mjs`, Registry, Config, i18n (`source.jooble` DE/EN), `JobSources.tsx`, `App.test.tsx`, `JobSources.test.tsx`, Registry-Test, `.env.example`, `ATS_JOB_SOURCES.md`, `JOB_SOURCES.md`, `ARCHITECTURE.md`. `JobSource`-Typ ist offen (`string & {}`) — keine Typänderung nötig. Report-Logs sind Historie und bleiben unverändert.

4. **Umsetzung**: `jobspipe.mjs`-Adapter (Bearer, `skills_or`/`job_title_or`/`posted_at_max_age_days`/`limit:40`, L1-Cache 600 s, Monthly-/User-Credit-Guards Default 200/20), Config (`JOBSPIPE_API_KEY`, `JOB_SOURCE_JOBSPIPE_ENABLED`, `JOBSPIPE_MONTHLY_MAX_CREDITS/_PER_USER`), Usage-Counter + Snapshot, Registry-Swap, `jooble.mjs` + Jooble-Tests gelöscht, i18n (`source.jobspipe`), Labels, 12 neue Adapter-Tests, Registry-/App-/JobSources-Tests umgestellt, Doku (`.env.example`, `ATS_JOB_SOURCES.md`, `JOB_SOURCES.md`, `ARCHITECTURE.md`).
5. **Verifikation**: `node --check` alle Module, Export-Check (`usage.mjs` + Registry), Suite 657 passed / 4 skipped, Build OK. Dabei gefunden + sofort gefixt: ein Edit hatte versehentlich `theirstackUserCreditLimitReached` ersetzt (500 im Dev-Lauf) — wiederhergestellt, per Export-Check abgesichert. Hinweis: Unit-Tests mocken `usage.mjs`, daher fiel das erst im Live-Lauf auf.
6. **Live-/Sandbox-Beweise** (`vercel dev` 127.0.0.1:4587, Dev-Env per `env pull`): Docker-Query → arbeitnow 14 + adzuna 2, jobspipe/theirstack `upstream`, greenhouse/arbeitsagentur disabled. Sandbox (keyless, echtes Schema): Normalisierung bewiesen (21 Vertragsfelder, `jp-`-Slugs, Tags, `source: [jobspipe]`). Dev-Server danach gestoppt; Secrets nur in gitignored Files.
7. **TheirStack-Dashboard-Befund (User)**: 4× `POST /v1/jobs/search` heute, Status Error, 0 Credits, 0,3 s, Filter verstanden ("Last 30 days, docker") → schnelle Ablehnung, kein Timeout. Konsequenz: Upstream-Fehlertexte werden jetzt als Excerpt (200 Zeichen, keine Secrets — Key reist im Header) in die HttpError-Messages von TheirStack + JobsPipe aufgenommen, damit Server-Logs künftig die Ursache direkt zeigen. Tests (Status/Code-Assertions) weiter grün (36 passed).

## Actual findings
- JobsPipe-Shape ist TheirStack-kompatibel (`{metadata, data}`, `job_title_or`, `posted_at_max_age_days`, Credit-Abrechnung pro Record) — Adapter folgt dem TheirStack-Muster, plus `skills_or` für serverseitiges Skill-Matching.
- **KEY-BEFUND**: `JOBSPIPE_API_KEY` (Development) wird von der Live-API als `"Invalid API key … may have been revoked"` abgelehnt (direkt: HTTP 401 in 0,3 s; via Dev-Runtime teils HTTP 504 auf schwere Queries). Sandbox (ohne Key) antwortet 200 in 0,19 s mit korrektem Schema — API oben, Key kaputt. Wahrscheinlich: falsch kopiert/abgeschnitten oder widerrufen. Ebenfalls auffällig: Theirstack-Dev-Key wird mit 401/403 abgelehnt ("rejected the credentials").
- Free-Plan: 25 Records/Call; `limit: 40` wie TheirStack; Guards 200/Monat + 20/User wie beauftragt.

## Evidence / file references
- `https://docs.jobspipe.dev/api-reference/jobs-search`, `/filters`, `/job-schema`, `/authentication` (per Fetch verifiziert 2026-10-01)
- `api/_lib/sources/theirstack.mjs` — Adapter-Vorlage (Guards, Cache, Normalisierung)
- `tests/api/jooble-source.test.mjs` — Test-Vorlage (Mock-Muster)

## Classification
**YELLOW** — Code fertig + verifiziert, aber Live-Key ungültig: JobsPipe liefert in Dev/Prod 0, bis der Key erneuert ist. Kein AI-Datenfluss betroffen.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
- 14× modified + 4× neu + 2× gelöscht (jooble.mjs, jooble-test), ungepusht. `.vercel/`/`.env*` gitignored.

## Files changed, if any
- `api/_lib/sources/jobspipe.mjs` — neu (Adapter, Guards, Normalisierung)
- `api/_lib/config.mjs` — Jooble-Block → JobsPipe-Block (Key, Flag, Credit-Guards 200/20)
- `api/_lib/usage.mjs` — JobsPipe-Credit-Counter + Snapshot (dabei TheirStack-Export versehentlich ersetzt und wiederhergestellt)
- `api/_lib/sources/index.mjs` — Registry-Swap
- `api/_lib/sources/jooble.mjs`, `tests/api/jooble-source.test.mjs` — gelöscht
- `tests/api/jobspipe-source.test.mjs` — neu (12 Tests)
- `tests/api/sources-registry.test.mjs`, `src/App.test.tsx`, `src/components/JobSources.{tsx,test.tsx}`, `src/i18n.tsx` — Jooble→JobsPipe
- `.env.example`, `docs/ATS_JOB_SOURCES.md`, `docs/JOB_SOURCES.md`, `docs/ARCHITECTURE.md` — Doku umgestellt
- `docs/reports/JOBSPIPE-01-EXECUTION_LOG.md` — neu (dieser Log)

## Explicit confirmation when no files were changed
N/A — dieser Log ist neu; Code-Änderungen folgen im Umsetzungsschritt.

## Open questions
1. ~~Jooble-Key löschen oder behalten?~~ — Jooble ist raus; `JOOBLE_API_KEY` in Vercel kann gelöscht werden (tote Secret vermeiden). Gleiches gilt für Theirstack-Key-Prüfung (Dev-Key wird 401-abgelehnt).
2. **JobsPipe-Key erneuern** (JobsPipe-Dashboard → neuer Key → `vercel env add JOBSPIPE_API_KEY` für Development + Production → Redeploy), danach Docker-Query erneut prüfen.
3. `JOB_SOURCE_JOBSPIPE_ENABLED`-Flag nötig, oder immer an? (Umgesetzt: Flag wie bei allen Quellen, Default true.)

## Risks
- JobsPipe-Upstream-Verhalten (401/402/429-Codes) ist doku-basiert, nicht live-gegengeprüft → Live-Beweis in Dev-Umgebung ist Pflichtschritt vor Prod-Freigabe.
- Credit-Verbrauch: `skills_or`-Serverfilter + `limit: 40` + L1-Cache (600 s) + Monthly/User-Guards begrenzen Kosten; `include_technologies` wird NICHT gesetzt (kostet Extra-Credits).
- Jooble-Entfernung: `JOOBLE_API_KEY` bleibt als ungenutzte Env zurück (Frage 1).

## Recommended next actions
1. JobsPipe-Key im Dashboard prüfen/erneuern und in Vercel (Development + Production) setzen.
2. Mit gültigem Key: 1× Docker-Query via `vercel dev` (JobsPipe-Treffer erwartet) — danach committen + pushen + Preview/Prod-Deploy.
3. Tote Vercel-Secrets aufräumen (`JOOBLE_API_KEY`; Theirstack-Key prüfen).

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: Job-Source-Austausch (Jooble → JobsPipe) in deterministischer Suchpipeline: neuer Adapter + Registry + Guards + Anzeige. Kein Model Call, kein AI Provider, kein Matching-/Consent-Flow geändert. `docs/AI_AUDITLOG.md` ist Template-/Prozess-Datei; geführt wurde dieser Report-Log (laufend aktualisiert, inkl. Nachholen der Template-Sektionen).

## Current resume point
Code fertig/verifiziert; blockiert am ungültigen Live-Key (User-Aktion). Danach: Key-Proof → committen + pushen.
