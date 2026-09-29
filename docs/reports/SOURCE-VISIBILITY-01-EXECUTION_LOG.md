# SOURCE-VISIBILITY-01 — Nur Arbeitnow in der Jobquellen-Anzeige

## Current status
INVESTIGATED — Ursache identifiziert, kein Codefehler. Verhalten ist per Design; andere Sources lieferten 0 Jobs für diese Suche.

## Audit date/time
2026-09-29 12:45:00 CET

## Git branch and HEAD
- Branch: main
- HEAD: 89a3ce5
- Working tree: clean (nur dieser Report als neue Datei)

## Audit scope
Befund: Jobquellen-Box zeigt nur `Arbeitnow — 37 Stellen`, `Insgesamt 37 Stellen`. Frage: warum ist nur eine Jobquelle zu sehen? Read-only Prüfung von API-Response und Frontend-Rendering. Keine Codeänderung.

## Completed audit sections
1. Frontend-Rendering geprüft (`src/components/JobSources.tsx`).
2. API-Response-Struktur geprüft (`api/jobs.mjs`, `api/_lib/sources/index.mjs`).
3. Source-Enable-/Empty-Logik geprüft (Arbeitnow, Greenhouse, Arbeitsagentur/Apify, Public-ATS-Factory, `api/_lib/config.mjs`).

## Actual findings
- `JobSources.tsx` zählt **nur Jobs im gelieferten Ergebnis** (`job.source` je Job) und blendet Quellen mit 0 Treffern aus (`.filter(([, count]) => count > 0)`). Es ist eine Ergebnis-Anzeige, keine Registry-Übersicht.
- `Arbeitnow 37 / Insgesamt 37` bedeutet daher: alle 37 Jobs im finalen Pool tragen `source: ["arbeitnow"]`; keine andere Source hat einen Job in diesen Pool eingebracht.
- Warum die anderen Sources 0 beitragen (verifiziert im Code):
  - **Greenhouse (legacy)**: `enabled()` ist default `true`, aber ohne `JOB_SOURCE_GREENHOUSE_BOARDS` liefert `fetchGreenhouseJobs` sofort `emptyResult("no_boards_configured")` → 0 Jobs (`api/_lib/sources/greenhouse.mjs:25-29`).
  - **Arbeitsagentur (Apify)**: ohne `APIFY_API_TOKEN` liefert `fetchActorJobs` sofort `emptyResult("missing_config")` → 0 Jobs (`api/_lib/sources/apify/index.mjs:36-38`).
  - **Public ATS (Lever/Ashby/Workable/Recruitee/Personio/factory-Greenhouse)**: entstehen nur aus `PUBLIC_ATS_SOURCES`; Default ist `[]` (`api/_lib/config.mjs`, `parsePublicAtsSources`), also 0 Instanzen → 0 Jobs.
  - Zusätzlich filtert die Search-Pipeline (Keywords/Ort/Strategie) — Jobs anderer Sources, die nicht zur Suche passen, fallen ebenfalls raus.
- Die vollständige Registry-Info existiert, wird aber von dieser Komponente nicht angezeigt: `/api/jobs` liefert in `meta` zusätzlich `sources` (Roh-Counts je Source inkl. 0), `sourceCounts`, `disabledSources` und `sourceDetails` (`api/_lib/sources/index.mjs:105-117).

## Evidence / file references
- `src/components/JobSources.tsx:22-31` — Zählung aus `job.source`, Filter `count > 0`
- `api/_lib/sources/index.mjs:105-117` — `meta.sources`, `meta.sourceCounts`, `meta.disabledSources`, `meta.sourceDetails`
- `api/_lib/sources/greenhouse.mjs:13-15,25-29` — enabled default true, aber `no_boards_configured` ohne Boards
- `api/_lib/sources/apify/index.mjs:36-38` — `missing_config` ohne `APIFY_API_TOKEN`
- `api/_lib/config.mjs:132,136-157` — `publicAtsSources` default `[]`
- `api/_lib/sources/public-ats/factory.mjs:17-34` — Instanzen nur aus konfigurierten Einträgen

## Classification
**GREEN** — Kein Defekt. Erwartetes Verhalten bei der aktuellen Produktions-Konfiguration (nur Arbeitnow liefert Jobs).

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
Clean; einzige Änderung ist dieser neue Report.

## Files changed
- `docs/reports/SOURCE-VISIBILITY-01-EXECUTION_LOG.md` — neu (dieser Log)

## Explicit confirmation when no files were changed
N/A — genau eine Datei (dieser Report) wurde neu erstellt; kein Applikationscode geändert.

## Open questions
1. Welche `meta.sources` / `meta.disabledSources` / `meta.sourceDetails` liefert die konkrete Produktions-Anfrage? (Ein Blick in die `/api/jobs`-Response im Browser-Netzwerktab bestätigt die Diagnose.)
2. Sollen inaktive/leere Sources in der UI sichtbar sein (z. B. "Greenhouse — nicht konfiguriert")? Das wäre ein separater UI-Task, kein Bugfix.

## Risks
- Keine. Falls gewünscht, kann die Jobquellen-Box um `meta.sourceDetails`/`disabledSources` erweitert werden, damit konfigurierte-aber-leere Sources sichtbar sind.

## Recommended next actions
1. In Vercel prüfen: `JOB_SOURCE_GREENHOUSE_BOARDS`, `PUBLIC_ATS_SOURCES`, `APIFY_API_TOKEN` — je nach gewünschter Quellenabdeckung setzen.
2. Optional (separater Task): `JobSources.tsx` um Hinweiszeile für 0-Treffer-/deaktivierte Sources aus `meta` ergänzen.
3. Diesen Report committen + pushen.

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: Read-only Befund zu Jobquellen-Anzeige und Source-Konfiguration. Kein Model Call, kein AI Provider, kein Consent-/Anonymisierungs-/Fallback-Flow geändert. `docs/AI_AUDITLOG.md` wurde gegen sein Template geprüft; es ist eine Template-Datei, daher wurde kein künstlicher Audit-Eintrag erzeugt.

## Current resume point
Befund dokumentiert. Nächster Schritt: Report committen + pushen; danach optional Vercel-Env prüfen oder UI-Task anlegen.
