# BA-DIRECT-PROBE-01 — Direkte BA-Anfragen ohne Key geprüft (Apify-Runner beim User)

## Current status
PROBED — Direkte keyless BA-REST-Anfragen scheitern ab Server-Netz (durchgehend HTTP 403, alle Header-Varianten). Kein direkter BA-Pfad implementiert — er würde auf Vercel ebenfalls scheitern. Apify bleibt die funktionierende Route.

## Audit date/time
2026-09-29 15:00:00 CET

## Git branch and HEAD
- Branch: main
- HEAD: 7751f26
- Working tree: clean (nur dieser Report als neue Datei)

## Audit scope
Arbeitsteilung: User prüft den Apify-Runner (mit Token, geringe Kosten); ich prüfe die direkten Anfragen bei der BA (ohne Key), damit BA-Jobs mindestens auch dann fließen, wenn Apify nicht antwortet. Methode: `curl`-Probes gegen `rest.arbeitsagentur.de` aus der Server-Umgebung, mehrere Header-Varianten, ohne Key. Read-only; keine Codeänderung.

## Completed audit sections
1. **Such-Endpunkt probiert**: `GET .../pc/v4/app/jobs/?was=java&size=3` mit Default-UA und Browser-UA → beide 403 (1 Byte Body).
2. **Header/Body forensisch geprüft**: volle Response-Header + Body (`xxd`) gelesen — Body ist ein einzelnes Leerzeichen, kein `WWW-Authenticate`, leeres `server`-Feld, `vary: User-Agent`.
3. **Origin/Referer-Variante probiert** (`Origin` + `Referer: .../jobsuche/suche`, Browser-UA, `Accept: application/json`) → weiterhin 403 (1 Byte).
4. **Kontroll-Probes**: `rest.arbeitsagentur.de/` (Root) → 403; `www.arbeitsagentur.de/` → 200 (Netz selbst funktioniert, nur der REST-Host blockt).
5. **Implementierungs-Entscheidung**: kein direkter BA-Pfad eingebaut (Begründung siehe Befund 4).

## Actual findings
1. **Keyless Direktzugriff ab Server-Netz: NEIN.** Alle `rest.arbeitsagentur.de`-Pfade (Suche, Root) antworten 403 — unabhängig von User-Agent, `Accept`, `Origin`, `Referer`. Der betroffene Such-Request wäre exakt der, den ein direkter BA-Source-Adapter auf Vercel stellen müsste.
2. **403-Signatur spricht für Edge-/Bot-Schutz, nicht für fehlende Auth.** Kein `WWW-Authenticate`-Header, leerer `server`-Header, 1-Byte-Leerzeichen-Body (`0x20`) — eine Key-Pflicht würde typischerweise 401 + Auth-Hinweis oder JSON-Fehlerbody liefern. Starkes (kein beweisendes) Indiz für IP-/WAF-Block serverseitiger Netze.
3. **Konsistent mit STEP_25/30A**: Dort 403 für Detail-Endpunkte (`/pc/v4/jobdetails`, `/pc/v6/jobs`) inkl. UA-/`clientId`-/`X-API-Key`-Varianten. Nun auch für den **Such-Endpunkt** und die Root bestätigt — erstmals direkt gemessen statt nur dokumentiert.
4. **Kein direkter Pfad implementiert — bewusst.** Ein `fetchBoardJobs`-ähnlicher BA-Direktadapter würde auf Vercel mit derselben 403 scheitern und pro Suche nur Latenz/Timeouts kosten. Implementierung erst dann sinnvoll, wenn EINE der Bedingungen erfüllt ist: (a) Heimnetz-Test zeigt 200 (Beleg für IP-Block statt Auth), (b) offizieller Key/Registrierung (z. B. api.bund.dev) liegt vor.
5. **Apify bleibt die einzige verifiziert funktionierende Route** (Wohn-IP-ähnliche Netze via Apify-Proxy): Liste (kompakt) + Details (gezielt, mit Quota/Cache) — siehe BA-LIST-DETAIL-01. Dein Runner-Check und dieser Befund ergänzen sich: Apify = Datenweg, Direkt-BA = derzeit serverseitig blockiert.

