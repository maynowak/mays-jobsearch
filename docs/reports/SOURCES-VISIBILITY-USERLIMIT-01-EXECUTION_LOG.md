# SOURCES-VISIBILITY-USERLIMIT-01 — Doku-Altlasten, Cut-Row-Anzeige, Theirstack-Limit 20/User

## Current status
COMPLETED — (1) Veraltete Source-Aussagen in 5 Doku-Dateien korrigiert; (2) liefernde, aber herausgefilterte Sources erscheinen zusätzlich in der Jobquellen-Box; (3) Theirstack-Per-User-Limit 20 Credits/Monat (Session) implementiert.

## Audit date/time
2026-09-29 21:50:00 CET

## Git branch and HEAD
- Branch: main
- HEAD: 611ac04 (before change; change uncommitted at log time)
- Working tree: siehe Files changed (19 Dateien)

## Audit scope
Drei User-Vorgaben: (1) Doku-Altlasten zu neuen Resource-Jobs prüfen/bereinigen; (2) liefernde Sources müssen trotz 50-Cap angezeigt werden (Anschluss an POOL-CAP-50-01); (3) teure Quellen (200-Credits-Kontingent = Theirstack) zusätzlich auf max. 20 pro User begrenzen. Keine Änderung an Suchstrategie-Ranking, Deduplication, ATS-Analyse, API-Contract.

## Completed audit sections
1. **Doku-Audit**: `README.md` ("two sources", "(Arbeitnow + Apify)", überholte Open Points für WorkMode/Radius), `ARCHITECTURE.md` (Registry-Beschreibung), `ATS_JOB_SOURCES.md` ("All 6 providers", Next Steps, Capability-Matrix ohne Key-Quellen), `JOB_SOURCES.md` (nur Quelle 1+2, Enable-Tabelle, Frontend-Typ-Hinweis), `ENVIRONMENT_MATRIX.md` (fehlende Source-Vars) — alle stellen bereinigt/erweitert; historische Migrations-/Changelog-Einträge unangetastet.
2. **Anzeige**: `meta.sources` wird in App-State übernommen (`runSearch`/`runCvSearch`) und an `JobSources` als `deliveredCounts` gereicht; Cut-Rows (raw>0, final==0) mit `(nicht angezeigt)`-Hinweis; Labels für neue Sources (DE/EN); unverändertes Verhalten ohne `deliveredCounts` und bei leerem Pool.
3. **Per-User-Limit**: `THEIRSTACK_MAX_CREDITS_PER_USER` (Default 20, monatlich, Session = User, Key gehasht); Identity-Plumbing `/api/jobs` (Session-Cookie wie `/api/match`) → `fetchAllJobs` → Adapter (optionales Feld, abwärtskompatibel); `user_limit_reached` ohne Paid-Call; Zählung nur bei Erfolg; `.env.example` + Doku.
4. **Verifiziert**: volle Suite, Build (echter Exit-Code, kein Pipe-Schlucken), Diff-Check.

## Actual findings
- **Altlasten waren real**: README behauptete "two sources" + zwei bereits implementierte Open Points; ARCHITECTURE/JOB_SOURCES kannten nur Arbeitnow/Arbeitsagentur; Matrix kannte keine Key-Quellen.
- **Anzeige-Entscheidung** (bewusst, dokumentiert): Cut-Rows zeigen Roh-Count + Hinweis, Final-Rows und Total unverändert; Alternative (Jobs ins Ranking zwingen) verworfen — würde Relevanz verzerren. Reine Anzeige-Transparenz.
- **Limit-Entscheidung** (bewusst, dokumentiert): Session-basiert (fairste "pro User"-Abbildung ohne Login; Cookie-Bypass als dokumentierte Limitation), monatlich (passend zum 200er Global-Limit = ~10 User), ohne Identity greift nur der globale Guard, kein IP-Backstop (keine erfundene zweite Schwelle).
- **Beinahe-Fehler abgefangen**: `npm run build | tail` schluckte den tsc-Exit-Code (TS-Fehler im ersten Entwurf unbemerkt); ab jetzt Exit-Code direkt prüfen. Betraf nur neuen Code, kein Altbestand.

