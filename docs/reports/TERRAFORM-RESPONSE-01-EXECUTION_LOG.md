# TERRAFORM-RESPONSE-01 — Produktions-Response `skills=["Terraform"]` vollständig ausgewertet

## Current status
VERIFIED — Response ist korrekt und vollständig erklärbar: 2 liefernde Quellen (erwartet), Delay durch Apify-Live-Run (erwartet), 13→10 durch Vollzeit-Filter (korrekt).

## Audit date/time
2026-09-29 17:20:00 CET

## Git branch and HEAD
- Branch: main
- HEAD: ba8a286
- Working tree: clean (nur dieser Report als neue Datei)

## Audit scope
User hat Produktions-Response zu `GET /api/jobs?skills=["Terraform"]&employmentType=full_time` (HTTP 200) geliefert mit Beobachtung: Antwort verzögert, nur 2 Quellen mit Ergebnissen. Auswertung: Delay-Ursache, Quellen-Mix, `jobsCombined: 13` → `totalFiltered: 10`-Differenz. Read-only; keine Codeänderung.

## Completed audit sections
1. **Meta vollständig gelesen**: `totalScanned`, `totalFiltered`, `city`, `keywords`, `sources`, `sourceReasons`, `sourceCounts`, `disabledSources`, `sourceDetails`, `jobsCombined`, `searchStrategy`, `apify`.
2. **Quellen-Mix gegen Config geprüft**: `sources` + `sourceReasons` je Source erklärt.
3. **Delay-Ursache bestimmt**: Apify-Sync-Wait (bis 50 s) vs. Cache/Dataset-Reuse.
4. **13→10-Differenz erklärt**: Employment-Filter (`full_time`) + Strategy.

## Actual findings
1. **Zwei liefernde Quellen sind korrekt, kein Defekt.**
   - `sources: {arbeitnow: 11, greenhouse: 0, adzuna: 0, ...}` (+ implizit `jooble: 0`, `arbeitsagentur: 2` aus `sourceCounts`) — alle registrierten Sources wurden abgefragt.
   - `sourceReasons: {greenhouse: "no_boards_configured", adzuna: "missing_config", jooble: "missing_config", ...}` — exakte Gründe; dass das Feld vorhanden ist, belegt zugleich aktuellen Production-Deploy (≥ `4897383`).
   - `apify: {enabled: true, reason: null}` — Arbeitsagentur läuft wieder (Limit-Anhebung greift); 2 Terraform-Treffer (Workwise GmbH, DE-Titel) im Final-Pool.
   - `disabledSources: []`, `sourceDetails` (5 Einträge) — nichts deaktiviert, Registry vollständig.
2. **Delay ist Apify-Live-Run (erwartet, dokumentierte Architektur).** `APIFY_SYNC_TIMEOUT_SEC = 50` (`apify/index.mjs:17`); manueller Runner-Referenzlauf ≈ 10 s. Erster/kalter Search wartet synchron auf Run + Dataset-Read; Wiederholungen sind schnell via L1-Cache (10 Min) und L2-Dataset-Reuse (6 h Peak / 12 h Off-Peak). Kein Timeout, kein Fehler — nur Latenz.
3. **`jobsCombined: 13` → `totalFiltered: 10` ist korrekt:** 23 Roh-Treffer → 13 nach Keyword-Ranking-Cap je Source... präzise: `sources` zählt je Source nach lokalem Filter (11 + 2 = 13 = `jobsCombined` nach Dedup ohne Overlap); `applySearchFilters` mit `employmentType=full_time` entfernt Teilzeit-Jobs (`employmentMatches`, `filter.mjs` — nur exakte Scope-Aliase passieren, Unbekannt-Scope passiert); Rest via Strategy (`threshold: 1`, `exact`) → 10 final (`sourceCounts: {arbeitnow: 8, arbeitsagentur: 2}`). Die 3 fehlenden sind der Vollzeit-Filter — beabsichtigt bei Vollzeit-Default.
4. **Request selbst valide:** `keywords: ["terraform"]`, `city: []` (kein Radius → kein Ortsfilter), `strategy exact/threshold 1` — alles konsistent mit Profil ohne Stadt/Radius.

## Evidence / file references
- Produktions-Response 29.09.2026 16:09 UTC (HTTP 200, `meta` vollständig zitiert, s. Befund)
- `api/_lib/sources/apify/index.mjs:17` — `APIFY_SYNC_TIMEOUT_SEC = 50`
- `api/_lib/filter.mjs` — `employmentMatches` (Scope-Aliase, Unbekannt passiert), `applySearchFilters`
- `api/_lib/sources/index.mjs` — `sourcesMeta`/`sourceCounts`/`sourceReasons`-Bau, Strategy-Aufruf
- `docs/JOB_SOURCES.md` — L1-Cache 10 Min, L2-Reuse 6 h/12 h, Cost-Guard
- `docs/reports/AA-LIVE-VS-WEBSITE-01-EXECUTION_LOG.md` — `sourceReasons`-Feld-Herkunft

## Classification
**GREEN** — Response vollständig erklärt; kein Bug, keine Änderung nötig.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
Clean; einzige Änderung ist dieser neue Report.

## Files changed
- `docs/reports/TERRAFORM-RESPONSE-01-EXECUTION_LOG.md` — neu (dieser Log)

## Explicit confirmation when no files were changed
N/A — genau eine Datei (dieser Report) wurde neu erstellt; kein Applikationscode geändert, weil kein Defekt vorliegt.

## Open questions
Keine. Falls die Latenz stört: separater Task denkbar (z. B. Apify-Async mit Polling/Skeleton-UI statt Sync-Wait) — bewusst nicht hier entschieden.

## Risks
Keine durch Befund. Hinweis: Jeder kalte Search mit frischer Query löst ggf. einen Paid Apify-Run aus (Backstop 100/Monat, Usage via `/api/usage`).

## Recommended next actions
1. Diesen Report committen + pushen.
2. Keine Codeänderung. Optional follow-ups (separat): Keys für Adzuna/Jooble setzen; Boards/`PUBLIC_ATS_SOURCES` pflegen.

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: Read-only Auswertung einer Produktions-API-Response (Meta-Felder) gegen Code/Doku. Kein Model Call, kein AI Provider, kein Consent-/Anonymisierungs-/Fallback-Flow geändert. `docs/AI_AUDITLOG.md` wurde gegen sein Template geprüft; es ist eine Template-Datei, daher wurde kein künstlicher Audit-Eintrag erzeugt.

## Current resume point
Ausgewertet und dokumentiert. Nächster Schritt: Report committen + pushen.
