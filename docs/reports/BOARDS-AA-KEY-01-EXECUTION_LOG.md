# BOARDS-AA-KEY-01 — Greenhouse-Boards auflisten/beschreiben + Arbeitsagentur-Key-Bedarf prüfen

## Current status
INVESTIGATED — Boards: Konfigurationspunkte und Beispiel-Tokens dokumentiert (echte Produktions-Boards liegen nur serverseitig in Env-Vars, lokal nicht einsehbar). Arbeitsagentur: Behauptung "benötigt kein API-Key" per Repo-Evidenz WIDERLEGT — direkter BA-Zugriff liefert 403, implementierte Route braucht `APIFY_API_TOKEN`.

## Audit date/time
2026-09-29 14:35:00 CET

## Git branch and HEAD
- Branch: main
- HEAD: 9f5f2da
- Working tree: clean (nur dieser Report als neue Datei)

## Audit scope
1. Auflistung und Beschreibung der Greenhouse Boards (welche Boards, wo konfiguriert, was ein Board-Token ist).
2. Verifizieren, ob die Arbeitsagentur-Quelle ohne API-Key auskommt. Read-only; keine Codeänderung.

## Completed audit sections
1. **Greenhouse-Konfiguration inventarisiert** (`config.mjs`, `greenhouse.mjs`, `ATS_JOB_SOURCES.md`, `.env.example`, Factory).
2. **Repo nach realen Board-Tokens durchsucht** — nur Platzhalter/Beispiele gefunden, keine Produktions-Werte.
3. **Arbeitsagentur-Key-Pfad geprüft** (`apify/index.mjs`, `config.mjs`, `DEPLOYMENT.md`, `ARCHITECTURE.md`).
4. **Frühere BA-Direktzugriff-Untersuchung ausgewertet** (`STEP_25_HTML_ENTITY_AND_TRANSLATION_EXECUTION_LOG.md`, Zeilen 755-834).

## Actual findings

### 1. Greenhouse Boards — Auflistung und Beschreibung
**Was ein Board ist:** Ein Greenhouse `board_token` ist der öffentliche Slug eines Firmen-Jobboards, sichtbar in der URL `https://boards.greenhouse.io/{board_token}`. Die Public API lautet `GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true` — kein Auth-Key nötig, aber pro Firma ein eigener Token.

**Wo Boards konfiguriert werden (zwei Pfade, beide serverseitig):**

| Pfad | Env-Var | Format | Erzeugt | Code |
|------|---------|--------|---------|------|
| Legacy (Multi-Board) | `JOB_SOURCE_GREENHOUSE_BOARDS` | Komma-Liste, z. B. `"token1,token2"` | 1 Source `greenhouse`, loopt über alle Boards | `greenhouse.mjs:17-23,41-49` |
| Factory (empfohlen) | `PUBLIC_ATS_SOURCES` (JSON) | `[{"provider":"greenhouse","identifier":"<board_token>","enabled":true,...}]` | je 1 Source-Instanz `greenhouse:<token>` | `factory.mjs:17-34`, `greenhouse.mjs:163-207` |

**Im Repo genannte Token (ausschließlich Platzhalter/Beispiele, KEINE Produktions-Werte):**
- `ATS_JOB_SOURCES.md`: `"board1,board2,board3"`, `"stripe,airbnb,coinbase"` (Beispiele)
- Echte Produktions-Boards stehen nur in Vercel-Env und sind lokal nicht einsehbar.
- Verhalten bei leerer Config: sofort `emptyResult("no_boards_configured")` → 0 Jobs (`greenhouse.mjs:25-29`).

### 2. Arbeitsagentur API-Key — Behauptung widerlegt
**Behauptung:** "Arbeitsagentur benötigt kein API-Key."
**Ergebnis: NICHT bestätigt — Repo-Evidenz spricht dagegen.**

