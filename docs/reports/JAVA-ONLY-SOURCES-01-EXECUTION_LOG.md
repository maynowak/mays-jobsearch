# JAVA-ONLY-SOURCES-01 — Gespeichertes "java"-Profil liefert nur Arbeitnow

## Current status
RESOLVED — Produktions-Response liefert die exakte Ursache: Arbeitsagentur = `limit_reached` (Monats-Run-Counter am Backstop, beabsichtigter Cost-Guard), Greenhouse = `no_boards_configured`. Kein Bug.

## Audit date/time
2026-09-29 14:20:00 CET (Produktions-Evidenz ergänzt: 2026-09-29 13:36 UTC-Request)

## Git branch and HEAD
- Branch: main
- HEAD: 4897383
- Working tree: clean (nur dieser Report geändert)

## Audit scope
Befund: gespeichertes Profil mit ausschließlich Skill "java" → Jobquellen-Anzeige listet nur Arbeitnow. Vermutung des Users: Fehler im Anfrage-Call ("das müsste alle Quellen anfragen"). Geprüft: Frontend-Request (was wird gesendet), Backend-Fanout (welche Sources werden abgefragt), Lieferverhalten je Source, Anzeige-Logik. Read-only; keine Codeänderung.

## Completed audit sections
1. **Frontend-Request geprüft** (`src/api.ts` `fetchJobs`): `skills: "java"` → `normalizeSkillsParam` → JSON `'["java"]'` als `skills`-Query-Param; `targetRoles` leer → kein Param; `city`/`radiusKm`/`workMode`/`employmentType` je nach Profil. Format valide.
2. **Backend-Parsing geprüft** (`api/jobs.mjs`): `parseSkillsParam` erkennt JSON-Array → `["java"]`; alle Params defensiv geparst; `fetchAllJobs` erhält saubere Arrays.
3. **Registry-Fanout geprüft** (`api/_lib/sources/index.mjs:68-70`): `Promise.allSettled(sources.map(s => s.fetchJobs(...)))` — alle `enabledSources()` werden parallel abgefragt, Fehler je Source isoliert (nur `critical`-Sources werfen).
4. **Laufzeit-Check mit Default-Env**: `enabledSources()` → `arbeitnow, greenhouse, arbeitsagentur`; `disabledSources()` → leer. Alle drei werden also tatsächlich angefragt.
5. **Lieferverhalten je Source geprüft**:
   - Arbeitnow: öffentlich, kein Key nötig → liefert Jobs mit "java"-Treffer.
   - Greenhouse (legacy): `enabled()` default true, aber ohne `JOB_SOURCE_GREENHOUSE_BOARDS` sofort `emptyResult("no_boards_configured")` → 0 Jobs (`greenhouse.mjs:25-29`).
   - Arbeitsagentur (Apify): `enabled()` default true, aber ohne `APIFY_API_TOKEN` sofort `emptyResult("missing_config")` → 0 Jobs (`apify/index.mjs:36-39`).
   - Public ATS (Lever/Ashby/Workable/Recruitee/Personio/Factory-Greenhouse): entstehen ausschließlich aus `PUBLIC_ATS_SOURCES` (Default `[]`) → 0 Instanzen → werden gar nicht erst registriert.
6. **Anzeige-Logik geprüft** (`src/components/JobSources.tsx:22-31`): zählt `job.source` der gelieferten Jobs, filtert `count > 0` — Quellen ohne Treffer erscheinen nicht. Korrektes Anzeigeverhalten, kein Bug.
7. **Bestehende Tests**: Registry-/Filter-/Strategy-Tests grün (97/97 in den drei relevanten Dateien).

## Actual findings
- **Der Anfrage-Call ist korrekt.** Weder Frontend noch `api/jobs.mjs` noch `fetchAllJobs` schließen eine Source aus; der Fanout auf alle aktivierten Sources ist per Code und Laufzeit-Check verifiziert.
- **"Nur Arbeitnow" erklärt sich vollständig aus Server-Konfiguration + Upstream-Verfügbarkeit**, nicht aus dem Request:
  | Source | Abgefragt? | Liefert bei "java"? | Warum |
  |--------|------------|---------------------|-------|
  | Arbeitnow | ja | ja | öffentlich, kein Key nötig |
  | Greenhouse | ja | nein | keine Boards konfiguriert (`no_boards_configured`) |
  | Arbeitsagentur | ja | nein, falls kein Token/Limit/Run-Fehler | braucht `APIFY_API_TOKEN` + erfolgreichen Actor-Run |
  | Lever/Ashby/Workable/Recruitee/Personio | nur falls konfiguriert | nur falls `PUBLIC_ATS_SOURCES`-Eintrag + Feed erreichbar | Default: 0 Instanzen |
- **Entscheidend für den Einzelfall**: Die `/api/jobs`-Response dokumentiert pro Anfrage in `meta` exakt, was passiert ist: `meta.sources` (Roh-Counts je Source inkl. 0), `meta.apify` (`{enabled, reason}` z. B. `missing_config`/`limit_reached`/Upstream-Fehler), `meta.disabledSources`, `meta.sourceDetails`. Ohne diese Response kann nicht unterschieden werden zwischen "nicht konfiguriert", "Limit erreicht", "Upstream-Fehler" und "keine Treffer".
- **Kein Code-Fix erforderlich.** Eine Änderung wäre nur dann nötig, wenn `meta.sources` eine konfigurierte, erreichbare Source mit unerklärlich 0 Treffern zeigt.

