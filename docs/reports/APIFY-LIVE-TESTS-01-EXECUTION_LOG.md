# APIFY-LIVE-TESTS-01 — Bedingte Live-Actor-Tests für Standard-Queries

## Current status
COMPLETED — Gated Live-Tests angelegt (default übersprungen, kein Token lokal nötig); Request-Struktur für Standard-Queries verifiziert; Suite grün.

## Audit date/time
2026-09-29 15:15:00 CET

## Git branch and HEAD
- Branch: main
- HEAD: f85d37c (before change; change uncommitted at log time)
- Working tree: neu `tests/api/apify-live.test.mjs`

## Audit scope
User-Vorgabe: Standard-Anfragen am Actor testen; spezifische Tests sollen nur bei Bedarf im Entwicklungsprozess gegen den Actor laufen. Umgesetzt als Opt-in-Live-Tests (kein Ersatz für gemockte Tests). Read-only-Prüfung der bestehenden Tests plus eine neue Testdatei; kein App-Code geändert.

## Completed audit sections
1. **Bestand geprüft**: `tests/api/apify-actor.test.mjs` (Flow, Cache, Limit — alles gemockt), `tests/api/apify-client.test.mjs` (Header/URLs — gemockt). Kein Live-Test im Repo vorhanden.
2. **Token-Lage geprüft**: `APIFY_API_TOKEN` lokal ABSENT (nur Vercel-Production-Scope) — Live-Calls von hier unmöglich und auch nicht gewollt ohne Freigabe.
3. **Gated Live-Tests angelegt** (`tests/api/apify-live.test.mjs`): laufen nur bei `APIFY_LIVE_TESTS=1` + gesetztem Token, sonst `describe.skipIf`.
4. **Request-Struktur ohne Live-Call verifiziert**: `buildInput` für `java` und `Software Developer` + POST-Ziel/Body-Shape.
5. **Verifiziert**: neue Datei skippt sauber (2 skipped, 0 Kosten), volle Suite grün, Build OK, Diff clean.

## Actual findings
- Bestehende Actor-Tests decken Flow/Cache/Limit/Token-Transport ab — alle mit gemocktem `fetch`, kein Geld, kein Token nötig.
- Neue Live-Tests (2 Standard-Queries: `java`, `Software Developer`; `maxResults: 5`; Timeout 150s): Start → Poll (120s) → Dataset-Read → `normalize`-Shape-Check (`aa`-Slug, Titel-String, `arbeitsagentur`-Source).
- Kosten-Disziplin: max 5 Results pro Run; expliziter Kommentar im File (nicht ohne Freigabe erhöhen).
- Verifizierte Request-Struktur (was bei Freigabe gesendet würde):
  - `POST https://api.apify.com/v2/acts/blackfalcondata~arbeitsagentur-jobs-feed/runs`, `Authorization: Bearer <token>`
  - Body `java`: `{"query":"java","location":"","maxResults":5,"mode":"full","includeDetails":false,"compact":true,"excludeEmptyFields":false}`
  - Body `Software Developer`: identische Form mit anderer Query
- Ausführung hier: `1 skipped file, 2 skipped tests` — wie designed, 0 Kosten.

## Evidence / file references
- Neu: `tests/api/apify-live.test.mjs` — Gate (`APIFY_LIVE_TESTS=1` + Token), 2 Tests, Kosten-Kommentar
- `tests/api/apify-actor.test.mjs:44-151` — gemockte Flow-Tests (unverändert)
- `tests/api/apify-client.test.mjs:11-34` — Bearer-Header-Tests (unverändert)
- `api/_lib/sources/apify/actors.mjs:36-60` — Actor-ID, `maxJobs: 40`, `buildInput`
- `api/_lib/sources/apify/client.mjs:1-107` — Start/Poll/Read mit Bearer-Auth
- Run nach lokal: `Test Files 47 passed | 1 skipped (48)`, `Tests 569 passed | 2 skipped (571)`

## Classification
**GREEN** — Live-Test-Harness vorhanden und sicher gegated; kein Geld ausgegeben; Suite grün.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
- Neu: `tests/api/apify-live.test.mjs`
- Neu: dieser Report

## Files changed
- `tests/api/apify-live.test.mjs` — neu (gated Live-Tests)
- `docs/reports/APIFY-LIVE-TESTS-01-EXECUTION_LOG.md` — neu (dieser Log)

## Explicit confirmation when no files were changed
N/A — zwei Dateien neu wie oben gelistet; kein Applikationscode geändert.

## Open questions
Keine. Hinweis: Live-Ausführung erfordert bewusst `APIFY_LIVE_TESTS=1 APIFY_API_TOKEN=<token> npm test -- tests/api/apify-live.test.mjs` — nur bei Bedarf, verursacht echte (kleine) Kosten.

## Risks
Minimal: Datei ist default-skipped; Risiko nur bei manueller Freigabe (begrenzt durch `LIVE_MAX_RESULTS = 5`).

## Recommended next actions
1. Diesen Task committen + pushen.
2. Bei Bedarf (dein Runner-Check läuft ja): Live-Tests gezielt ausführen und Ergebnis hier ergänzen.

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: Test-Harness für Job-Source-Actor (Opt-in, default-skipped) plus Dokumentation. Kein Model Call, kein AI Provider, kein Consent-/Anonymisierungs-/Fallback-Flow geändert. `docs/AI_AUDITLOG.md` wurde gegen sein Template geprüft; es ist eine Template-Datei, daher wurde kein künstlicher Audit-Eintrag erzeugt.

## Current resume point
Verifiziert und bereit. Nächster Schritt: committen + pushen.
