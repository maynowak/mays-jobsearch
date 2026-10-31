# JM-GUEST-MODEL-A-RELEASE-GATE-FIX-01

**Art:** Release-Gate-Fix / Source-Policy / Rollback-Dokumentation
**Baseline:** `b2cb191`
**Status:** ABGESCHLOSSEN — kein Deployment, keine Preview
**Datum:** 2026-10-31

## 1. Git-Preflight

| Prüfung | Ergebnis |
|---|---|
| Branch | `main` |
| HEAD bei Start | `b2cb191ac34b345081dc5fa0f8fabaa8afda60aa` |
| `origin/main` | synchron (`0 0`) |
| Working Tree | nur vorbestehende, unverwandte untracked Dateien |
| Bestehende Änderungen überschrieben | nein |

## 2. Bestätigte Findings

### Finding 1 — Provider-Typ wurde nicht geprüft

`api/_lib/sourcePolicy.mjs` prüfte nur Quelle-ID bzw. ATS-Präfix. Ein künftiger
Anbieter mit derselben ID oder demselben Präfix, aber anderer Abrechnungsart
(z. B. `lever:paid` mit `provider === "job-api"`, `greenhouse:paid` mit
`provider === "apify"` oder `arbeitsagentur` mit falschem Provider) wäre
freigegeben worden.

**Behoben:** Freigabe erfordert jetzt übereinstimmend freigegebene Identität
**und** erwarteten Adapter-/Provider-Typ.

### Finding 2 — Unsicherer Rollback-Stand dokumentiert

Der vorherige Release-Preflight nannte `823b715` als Rollback-Ziel. Dieser
Commit liegt vor der Model-A-Sperre und würde TheirStack/JobsPipe für Gäste
sowie das alte `mj_session`-Verhalten wieder öffnen.

**Behoben:** Release-Dokumentation und `docs/DEPLOYMENT.md` enthalten nun einen
sicheren Rollback-Ablauf; `823b715` ist ausdrücklich als unsicher markiert.

## 3. Änderungen

`api/_lib/sourcePolicy.mjs`:

- `GUEST_FREE_SOURCE_PROVIDERS`: ID → Pflicht-Provider
  - `arbeitnow` → `direct-api`
  - `greenhouse` → `ats`
  - `adzuna` → `job-api`
- `GUEST_APIFY_SOURCE_PROVIDERS`: `arbeitsagentur` → `apify`
- Öffentliche ATS-Präfixe nur zusammen mit `provider === "ats"`
- Alle anderen IDs, Provider und Präfix-Kombinationen: BLOCKED
- Die ID-only-Hilfsfreigabe `guestPaidSourceAllowed()` wurde entfernt, damit
  keine Produktions- oder Teststelle eine Freigabe ohne Provider-Prüfung
  verwenden kann.

`tests/api/guest-source-policy.test.mjs`:

- Positivfälle für alle realen Public-ATS-Adapter
- Negativfälle für falsche Provider bei freigegebenen IDs
- Negativfälle für bezahlte ATS-Präfixe
- Filtertest über den gemischten Registry-Ausschnitt

`docs/DEPLOYMENT.md` und
`docs/reports/JM-GUEST-MODEL-A-RELEASE-PREFLIGHT-01.md`:

- Rollback auf `823b715` als unsicher korrigiert
- Apify-Notbremse über `JOB_SOURCE_ARBEITSAGENTUR_ENABLED=false`
- Kein Redis-Flush, keine Cookie-Wiedereinführung
- Kein stilles Freischalten von TheirStack/JobsPipe

## 4. Bestätigte Zugriffsmatrix

| Quelle | Identität | Provider | Gast |
|---|---|---|---|
| Arbeitnow | `arbeitnow` | `direct-api` | ALLOWED |
| Greenhouse | `greenhouse` | `ats` | ALLOWED |
| Public ATS | `greenhouse:…` | `ats` | ALLOWED |
| Public ATS | `lever:…` | `ats` | ALLOWED |
| Public ATS | `ashby:…` | `ats` | ALLOWED |
| Public ATS | `workable:…` | `ats` | ALLOWED |
| Public ATS | `recruitee:…` | `ats` | ALLOWED |
| Public ATS | `personio:…` | `ats` | ALLOWED |
| Adzuna | `adzuna` | `job-api` | ALLOWED |
| Arbeitsagentur Suche | `arbeitsagentur` | `apify` | ALLOWED |
| Arbeitsagentur Details | `arbeitsagentur` | `apify` | ALLOWED |
| TheirStack | `theirstack` | beliebig | BLOCKED |
| JobsPipe | `jobspipe` | beliebig | BLOCKED |
| Andere Apify-Actors | beliebig | `apify` | BLOCKED |
| Falscher Provider | freigegebene ID | abweichend | BLOCKED |
| Bezahltes ATS-Präfix | z. B. `lever:paid` | `job-api` | BLOCKED |
| Unbekannte künftige Klassen | beliebig | `ats`/`direct-api` | BLOCKED |

Die Klassifikation betrifft ausschließlich API-Anbieter. Unbekannte
Stellenanzeigen oder Arbeitgeber werden nicht gefiltert.

## 5. Apify-Kostenschutz (unverändert)

Beide Arbeitsagentur-Pfade bleiben unverändert geschützt:

- Cache-first; Cache-Hit löst keinen Run aus.
- Single-Flight; Follower starten keinen zweiten Run.
- Atomare globale Run-Reservierung vor jedem Apify-Aufruf.
- Redis-Ausfall → `quota_unavailable`, kein kostenpflichtiger Aufruf.
- Unbekannte Abrechnung wird konservativ behandelt.
- Kein Gast-Cookie, keine Session-Kennung.
- Monatslimit → kontrollierter `limit_reached`-Zustand.
- Keine unkontrollierten Retries.

