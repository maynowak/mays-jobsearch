# BA-BROWSER-MODEL-01 — "Benutzer mit Komfortangebot": Modell verstanden, technische Folgen geprüft

## Current status
CLARIFIED — Nutzer-Modell ("wir agieren als Benutzer mit Komfortangebot", Reglement daher OK) verstanden und übernommen. Technische Prüfung zeigt: Der Job-Datenabruf läuft NICHT im Browser, sondern serverseitig (Vercel Functions) — das Modell ändert daher an den verifizierten Blockern (403 serverseitig, CORS clientseitig) nichts. Optionen dokumentiert.

## Audit date/time
2026-09-29 14:50:00 CET

## Git branch and HEAD
- Branch: main
- HEAD: 87502c7
- Working tree: clean (nur dieser Report als neue Datei)

## Audit scope
Nutzer-Klarstellung zum BA-Zugriff: Da die App bei den Benutzern im Browser läuft, seien die Reglements OK — Entwicklung als "Benutzer mit Komfortangebot" betrachten. Zu prüfen: stimmt die Browser-Annahme für den Datenabruf, und was folgt daraus für den Arbeitsagentur-Key-Bedarf (BOARDS-AA-KEY-01)? Read-only; keine Codeänderung.

## Completed audit sections
1. **Datenfluss verifiziert**: einziger Browser-Fetch auf Fremd-Origin ist OpenPLZ-Autocomplete; alle Job-Daten laufen über eigene `/api/*`-Endpoints.
2. **Server/Client-Grenze belegt**: `/api/jobs` ist eine Vercel-Function; Upstream-Calls (Arbeitnow, Greenhouse, Apify) erfolgen serverseitig.
3. **Konsequenzen des Nutzer-Modells bewertet**: ToS-Deutung übernommen, technische Blocker (403/CORS) bleiben bestehen.
4. **Optionen für keyless BA-Zugriff skizziert** (separate Tasks, keine Implementierung).

## Actual findings
1. **Modell verstanden und übernommen**: "Benutzer mit Komfortangebot" = die App handelt im Auftrag des jeweiligen Nutzers, kein eigenständiges Dritt-Scraping. Diese Deutung wird für ToS-/Reglement-Fragen so festgehalten.
2. **Aber: Der Job-Datenabruf läuft serverseitig, nicht im Browser.**
   - `src/api.ts:169-184` (`apiFetch`) wird ausschließlich mit gleich-Origin-URLs aufgerufen (`/api/jobs`, `/api/match`, …) → Vercel serverless functions.
   - Einziger direkter Browser→Fremd-Origin-Call im Frontend: `useCityAutocomplete.ts:70` (OpenPLZ, öffentlich + CORS-fähig) — ohne Bezug zu BA-Jobdaten.
   - Upstream-Abrufe (Arbeitnow, Greenhouse-Boards, Apify-Runs) erfolgen in `api/_lib/*`, also auf Vercel-Servern, nicht im Browser des Benutzers.
3. **Folge: Das Modell beseitigt keinen der verifizierten Blocker.**
   - Serverseitig bleibt der 403-Befund aus STEP_25/30A bestehen (`rest.arbeitsagentur.de/.../pc/v4/...`, `/pc/v6/jobs` → 403, keine CORS-Header, auch mit Browser-UA/`clientId`/`X-API-Key`).
   - Clientseitig (falls man den Abruf dorthin verlagern würde) blockt CORS: BA sendet kein `Access-Control-Allow-Origin` (STEP_25-verifiziert) — der Browser des Benutzers würde den Fetch ebenfalls ablehnen, unabhängig von der ToS-Deutung.
   - Technische Enforcement-Ebene (403/CORS) und ToS-Ebene (Reglement OK) sind zwei verschiedene Dinge; erstere bleibt bestehen.
4. **BOARDS-AA-KEY-01 bleibt gültig**: `APIFY_API_TOKEN` ist für die implementierte Arbeitsagentur-Route weiterhin erforderlich. Keine der dortigen Aussagen wird durch dieses Modell entkräftet.

## Evidence / file references
- `src/api.ts:169-184,222-235` — `apiFetch` nur für eigene `/api/*`-Routen; `fetchJobs` baut `/api/jobs?...`
- `src/hooks/useCityAutocomplete.ts:70` — einziger Fremd-Origin-Browser-Call (OpenPLZ)
- `api/jobs.mjs:60-67` — serverseitiger Fanout an alle Sources
- `api/_lib/sources/apify/index.mjs:35-39` — `missing_config` ohne `APIFY_API_TOKEN`
- `docs/reports/STEP_25_HTML_ENTITY_AND_TRANSLATION_EXECUTION_LOG.md:766-769,822-830` — 403 + fehlende CORS-Header verifiziert
- `docs/reports/BOARDS-AA-KEY-01-EXECUTION_LOG.md` — Vorgänger-Befund (bleibt bestehen)

## Classification
**GREEN** — Modell verstanden und dokumentiert; technische Folgen verifiziert; keine Codeänderung nötig.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
Clean; einzige Änderung ist dieser neue Report.

## Files changed
- `docs/reports/BA-BROWSER-MODEL-01-EXECUTION_LOG.md` — neu (dieser Log)

## Explicit confirmation when no files were changed
N/A — genau eine Datei (dieser Report) wurde neu erstellt; kein Applikationscode geändert.

## Open questions
1. Soll der BA-Abruf bewusst in den Browser verlagert werden (clientseitiger PoC gegen `rest.arbeitsagentur.de`, Erwartung: CORS-Block — dient nur als Negativ-Nachweis)?
2. Soll eine BA-Registrierung (z. B. via api.bund.dev-Portal, Client-ID/Key) geprüft werden?
3. Oder bleibt Apify (`APIFY_API_TOKEN` + Run-Kosten) die Route? → Falls ja, keine weitere Aktion nötig.

## Risks
Keine durch diesen Befund. Hinweis: Eine Verlagerung des BA-Abrufs in den Browser würde zusätzlich API-Keys/Run-Logik an den Client verlagern und das Kosten-/Missbrauchsmodell ändern — deshalb nur als separater, bewusst entschiedener Task.

## Recommended next actions
1. Diesen Report committen + pushen.
2. Entscheidung zu den offenen Fragen 1–3 treffen (empfohlen: Apify-Route behalten, kein Umbau).
3. Bei Wunsch nach keyless BA-Direktintegration → separater Task mit PoC + ToS-/Auth-Klärung.

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: Modell-Klärung und Datenfluss-Verifikation (Browser vs. Server) ohne Codeänderung. Kein Model Call, kein AI Provider, kein Consent-/Anonymisierungs-/Fallback-Flow geändert. `docs/AI_AUDITLOG.md` wurde gegen sein Template geprüft; es ist eine Template-Datei, daher wurde kein künstlicher Audit-Eintrag erzeugt.

## Current resume point
Befund dokumentiert. Nächster Schritt: Report committen + pushen, dann Entscheidung zu den offenen Fragen.
