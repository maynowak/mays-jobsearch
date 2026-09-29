# KEY-SOURCES-CACHE-01 — L1-Cache für Adzuna + Jooble (Quota-Schutz)

## Current status
COMPLETED — Beide Key-Quellen cachen Roh-Payloads je Query (TTL 600 s, Apify-L1-Muster); identische Wiederholungs-Suchen kosten keinen Paid-Call mehr.

## Audit date/time
2026-09-29 19:35:00 CET

## Git branch and HEAD
- Branch: main
- HEAD: 7e1a8cb (before change; change uncommitted at log time)
- Working tree: `M api/_lib/sources/adzuna.mjs`, `M api/_lib/sources/jooble.mjs`, `M tests/api/adzuna-source.test.mjs`, `M tests/api/jooble-source.test.mjs`, `M docs/ATS_JOB_SOURCES.md`

## Audit scope
User-Vorgabe nach Key-Eintrag: Cache einbauen, damit das 1000-Request-Kontingent (Jooble; Adzuna analog per-Call-kostenpflichtig) nicht pro Suche verbrennt. Umsetzung als L1-Result-Cache je Query, analog Apify (`APIFY_CACHE_TTL_SEC = 600`). Keine Änderung an Normalisierung, Filtern, Registry, Quotas.

## Completed audit sections
1. **Adapter-Stand geprüft**: beide Adapter fetchen bisher pro `/api/jobs`-Request neu (kein Cache) — jede Suche = 1+ Paid-Call(s).
2. **L1-Cache eingebaut** (Roh-Payloads, wie Apify-L1; Normalisierung/Filterung laufen weiter pro Request auf gecachten Daten):
   - Adzuna je Land: `job-source:adzuna:<country>|<what>|<where>`, TTL 600 s, nur nicht-leere Payloads, Cache-Hit/Miss-Counter (`countJobSourceCacheHit/Miss`).
   - Jooble je Query: `job-source:jooble:<keywords>|<location>`, TTL 600 s, gleiche Regeln.
3. **Cache-Tests ergänzt** (je Adapter: Hit ohne Fetch, Store mit Key/TTL-Shape, kein Store bei leer, Adzuna zusätzlich Länder-Unabhängigkeit).
4. **Doku**: `ATS_JOB_SOURCES.md`-Abschnitte beider Provider um Cache-Verhalten ergänzt.
5. **Verifiziert**: volle Suite, Build, Diff-Check.

## Actual findings
- Ohne Cache kostet jede identische Wiederholungs-Suche (z. B. Doppelklick, Re-Match, geteilte Profile) volle Paid-Calls — bei 1000 Requests Kontingent der dominante Verbrauchspfad.
- Mit Cache kostet nur die erste Suche je Query-Fenster (10 Min); danach 0 Paid-Calls. Leere Ergebnisse werden bewusst nicht gecacht (Upstream-Lage kann sich ändern; konsistent mit Apify).
- Cache-Key enthält die nativen Suchparameter (`what`/`where` bzw. `keywords`/`location`), normalisiert (lowercase/trim) — keine Cross-Query-Kontamination; lokale Filter laufen deterministisch auf gecachten Rohdaten.

## Evidence / file references
- `api/_lib/sources/adzuna.mjs` — `CACHE_TTL_SEC`, `countryCacheKey`, `fetchCountryJobsCached`
- `api/_lib/sources/jooble.mjs` — `CACHE_TTL_SEC`, `searchCacheKey`, `fetchJoobleJobsCached`, `fetchJoobleUpstream`
- `tests/api/adzuna-source.test.mjs` — 4 Cache-Tests (Hit, Store, Länder-Unabhängigkeit, kein Empty-Store)
- `tests/api/jooble-source.test.mjs` — 3 Cache-Tests (Hit, Store, kein Empty-Store)
- `docs/ATS_JOB_SOURCES.md` — Cache-Absätze beider Provider
- Run: 50 Dateien passed / 1 skipped, 631 Tests passed / 2 skipped (Live-Opt-in), 0 failed

## Classification
**GREEN** — Quota-Schutz umgesetzt, getestet, dokumentiert; volle Suite grün.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
- 5× modified, alle zu diesem Task gehörig (siehe Files changed).

## Files changed
- `api/_lib/sources/adzuna.mjs` — L1-Cache je Land + Counter
- `api/_lib/sources/jooble.mjs` — Fetch in `fetchJoobleUpstream` extrahiert, L1-Cache + Counter davor
- `tests/api/adzuna-source.test.mjs` — Cache-Mocks + 4 Cache-Tests
- `tests/api/jooble-source.test.mjs` — Cache-Mocks + 3 Cache-Tests
- `docs/ATS_JOB_SOURCES.md` — Cache-Verhalten beider Provider
- `docs/reports/KEY-SOURCES-CACHE-01-EXECUTION_LOG.md` — neu (dieser Log)

## Explicit confirmation when no files were changed
N/A — Dateien geändert wie oben gelistet; keine anderen Dateien angefasst.

## Open questions
Keine.

## Risks
Niedrig, verifiziert:
- Cache-Key enthält alle upstream-relevanten Parameter → keine falschen Treffer.
- Nur nicht-leere Payloads gecacht; TTL 600 s wie Apify-L1; Redis-Ausfall = fail-safe (Miss-Pfad, bestehendes Verhalten).
- Volle Suite grün (631 passed), Build OK.

## Recommended next actions
1. Diesen Task committen + pushen (+ Deploy, damit Cache + Key live greifen).
2. Verbrauch via `/api/usage` beobachten (Cache-Hits vs. Misses je Source).

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: Quota-Schutz-Cache für Job-Source-Adapter (Datensammlungsebene). Kein Model Call, kein AI Provider, kein Consent-/Anonymisierungs-/Fallback-Flow geändert. `docs/AI_AUDITLOG.md` wurde gegen sein Template geprüft; es ist eine Template-Datei, daher wurde kein künstlicher Audit-Eintrag erzeugt.

## Current resume point
Verifiziert. Nächster Schritt: committen + pushen.