| Limit | Default | Wirkung |
|---|---|---|
| `APIFY_MONTHLY_MAX_RUNS` | 100 | harter, atomarer Run-Deckel |
| `APIFY_MONTHLY_SOFT_LIMIT_USD` | 4.00 | nur beratend, blockiert nicht |
| `APIFY_DETAIL_MAX_PER_USER_PER_DAY` | 30 | nur bei vorhandener Session |
| `APIFY_DETAIL_MAX_PER_IP_PER_DAY` | 100 | nur bei Legacy-`clientIp` |
| `IP_QUOTA_*` | deaktiviert | optionaler IP-HMAC-Zusatzschutz |

Produktive Vercel-Konfiguration: **PRODUCTION CONFIG NOT VERIFIED** (keine
lesende Produktionsverbindung verwendet, keine Secrets ausgegeben).

## 6. Testnachweise

| Prüfung | Ergebnis |
|---|---|
| `tests/api/guest-source-policy.test.mjs` | PASS — 4 Tests |
| `npm test -- --run` | PASS — 1031 passed, 5 skipped |
| `npx tsc --noEmit -p tsconfig.app.json` | PASS |
| `npm run build` | PASS |
| `npm run test:budget:redis` | PASS |
| `npm run test:ip-quota:redis` | PASS |
| `npm run test:lock:redis` | PASS |
| `npm run test:ip-quota:rest` | PASS — 6 Tests |
| `npm run test:e2e:guest-cv` | PASS — 1440/390 |
| `git diff --check` | PASS |
| Echte kostenpflichtige Provider-Aufrufe | keine |
| Live-Vercel / Production-Apify | NOT VERIFIED |

## 7. Sicherer Rollback

`823b715` ist **kein** Rollback-Ziel.

1. **Apify-Vorfall:** `JOB_SOURCE_ARBEITSAGENTUR_ENABLED=false` und/oder
   `APIFY_API_TOKEN` entfernen. Nur der freigegebene Arbeitsagentur-Pfad wird
   deaktiviert.
2. **Code-Rollback:** letzter Release-Commit, der `8f04af8` (Source-Policy) und
   `21609f3` (Cookie-Entfernung) bereits enthält — aktuell `b2cb191` oder
   später. Nicht älter.
3. **Wenn nur `b2cb191` jemals deployt wurde und fehlerhaft ist:** Es existiert
   kein älterer gast-sicherer Stand. Dann ist ein kontrollierter Roll-forward
   erforderlich; Rückfall auf `823b715` ist ein Deployment-Blocker.
4. **Redis:** keine Löschung, kein Flush, kein Budget-Reset.
5. **Cookies:** kein `Set-Cookie: mj_session`; Legacy-Cookies bleiben gelöscht.
6. **Arbeitsagentur:** nur über die explizite Policy-Regel oder den Env-Schalter
   freigeben bzw. sperren; niemals die Policy für andere bezahlte Anbieter
   aufweichen.
7. **TheirStack/JobsPipe:** bleiben bei jedem Rollback gesperrt, sofern nicht
   ausdrücklich und separat freigegeben.
8. Keine neuen Secrets oder produktiven Environment-Änderungen.

## 8. Preview-Freigabevoraussetzungen

1. Ausdrückliche Preview-Freigabe.
2. Zu prüfender Runtime-Commit: `7c7e0dd` (Dokumentations-Commits ändern kein
   Laufzeitverhalten).
3. Preview-Deploy nur mit `vercel deploy` (kein `--prod`).
4. Erwartete API-Antworten:
   - Gastsuche enthält Arbeitnow/Greenhouse/Adzuna/public ATS und
     Arbeitsagentur,
   - TheirStack/JobsPipe erzeugen keine Provider-Aufrufe,
   - Arbeitsagentur-Details laden,
   - kein `403 paid_source_blocked` für Arbeitsagentur,
   - kein `Set-Cookie: mj_session`,
   - Legacy-Cookie wird mit `Max-Age=0` gelöscht.
5. Browser-Cookie-Prüfung: Cookie-Jar vor/nach Suche, Detail und Match.
6. Apify-Cache: erster Lauf = Miss, Wiederholung = Hit ohne neuen Run.
7. Globales Limit: nur mit Test-/Preview-Budget oder simuliertem Zähler prüfen;
   keine echten Zusatzkosten.
8. Vercel-IP-Header nur prüfen, falls IP-Quoten aktiviert werden sollen:
   IPv4/IPv6, `x-forwarded-for`/`x-real-ip`, fehlende IP; keine Roh-IPs loggen.
9. Keine Preview und keine Production in diesem Paket.

## 9. Deployment-Status

- Preview: **NICHT DEPLOYT**
- Production: **NICHT DEPLOYT**
- Produktive Konfiguration: **NOT VERIFIED**
- Öffentliche Datenschutztexte: unverändert; rechtliche Freigabe offen

## 10. Git

- Source-Policy-/Test-Commit: `7c7e0dd`
- Dokumentations-Commit: `dbfccb4`
- Preview-Prüf-Commit (Runtime): `7c7e0dd`; Deployment-HEAD enthält zusätzlich
  `dbfccb4` (Dokumentation)
- Remote-Synchronität: `origin/main` = `0 0` nach Push
- Kein Deployment

## 11. Offene Freigaben

1. Preview-Deployment
2. Produktionskonfiguration verifizieren
3. Datenschutztexte rechtlich freigeben
4. Optional IP-Quota aktivieren
5. Produktions-Deployment
