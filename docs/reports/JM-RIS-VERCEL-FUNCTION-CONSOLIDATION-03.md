# JM-RIS-VERCEL-FUNCTION-CONSOLIDATION-03

- Datum: 2026-11-06
- Status: **COMPLETE — LOCAL VERIFIED / READY FOR DEPLOYMENT REVIEW**
- Repository: `/home/dci-student/projects/Mays-Jobsearch`
- Branch: `main`
- Kein Push, kein Deployment, keine RIS-/Vercel-Env-Änderung

## 1. Ausgangsstand

| Item | Wert |
|---|---|
| HEAD vor der Konsolidierung | `f59aa4b` |
| `origin/main` | `f59aa4b` |
| Divergenz | 0 / 0 |
| Vercel Functions vorher | **13** |
| Untracked Dokumente | 4 bekannte Dateien unverändert |

Vorhandene RIS-Einstiegspunkte:

```text
api/ris/applications.mjs
api/ris/consents.mjs
```

## 2. Root Cause

Vercel Hobby erlaubt maximal **12 Serverless Functions** pro Deployment. Mit dem zusätzlichen Consent-BFF waren **13** Functions vorhanden. Der Build selbst war erfolgreich; das Deployment endete mit:

```text
exceeded_serverless_functions_per_deployment
```

Die Konsolidierung musste beide öffentlichen RIS-Routen auf einen gemeinsamen Function-Einstiegspunkt führen, ohne die URLs oder das Verhalten zu ändern.

## 3. Function-Anzahl vorher

```text
api/alerts.mjs
api/ats-analysis.mjs
api/cover-letter.mjs
api/cron/digest.mjs
api/cv-improvement.mjs
api/job-details.mjs
api/jobs.mjs
api/match.mjs
api/models.mjs
api/profile.mjs
api/ris/applications.mjs
api/ris/consents.mjs
api/usage.mjs
```

**13 Functions.**

## 4. Neue Routing-Architektur

Ein gemeinsamer Einstiegspunkt:

```text
api/ris/router.mjs
```

Die bisherigen Handler bleiben logisch getrennt und liegen als interne Module unter `api/_lib/ris/`:

```text
api/_lib/ris/applicationsHandler.mjs
api/_lib/ris/consentsHandler.mjs
```

Öffentliche URLs bleiben unverändert:

| Öffentliche URL | Internes Ziel |
|---|---|
| `/api/ris/applications` | `/api/ris/router?__ris_applications=1` |
| `/api/ris/consents` | `/api/ris/router?__ris_consents=1` |

Der Router:

- akzeptiert genau **ein** internes Rewrite-Flag,
- prüft zusätzlich den Originalpfad, wenn Vercel ihn bereitstellt,
- weist widersprüchliche Flags, unbekannte Routen und verschachtelte Pfade mit `404 not_found` ab,
- leitet direkt aufgerufenes `/api/ris/router` per `307` auf `/404` um,
- implementiert **keinen Catch-all-Proxy**,
- öffnet keine neue funktionale RIS-Route.

Die Handler verwenden weiterhin dieselben Komponenten:

```text
api/_lib/ris/auth.mjs
api/_lib/ris/client.mjs
api/_lib/ris/config.mjs
api/_lib/ris/map.mjs
```

## 5. Änderungen an `vercel.json`

Neu:

```json
"redirects": [
  {
    "source": "/api/ris/router",
    "destination": "/404",
    "permanent": false
  }
],
"rewrites": [
  {
    "source": "/api/ris/applications",
    "destination": "/api/ris/router?__ris_applications=1"
  },
  {
    "source": "/api/ris/consents",
    "destination": "/api/ris/router?__ris_consents=1"
  }
]
```

Die bestehenden SPA-Rewrites (`/search`, `/profil`, `/anmelden`, …) bleiben unverändert. Es gibt keine weiteren RIS-Rewrites und keine Catch-all-Regel.

## 6. Öffentliche API-Kompatibilität

### Applications

| Methode | Operation | Status |
|---|---|---|
| GET | Liste / Detail | unverändert |
| GET | Metrics | unverändert |
| GET | Export | unverändert |
| POST | Create | unverändert |
| POST | Status | unverändert |
| POST | History | unverändert |
| POST | Cover-Letter-Version | unverändert |
| PATCH | Update | unverändert |
| DELETE | Delete | unverändert |

Erhalten:

- JWT-Verifikation (RS256/JWKS),
- Issuer-/Client-Prüfung,
- serverseitige Testbenutzer-Allowlist,
- Owner-/Tenant-Bindung an `iss + sub`,
- Idempotency-Keys,
- Versionskonflikte,
- Validierung und Fehler-Mapping,
- Request-/Response-Formate.

### Consents

| Methode | Operation | Status |
|---|---|---|
| GET | Status abrufen | unverändert |
| GET | History abrufen | unverändert |
| POST | Grant | unverändert |
| POST | Withdraw (`?action=withdraw`) | unverändert |

Erhalten:

- `RIS_CONSENT_NOTICE_VERSION` bleibt ausschließlich serverseitig,
- der Browser kann keine Erklärungsversion vorgeben,
- `Cache-Control: no-store, private`,
- Allowlist und Identität aus `iss + sub`,
- Zweckvalidierung und Fehlerbehandlung.

