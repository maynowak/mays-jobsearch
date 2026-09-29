# ADZUNA-JOOBLE-01 — Adzuna + Jooble als eigene Job-Sources eingebaut

## Current status
COMPLETED — Beide Provider analysiert, als eigenständige Registry-Sources implementiert, getestet, dokumentiert.

## Audit date/time
2026-09-29 17:00:00 CET

## Git branch and HEAD
- Branch: main
- HEAD: 9f5f2da (before change; change uncommitted at log time)
- Working tree: neu `api/_lib/sources/adzuna.mjs`, `api/_lib/sources/jooble.mjs`, `tests/api/adzuna-source.test.mjs`, `tests/api/jooble-source.test.mjs`; `M api/_lib/config.mjs`, `api/_lib/sources/index.mjs`, `src/types.ts`, `.env.example`, `docs/ATS_JOB_SOURCES.md`

## Audit scope
User-Vorgabe: Adzuna API (stark UK/USA/DE/FR + 10 Länder, Free Tier, JSON mit Geodaten + Gehalt, offiziell/legal) und Jooble API (weltweit 60+ Länder, simple REST-API, Länder-/Sprachfilter) analysieren und einbauen. Umsetzung als eigene Sources in bestehender Registry; keine Änderung an Search-Strategie, Deduplication, ATS-Analyse, API-Contract.

## Completed audit sections
1. **API-Analyse**: Adzuna-Endpunkt + Parameter gegen offizielle Doku verifiziert (`developer.adzuna.com/docs/search`, per curl: Pfad `.../jobs/{country}/search/{page}`, `app_id`/`app_key`, `results_per_page`, `what`, `where`, `redirect_url` bestätigt). Jooble-Dokuseite bot-blockt (403) → defensiv nach dokumentiertem Schema implementiert.
2. **Adzuna-Adapter** (`api/_lib/sources/adzuna.mjs`): Multi-Country-Loop (wie Greenhouse-Boards), native `what`/`where`-Suche, `az-{country}-{id}`-IDs, Geodaten → optionale `latitude`/`longitude`, `salary_min/max` → Range-String (keine Währung erfunden), `contract_time` → `jobTypes`. Länder-Fehler isoliert; Totalausfall wirft Erstfehler (sichtbare Fehlkonfiguration statt stillem Leer).
3. **Jooble-Adapter** (`api/_lib/sources/jooble.mjs`): POST mit Key im Pfad, `{keywords, location}`-Body, `jo-{id}`-IDs, `snippet`→Description (ent-highlighted), `salary`-String passthrough, `type`→`jobTypes`.
4. **Config + Registry**: `ADZUNA_APP_ID/APP_KEY`, `ADZUNA_COUNTRIES` (Default `de`), `JOB_SOURCE_ADZUNA_ENABLED`, `JOOBLE_API_KEY`, `JOB_SOURCE_JOOBLE_ENABLED` in `getConfig()`; fehlende Keys → `emptyResult("missing_config")` (Apify-Muster); beide in `SOURCES` registriert; `.env.example` + `Job.latitude/longitude` (Frontend-Typ, optional, für künftigen Per-Job-Radius) ergänzt.
5. **Tests**: je Adapter Mock-Suite (Config, Happy Path inkl. Geo/Salary, Empty, 401/404/429, Netzwerk, invalides JSON, Limit) — 34 Tests.
6. **Doku**: `ATS_JOB_SOURCES.md` (Key-Tabelle, Adzuna-/Jooble-Abschnitte, Status, Config, `latitude/longitude`-Felder, Security-Hinweis).
7. **Verifiziert**: volle Suite, Build, Diff-Check.

