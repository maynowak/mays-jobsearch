# JM-RIS-VERCEL-TEST-ENV-05 — Vercel Test Environment Readiness

**Art:** Read-only Vercel-/BFF-/Contract-Readiness
**Datum:** 2026-11-06
**Repository:** `Mays-Jobsearch`
**Status:** **PARTIAL / PREVIEW BLOCKED · NO VERCEL MUTATION · NO LIVE E2E**

---

## 1. Git-Baseline

| Element | Wert |
|---|---|
| Branch | `feature/jm-ris-testuser-allowlist-reconciliation-01` |
| HEAD | `2382ab4` (Allowlist) · `48b8049` (dieser Report) |
| Lokaler `main` | `bef81b9` |
| Reconciliation-Branch vs. main | **1 Commit ahead / 0 behind** |
| Working Tree | clean bis auf 4 bewusst untracked Dokumente |
| Uncommitted | keine tracked Änderungen |
| Merge/Push | nicht ausgeführt |

Der Branch enthält den serverseitigen Allowlist-Commit. Die vier untracked
Dokumente wurden nicht verändert, gelöscht oder committed.

---

## 2. Vercel-Projekt und Environment-Audit

Geprüft ausschließlich mit `vercel env ls`/`vercel project ls`; **keine
Secret-Werte gelesen, ausgegeben oder heruntergeladen**.

| Prüfung | Befund |
|---|---|
| Linked Project | `maymilly/mays-job-matcher` |
| Separates Projekt | `maymilly/mays-jobsearch` vorhanden, **keine Environment Variables** |
| Production URL des Linked Project | `https://www.mays-job-matcher.app` |
| Projektzuordnung | **PARTIAL** — Zielprojekt muss vor Preview-Test ausdrücklich bestätigt werden |
| `RIS_API_KEY` | vorhanden als Secret: **Production + Development**, **nicht Preview** |
| `RIS_PARTNER_CREDENTIAL` | **fehlt** |
| `RIS_API_BASE_URL` | **fehlt** |
| `RIS_COGNITO_ISSUER` | **fehlt** |
| `RIS_COGNITO_CLIENT_ID` | **fehlt** |
| `RIS_TEST_USER_ALLOWLIST` | **fehlt** |
| `RIS_APPLICATION_STORAGE_ENABLED` | **fehlt** → Default OFF |
| `VITE_RIS_APPLICATION_STORAGE_ENABLED` | **fehlt** → Default OFF |
| `VITE_RIS_APPLICATION_MIGRATION_MOCK` | **fehlt** → Default OFF |
| `RIS_API_TIMEOUT_MS` | **fehlt** → Code-Default 10000 ms |

### Ergebnis

`RIS_API_KEY` allein genügt nicht. Der BFF benötigt zusätzlich Base URL,
Cognito-Issuer, Client-ID, eine serverseitige Allowlist und den expliziten
Server-Flag. Der vorhandene Key liegt **nicht** in der Preview-Umgebung.
Die Preview-Umgebung ist daher **nicht testbereit**.

---

## 3. BFF-Konfigurationspfad

Vorhanden:
- `api/ris/applications.mjs`
- `api/_lib/ris/config.mjs`
- `api/_lib/ris/auth.mjs`
- `api/_lib/ris/client.mjs`
- `api/_lib/ris/map.mjs`
- `tests/api/ris-applications.test.mjs`
- `tests/api/ris-boundary.test.mjs`

Der Code:
- akzeptiert `RIS_PARTNER_CREDENTIAL` und die dokumentierten Aliase
  `RIS_API_KEY`/`RIS_API_CREDENTIAL` serverseitig;
- verlangt HTTPS für Base URL und Issuer;
- prüft JWT-Signatur über JWKS/RS256, Issuer, Client, `token_use=access`,
  `exp`, `nbf` und `sub`;
- prüft die Allowlist als **`issuer|sub`** nach der JWT-Verifikation;
- lehnt fehlende/leere Allowlist fail-closed mit `403 test_user_not_allowed` ab;
- sendet das Partner-Credential ausschließlich als `X-Api-Credential` aus dem
  Server-BFF;
- hält Feature-Flags standardmäßig OFF;
- hat kein Catch-all, keinen offenen Proxy und keine Client-Allowlist.

