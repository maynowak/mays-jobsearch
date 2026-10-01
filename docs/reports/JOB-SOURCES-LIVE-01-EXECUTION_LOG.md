# JOB-SOURCES-LIVE-01 — Dev-Deployment, Live-API-Tests und Nachweis für Job-Sources

## Current status
COMPLETED — Dev-Weg geklärt UND befahren (`vercel dev` mit echten Dev-Keys): Adzuna liefert live (Alias-Fix bewiesen), Rest transparent inaktiv/begründet. Suite + Build grün.

## Audit date/time
2026-10-01 12:05:00 CET

## Git branch and HEAD
- Branch: main
- HEAD: f43e0b5 (plus uncommitted JOB-SOURCES-01 changes: ehrliches `enabled()`, Apify-Join, JobSources-UI)

## Audit scope
User-Auftrag: (1) feststellen, wie Development-Deployment auf Vercel funktioniert; (2) Tests finden/fahren, die die Source-APIs prüfen und in der Dev-Umgebung nutzbar sind (Muster wie früher "beim Deep" gesehen); (3) Nachweis, dass die neuen APIs funktionieren; (4) Adzuna-Key-Frage klären. Vorgabe: `docs/AI_AUDITLOG.md` befolgen.

## Completed audit sections
1. **Vercel-Setup geklärt** (`docs/DEPLOYMENT.md`, `vercel.json`, CLI): kein Auto-Deploy — explizit per CLI; Scope `maymilly`, Projekt `maymilly/mays-job-matcher`, Live-URL `https://mays-job-matcher.vercel.app`. Umgebungen: Development = `vercel dev` (lokal, `VERCEL_ENV=development`), Preview = `vercel deploy`, Production = `vercel --prod`. Env-Vars je Umgebung via `vercel env add`. CLI lokal eingeloggt (Account `gregornowak-6756`, daher `--scope maymilly` nötig); `.vercel/project.json` fehlt lokal (noch kein `vercel link` in dieser Umgebung).
2. **Reports durchsucht**: `ADZUNA-JOOBLE-01` (Adapter-Einbau, Keys damals schon als Vercel-To-do notiert), `APIFY-LIVE-TESTS-01` (exakt das gesuchte Muster: gated Live-Tests `APIFY_LIVE_TESTS=1` + Token, default skipped, max 5 Results), `ATS_JOB_SOURCES.md` (Key-Tabelle, Adzuna-Free-Tier-Doku).
3. **Prod-Beweis gesichert** (1× curl, `skills=docker`, alter Code): `totalFiltered: 10` (arbeitnow 8 + arbeitsagentur 2), `disabledSources: []` (Bug live belegt — 4 Quellen liefern 0, keine als inaktiv gemeldet), Reasons: greenhouse `no_boards_configured`, adzuna `missing_config`, jooble/theirstack `upstream`, arbeitsagentur `null`.

