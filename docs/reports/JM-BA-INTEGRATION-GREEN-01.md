# JM-BA-INTEGRATION-GREEN-01

**Art:** Bundesagentur für Arbeit / Integrationsentwicklung / Gesamtdokumentation
**Status:** **TESTED GREEN (lokal/mock)** — Produktions-Live-Verifikation offen
**Datum:** 2026-11-02
**Baseline:** `main` @ `c402014`, `origin/main` synchron
**Grenzen:** Kein Deployment, keine echten Apify-Runs, keine BA-Direkt-API, keine Quotenänderung.

## 1. Zusammenfassung

Die bestehende BA-Anbindung ist über den Apify-Actor
`blackfalcondata~arbeitsagentur-jobs-feed` integriert und lokal umfassend
getestet. Die Integration ist **nicht** als direkte BA-REST-API implementiert.

Aktueller Stand:

- BA-Liste über Apify (`includeDetails:false`, `compact:true`).
- Bedarfsgesteuertes Detail-Enrichment über einen gezielten Apify-Run
  (`startUrls`, `includeDetails:true`).
- L1-Cache, L2-Dataset-Reuse, Run-/IP-/Detail-Quotas bleiben aktiv.
- Gast-Policy erlaubt BA über die bestehende Apify-Ausnahme.
- BA-Detailtexte werden als HTML, Plain-Text oder Markdown sicher und formatiert
  dargestellt.
- Bei fehlendem Detail-Fallback erscheint ein sichtbarer Link zur
  Originalanzeige bei der BA.
- Eine direkte BA-REST-API bleibt **BLOCKED** und ist für den vereinbarten
  nutzervermittelten Fluss **nicht erforderlich**.

## 2. Architektur

```text
Nutzer startet Suche in May's Job Matcher
→ /api/jobs
→ Source-Registry
→ arbeitsagentur (Apify)
   ├── Listen-Run: compact, max. 40 Jobs
   └── bei „Mehr anzeigen“: gezielter Detail-Run via startUrls
→ Normalisierung / Deduplizierung / Suche
→ Frontend: gemeinsame Job- und Detaildarstellung
```

### 2.1 Keine direkte BA-API

- Keine direkte `rest.arbeitsagentur.de`-Source.
- Keine Header-Simulation, kein CORS-Bypass, kein Proxy.
- Die öffentliche BA-Client-ID ist kein Drittanbieter-Zugangsrecht.
- Der frühere direkte BA-Probe-Fall endete serverseitig mit HTTP 403.
- Der nutzervermittelte BA-Fluss (Person sucht bei der BA, nutzt danach unsere
  Aufbereitung) bleibt der rechtlich/organisatorisch vorgesehene Weg.

## 3. Entwicklungsmaßnahmen

### 3.1 BA-Suche wiederhergestellt

`JM-BA-RESTORE-03` (`559cd55`):

- Mehrwortige Skills wie `["Java Developer"]` wurden im Apify-Adapter als eine
  exakte Phrase geprüft und verwarfen Treffer wie `Java-Entwickler`.
- Der Source-Filter teilt Rollen/Skills jetzt für die lokale Trefferprüfung in
  Wörter.
- Die Search-Strategy hat einen begrenzten Einzelwort-Fallback, wenn die exakte
  Phrase keine Treffer liefert.
- Reproduzierte Beispiele:
  - Java Developer, Frankfurt
  - Softwareentwickler, Darmstadt
  - Cloud Engineer, Mainz
- Nach der Korrektur jeweils BA-Treffer für Gast und angemeldet.

### 3.2 BA-Detaildarstellung

`JM-BA-DETAIL-FORMAT-01/02/03` (`d3989d8`, `4b498a4`, `fc84d20`):

- BA-Details nutzen nach dem Laden denselben Darstellungsumfang wie normale
  Suchergebnisse (`displayJob`).
- Plain-Text und Markdown werden unterstützt:
  - Absätze
  - Zeilenumbrüche
  - Bullet-/nummerierte Listen
  - `**Fett**`
  - Markdown-Links `[Text](https://…)`
  - Überschriften
- HTML bleibt unverändert und wird weiterhin durch DOMPurify sanitized.
- Keine neue UI-Komponente, keine neue Abhängigkeit.

### 3.3 Detail-Fehler-Fallback

`JM-BA-DETAIL-FALLBACK-04` (`fb155cc`):

- Bei fehlgeschlagenem Detail-Laden erscheint direkt an der Fehlermeldung:
  **„Originalanzeige bei der Arbeitsagentur öffnen“**
- Verwendet die vorhandene `job.url`, nur gültige `http(s)`-Ziele.
- Keine automatische Navigation.
- Bestehender „Stellenanzeige ansehen“-Link bleibt erhalten.
- Keine zusätzliche BA-API und kein zusätzlicher Apify-Run.