- **Implementierte Route braucht einen Key:** `api/_lib/sources/apify/index.mjs:36-39` — ohne `APIFY_API_TOKEN` sofort `emptyResult("missing_config")` → 0 Jobs. Doku: `DEPLOYMENT.md:80` ("Optional — without it only Arbeitnow is used"), `ARCHITECTURE.md:166` ("requires `APIFY_API_TOKEN`").
- **Direkter BA-Zugriff ohne Key scheitert (verifiziert, STEP_25/30A):** `GET https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobdetails/{refnr}` und `/pc/v6/jobs` → **HTTP 403**, leerer Body, keine CORS-Header — auch mit Browser-UA, `clientId`-Param und `X-API-Key`-Header (`STEP_25...LOG.md:766-769,822-825`). Fazit dort: "no free public BA detail REST endpoint"; einzig dokumentierter programmatischer Weg ist der Apify-Actor (der selbst `APIFY_API_TOKEN` + Run-Kosten braucht).
- **Präzisierung:** Nur das manuelle Browsen auf `arbeitsagentur.de` (Jobsuche-Webseite, Job-Links `...?id=<refnr>`) ist keyless möglich — für Menschen im Browser, nicht als Daten-Feed für die App. Die Aussage "kein API-Key" gilt also nur für manuelle Browser-Nutzung, **nicht** für die implementierte Jobquelle.

**Konsequenz:** `APIFY_API_TOKEN` kann nicht ersatzlos gestrichen werden. Eine keyless Direkt-Integration wäre ein separates Task (BA-Auth/Relay-Recherche + neue Source-Implementierung).

## Evidence / file references
- `api/_lib/config.mjs:114-118,127-152` — Greenhouse-Flags/Boards, `PUBLIC_ATS_SOURCES`-Parser (Default `[]`)
- `api/_lib/sources/greenhouse.mjs:17-29,41-49,163-207` — Board-Parsing, Loop, Factory-Adapter
- `api/_lib/sources/public-ats/factory.mjs:1-34` — `ADAPTERS`-Map, ID-Schema `provider:identifier`
- `api/_lib/sources/apify/index.mjs:35-39` — `missing_config` ohne `APIFY_API_TOKEN`
- `docs/reports/STEP_25_HTML_ENTITY_AND_TRANSLATION_EXECUTION_LOG.md:766-769,771-778,822-830` — 403-Nachweis Direktzugriff, kein freier BA-REST-Endpunkt
- `docs/DEPLOYMENT.md:80`, `docs/ARCHITECTURE.md:166` — Token-Pflicht dokumentiert
- `docs/ATS_JOB_SOURCES.md:105,143,311,343` — nur Beispiel-Tokens im Repo

## Classification
**GREEN** — Beide Fragen mit verifizierter Evidenz beantwortet; keine Codeänderung nötig.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
Clean; einzige Änderung ist dieser neue Report.

## Files changed
- `docs/reports/BOARDS-AA-KEY-01-EXECUTION_LOG.md` — neu (dieser Log)

## Explicit confirmation when no files were changed
N/A — genau eine Datei (dieser Report) wurde neu erstellt; kein Applikationscode geändert, weil kein Code-Bug vorliegt.

## Open questions
1. Welche Board-Tokens sind aktuell in Vercel gesetzt (`JOB_SOURCE_GREENHOUSE_BOARDS` / `PUBLIC_ATS_SOURCES`)? → Vercel-Dashboard prüfen.
2. Falls eine keyless BA-Direktintegration gewünscht ist → separater Task (Auth-/Relay-Recherche + Implementierung).

## Risks
Keine durch diesen Befund. Hinweis: `APIFY_API_TOKEN` entfernen würde die Arbeitsagentur-Quelle auf 0 Jobs setzen (nur noch Arbeitnow + ggf. konfigurierte ATS-Boards).

## Recommended next actions
1. Diesen Report committen + pushen.
2. Vercel-Env prüfen/setzen je gewünschter Quellenabdeckung.
3. Optional: UI-Hinweis für unkonfigurierte Sources (separater Task).

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: Read-only Befund zu Source-Konfiguration (Boards) und Key-Bedarf (Arbeitsagentur). Kein Model Call, kein AI Provider, kein Consent-/Anonymisierungs-/Fallback-Flow geändert. `docs/AI_AUDITLOG.md` wurde gegen sein Template geprüft; es ist eine Template-Datei, daher wurde kein künstlicher Audit-Eintrag erzeugt.

## Current resume point
Befund dokumentiert. Nächster Schritt: Report committen + pushen.