`RIS_CONSENT_NOTICE_VERSION` und die Consent-Version `1.0` bleiben unverändert **DRAFT**, bis eine ausdrückliche rechtliche und betriebliche Freigabe vorliegt.

## 7. Auth-/Security-Regression

| Prüfung | Ergebnis |
|---|---|
| Kein Token → 401 | PASS |
| Ungültiger Token → 401 | PASS |
| Fremder Issuer/Client → 401 | PASS |
| Nicht erlaubter Testbenutzer → 403 | PASS |
| Fehlende Allowlist → fail-closed | PASS |
| Deaktivierte Speicherung → 503 | PASS |
| Fehlende Konfiguration → 503 | PASS |
| RIS-Fehler-Mapping | PASS |
| Owner aus `iss + sub`, nicht E-Mail | PASS |
| Query-Flag kann Handler nicht wechseln | PASS |
| Direkter Router-Aufruf → `/404` (Config) | PASS |
| Keine Secrets/JWTs in Antworten | PASS |

Es wurde **kein Consent-Enforcement** neu eingeführt oder abgeschwächt. Die produktiven Remote-Flags bleiben unverändert deaktiviert.

## 8. Build-Nachweis der tatsächlichen Function-Anzahl

Lokaler Vercel-Build:

```text
vercel build --non-interactive
```

Ergebnis: **Build completed successfully**.

Erzeugte Function-Artefakte:

```text
api/alerts.func
api/ats-analysis.func
api/cover-letter.func
api/cron/digest.func
api/cv-improvement.func
api/job-details.func
api/jobs.func
api/match.func
api/models.func
api/profile.func
api/ris/router.func
api/usage.func
```

**Function Count: 12 — VERIFIED.**

Das Build-Output enthielt außerdem:

```text
Redirect: /api/ris/router -> /404 (307)
Rewrite:  /api/ris/applications -> /api/ris/router?__ris_applications=1
Rewrite:  /api/ris/consents     -> /api/ris/router?__ris_consents=1
```

Hinweis: `vercel dev` verwendet in diesem Vite-Projekt den Vite-Dev-Server und wandte die `vercel.json`-Rewrites bzw. dynamische API-Routen lokal nicht an. Deshalb wurde die **Function-Erzeugung über den Vercel-Build** verifiziert, nicht über `vercel dev`. Die Runtime-Rewrite-Semantik ist im separaten Preview-Deployment-Test zu bestätigen.

## 9. Testergebnisse

| Prüfung | Ergebnis |
|---|---|
| Applications-Tests | **29 / 29 PASS** |
| Consent-Tests | **7 / 7 PASS** |
| Routing-Tests | **11 / 11 PASS** |
| Gesamtsuite | **1520 passed / 5 skipped** |
| Build (`npm run build`) | **PASS** |
| API-Syntax (`node --check`) | **PASS** |
| `git diff --check` | **PASS** |

Die Routing-Tests prüfen beide öffentlichen URLs über den gemeinsamen Einstiegspunkt, Query-/Method-/Body-/Header-Erhalt, unbekannte und verschachtelte Routen, widersprüchliche Flags sowie die `vercel.json`-Konfiguration.

## 10. Offene Risiken

1. **Runtime-Rewrite-Verhalten** ist lokal nicht über `vercel dev` verifizierbar; der Vercel-Build und die Routing-Konfiguration sind verifiziert. Ein Preview-Deployment-Test bleibt erforderlich.
2. Der direkte `/api/ris/router`-Aufruf wird per `307` auf `/404` umgeleitet. Das ist im Preview-Deployment zu bestätigen.
3. `RIS_CONSENT_NOTICE_VERSION` bleibt nicht gesetzt; Grant ist weiterhin fail-closed (`notice_version_not_mapped`).
4. Die Preview-Secret-Isolation und der Testbenutzer-/Allowlist-Blocker bleiben eigenständige Voraussetzungen.
5. Keine produktive Bewerberspeicherung; Remote-Flags bleiben OFF.

## 11. Git-Commit

Der Abschluss-Commit enthält:

- `api/ris/router.mjs` (neu),
- `api/_lib/ris/applicationsHandler.mjs` (verschoben),
- `api/_lib/ris/consentsHandler.mjs` (verschoben),
- `vercel.json`,
- `tests/api/ris-applications.test.mjs`,
- `tests/api/ris-consents.test.mjs`,
- `tests/api/ris-routing.test.mjs` (neu),
- diesen Report und den Auditlog.

Kein Push, kein Deployment.

## 12. Empfehlung für den kontrollierten Deployment-Test

**Status: READY FOR DEPLOYMENT REVIEW.**

In einem separaten, freigegebenen Preview-Deployment prüfen:

1. `/api/ris/applications` ohne Token → `401`.
2. `/api/ris/consents` ohne Token → `401`.
3. Beide Routen mit deaktiviertem Flag → `503 ris_disabled`.
4. `/api/ris/router` direkt → `307` auf `/404`.
5. Query-/Body-/Header-Erhalt für Applications und Consents.
6. Kein Handler-Wechsel über zusätzliche Query-Flags.
7. Vercel-Deployment bleibt bei **12 Functions**.
8. Keine Secrets im Browser-Bundle oder in Logs.

Bis dahin: keine Aktivierung der Remote-Speicherung, keine Consent-Produktivierung, kein Production-Deployment.