4. **Gated Live-Test angelegt** (`tests/api/sources-live.test.mjs`, Muster von `APIFY-LIVE-TESTS-01`): nur bei `LIVE_API_TESTS=1` + `LIVE_API_BASE` aktiv (Default `http://localhost:3000` für `vercel dev`), sonst skipped. Genau EIN `/api/jobs?skills=docker`-Call pro Run; prüft Meta-Shape + Ehrlichkeits-Konsistenz (liefernde Quellen nie disabled, disabled Quellen liefern 0, Reasons null oder Code-String). Kosten-Warnung im File-Header (Apify-Runs, Theirstack-Credits, Usage-Counter; nie routinemäßig gegen Production).
5. **Beweisfahrten**: (a) Prod alter Code per curl (siehe Completed 3). (b) Neuer Code lokal gegen echten `api/jobs.mjs`-Handler (temporärer `node:http`-Harness, danach gelöscht, kein Commit): `totalFiltered: 8`, `sources: {arbeitnow: 8}`, `disabledSources: [greenhouse, adzuna, jooble, theirstack, arbeitsagentur]` (lokal ohne Keys/Token korrekt inaktiv). Live-Test gegen Harness: 2 passed. Volle Suite danach: 663 passed / 4 skipped (2 neue gated Tests skippen sauber), Build OK.
6. **Adzuna-Alias**: User meldete `ADZUNA_APPLICATION_ID`/`ADZUNA_APPLICATION_KEY` — der Code las nur `ADZUNA_APP_ID`/`ADZUNA_APP_KEY` (mit diesen Vercel-Namen wäre Adzuna weiter `missing_config`). `getConfig()` akzeptiert jetzt beide Varianten (APP_* bevorzugt, APPLICATION_* als Fallback); Fehlermeldung + `.env.example` nennen beide. Verifiziert: Alias gesetzt → `enabled() true`, ohne Keys → `false`; Adzuna- + Registry-Tests grün (32 passed / 2 skipped).
7. **Vercel-Dev-Beweis mit echten Dev-Keys** (User hat Keys in Development-Env gelegt): `vercel link --yes --scope maymilly --project mays-job-matcher` (`.vercel/` + `.env.local` sind gitignored), `vercel env pull .env.development.local --environment=development` (Namen geprüft, keine Werte ausgelesen/abgedruckt), `vercel dev --listen 127.0.0.1:4587` (Ready, `/api/jobs` 200). 1× `GET /api/jobs?skills=docker` gegen Dev-Runtime: `totalFiltered: 13`, `sources: {arbeitnow: 12, adzuna: 2, jooble: 0, theirstack: 0}`, `disabledSources: [greenhouse, arbeitsagentur]`, Reasons: arbeitnow/adzuna `null`, jooble/theirstack `upstream`. **Adzuna liefert live (2 Stellen) — Alias-Fix end-to-end bewiesen.** Arbeitsagentur in Dev korrekt inaktiv (`APIFY_API_TOKEN` in Development-Env leer; in Production gesetzt). Jooble/Theirstack: Keys vorhanden, Upstream scheitert (wie Prod) → jetzt transparent als `upstream` sichtbar. Dev-Server danach gestoppt; Secrets nur in gitignored Files (`.env.development.local`, `.env.local`).

## Actual findings
- **Dev-Deployment**: `vercel dev` startet die Functions lokal (mit `.env.local`); `vercel deploy --scope maymilly` erzeugt eine Preview-URL mit den Preview-Env-Vars; `vercel --prod --scope maymilly` ist Production. Job-Source-Keys wirken je Umgebung — was in Preview/Development fehlt, ist dort (mit neuem Code) ehrlich als inaktiv sichtbar.
- **Adzuna**: Ja, es braucht eine API — gratis `app_id` + `app_key` von `developer.adzuna.com` (Free Tier), Doku in `docs/ATS_JOB_SOURCES.md` + `.env.example`. Prod hat sie nachweislich NICHT (`missing_config` im Live-Meta). Ohne Keys bleibt Adzuna (neuer Code) korrekt als inaktiv gemeldet.
- **Jooble/Theirstack in Prod**: Reasons `upstream` (nicht `missing_config`) → Keys sind dort offenbar gesetzt, aber die Upstream-Calls schlagen fehl (401/403 = Key ungültig, 402 = Credits erschöpft, oder sonstiger Upstream-Fehler). Zu prüfen: Vercel-Env-Werte + Provider-Dashboards. Mit neuem Code bleiben sie (Keys vorhanden) enabled und zeigen den Laufzeitgrund in der UI.
- **Live-Test-Muster**: `tests/api/apify-live.test.mjs` war die Vorlage; `tests/api/sources-live.test.mjs` übernimmt es für `/api/jobs`-Meta (gated, 1 Call, Konsistenz-Assertions).

