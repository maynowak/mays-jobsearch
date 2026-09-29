# APIFY-RUNNER-STATUS-01 — Runner-Status vom User abgeglichen, Versorgungslage bestätigt

## Current status
CONFIRMED — Apify-Runner gesund und identisch mit konfiguriertem Actor; Versorgungslage stabil. Kein Handlungsbedarf im Code.

## Audit date/time
2026-09-29 15:15:00 CET

## Git branch and HEAD
- Branch: main
- HEAD: b1e67ce
- Working tree: clean (nur dieser Report als neue Datei)

## Audit scope
User-Meldung zum Apify-Runner (Arbeitsteilung aus BA-DIRECT-PROBE-01: User prüft Runner, ich die BA-Direktanfragen) gegen Code-Konfiguration abgleichen und Gesamt-Versorgungslage feststellen. Read-only; keine Codeänderung.

## Completed audit sections
1. **Runner-Status ausgewertet** (User-Meldung): Actor verfügbar, letzter Run erfolgreich.
2. **Actor-Identität abgeglichen**: gemeldeter Actor vs. konfigurierte `actorId` im Code.
3. **Kosten/Kontingent bewertet**: Usage gegen Backstops gelegt.
4. **Gesamt-Versorgungslage festgestellt** (Apify-Befund + BA-Direkt-Befund).

## Actual findings
1. **Runner gesund.** Gemeldet: `blackfalcondata/arbeitsagentur-jobs-feed` ("Arbeitsagentur Job Scraper — German Federal Jobs"), letzter Run 19.09.2026 07:45:03, Status `Succeeded`, Dauer 10s, Test-Input (`query: "Software Developer"`, `maxResults: 100`, `includeDetails: false`).
2. **Identität stimmt überein.** Code nutzt `actorId: "blackfalcondata~arbeitsagentur-jobs-feed"` (`apify/actors.mjs:40`) — `~` ist die API-Pfad-Notation für `/`, also exakt derselbe Actor. `maxJobs: 40` im Code vs. `100` im manuellen Test-Run: unkritisch (reine Input-Größe, kein Versionsunterschied).
3. **Kosten im Rahmen.** September-Usage `$0.26 / $5.00` (User-Angabe); Actor-Pricing ab `$0.79 / 1.000 Results`. App-seitige Backstops (`APIFY_MONTHLY_MAX_RUNS`, Tages-Quotas, L1/L2-Cache, Dataset-Reuse) greifen zusätzlich — kein Kostenrisiko aus diesem Befund.
4. **Gesamt-Versorgungslage (beide Prüfstränge zusammen):**
   - Apify-Route: FUNKTIONIERT (Runner gesund, Token-Pfad im Code intakt).
   - BA-Direkt-Route: serverseitig blockiert (403, siehe BA-DIRECT-PROBE-01).
   - Fazit: Kein Handlungsbedarf; bei "nur Arbeitnow"-Anzeigen zuerst `meta.apify`/`meta.sources` der Response prüfen (Run-Limit? Upstream-Fehler? kein Treffer?), dann Vercel-Env.

## Evidence / file references
- User-Meldung: Actor-Name, `Succeeded`, 10s, Input-JSON, ` $0.26 / $5.00`
- `api/_lib/sources/apify/actors.mjs:36-60` — `actorId`, `maxJobs: 40`, Listen-Input (`includeDetails: false`), Detail-Input (`includeDetails: true`)
- `api/_lib/sources/apify/index.mjs:35-49,89` — Token-Check, Input-Bau, Run-Start
- `docs/reports/BA-DIRECT-PROBE-01-EXECUTION_LOG.md` — Direkt-BA blockiert (Gegenstück zu diesem Befund)
- `docs/reports/BA-LIST-DETAIL-01-EXECUTION_LOG.md` — Zwei-Stufen-Fluss (Liste + Link/Enrich)

## Classification
**GREEN** — Runner verifiziert gesund und passend; kein Code-Bug, keine Änderung nötig.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
Clean; einzige Änderung ist dieser neue Report.

## Files changed
- `docs/reports/APIFY-RUNNER-STATUS-01-EXECUTION_LOG.md` — neu (dieser Log)

## Explicit confirmation when no files were changed
N/A — genau eine Datei (dieser Report) wurde neu erstellt; kein Applikationscode geändert.

## Open questions
Keine. Falls künftig "nur Arbeitnow" trotz gesundem Runner auftritt: `meta.apify.reason` aus der `/api/jobs`-Response sichern (unterscheidet Limit/Upstream/kein-Treffer).

## Risks
Keine aus diesem Befund. Bekannt (unverändert): Apify-Runs kosten pro Run/Result — Backstops + Cache begrenzen das; DIRECT-PROBE-Hinweis (kein direkter Ersatzpfad) bleibt bestehen.

## Recommended next actions
1. Diesen Report committen + pushen.
2. Keine Codeänderung. Nächste Schritte nur anlassbezogen (bei konkreter `meta.apify`-Fehlermeldung).

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: Runner-Statusabgleich und Dokumentation der Versorgungslage. Kein Model Call, kein AI Provider, kein Consent-/Anonymisierungs-/Fallback-Flow geändert. `docs/AI_AUDITLOG.md` wurde gegen sein Template geprüft; es ist eine Template-Datei, daher wurde kein künstlicher Audit-Eintrag erzeugt.

## Current resume point
Beide Prüfstränge abgeschlossen (Runner: du, Direkt-BA: ich). Nächster Schritt: Report committen + pushen.