---

## 4. API-Vertrag

| Prüfpunkt | Bewertung |
|---|---|
| HTTPS-Basisadresse | Code erzwingt HTTPS; offizielle Basisadresse **nicht in Vercel konfiguriert**, Anbieterdokumentation in diesem Auftrag nicht verfügbar |
| Authentifizierung | Jobsearch-seitiger Vertrag: Cognito Access Token (RS256/JWKS) + `X-Api-Credential`; offizielle Partner-Attestation **nicht erneut verifiziert** |
| Cognito-Issuer/Client | Erwartet, aber in Vercel **nicht gesetzt** |
| Partner-Credential-Header | `X-Api-Credential`, serverseitig; Alias-Code vorhanden, echter separater Wert **nicht konfiguriert** |
| ApplicationV1-Endpunkte | List/Get/Create/Patch/Status/History/Cover-Letter/Export/Delete/Metrics im BFF vorhanden; nur Mock-/Contract-Tests, **kein Live-Nachweis** |
| Fehlercodes | 401/403/404/409/422/429/502/503 gemappt und getestet; Provider-Verhalten nicht live verifiziert |
| Datenvertrag | **PARTIAL** — u. a. Multi-Location/Multi-Source, Builder-CV, Timeline, Delete-Receipt und Server-Consent bleiben Einschränkungen |

**API CONTRACT: PARTIAL.** Fehlende offizielle Partner-Dokumentation
(Base-URL, registrierte Issuer/Client-Kombination, Credential-/Tenant-/
Entitlement-Bindung, veröffentlichte OpenAPI-Version) ist ausdrücklich als
**Anbieter-Dokumentationslücke** zu behandeln. Historische Jobsearch-Reports
mit RIS-internen Beobachtungen werden für diesen Auftrag **nicht** als
Vertragsbeweis verwendet.

---

## 5. Testbenutzer und Allowlist

| Prüfung | Ergebnis |
|---|---|
| Server-side Allowlist implementiert | **PASS** (Code + Tests) |
| Format `<issuer>|<sub>` | **PASS** |
| Fehlende/leere Allowlist | **PASS** fail-closed |
| Clientseitige Allowlist | **nicht vorhanden** |
| Aktueller Testbenutzer | **BLOCKED** — keine gültige, aktuell bestätigte Testidentität und kein Allowlist-Wert in Vercel |
| Synthetic Identity aus RIS-LIVE-E2E-04 | **nicht vorausgesetzt**; laut Bericht gelöscht |
| RIS-LIVE-E2E-04-Report im Jobsearch-Repo | **nicht vorhanden** — nur in diesem Readiness-Report referenziert; **nicht als verifizierte Evidence verwendet** |
| Allowlist-Wert in Vercel | **fehlt** |

**TEST USER: BLOCKED. SERVER-SIDE ALLOWLIST: VERIFIED (Code), NOT CONFIGURED (Vercel).**

---

## 6. Preview-Readiness-Checkliste

| # | Prüfung | Ergebnis |
|---|---|---|
| 1 | BFF deploymentfähig | Lokal build-/testfähig; Vercel-Deployment nicht verifiziert |
| 2 | Vercel-Projekt/Preview-Ziel | **PARTIAL** — Linked Project `mays-job-matcher`; separates `mays-jobsearch` ohne Env |
| 3 | Getesteter Git-Stand eindeutig | **PASS** lokal: `2382ab4` |
| 4 | Erforderliche Servervariablen vorhanden | **BLOCKED** — Base/Issuer/Client/Allowlist/Flags fehlen |
| 5 | Secrets serverseitig | **PASS** im Code; `RIS_API_KEY` ist Secret, kein `VITE_*` |
| 6 | Feature-Flags default OFF | **PASS** — fehlende Flags bedeuten OFF |
| 7 | Testbenutzer autorisierbar | **BLOCKED** — Allowlist/Testidentität fehlt |
| 8 | Veröffentlichter RIS-Vertrag | **PARTIAL** — Anbieter-Dokumentationslücke |
| 9 | Preview-Test ohne echte Bewerberdaten | Möglich nur mit synthetischen Daten und Freigaben; **nicht gestartet** |
| 10 | Fehlende Freigaben | Zielprojekt, Preview-Env-Setzung, Credential-Zuordnung, Testbenutzer, RIS-Surface/Partnerbindung, Push/Deploy, E2E |

