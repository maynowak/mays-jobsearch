# BA-LIST-DETAIL-01 — Wissensstand-Abgleich: Liste ohne Details + Link/Apify-Anreicherung

## Current status
CLARIFIED — Erinnerung des Users trifft die Zwei-Stufen-Form (kompakte Liste + Details per Link/Apify), aber nicht das "ohne Token": Ein tokenloser Listen-Pfad hat in dieser Codebase nie existiert (auch vor der Modularisierung nicht).

## Audit date/time
2026-09-29 15:05:00 CET

## Git branch and HEAD
- Branch: main
- HEAD: 3c77d85
- Working tree: clean (nur dieser Report als neue Datei)

## Audit scope
Nutzer-Erinnerung prüfen: "Wir hatten das schon am Laufen — ohne Token liefert lediglich Name des Jobs ohne Details; Details wurden über einen Link beim Anbieter geschaut oder über Apify nachgeholt." Abgleich gegen Git-Historie und aktuellen Code. Read-only; keine Codeänderung.

## Completed audit sections
1. **Historie geprüft** (`git log -S`, `git show 67f3ff2^`): Token-Pflicht und Kompakt-Modus bestanden bereits vor der Modularisierung.
2. **Stufe 1 (Liste) verifiziert**: Kompakt-Records ohne Vollbeschreibung, Portal-URL + RefNr enthalten.
3. **Stufe 2a (Link) verifiziert**: Jeder AA-Job trägt die Portal-URL für die Detailansicht beim Anbieter.
4. **Stufe 2b (Apify-Enrich) verifiziert**: gezielte Detail-Runs mit Quota + Cache, auto-ausgelöst in `/api/match`, zusätzlich `/api/job-details`-Endpoint.

## Actual findings
1. **"Ohne Token" hat es nie gegeben.** Bereits das alte monolithische `api/_lib/apify.mjs` (vor Commit `67f3ff2`) enthielt `APIFY_API_TOKEN`-Check → `missing_config` ohne Token (dort Zeilen 162-164) sowie Listen-Modus `includeDetails: false, compact: true` (Zeilen 177-178). Der String `rest.arbeitsagentur.de` kommt im Code nirgends vor (nur in Doku als 403-Nachweis) — ein direkter keyless BA-Feed war nie implementiert.
2. **Die erinnerte Zwei-Stufen-Form existiert und ist aktuell:**
   - **Stufe 1 — kompakte Liste:** Listen-Run mit `includeDetails: false, compact: true` (`actors.mjs:43-51`) → Titel/Arbeitgeber/Ort/`portalUrl`/`referenceId`, aber **keine Vollbeschreibung** ("lediglich Name des Jobs ohne Details" — Erinnerung in diesem Punkt korrekt). Kostet 1 Actor-Run pro frischer Query (danach L1-Cache 10 Min + L2-Dataset-Wiederverwendung).
   - **Stufe 2a — Link beim Anbieter (keyless):** Normalisierung setzt `url = https://www.arbeitsagentur.de/jobsuche/suche?id=<refnr>` (`actors.mjs:24`, `detailEnrich.mjs:17,34-36`). Der Klick erfolgt im Browser des Benutzers — exakt das "Benutzer mit Komfortangebot"-Modell aus BA-BROWSER-MODEL-01; hier ist kein Key im Spiel.
   - **Stufe 2b — Apify nachholen (mit Token + Quota):** `enrichArbeitsagenturDetails` (`detailEnrich.mjs:65-182`) — gezielter `includeDetails: true`-Run auf Portal-URLs, gebündelt in EINEM Run, 7-Tage-Cache, Tages-Quota pro Session + IP-Backstop, Monats-Backstop, fails closed. Auto-Auslösung nur für gematchte AA-Jobs **ohne** Beschreibung in `/api/match` (`match.mjs:21-47`, best-effort — Match scheitert nie am Enrich), plus manuell via `/api/job-details` (`job-details.mjs:2,40`).
3. **Korrektur der Erinnerung:** Token ist an **jedem** Apify-Berührungspunkt Pflicht (Liste UND Enrich); keyless ist nur der Portal-Link-Klick. Vermutlich wurde "kompakte Liste" (billig, 1 Run, ohne Details) mit "tokenlos" verwechselt.
4. **BOARDS-AA-KEY-01 bleibt gültig**, wird hiermit präzisiert: `APIFY_API_TOKEN` streichen = Arbeitsagentur-Liste UND Enrich entfallen (nur Portal-Links bereits gelieferter Jobs blieben nutzbar).

## Evidence / file references
- `git show 67f3ff2^:api/_lib/apify.mjs:162-164,177-178` — Token-Check + Kompakt-Modus schon vor Modularisierung
- `git log -S rest.arbeitsagentur` — nur Doku-Treffer (STEP_30/30A), nie Code
- `api/_lib/sources/apify/actors.mjs:36-60` — Listen-Input (`includeDetails: false, compact: true`) + Detail-Input (`includeDetails: true`); `normalizeArbeitsagentur` (tags `[]`, keine Vollbeschreibung aus Liste)
- `api/_lib/sources/apify/index.mjs:35-39` — `missing_config` ohne Token
- `api/_lib/detailEnrich.mjs:17-36,65-182` — RefNr-Validierung, Portal-URL-Bau, Quota, 1 gebündelter Run, 7d-Cache
- `api/match.mjs:21-47,79` — Auto-Enrich nur für Treffer ohne `description`, best-effort
- `api/job-details.mjs:2,40` — manueller Enrich-Endpoint
- `docs/reports/STEP_25_HTML_ENTITY_AND_TRANSLATION_EXECUTION_LOG.md:766-769,822-830` — 403 Direktzugriff, Apify als dokumentierte Route

## Classification
**GREEN** — Wissensstand abgeglichen und mit verifizierter Evidenz dokumentiert; keine Codeänderung nötig.

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
Clean; einzige Änderung ist dieser neue Report.

## Files changed
- `docs/reports/BA-LIST-DETAIL-01-EXECUTION_LOG.md` — neu (dieser Log)

## Explicit confirmation when no files were changed
N/A — genau eine Datei (dieser Report) wurde neu erstellt; kein Applikationscode geändert.

## Open questions
Keine zum Befund. Offen (wie bisher): Falls eine tokenlose BA-Liste gewünscht ist → separater Task (derzeit technisch blockiert: 403 + kein CORS, siehe STEP_25/BOARDS-AA-KEY-01).

## Risks
Keine durch diesen Befund. Hinweis: Missverständnis "ohne Token" bitte nicht in Config-Entscheidungen übernehmen — `APIFY_API_TOKEN` entfernen = AA-Liste + Enrich weg.

## Recommended next actions
1. Diesen Report committen + pushen.
2. Keine Codeänderung. Bei Bedarf Vercel-Env (`APIFY_API_TOKEN`, Quotas) prüfen.

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: Git-/Code-Historienabgleich und Dokumentation des BA-Listen-/Detail-Flows. Kein Model Call, kein AI Provider, kein Consent-/Anonymisierungs-/Fallback-Flow geändert. `docs/AI_AUDITLOG.md` wurde gegen sein Template geprüft; es ist eine Template-Datei, daher wurde kein künstlicher Audit-Eintrag erzeugt.

## Current resume point
Abgleich dokumentiert. Nächster Schritt: Report committen + pushen.
