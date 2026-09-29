# THEIRSTACK-01 — Theirstack als eigene Job-Source (Bearer, Credit-Kontingent 200)

## Current status
COMPLETED — Theirstack analysiert (Doku-verifiziert), als eigenständige Registry-Source implementiert, 200-Credits-Kontingent umgesetzt, getestet, dokumentiert.

## Audit date/time
2026-09-29 20:25:00 CET

## Git branch and HEAD
- Branch: main
- HEAD: 67b71ad (before change; change uncommitted at log time)
- Working tree: neu `api/_lib/sources/theirstack.mjs`, `tests/api/theirstack-source.test.mjs`; `M api/_lib/cache.mjs`, `api/_lib/usage.mjs`, `api/_lib/config.mjs`, `api/_lib/sources/index.mjs`, `docs/ATS_JOB_SOURCES.md`, `.env.example` (Theirstack-Block dort vorgefunden, verifiziert, übernommen)

## Audit scope
User-Vorgabe: Theirstack einbauen, Kontingent 200/Monat, API-Key liegt beim User vor. Umsetzung als eigene Source in bestehender Registry; keine Änderung an Search-Strategie, Deduplication, ATS-Analyse, API-Contract.

## Completed audit sections
1. **API-Doku live verifiziert** (Search- + Auth-Referenz): `POST https://api.theirstack.com/v1/jobs/search`, `Authorization: Bearer`, Pflichtfilter (`posted_at_max_age_days` u. a., sonst 400), Credit-Modell (1 Credit pro Datensatz), Response-Shape (`data[]`, Feldliste).
2. **Adapter implementiert** (`api/_lib/sources/theirstack.mjs`): native `job_description_contains_or` (Whole-Word, kein Regex-Escaping-Risiko) + `job_title_or` (Zielrollen) + `limit ≤ 40` + `posted_at_max_age_days: 30`; `no_query`-Guard ohne Suchbegriffe (kein 40-Credit-Blindflug); L1-Cache; lokale Filter/Ranking wie alle Sources.
3. **200er-Kontingent als Credits umgesetzt** (nicht Requests — Doku-verifiziert): `THEIRSTACK_MONTHLY_MAX_CREDITS` (Default 200), Zähler `mj-usage:theirstack:credits:<Monat>`, `limit_reached` vor Paid-Calls, Cache-Hits kosten 0, `/api/usage` zeigt `theirstack.creditCount/creditLimit`. Neu: `cacheIncrBy`-Primitiv.
4. **Config + Registry + Env-Doku**: 3 Config-Felder, `SOURCES`-Eintrag, `.env.example`-Block (vorgefunden, verifiziert, übernommen).
5. **Tests**: 21 Mock-Tests (Config, Happy Path inkl. Geo/Salary/Employment, 401/402/429, Netzwerk, invalides JSON, Cache, Limit).
6. **Doku**: `ATS_JOB_SOURCES.md` (Key-Tabelle, Theirstack-Abschnitt, Status, Config, Security).
7. **Verifiziert**: volle Suite, Build, Diff-Check.

## Actual findings
- Theirstack passt zum bestehenden Contract, braucht aber eigene Datei (Bearer-Auth, Credit-Billing, Pflichtfilter) — kein Factory-Eintrag (Factory bleibt keyless).
- Test fand realen Edge-Bug: `Number(null) === 0` erzeugte `"$0 - $0"` — gefixt (null/undefined/"" = fehlend).
- `.env.example`-Theirstack-Block war uncommitted vorgefunden (Vorarbeit); Inhalt verifiziert korrekt und übernommen, hier transparent vermerkt statt still mitzucommitten.

## Evidence / file references
- Neu: `api/_lib/sources/theirstack.mjs` (279 Zeilen), `tests/api/theirstack-source.test.mjs` (21 Tests)
- `api/_lib/cache.mjs` — neu `cacheIncrBy`; `api/_lib/usage.mjs` — `countTheirstackCredits`, `theirstackCreditLimitReached`, `theirstackCreditCount`, Snapshot-Sektion
- `api/_lib/config.mjs` — `jobSourceTheirstackEnabled`, `theirstackApiKey`, `theirstackMonthlyMaxCredits` (Default 200)
- `api/_lib/sources/index.mjs` — `SOURCES` + Theirstack-Import
- `.env.example`, `docs/ATS_JOB_SOURCES.md` — Key-/Provider-Doku
- Live-Doku: `theirstack.com/en/docs/api-reference/jobs/search_jobs_v1` + `/authentication` (per webfetch verifiziert 2026-09-29)
- Run: 51 Dateien passed / 1 skipped, 652 Tests passed / 2 skipped (Live-Opt-in), 0 failed

## Classification
**GREEN** — Analyse belegt, Source implementiert/integriert/getestet/dokumentiert.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
- 5× modified, 2× neu — alle zu diesem Task gehörig (siehe Files changed).

## Files changed
- `api/_lib/sources/theirstack.mjs`, `tests/api/theirstack-source.test.mjs` — neu
- `api/_lib/cache.mjs`, `api/_lib/usage.mjs`, `api/_lib/config.mjs`, `api/_lib/sources/index.mjs` — Integration
- `.env.example`, `docs/ATS_JOB_SOURCES.md` — Key-/Provider-Doku (env-Block vorgefunden+verifiziert)
- `docs/reports/THEIRSTACK-01-EXECUTION_LOG.md` — neu (dieser Log)

## Explicit confirmation when no files were changed
N/A — Dateien geändert wie oben gelistet; keine anderen Dateien angefasst.

## Open questions
1. Key in Vercel setzen (`THEIRSTACK_API_KEY`, Production-Scope) + deployen — ohne Key liefert die Source `missing_config` (by design).
2. Danach einmal mit Live-Key verifizieren (`meta.sources.theirstack > 0`); erst dann gilt das Feldmapping als endverifiziert (wie bei Jooble dokumentiert).

## Risks
Niedrig, verifiziert:
- Ohne Key: sauberes Empty, keine Requests, keine Kosten (21 Mock-Tests + volle Suite grün).
- Kontingent: max. 40 Credits pro Paid-Call, Cache-Hits 0, Limit-Guard davor; Worst-Case 200 = 5 volle Calls/Monat — bewusst so (User-Vorgabe), per Env anpassbar.
- Keys ausschließlich serverseitig (Env), nie Frontend/Bundle/Doku.

## Recommended next actions
1. Diesen Task committen + pushen (+ Deploy).
2. `THEIRSTACK_API_KEY` in Vercel (Production) setzen, neu deployen, mit Live-Key verifizieren.
3. Verbrauch via `/api/usage` → `theirstack.creditCount` beobachten.

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: Neue Job-Source (Datensammlung + Normalisierung + Kostenwächter) in deterministischer Suchpipeline. Kein Model Call, kein AI Provider, kein Consent-/Anonymisierungs-/Fallback-Flow geändert. `docs/AI_AUDITLOG.md` wurde gegen sein Template geprüft; es ist eine Template-Datei, daher wurde kein künstlicher Audit-Eintrag erzeugt.

## Current resume point
Verifiziert. Nächster Schritt: committen + pushen.