## 4. Teststatus — TESTED GREEN (lokal/mock)

### 4.1 Gezielte BA-Tests

Ausgeführt am 2026-11-02:

```text
tests/api/apify-actor.test.mjs
tests/api/apify-client.test.mjs
tests/api/detail-enrich.test.mjs
tests/api/job-details.test.mjs
tests/api/match-enrich.test.mjs
tests/api/sources-registry.test.mjs
tests/api/guest-source-policy.test.mjs
tests/api/guest-model-a-cookie.test.mjs
src/components/RemainingCard.test.tsx
src/components/JobSources.test.tsx
src/lib/safeHtml.test.ts
```

**Ergebnis: 11 Testdateien, 108 Tests, alle PASS.**

Abgedeckt:

- Apify-Listen-/Detail-Flow (gemockt)
- Cache/Dataset-Reuse
- Run-Limit/Cost-Guard
- Guest-Policy
- Multiword-Skills und Target-Roles
- Deduplizierung/Registry
- Detail-Enrichment und Fehlerfälle
- BA-Detailformatierung (Plain-Text/Markdown)
- Fallback-Link zur Originalanzeige
- Lade-/Erfolgs-/Cache-/Fehlerzustände

### 4.2 Gesamtsuite

| Prüfung | Ergebnis |
|---|---|
| `npm test -- --run` | **1155 passed, 5 skipped** |
| Gezielte BA-Tests | **108 passed** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |

### 4.3 Nicht ausgeführt / nicht verifiziert

- **Keine echten Apify-Runs** (keine Kostenfreigabe).
- **Keine Produktions-Live-Verifikation** der BA-Quelle.
- **Keine Live-BA-REST-Abfrage**; direkter Zugriff bleibt technisch blockiert.
- Kein Deployment der letzten lokalen Fixes.
- Kein `USAGE_DIAGNOSTICS_TOKEN`-Zugriff; Produktionszähler nicht lesbar.

**Wichtig:** „TESTED GREEN“ bezieht sich auf lokale/mock-basierte Tests und
Browser-Darstellung, nicht auf einen unbelegten Live-Provider-Erfolg.

## 5. Produktionsstatus / offene Punkte

| Punkt | Status |
|---|---|
| `APIFY_API_TOKEN` in Production | vorhanden |
| `JOB_SOURCE_ARBEITSAGENTUR_ENABLED` | nicht explizit gesetzt → Default `true` |
| `APIFY_MONTHLY_MAX_RUNS` | nicht explizit gesetzt → Default `100` |
| Aktueller Apify-Monatszähler | **nicht verifiziert** |
| Apify-Run-/Cache-Logs | **nicht verifiziert** |
| BA-Direkt-API | **BLOCKED** / nicht implementiert |
| Nutzervermittelter BA-Fluss | **GO** |

Mögliche Produktionsursachen für 0 BA-Treffer bleiben:

- `limit_reached`
- `quota_unavailable`
- `busy`
- Apify-Upstream-Fehler
- leerer/veralteter Cache/Dataset
- fehlende/ungültige Suchparameter
- Filter-/Strategy-Grenzen

Der reproduzierte Codefehler der Mehrwortsuche ist behoben. Eine aktuelle
Produktionsnull kann ohne interne Usage-Diagnostics nicht abschließend
zugeordnet werden.

## 6. Nächste Schritte

1. Deployment der lokalen BA-Fixes nur nach separater Freigabe.
2. Danach die drei Beispielsuchen im Frontend prüfen:
   - Java Developer, Frankfurt
   - Softwareentwickler, Darmstadt
   - Cloud Engineer, Mainz
3. Bei weiterhin 0 BA-Treffern interne Diagnostics prüfen:
   - `apify.runs`
   - `jobSources.arbeitsagentur.*`
   - `sourceReasons` / `apify.reason`
4. Bei `limit_reached` keine eigenmächtige Erhöhung; Betreiberentscheidung.
5. Live-Test nur mit ausdrücklicher Kostenfreigabe.

## 7. Referenzen

- `docs/reports/JM-BA-RESTORE-03.md`
- `docs/reports/JM-BA-DETAIL-FORMAT-01.md`
- `docs/reports/JM-BA-DETAIL-FALLBACK-04.md`
- `docs/reports/BA-SOURCE-CHECK-02.md`
- `docs/reports/JM-BA-DIRECT-API-READINESS-01.md`
- `docs/reports/BA-DIRECT-PROBE-01-EXECUTION_LOG.md`
- `docs/reports/BA-LIST-DETAIL-01-EXECUTION_LOG.md`

## 8. Git

- Dokumentationscommit: nach diesem Bericht.
- Kein Deployment.
- Keine echten Apify-Aufrufe.
EOF