---

## 7. Tests und Regression

| Prüfung | Ergebnis |
|---|---|
| BFF (`tests/api/ris-applications.test.mjs`) | **29 / 29 PASS** |
| Boundary (`tests/api/ris-boundary.test.mjs`) | **6 / 6 PASS** |
| BFF + Boundary gesamt | **35 / 35 PASS** |
| `node --check` aller `api/**/*.mjs` | **PASS** |
| `npm run build` | **PASS** |
| Vollsuite, seriell (`npx vitest run --maxWorkers=1`) | **1502 passed / 5 skipped** |
| Vollsuite, paralleler Default-Lauf | 2 unabhängige Timeout-Flakes in bestehenden UI-Tests; isolierte Wiederholung PASS |
| `git diff --check` | **PASS** |

Keine Tests deaktiviert, keine Timeouts erhöht. Die Flakes betreffen bestehende
UI-Tests außerhalb des RIS-BFF, nicht die Allowlist-/Boundary-Suite.

---

## 8. Freigabebedarf für Preview-E2E

1. **Zielprojekt bestätigen:** `maymilly/mays-job-matcher` oder separates
   `maymilly/mays-jobsearch` (letzteres hat keine Env).
2. **Preview-Environment setzen** (nur nach Betreiberfreigabe):
   `RIS_API_BASE_URL`, `RIS_COGNITO_ISSUER`, `RIS_COGNITO_CLIENT_ID`,
   `RIS_TEST_USER_ALLOWLIST`, `RIS_APPLICATION_STORAGE_ENABLED=false` zunächst,
   `VITE_RIS_APPLICATION_STORAGE_ENABLED=false` zunächst.
3. **`RIS_API_KEY` in Preview bereitstellen** bzw. bestätigen, dass der
   Production-Key für Preview verwendet werden darf. Keine neue
   Credential-Ausstellung in diesem Auftrag.
4. **Testbenutzer:** aktuelle `<issuer>|<sub>`-Identität bestätigen und
   serverseitig in die Allowlist aufnehmen; keine Werte in Git/Reports.
5. **RIS-Partnerbindung/Surface:** separat durch RIS bestätigen; keine
   RIS-Änderung durch Jobsearch.
6. **Push/Deploy:** separater Auftrag; Preview-Deployment ist **nicht
   autorisiert**.
7. **E2E-Daten:** ausschließlich synthetische Bewerbungen, Cleanup-Verfahren,
   keine produktiven Bewerberdaten.
8. **Storage-Flag:** erst nach erfolgreichem Read-/Write-/Delete-Test und
   separater Consent-/Rechtsfreigabe aktivieren.

---

## 9. Abschlussstatus

```text
JM-RIS-VERCEL-TEST-ENV-05

REPOSITORY: mays-jobsearch

GIT BASELINE:
  VERIFIED

EXISTING RIS_API_KEY:
  PRESENT (Production + Development; NOT Preview)

VERCEL PREVIEW ENV:
  BLOCKED

RIS API CONTRACT:
  PARTIAL

TEST USER:
  BLOCKED

SERVER-SIDE ALLOWLIST:
  VERIFIED (code) / NOT CONFIGURED (Vercel)

BFF SECURITY:
  PASS

BOUNDARY TESTS:
  PASS

REGRESSION:
  PASS (serialized; unrelated parallel timeout flake noted)

PREVIEW DEPLOYMENT:
  NOT AUTHORIZED

LIVE E2E:
  NOT EXECUTED

PRODUCTION STORAGE:
  DISABLED

RIS CHANGES:
  NONE

GIT COMMIT:
  48b8049 (report) + folgender Docs-Commit

PUSH:
  NOT AUTHORIZED
```

**HARD STOP.** Keine Vercel-Konfigurationsänderung, kein Push, kein Deployment,
keine RIS-/AWS-/Cognito-/CloudFront-/Terraform-Änderung, keine echten
RIS-Requests oder produktiven Bewerberdaten.
