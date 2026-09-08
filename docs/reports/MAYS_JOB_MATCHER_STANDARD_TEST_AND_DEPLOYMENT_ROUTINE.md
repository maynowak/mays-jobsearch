# May's Job Matcher — Standard Test & Deployment Routine

## 1. Zweck

Reproduzierbare, einzeln ausführbare Routine für Codeänderungen, Regression,
Deployment und den (seltenen) kontrollierten echten Apify-Detail-Enrichment-Test.

Gilt für den aktuellen Stand (Version `2.0.0`). Kein Ersatz für den laufenden
Execution Log — dieser bleibt der Nachweis der tatsächlichen Ausführung
(`docs/reports/STEP_25_HTML_ENTITY_AND_TRANSLATION_EXECUTION_LOG.md`).

## 2. Systemgrenzen

- **Frontend:** React + TypeScript + Vite, SPA.
- **Backend:** Vercel Serverless Functions (`api/**/*.mjs`, ESM).
- **Datenquellen:** Arbeitnow (direkter API-Fetch), Arbeitsagentur über Apify
  Actor `blackfalcondata~arbeitsagentur-jobs-feed`.
- **Detail-Enrichment:** serverseitig, per `startUrls` (targeted, `includeDetails:true`),
  quota- und cache-gesteuert.
- **Kostenrelevante Grenzen:** Apify Pay-per-event
  (~$0.00005 Runstart + $0.00079/Record). Quota: `APIFY_DETAIL_MAX_PER_USER_PER_DAY=30`,
  `APIFY_DETAIL_MAX_PER_IP_PER_DAY=100`, global `APIFY_MONTHLY_MAX_RUNS=30`.

## 3. Testklassen / Kostenklassen

| Klasse | Bedeutung | Apify-Risiko |
|---|---|---|
| `[FREE]` | keine Apify-Kosten | keinerlei Run |
| `[CACHE]` | bei vorhandenem Cache kein neuer Run möglich | ggf. Cache-Hit, nie neuer Run |
| `[CONTROLLED-PAID]` | kann genau EINEN echten Run auslösen | genau 1 Run autorisiert |
| `[MANUAL-PRODUCTION]` | prüft Live-Production | je nach Test |

⚠️ Ein `[CONTROLLED-PAID]`-Test darf **nie** mehrfach hintereinander oder als
Teil der normalen Regression ausgeführt werden. Kein Retry, kein Diagnose-Run.

## 4. Testmatrix

| Test | Manual/Auto | Production? | Apify-Run? | Kosten | Ort |
|---|---|---|---|---|---|
| 01 Production App/Version | Manual | ja | nein | FREE | Browser |
| 02 Production API | Manual | ja | nein | FREE | Browser/curl |
| 03 Arbeitnow Search | Manual | ja | nein | FREE | Browser |
| 04 BA Search | Manual | ja | nein (Cache) | CACHE | Browser |
| 05 BA collapsed/preview | Manual | ja | nein | FREE | Browser |
| 06 BA „Mehr anzeigen" (Cache vorhanden) | Manual | ja | nein | CACHE | Browser |
| 07 BA Detail-Enrichment (Cache-Miss) | Manual | ja | **genau 1** | CONTROLLED-PAID | Browser |
| 08 Detail Cache | Manual | ja | nein | CACHE | Browser |
| 09 Detail-Reopen ohne Run | Manual | ja | nein | CACHE | Browser |
| 10 AI Matching | Manual | ja | nein | FREE | Browser |
| 11 AI Failure → kein Run | Auto | nein | nein | FREE | vitest |
| 12 AI Success → nur evaluierte BA | Auto | nein | nein | FREE | vitest |
| 13 Enrichment nach Match | Auto | nein | nein | FREE | vitest |
| 14 Batch Detail Enrichment | Auto | nein | nein | FREE | vitest |
| 15 Session Quota | Auto | nein | nein | FREE | vitest |
| 16 IP Backstop | Auto | nein | nein | FREE | vitest |
| 17 Quota Grenze | Auto | nein | nein | FREE | vitest |
| 18 Monats-Run-Limit | Auto | nein | nein | FREE | vitest |
| 19 Redis fail-closed | Auto | nein | nein | FREE | vitest |
| 20 Target URL Security | Auto | nein | nein | FREE | vitest |
| 21 Apify Bearer | Auto | nein | nein | FREE | vitest |
| 22 HTML Sanitization | Auto | nein | nein | FREE | vitest |
| 23 Live DOM/HTML | Manual | ja | nein | FREE | Browser |
| 24 Language/translation metadata | Auto+Manual | teilw. | nein | FREE | vitest/Browser |
| 25 npm test | Auto | nein | nein | FREE | CLI |
| 26 TypeScript | Auto | nein | nein | FREE | CLI |
| 27 Production Build | Auto | nein | nein | FREE | CLI |
| 28 git diff --check | Auto | nein | nein | FREE | CLI |
| 29 Git State | Manual | nein | nein | FREE | CLI |
| 30 Deployment SHA | Manual | ja | nein | FREE | Browser/CLI |

### Einzelne Schlüssel-Tests (manuelle / Production)

#### TEST 06 — BA „Mehr anzeigen" bei vorhandenem Detail-Cache
- **Zweck:** bereits angereicherter BA-Job öffnet Details rein aus dem Cache.
- **Voraussetzungen:** Job wurde zuvor via TEST 07 angereichert (Detail-Cache gefüllt).
- **Start:** Im UI „Mehr anzeigen" klicken.
- **Erwartung:** Details erscheinen sofort (Spinner nur kurz/gar nicht), kein neuer Apify Run.
- **Kontrolle:** `enrichedCount` müsste 0 sein; kein Run-Log/Counter-Anstieg.
- **Kosten:** `[CACHE]` — wiederholbar, kein neuer Run.