## Evidence / file references
- Doku: `README.md`, `docs/ARCHITECTURE.md`, `docs/ATS_JOB_SOURCES.md` (Matrix + Next Steps), `docs/JOB_SOURCES.md` (Abschnitte 3–7, Enable-Tabelle, Frontend), `ENVIRONMENT_MATRIX.md` (Source-Vars)
- Anzeige: `src/App.tsx` (`foundSources`-State, 3 Stellen), `src/components/JobSources.tsx` (Cut-Rows), `src/i18n.tsx` (`sources.notShown` + 4 Labels DE/EN), `src/styles.css` (`.job-sources-row--cut`, muted)
- Limit: `api/_lib/config.mjs`, `api/_lib/usage.mjs` (`countTheirstackUserCredits`, `theirstackUserCreditLimitReached`), `api/jobs.mjs` (Identity + Cookie), `api/_lib/sources/index.mjs` (Passthrough), `api/_lib/sources/theirstack.mjs` (Check + Zählung), `.env.example`
- Tests: `JobSources.test.tsx` (+3), `App.test.tsx` (+1 Plumbing-Test), `theirstack-source.test.mjs` (+3 User-Limit-Tests); Debug: fehlendes `source[]`-Feld im Mock erzeugt leere Box (Test-Fixture korrigiert, kein Code-Bug)
- Run: 51 Dateien passed / 1 skipped, 659 Tests passed / 2 skipped (Live-Opt-in), 0 failed; Build Exit 0; Diff clean

## Classification
**GREEN** — Alle drei Vorgaben umgesetzt und verifiziert.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
- 17× modified, 1× neu (Report) — alle zu diesem Task gehörig (siehe Files changed).

## Files changed
- `README.md`, `docs/ARCHITECTURE.md`, `docs/ATS_JOB_SOURCES.md`, `docs/JOB_SOURCES.md`, `ENVIRONMENT_MATRIX.md` — Doku-Altlasten
- `src/App.tsx`, `src/components/JobSources.tsx`, `src/i18n.tsx`, `src/styles.css` — Cut-Row-Anzeige
- `src/components/JobSources.test.tsx`, `src/App.test.tsx` — Anzeige-Tests
- `api/_lib/config.mjs`, `api/_lib/usage.mjs`, `api/jobs.mjs`, `api/_lib/sources/index.mjs`, `api/_lib/sources/theirstack.mjs`, `.env.example` — Per-User-Limit
- `tests/api/theirstack-source.test.mjs` — Limit-Tests
- `docs/reports/SOURCES-VISIBILITY-USERLIMIT-01-EXECUTION_LOG.md` — neu (dieser Log)

## Explicit confirmation when no files were changed
N/A — Dateien geändert wie oben gelistet; keine anderen Dateien angefasst.

## Open questions
Keine. Hinweise: (1) Neues `meta.sources`-Plumbing greift nach Deploy; (2) `THEIRSTACK_MAX_CREDITS_PER_USER` ggf. per Env feinjustieren; (3) Labels dynamischer Factory-IDs (`greenhouse:<board>`) bleiben Roh-ID (bewusst).

## Risks
Niedrig, verifiziert:
- Anzeige: nur additive Zeilen; ohne `deliveredCounts`/bei leerem Pool exakt Altverhalten (Tests).
- Limit: Session-Cookie-Bypass dokumentiert (Cookie löschen = neues Kontingent); globaler Guard + Paid-Call-Schutz unverändert; ohne Identity keine Änderung.
- Volle Suite grün (659 passed), Build Exit 0.

## Recommended next actions
1. Diesen Task committen + pushen (+ Deploy).
2. Manuell prüfen: Cut-Row bei gefilterter Quelle; `/api/usage`-Zähler; Theirstack-Limit per Test-Session.

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: Doku-Bereinigung, Anzeige-Transparenz und Kostenwächter in deterministischer Suchpipeline. Kein Model Call, kein AI Provider, kein Consent-/Anonymisierungs-/Fallback-Flow geändert. `docs/AI_AUDITLOG.md` wurde gegen sein Template geprüft; es ist eine Template-Datei, daher wurde kein künstlicher Audit-Eintrag erzeugt.

## Current resume point
Verifiziert. Nächster Schritt: committen + pushen.
