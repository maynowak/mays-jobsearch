# NEW-SOURCES-EMPTY-01 — Neue Quellen liefern 0: Config, nicht Code

## Current status
INVESTIGATED — Neue Sources sind korrekt verdrahtet (registriert, enabled, saubere Empty-States); sie liefern 0, weil ihre Credentials/Identifier in Production fehlen. Kein Code-Bug. Zusätzlich `JobSource`-Typ für neue IDs geöffnet.

## Audit date/time
2026-09-29 17:10:00 CET

## Git branch and HEAD
- Branch: main
- HEAD: 7e1a8cb (before change; change uncommitted at log time)
- Working tree: `M src/types.ts`

## Audit scope
Befund: `Arbeitnow 29 + Arbeitsagentur 21 = Insgesamt 50` — Arbeitsagentur läuft wieder, aber Adzuna/Jooble (+ ATS-Factory-Quellen) liefern keine Ergebnisse. Geprüft: Registrierung, Enabled-Defaults, Empty-Pfade, Anzeige-Fallback. Read-only plus 1-zeilige Typ-Korrektur.

## Completed audit sections
1. **Registrierung verifiziert**: `SOURCES = [arbeitnow, greenhouse, adzuna, jooble, ...publicAtsSources, ...apify]`; Laufzeit-Check: alle 5 `enabled: true` (plus Factory-Instanzen nur bei Config).
2. **Empty-Pfade verifiziert** (lokal ausgeführt): Adzuna/Jooble ohne Keys → `{enabled: false, reason: "missing_config", jobs: []}` — keine Requests, keine Kosten, kein Throw.
3. **Anzeige verifiziert**: `JobSources.tsx` listet nur Counts > 0 (Test D dokumentiert das); unbekannte IDs fallen auf Roh-ID zurück (`sourceLabel`) — neue Sources würden korrekt erscheinen, sobald sie liefern.
4. **Typ-Lücke geschlossen**: `JobSource` war `"arbeitnow" | "arbeitsagentur"` — für neue First-Class-Sources zu eng (Laufzeit ok, Typ unehrlich). Geöffnet auf `"arbeitnow" | "arbeitsagentur" | (string & {})`; Build + Tests grün.
5. **Arbeitsagentur-Comeback erklärt**: Limit war erreicht (`limit_reached`, gleicher Monat) → läuft nur wieder, weil die Anhebung (Default 100, Commit `6eb3856`) oder ein Env-Override live ist. Konsistent, kein Widerspruch.

## Actual findings
- **Kein Code-Bug.** Erwartete `meta`-Werte für diese Suche: `sources: {arbeitnow: 29, arbeitsagentur: 21, greenhouse: 0, adzuna: 0, jooble: 0}`, `sourceReasons: {greenhouse: "no_boards_configured", adzuna: "missing_config", jooble: "missing_config", ...}`.
- **Ursache je neuer Source (Konfiguration, nicht Code):**
  | Source | Warum 0 | Nötig in Vercel |
  |--------|---------|-----------------|
  | Adzuna | keine Keys → `missing_config` | `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` (+ opt. `ADZUNA_COUNTRIES`, Default `de`) |
  | Jooble | kein Key → `missing_config` | `JOOBLE_API_KEY` |
  | Greenhouse-Boards/Factory-ATS | keine Identifier → `no_boards_configured` / 0 Instanzen | `JOB_SOURCE_GREENHOUSE_BOARDS` bzw. `PUBLIC_ATS_SOURCES` |
- **Anzeige korrekt**: 0-Treffer-Quellen werden ausgeblendet (Test D); neue IDs würden per Fallback mit Roh-ID erscheinen.

## Evidence / file references
- `api/_lib/sources/index.mjs` — `SOURCES`-Array mit `adzuna`, `jooble`
- Laufzeit-Check: `enabled: arbeitnow, greenhouse, adzuna, jooble, arbeitsagentur` (alle true, keine Disabled)
- No-Key-Probe: beide Adapter → `missing_config`, 0 Jobs, kein Fetch
- `src/components/JobSources.tsx:22-31,41` — Count>0-Filter + Roh-ID-Fallback; `JobSources.test.tsx` Test D
- `src/types.ts` — `JobSource` geöffnet (Build + 3/3 JobSources-Tests grün)

## Classification
**GREEN** — Verdrahtung verifiziert korrekt; Ursache ist fehlende Production-Konfiguration; Typ-Lücke geschlossen.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
- 1× modified (`src/types.ts`), alle zu diesem Task gehörig.

## Files changed
- `src/types.ts` — `JobSource` für neue Source-IDs geöffnet
- `docs/reports/NEW-SOURCES-EMPTY-01-EXECUTION_LOG.md` — neu (dieser Log)

## Explicit confirmation when no files were changed
N/A — Dateien geändert wie oben gelistet; keine anderen Dateien angefasst.

## Open questions
1. Bitte in Vercel setzen (sonst bleibt es bei Arbeitnow + Arbeitsagentur): `ADZUNA_APP_ID`/`ADZUNA_APP_KEY`, `JOOBLE_API_KEY`, optional Boards/`PUBLIC_ATS_SOURCES` — danach liefern die Neuen.
2. Zur Kontrolle danach: `meta.sourceReasons` in der `/api/jobs`-Response prüfen (sollte dann `null` statt `missing_config` zeigen).

## Risks
Keine durch Code. Hinweis: Keys nur in Vercel-Env (Server), nie Frontend/Bundle/Doku — wie implementiert.

## Recommended next actions
1. Diesen Task committen + pushen.
2. Vercel-Env setzen + deployen; danach liefern Adzuna/Jooble (Jooble-Feldmapping bei Gelegenheit mit Live-Key gegenprüfen, siehe ADZUNA-JOOBLE-01).

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: Source-Verdrahtungsprüfung plus 1-zeilige Typ-Korrektur und Dokumentation. Kein Model Call, kein AI Provider, kein Consent-/Anonymisierungs-/Fallback-Flow geändert. `docs/AI_AUDITLOG.md` wurde gegen sein Template geprüft; es ist eine Template-Datei, daher wurde kein künstlicher Audit-Eintrag erzeugt.

## Current resume point
Verifiziert (JobSources-Tests + Build grün). Nächster Schritt: committen + pushen.