#### TEST 07 — BA Detail-Enrichment bei Cache-Miss
- **Zweck:** einzelner neuer BA-Job wird end-to-end angereichert (Run → Dataset → Cache → UI).
- **Voraussetzungen:** gültiger BA-Job aus normaler Suche; **explizite Paid-Freigabe**; Cache leer.
- **Start:** genau EINEN `POST /api/job-details {jobs:[slug]}` bzw. einen „Mehr anzeigen"-Klick.
- **Erwartung:** genau EIN Apify-Run, Dataset-Ready, Beschreibung + descriptionPlain + language.
- **Kontrolle:** `meta.enrichedCount = 1`; `set-cookie mj_session`; refnr korrekt.
- **Kosten:** `[CONTROLLED-PAID]` — genau 1 Run autorisiert, **kein Retry, kein Diagnose-Run**,
  **nicht Teil der normalen Regression**.

#### TEST 30 — Deployment SHA
- **Zweck:** laufenden Production-Code eindeutig dem Git-Commit zuordnen.
- **Start:** Footer `Version · env · commitSha` lesen, oder `curl <asset-js> | grep commitSha`.
- **Kontrolle:** SHA == erwarteter Commit; env == `production`; version == `2.0.0`.
- **Grenze:** der Footer beweist Commit-SHA/env/version, **nicht**, ob ein bestimmter
  Apify-Run gelaufen ist.

## 5. Automatisierte Regression (jede Codeänderung)

```
1. npm test            → alle Vitest-Suiten
2. npx tsc -b          → TypeScript
3. npm run build       → Produktion-Build (tsc + vite)
4. git diff --check    → Whitespace/Format
5. git status          → Scope-Prüfung
6. (nur bei Release) Deployment + Smoke (siehe §6)
```

Kein echter Apify-Run ist Teil der automatischen Regression.

## 6. Production Deployment Routine

**Normaler Weg = Git → Vercel-Integration.** Der reguläre Ablauf ist:

```
Codeänderung
→ technische Validierung (§5)
→ Commit
→ push zu main
→ Vercel Production Deployment (Git-Integration von main)
→ deployed SHA verifizieren (Footer / gebaktes JS)
→ Production Smoke Test
→ Execution Log
```

`vercel --prod --yes` ist der **manuelle/explizite CLI-Weg** für einen dafür
vorgesehenen Fall, **nicht** die zwingende Voraussetzung jedes Git-Deployments.
Es wird nur eingesetzt, wenn ein CLI-basierter Deploy ausdrücklich gewünscht ist;
der Standard bleibt die Git→Vercel-Integration.

**Smoke (nach jedem Deployment):**
- `/` → 200
- `/api/jobs` → 200 (Arbeitnow + BA)
- `/api/job-details` → Endpoint vorhanden (405 auf GET, 400 auf leeren POST)

**Evidence-Regel (zentral):**

```
Code-Commit ≠ Log-Commit ≠ automatisch identischer deployed SHA
```

Der tatsächlich laufende Production-Code muss per Footer/gebaktes JS verifiziert
und im Execution Log dokumentiert werden.

## 7. Controlled-Apify-Routine (selten, nur nach expliziter Freigabe)

1. Production-Version prüfen (Footer-SHA).
2. Einen gültigen BA-Job aus normaler Suche wählen (refnr notieren).
3. Start-Cache/Quota-Zustand dokumentieren (soweit beobachtbar).
4. **genau EINEN** Detailabruf auslösen (`POST /api/job-details {jobs:[slug]}`).
5. HTTP/Status + `meta.enrichedCount` + `set-cookie` dokumentieren.
6. Dataset prüfen (refnr/Beschreibung/language/descriptionPlain).
7. Cache: nicht durch erneuten Abruf „beweisen" (Risiko eines 2. Laufs) —
   stattdessen Code-Pfad `cacheSet` + `enrichedCount` als Beleg verwenden.
8. Quota +1 (Session + IP) und globaler Run-Counter +1 dokumentieren.
9. UI manuell prüfen (Beschreibung rendert, keine Script-Ausführung).
10. Kosten angeben (advisory $0.00005 + $0.00079/Record).
11. **STOP** — kein Retry, kein Diagnose-Run, kein Batch.

Hard Rule: Eine Freigabe = genau EIN Apify-Run.

## 8. Cleanup-Regeln (Lebenszyklen getrennt)

| Entität | Key | Lebensdauer / TTL |
|---|---|---|
| Session Cookie | `mj_session` | Max-Age **1 Jahr** |
| User-Quota (Tages-Key) | `mj-detail:quota:s:*`, `mj-detail:quota:ip:*` | TTL **24 Stunden** |
| Detail-Cache | `mj-detail:arbeitsagentur:*` | TTL **7 Tage** |

Diese drei Lebenszyklen sind **nicht** zu vermischen.

- Nichts blind löschen.
- Persistent (bewusst): Apify Run + Dataset (Apify-Retention).
- Nie Produktions-Redis-Löschung ohne expliziten Auftrag.

## 9. Evidence / Dokumentation

- Jede tatsächliche Ausführung in den zentralen Execution Log (`docs/reports/STEP_25_...`).
- Automatische Tests: Vitest-Report (Dateizahl/Testzahl).
- Deployment: Deploy-ID, Alias, deployed SHA.

## 10. PASS/FAIL-Regeln

- **PASS:** Alle definierten Checks des Tests erfüllt, keine Abweichung.
- **FAIL:** Abweichung → sofort STOP, Fehler + Evidenz in den Log, **kein**
  weiterer Apify-Run / kein erneutes Klicken bei Apify-Fehler.