## Evidence / file references
- Probes (curl, Server-Umgebung, 29.09.2026):
  - `.../pc/v4/app/jobs/?was=java&size=3` Default-UA → `403 (1b)`
  - dto. Browser-UA + `Accept: application/json` → `403 (1b)`
  - Header-Dump: `HTTP/2 403`, `server:` (leer), `vary: User-Agent`, `content-type: text/plain`, kein `WWW-Authenticate`
  - Body: `0x20` (ein Leerzeichen)
  - Mit `Origin: https://www.arbeitsagentur.de` + `Referer: .../jobsuche/suche` → `403 (1b)`
  - `https://rest.arbeitsagentur.de/` → `403`; `https://www.arbeitsagentur.de/` → `200`
- `docs/reports/STEP_25_HTML_ENTITY_AND_TRANSLATION_EXECUTION_LOG.md:766-769,822-830` — 403-Vorbefund Detail-Endpunkte
- `docs/reports/BA-LIST-DETAIL-01-EXECUTION_LOG.md` — Zwei-Stufen-Fluss (Liste + Link/Enrich), Token an jedem Apify-Punkt Pflicht
- `api/_lib/sources/apify/index.mjs:35-39`, `api/_lib/detailEnrich.mjs:65-182` — bestehende funktionierende Route (unverändert)

## Classification
**GREEN** — Auftrag ("Anfragen bei BA prüfen") vollständig ausgeführt und belegt; Negativ-Befund ist ein valides Ergebnis; keine Codeänderung nötig (eine Implementierung gegen 403 wäre schädlich: Latenz ohne Nutzen).

## Terraform checks actually executed and their results
N/A — this project does not use Terraform.

## Git status
Clean; einzige Änderung ist dieser neue Report.

## Files changed
- `docs/reports/BA-DIRECT-PROBE-01-EXECUTION_LOG.md` — neu (dieser Log)

## Explicit confirmation when no files were changed
N/A — genau eine Datei (dieser Report) wurde neu erstellt; kein Applikationscode geändert (bewusst, siehe Befund 4).

## Open questions
1. **Heimnetz-Gegentest (an dich):** `curl "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/app/jobs/?was=java&size=1"` vom Heimanschluss — `200` + JSON = Beleg für IP-Block (dann evtl. clientseitiger PoC als separater Task); `403` = Beleg für harte Auth-Pflicht.
2. Läuft dein Apify-Runner-Check? Falls Apify OK ist, ist die Versorgungslage unverändert stabil.

## Risks
Keine durch diesen Befund. Hinweis: Ein direkter BA-Adapter ohne vorherigen 200-Nachweis würde jede Suche verlangsamen (Timeouts) und 0 Jobs liefern — deshalb nicht implementiert.

## Recommended next actions
1. Diesen Report committen + pushen.
2. Du: Heimnetz-Gegentest (Frage 1) + Runner-Check (Frage 2) — Ergebnisse hierher oder in Folge-Log.
3. Nur bei 200-Nachweis: separater Task für direkten BA-Pfad (mit Fallback auf Apify bei 403).

## AI_AUDITLOG.md decision
AI_AUDITLOG classification: No AI data-flow change.
Reason: Live-Probing eines öffentlichen Job-APIs (jeweils 1–3 Datensätze angefragt, keine PII) plus Dokumentation. Kein Model Call, kein AI Provider, kein Consent-/Anonymisierungs-/Fallback-Flow geändert. `docs/AI_AUDITLOG.md` wurde gegen sein Template geprüft; es ist eine Template-Datei, daher wurde kein künstlicher Audit-Eintrag erzeugt.

## Current resume point
Probing + Report abgeschlossen. Nächster Schritt: Report committen + pushen; dann deine beiden Checks (Runner + Heimnetz-Gegentest).