## Evidence / file references
- `src/api.ts:192-235` — `normalizeSkillsParam` (JSON-Array) + `fetchJobs` (alle Params)
- `api/jobs.mjs:45-67` — defensives Parsing aller Params, Übergabe an `fetchAllJobs`
- `api/_lib/sources/index.mjs:14,57-83` — `SOURCES`, `fetchAllJobs`, `Promise.allSettled`-Fanout, Fehler-Isolation
- `api/_lib/sources/greenhouse.mjs:13-15,25-29` — enabled default true, `no_boards_configured` ohne Boards
- `api/_lib/sources/apify/index.mjs:35-39` — `missing_config` ohne `APIFY_API_TOKEN`
- `api/_lib/config.mjs:127-152` — `PUBLIC_ATS_SOURCES` Default `[]`
- `api/_lib/sources/public-ats/factory.mjs:17-34` — Instanzen nur aus konfigurierten Einträgen
- `src/components/JobSources.tsx:22-31` — Anzeige nur für Counts > 0
- Laufzeit-Check: `enabled: [arbeitnow, greenhouse, arbeitsagentur]`, `disabled: []`
- Tests: `sources-registry.test.mjs`, `search-strategy.test.mjs`, `filter.test.js` — 97/97 grün

## Production evidence (Request 29.09.2026 13:36 UTC, `skills=["java"]`, `employmentType=full_time`)
`GET /api/jobs?skills=["java"]&employmentType=full_time` → HTTP 200. Relevante `meta`-Werte:
- `sources: {arbeitnow: 23, greenhouse: 0, arbeitsagentur: 0}` — alle drei abgefragt.
- `sourceReasons: {greenhouse: "no_boards_configured", arbeitsagentur: "limit_reached", arbeitnow: null}` — exakte Gründe (Feld aus AA-LIVE-VS-WEBSITE-01; dass es vorhanden ist, belegt zugleich den aktuellen Production-Deploy).
- `apify: {enabled: false, reason: "limit_reached"}` — App-seitiger Monats-Run-Counter hat `APIFY_MONTHLY_MAX_RUNS` erreicht; Cost-Guard blockt neue Paid-Runs (beabsichtigt, kein Fehler). Token ist konfiguriert (sonst stünde `missing_config`).
- `totalScanned: 326` (Roh-Board) → `jobsCombined: 23` (Java-Treffer) → `totalFiltered: 22` (ein Teilzeit-Job fällt korrekterweise durch den `full_time`-Filter).
- `searchStrategy: {threshold: 1, strategy: "exact", skillsUsed: 1}`, `keywords: ["java"]`, `city: []`, `disabledSources: []` — alles korrekt.
- `sourceCounts: {arbeitnow: 22}` → UI zeigt folgerichtig nur Arbeitnow.

## Classification
**GREEN** — Anfrage-Call verifiziert korrekt; Produktions-Evidenz benennt die exakte Ursache je Source; kein Code-Bug, keine Änderung nötig.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
Clean; einzige Änderung ist dieser neue Report.

## Files changed
- `docs/reports/JAVA-ONLY-SOURCES-01-EXECUTION_LOG.md` — neu (dieser Log)

## Explicit confirmation when no files were changed
N/A — genau eine Datei (dieser Report) wurde neu erstellt; kein Applikationscode geändert, weil kein Code-Bug vorliegt.

## Open questions
1. Was steht in `meta.sources` / `meta.apify` / `meta.sourceDetails` der konkreten Produktions-Response? (Browser-Netzwerktab → `/api/jobs`-Response prüfen.)
2. Falls `meta.apify` z. B. `limit_reached` oder einen Upstream-Fehler zeigt → Apify-Kontingent/Run-Status prüfen; falls `missing_config` → Token-Scope in Vercel prüfen.

## Risks
Keine durch Code. Hinweis: Falls weitere Quellen gewünscht sind, müssen in Vercel `JOB_SOURCE_GREENHOUSE_BOARDS`, `PUBLIC_ATS_SOURCES` bzw. `APIFY_API_TOKEN` (Scope beachten) gesetzt sein; Apify-Runs unterliegen Kontingent (`APIFY_MONTHLY_MAX_RUNS`) und 50s-Sync-Timeout.

## Recommended next actions
1. Diesen Report committen + pushen.
2. Bei der nächsten "nur Arbeitnow"-Suche die `/api/jobs`-Response (`meta.sources`, `meta.apify`, `meta.disabledSources`) sichern und hier ergänzen.
3. Optional (separater UI-Task, kein Bugfix): `JobSources.tsx` um Hinweiszeile für abgefragte-aber-leere Sources aus `meta` ergänzen.

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: Read-only Untersuchung von Request-Call, Source-Fanout und Anzeige-Logik. Kein Model Call, kein AI Provider, kein Consent-/Anonymisierungs-/Fallback-Flow geändert. `docs/AI_AUDITLOG.md` wurde gegen sein Template geprüft; es ist eine Template-Datei, daher wurde kein künstlicher Audit-Eintrag erzeugt.

## Current resume point
Befund dokumentiert und verifiziert. Nächster Schritt: Report committen + pushen.