## Actual findings
- Adzuna passt zum bestehenden Contract, liefert aber zusätzlich Geodaten + Gehalt — deshalb eigene Adapter-Datei statt Factory (Auth + native Suche + Pagination), gleiche Normalisierungs-/Fehler-Konventionen.
- Jooble-Feldmapping ist defensiv implementiert, aber mangels Live-Key nicht endverifiziert → in Doku als "vor Prod-Einsatz mit Live-Key verifizieren" markiert.
- Kein Provider verlangt Scraping/OAuth/Employer-Zugang — beide offiziell und legal wie gefordert.

## Evidence / file references
- Neu: `api/_lib/sources/adzuna.mjs` (220 Zeilen), `api/_lib/sources/jooble.mjs`
- Neu: `tests/api/adzuna-source.test.mjs`, `tests/api/jooble-source.test.mjs` (34 Tests)
- `api/_lib/config.mjs` — 6 neue Config-Felder; `api/_lib/sources/index.mjs` — `SOURCES` +2
- `src/types.ts` — optionale `latitude`/`longitude`; `.env.example` — Key-Doku ohne Werte
- `docs/ATS_JOB_SOURCES.md` — Key-Tabelle, Provider-Abschnitte, Status, Config, Felder, Security
- Verifikation: Doku-Endpoint per curl bestätigt; Jooble-Doku 403 (bot-blockt)
- Run: 50 Dateien passed, 622 Tests passed (vorher 569/46 Dateien — Zuwachs = neue Suites)

## Classification
**GREEN** — Analyse belegt, beide Sources implementiert/integriert/getestet/dokumentiert.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
- 5× modified, 4× neu — alle zu diesem Task gehörig (siehe Files changed).

## Files changed
- `api/_lib/sources/adzuna.mjs`, `api/_lib/sources/jooble.mjs` — neu
- `tests/api/adzuna-source.test.mjs`, `tests/api/jooble-source.test.mjs` — neu
- `api/_lib/config.mjs`, `api/_lib/sources/index.mjs`, `src/types.ts`, `.env.example` — Integration
- `docs/ATS_JOB_SOURCES.md` — Provider-Doku
- `docs/reports/ADZUNA-JOOBLE-01-EXECUTION_LOG.md` — neu (dieser Log)

## Explicit confirmation when no files were changed
N/A — Dateien geändert wie oben gelistet; keine anderen Dateien angefasst.

## Open questions
1. Jooble-Feldmapping mit Live-Key gegenprüfen (ein valider Response genügt — alle Felder außer Array-Form sind optional).
2. Keys in Vercel setzen (`ADZUNA_APP_ID/ADZUNA_APP_KEY`, ggf. `ADZUNA_COUNTRIES`, `JOOBLE_API_KEY`), sonst liefern beide `missing_config` (by design, wie Apify).

## Risks
Niedrig, verifiziert:
- Ohne Keys: saubere Empty-States, keine Requests, keine Kosten, andere Sources unberührt (34 Mock-Tests + volle Suite grün).
- Jooble-Mapping defensiv (unbekannte Felder → `undefined`, nie erfunden); Adzuna-Endpunkt doku-verifiziert.
- Keys ausschließlich serverseitig (Env), nie im Frontend/Bundle/Doku.

## Recommended next actions
1. Diesen Task committen + pushen (+ Deploy).
2. Keys in Vercel setzen; Jooble einmal mit Live-Key verifizieren.
3. Optional follow-ups (separat): Adzuna-Pagination (Seite 2+), `salary_min`/`full_time`-Filter aus Suchprofil mappen, Per-Job-Radius via `latitude/longitude`.

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: Neue Job-Source-Adapter (Datensammlung + Normalisierung) in deterministischer Suchpipeline. Kein Model Call, kein AI Provider, kein Consent-/Anonymisierungs-/Fallback-Flow geändert. `docs/AI_AUDITLOG.md` wurde gegen sein Template geprüft; es ist eine Template-Datei, daher wurde kein künstlicher Audit-Eintrag erzeugt.

## Current resume point
Verifiziert. Nächster Schritt: committen + pushen.