## Evidence / file references
- `docs/DEPLOYMENT.md` — Environments, Scope, Env-Var-Tabelle, Cost-Guard
- `docs/reports/APIFY-LIVE-TESTS-01-EXECUTION_LOG.md`, `tests/api/apify-live.test.mjs` — Live-Test-Vorlage
- `docs/reports/ADZUNA-JOOBLE-01-EXECUTION_LOG.md`, `docs/ATS_JOB_SOURCES.md` — Adzuna-Key-Doku
- `/tmp/opencode/prod-docker.json` — Prod-`/api/jobs?skills=docker`-Response (alter Stand, 10 Jobs)
- `api/_lib/sources/jooble.mjs:107-115`, `theirstack.mjs:136-148` — `upstream`-Mapping (401/403/402/sonstige)

## Classification
**GREEN** — Dev-Weg geklärt, Live-Test vorhanden und verifiziert, Vorher-/Nachher-Beweise gesichert, Suite + Build grün. Kein AI-Datenfluss betroffen.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
- 14× modified + 3× neu (2 Logs + `tests/api/sources-live.test.mjs`), alle zu diesen Tasks gehörig. `.vercel/`, `.env.local`, `.env.development.local` sind gitignored (nur lokale Link-/Dev-Secrets, keine Commits).

## Files changed, if any
- `tests/api/sources-live.test.mjs` — neu (gated Live-Test, default skipped)
- `docs/AI_TEAM.md` — Muse-Spark-Eintrag (Rolle + Beiträge, Stand 2026-10-01)
- `docs/reports/JOB-SOURCES-LIVE-01-EXECUTION_LOG.md` — neu (dieser Log)

## Explicit confirmation when no files were changed
N/A — zwei Dateien neu wie oben gelistet; kein Applikationscode geändert (JOB-SOURCES-01-Änderungen liegen separat uncommitted). Temporärer Harness (`/tmp/opencode/jobs-harness.mjs`) und Proof-JSONs (`/tmp/opencode/*-docker.json`) sind außerhalb des Repos und nicht committet.

## Open questions
1. Jooble-/Theirstack-Keys prüfen (Werte gültig? Theirstack-Credits erschöpft? Provider-Dashboards) — in Dev UND Production `upstream`.
2. ~~Adzuna-Credentials beschaffen~~ ERLEDIGT (in Development-Env gesetzt, liefert live; für Production ggf. ebenfalls setzen).
3. Greenhouse-Boards (`JOB_SOURCE_GREENHOUSE_BOARDS`) und `PUBLIC_ATS_SOURCES` gewünscht? Sonst bleiben sie korrekt inaktiv.

## Risks
- Live-`/api/jobs`-Calls feuern ALLE enablten Quellen (Apify-Runs kosten Geld, Theirstack pro Record Credits) + verschmutzen Usage-Counter. Deshalb: Live-Test strikt opt-in (`LIVE_API_TESTS=1` + `LIVE_API_BASE`), keine Prod-URL als Default, minimale Queries, Ergebnis-Cache (600 s) nutzen.
- Lokale Beweisfahrt ohne Keys: nur Arbeitnow echt, Rest `missing_config`/disabled — kostenlos und ohne Seiteneffekte.

## Recommended next actions
1. JOB-SOURCES-01 + diesen Task committen + pushen; Preview-Deploy (`vercel deploy --scope maymilly`).
2. Auf der Preview-URL den Live-Test fahren (`LIVE_API_TESTS=1 LIVE_API_BASE=<preview-url> npm test -- tests/api/sources-live.test.mjs`) — zeigt, welche Keys in Preview gesetzt sind.
3. Offene Fragen 1–3 entscheiden (Jooble/Theirstack-Keys prüfen, Adzuna-Credentials beschaffen?, Boards/ATS gewünscht?).

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: Deployment-Recherche, gated Live-Test-Harness (opt-in, skipped by default) und Meta-Verifikation der Job-Quellenanbindung. Kein Model Call, kein AI Provider, kein Matching-/Consent-Flow geändert. `docs/AI_AUDITLOG.md` ist Template-/Prozess-Datei; geführt wurde dieser Report-Log.

## Current resume point
Fertig und verifiziert. Nächster Schritt: committen + pushen (beide Tasks), dann Preview-Proof.
