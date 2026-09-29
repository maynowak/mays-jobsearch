# AA-LIVE-VS-WEBSITE-01 — Live-Actor liefert, Webseite leer: Bruchstelle + Diagnose-Fix

## Current status
COMPLETED — Bruchstelle identifiziert (kein Actor-Problem, sondern stille 0-Jobs der Zusatz-Sources + fehlende Grund-Anzeige); `meta.sourceReasons` ergänzt, damit der Grund künftig im Browser ablesbar ist.

## Audit date/time
2026-09-29 15:35:00 CET

## Git branch and HEAD
- Branch: main
- HEAD: 5c05ecb (before fix; fix uncommitted at log time)
- Working tree: `M api/_lib/sources/index.mjs`, `M src/types.ts`, `M tests/api/sources-registry.test.mjs`

## Audit scope
User-Befund: Live-Tests gegen echten Actor grün (`java` + `Software Developer`, je ~7s, Records mit Shape-Check), aber gleiche Suche auf Webseite ergebnislos. Zu klären: wo zwischen Actor-Antwort und Anzeige die Kette bricht. Read-only-Analyse der Pipeline plus minimale additive Verbesserung; keine Verhaltensänderung.

## Completed audit sections
1. **Live-Test-Ergebnis eingeordnet**: Actor erreichbar, Auth OK, Records + Normalisierung OK — Actor-Seite gesund (Anschluss an APIFY-RUNNER-STATUS-01).
2. **Website-Pfad vs. Live-Test-Pfad differenziert**: Live-Tests umgehen Cache/Usage/Limit/Dataset-Reuse/Lokalfilter/Registry-Strategie/Frontend — sie beweisen nur Actor-Erreichbarkeit, nicht App-Pfad.
3. **Stille-Null-Stellen inventarisiert**: Cache/Usage sind fail-safe (kein Throw ohne Redis); `apifyRunLimitReached`, Run-Fehler/Timeout, lokale Keyword-/City-Filter, Strategy/Dedup können je 0 Jobs liefern, ohne dass die Response den Grund nennt.
4. **Diagnose-Lücke gefunden und geschlossen**: `fetchAllJobs` berechnete pro Source `meta.reason`, verwarf ihn aber — Response enthielt nur Counts. Neu: `meta.sourceReasons: { [sourceId]: reason | null }`.
5. **Verifiziert**: neuer Test M, volle Suite, Build, Diff-Check.

## Actual findings
1. **Der Actor ist unschuldig.** Live grün + Runner `Succeeded` → Fehler liegt zwischen Actor-Antwort und Anzeige.
2. **Wahrscheinlichste stille Nullen auf dem Website-Pfad** (alle ohne 500, ohne UI-Hinweis):
   - `APIFY_API_TOKEN` im Website-Runtime-Env fehlend/anderer Scope → `missing_config`
   - Monats-Run-Counter ≥ `APIFY_MONTHLY_MAX_RUNS` → `limit_reached`
   - Run-Fehler/Timeout im Serverless-Kontext (50s-Poll) → Fehler-Reason
   - Records, aber lokal rausgefiltert (Keyword/City) oder Strategy/Dedup
3. **Diagnose war bisher unmöglich**: `meta` enthielt `sources`-Counts, aber keinen Grund je Source (nur Sonderfeld `meta.apify`). Jetzt: `meta.sourceReasons`, z. B. `{arbeitnow: null, greenhouse: "no_boards_configured", arbeitsagentur: "missing_config"}`; bei rejected non-critical Sources deren `HttpError`-`code`.
4. **Keine Verhaltensänderung**: gleiche Jobs, gleiche Filter, gleiche Strategie — nur ein zusätzliches optionales Meta-Feld.

## Evidence / file references
- `api/_lib/sources/index.mjs` — Fanout (68-70), Fehler-Isolation (76-84, jetzt mit `meta.reason` aus `HttpError`-Code), `sourceReasons`-Bau + Response-Feld
- `api/_lib/sources/apify/index.mjs:35-39,86-96` — `missing_config` / `limit_reached` / Run-/Read-Fehler → `emptyResult`
- `api/_lib/cache.mjs:10-29` + `usage.mjs:156-160` — fail-safe ohne Redis (kein Throw → kein 500 daraus)
- `src/types.ts:70` — `sourceReasons?: Partial<Record<string, string | null>>` in `JobsResponse.meta`
- `tests/api/sources-registry.test.mjs` — neu Test M (arbeitnow null, greenhouse `no_boards_configured`, arbeitsagentur `missing_config`)
- User-Live-Test: 2/2 grün (~7s je Query)

## Classification
**GREEN** — Bruchstelle eingegrenzt, Diagnose-Fix verifiziert, volle Suite grün.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
- 3× modified, alle zu diesem Task gehörig.

## Files changed
- `api/_lib/sources/index.mjs` — `meta.reason` bei rejected Sources + `meta.sourceReasons` in Response
- `src/types.ts` — optionales `sourceReasons`-Feld
- `tests/api/sources-registry.test.mjs` — Test M
- `docs/reports/AA-LIVE-VS-WEBSITE-01-EXECUTION_LOG.md` — neu (dieser Log)

## Explicit confirmation when no files were changed
N/A — Dateien geändert wie oben gelistet; keine anderen Dateien angefasst.

## Open questions
1. Was zeigen `meta.sources` / `meta.sourceReasons` / `meta.apify` bei der nächsten leeren Website-Suche? (Browser-Netzwerktab → `/api/jobs`-Response.) Damit ist der konkrete Fall dann eindeutig zuordenbar.

## Risks
Minimal: rein additives optionales Meta-Feld; Frontend ignoriert Unbekanntes; bestehende Tests unverändert grün (570 passed).

## Recommended next actions
1. Diesen Task committen + pushen.
2. Bei nächster leerer Suche die `meta`-Werte sichern und hier ergänzen.
3. Optional (separater UI-Task): `JobSources.tsx` um "abgefragt, 0 Treffer (Grund)"-Zeilen aus `meta.sourceReasons` ergänzen.

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: Diagnose einer Job-Source-Pipeline (kein Actor-Problem) plus additives Diagnose-Meta-Feld. Kein Model Call, kein AI Provider, kein Consent-/Anonymisierungs-/Fallback-Flow geändert. `docs/AI_AUDITLOG.md` wurde gegen sein Template geprüft; es ist eine Template-Datei, daher wurde kein künstlicher Audit-Eintrag erzeugt.

## Current resume point
Verifiziert (570 passed, Build OK, Diff clean). Nächster Schritt: committen + pushen.
