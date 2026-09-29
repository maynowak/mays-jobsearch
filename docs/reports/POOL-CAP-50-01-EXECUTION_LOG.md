# POOL-CAP-50-01 — "Insgesamt 50": Cap am Ende, nicht beim Abfragen

## Current status
CLARIFIED — These halb bestätigt: Ja, es gibt ein Max von 50 — aber es kappt nur den fertigen Anzeige-Pool, nicht die Abfrage. Alle aktivierten Sources werden immer parallel abgefragt.

## Audit date/time
2026-09-29 20:45:00 CET

## Git branch and HEAD
- Branch: main
- HEAD: 611ac04
- Working tree: clean (nur dieser Report als neue Datei)

## Audit scope
User-These zu `Arbeitnow 38 + Arbeitsagentur 12 = Insgesamt 50`: "was haben wir da als max drin 50? und dann werden nicht alle angefragt". Geprüft: wo die 50 steht, was sie kappt (Anzeige vs. Abfrage) und welche Reihenfolge über Sichtbarkeit entscheidet. Read-only; keine Codeänderung.

## Completed audit sections
1. **Cap-Stellen gefunden**: `DEFAULT_CANDIDATE_POOL_TARGET = 50` (`searchStrategy.mjs:4`) + finaler Slice `combinedJobs.slice(0, options.candidatePoolTarget || 50)` (`searchStrategy.mjs:231`); `fetchAllJobs` übergibt keine Options → effektiv 50. Pro Source zusätzlich `MAX_JOBS_TO_AI = 40` (jede Adapter-Datei + `jsonFeedSource`).
2. **Fanout verifiziert**: `fetchAllJobs` (`sources/index.mjs:68-70`) fragt ALLE `enabledSources()` per `Promise.allSettled` ab — vor jeglichem Cap; `meta.sources` zählt Roh-Treffer je Source (unkappbar).
3. **Repro 1 (ohne Rollen)**: 70 Jobs (40 arbeitnow + 30 arbeitsagentur), 1 Skill → Output exakt 50 (`40/10`), Strategie `exact`. Beleg: Cap greift nach dem Mergen.
4. **Repro 2 (mit Zielrolle)**: 45 Rollen-Treffer + 20 Skill-Treffer → Output 50 (`45/5`), `targetRoleMatches: 45`. Beleg: Zielrollen-Treffer stehen vorne und können Skill-Treffer anderer Sources aus den 50 verdrängen.

## Actual findings
- **These-Teil 1 ("max 50") BESTÄTIGT**: `Insgesamt 50` ist exakt der Default-Cap des finalen Pools — 38+12 ist Zufall der Aufteilung, kein harter Source-Split.
- **These-Teil 2 ("nicht alle angefragt") WIDERLEGT**: Abfrage (Fanout) und Anzeige (Slice) sind getrennte Stufen. Alle aktivierten Sources werden immer abgefragt; `meta.sources` belegt die Roh-Lieferung je Source.
- **Präzisierung (wichtig)**: "Nicht alle ANGEZEIGT" kann stimmen — bei Pool-Überlauf (> 50) fallen hintere Jobs raus, und die Reihenfolge lautet Zielrollen-Treffer zuerst, dann Skill-Treffer. Eine Source mit nur Skill-Treffern kann so unsichtbar werden, obwohl sie geliefert hat.
- **Keine Änderung nötig**: Verhalten entspricht dem Design (50er-Anzeige-Pool; KI-Matching wertet separat max. 10 aus). Wer mehr als 50 sehen will, ist eine eigene Entscheidung (separater Task).

## Evidence / file references
- `api/_lib/searchStrategy.mjs:4` — `DEFAULT_CANDIDATE_POOL_TARGET = 50`
- `api/_lib/searchStrategy.mjs:231` — `combinedJobs.slice(0, options.candidatePoolTarget || 50)`
- `api/_lib/searchStrategy.mjs:215-220` — Reihenfolge: Zielrollen-Treffer + Skill-Treffer
- `api/_lib/sources/index.mjs:68-70` — Fanout vor Cap; `meta.sources` = Roh-Counts
- Adapter-`MAX_JOBS_TO_AI = 40` je Source (u. a. `arbeitnow.mjs:13`, `jsonFeedSource.mjs:3`)
- Repros (lokal, echte Funktionen, Mock-Daten): `70 → 50 (40/10)`; `65 → 50 (45/5), targetRoleMatches 45`

## Classification
**GREEN** — These geklärt (Cap ja, Fanout unberührt); kein Bug, keine Änderung nötig.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
Clean; einzige Änderung ist dieser neue Report.

## Files changed
- `docs/reports/POOL-CAP-50-01-EXECUTION_LOG.md` — neu (dieser Log)

## Explicit confirmation when no files were changed
N/A — genau eine Datei (dieser Report) wurde neu erstellt; kein Applikationscode geändert, weil kein Defekt vorliegt.

## Open questions
Keine. Optional follow-up (separat, falls gewünscht): Anzeige-Pool über 50 anheben oder pro-Source-Roh-Counts in der UI zeigen (`meta.sources` existiert bereits).

## Risks
Keine durch Befund. Hinweis: Cap-Anhebung erhöht Anzeigevolumen, nicht Suchqualität; KI-Matching (max. 10) bleibt unberührt.

## Recommended next actions
1. Diesen Report committen + pushen.
2. Keine Codeänderung. Bei Wunsch nach mehr als 50 sichtbaren Jobs separaten Task anlegen.

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: Read-only Verifikation von Pool-Cap, Fanout und Reihenfolge in deterministischer Suchpipeline (2 lokale Repros mit Mock-Daten, keine PII, keine Netz-Calls). Kein Model Call, kein AI Provider, kein Consent-/Anonymisierungs-/Fallback-Flow geändert. `docs/AI_AUDITLOG.md` wurde gegen sein Template geprüft; es ist eine Template-Datei, daher wurde kein künstlicher Audit-Eintrag erzeugt.

## Current resume point
Geklärt und dokumentiert. Nächster Schritt: Report committen + pushen.
