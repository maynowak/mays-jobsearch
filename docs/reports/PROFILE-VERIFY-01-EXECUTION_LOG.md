# PROFILE-VERIFY-01 — Profil gegen Fehler-Request und Quellen-Befund geprüft

## Current status
VERIFIED — Das genannte Profil entspricht exakt dem fehlgeschlagenen Request und bestätigt den SOURCE-VISIBILITY-01-Befund.

## Audit date/time
2026-09-29 13:00:00 CET

## Git branch and HEAD
- Branch: main
- HEAD: 3077427
- Working tree: clean (nur dieser Report als neue Datei)

## Audit scope
Prüfen, ob folgendes Profil den Befund bestätigt (nur-Arbeitnow-Anzeige, HTTP-500-Request):
- Skills: `Java AWS Terraform Docker DevOps CI/CD Microservices Spring JPA Hibernate JUnit React TypeScript Angular Node.js Git Jenkins SCRUM TDD Generative AI`
- Zielrollen: `Cloud Architect`, `AI Software Developer`, `DevOps Engineer`
- Stadt: `Michelstadt`, Umkreis: `Entfernung egal` (kein Radius)
Read-only Verifikation gegen Request-URL, Parser-Code und Registry. Keine Codeänderung.

## Completed audit sections
1. Request-URL gegen Profil abgeglichen (Skills, 3× targetRole, city, employmentType, fehlendes radiusKm).
2. Query-Parsing lokal verifiziert (`URLSearchParams` + `parseSkillsParam` alt/neu).
3. Registry-Verhalten mit Default-Env verifiziert (`enabledSources()`, `disabledSources()`, `sourceDetails()`).
4. Radius-Semantik geprüft (`geoCity`-Logik in `sources/index.mjs`).

## Actual findings
1. **Profil == Request.** Die URL aus dem Fehler-Report enthält exakt diese Skills (space-separiert via `+`), exakt diese 3 Zielrollen, `city=Michelstadt`, `employmentType=full_time` und **kein** `radiusKm`. Das Profil bestätigt den Request 1:1.
2. **Skills-Parsing bestätigt den Fix.** Alte Parser-Regel (`/[,;]+/`) machte aus der Skill-Zeichenkette **1 Token** (ganzer String); neue `parseSkillsParam`-Regel (`/[\s,;]+/`) erzeugt **21 Tokens**. Ohne den Fix wäre die Keyword-Suche wirkungslos gewesen.
3. **`Entfernung egal` bestätigt.** Ohne `radiusKm` gilt in `fetchAllJobs` (`sources/index.mjs:61-62`) `geoCity = ""` — Michelstadt wird **nicht** als Source-Filter weitergereicht. Die Stadt schränkt diese Suche also nicht ein (weder positiv noch negativ).
4. **Quellen-Befund bestätigt.** Mit Default-Env (kein `PUBLIC_ATS_SOURCES`, keine Greenhouse-Boards, kein `APIFY_API_TOKEN`) meldet die Registry: `enabled: arbeitnow,greenhouse,arbeitsagentur`, `disabled: (none)`. Alle drei werden abgefragt, aber Greenhouse liefert `no_boards_configured` (0 Jobs) und Arbeitsagentur `missing_config` (0 Jobs) — übrig bleibt nur Arbeitnow. Genau das zeigt die UI (`Arbeitnow 37 / Insgesamt 37`, 0-Treffer-Quellen werden ausgeblendet).
5. **HTTP 500 war ein separates Problem** (defekter `createGreenhouseSource`-Import, Fix `bd02cff`), kein Profil-Problem — das Profil selbst ist valide und wohlgeformt.

## Evidence / file references
- Fehler-Request: `GET /api/jobs?skills=Java+AWS+...&targetRole=Cloud+Architect&targetRole=AI+Software+Developer&targetRole=DevOps+Engineer&city=Michelstadt&employmentType=full_time` (HTTP 500, `FUNCTION_INVOCATION_FAILED`, 29.09.2026)
- `api/jobs.mjs:19-22,45-46` — `parseSkillsParam` mit `/[\s,;]+/`
- `api/_lib/sources/index.mjs:57-70` — `geoCity`-Logik, `Promise.allSettled`, `fetchAllJobs`-Signatur
- Verifikation lokal: `URLSearchParams`-Parse (Skills-String, 3 targetRoles, city, radiusKm=null), Token-Count alt=1 vs neu=21, Registry-Check (enabled/disabled/details)
- `src/components/JobSources.tsx:22-31` — nur Counts > 0 werden angezeigt

## Classification
**GREEN** — Profil verifiziert, Request erklärt, Quellen-Befund bestätigt, keine offenen Widersprüche.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
Clean; einzige Änderung ist dieser neue Report.

## Files changed
- `docs/reports/PROFILE-VERIFY-01-EXECUTION_LOG.md` — neu (dieser Log)

## Explicit confirmation when no files were changed
N/A — genau eine Datei (dieser Report) wurde neu erstellt; kein Applikationscode geändert.

## Open questions
Keine.

## Risks
Keine. Hinweis: Falls `meta.sources` der Produktions-Response wider Erwarten doch Beiträge anderer Sources zeigt, bitte Response hier dokumentieren und neu bewerten.

## Recommended next actions
1. Diesen Report committen + pushen.
2. Bei Bedarf Vercel-Env für weitere Quellen setzen (`JOB_SOURCE_GREENHOUSE_BOARDS`, `PUBLIC_ATS_SOURCES`, `APIFY_API_TOKEN`).

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: Read-only Profil-/Request-Verifikation und Registry-Prüfung. Kein Model Call, kein AI Provider, kein Consent-/Anonymisierungs-/Fallback-Flow geändert. `docs/AI_AUDITLOG.md` wurde gegen sein Template geprüft; es ist eine Template-Datei, daher wurde kein künstlicher Audit-Eintrag erzeugt.

## Current resume point
Verifikation abgeschlossen. Nächster Schritt: Report committen + pushen.
