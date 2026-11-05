# JM-RIS-INTEGRATION-01B — Testbenutzer, Cognito-Authentifizierung und RIS-DEV-Anschluss

**Art:** Auth-/BFF-Vorbereitung (Phase 01B)
**Datum:** 2026-11-05
**Zielumgebung:** `ris-dev` · **Referenz:** `ris-dev2`
**Status:** **BFF LOCAL VERIFIED · RIS-DEV LIVE BLOCKED**

---

## 1. Baseline

| System | Stand |
|---|---|
| Mays-Jobsearch | `main` `fec135c` + BFF-Arbeitsstand |
| Mays-RIS (lokal) | `main` `5ebefbd` (enthält `c28c668`, R08 `e0a3fe4`) |
| `ris-dev` | R08-Apply 52/4/0/0; 10 Application-Routen; `PARTNER_SURFACE_ENABLED=false` |
| Testbenutzer | vom Auftraggeber bereitgestellt; **nicht** in diesem Report dokumentiert |

---

## 2. Phase A — Jobsearch-Login

| Prüfpunkt | Ergebnis |
|---|---|
| Cognito-JWKS öffentlich erreichbar | **PASS** (HTTP 200, 2 Keys) |
| Issuer (Code/Config) | `https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O` |
| Client (Code/Config) | `5hb3f6dj5ialg77jf4blur9g6g` |
| `token_use=access`, `iss`, `sub`, `exp` | **nicht live geprüft** |
| Tatsächliche Anmeldung mit Testbenutzer | **BLOCKED** |
| Logout/Re-Login | **BLOCKED** |

**Grund für BLOCKED:** Die verfügbare AWS-Identität (`992382612204`) darf
`cognito-idp:DescribeUserPoolClient` auf dem Jobsearch-Pool nicht ausführen.
Zusätzlich wäre für `InitiateAuth` die Übergabe des Passworts über den
nicht-interaktiven Shell-Kanal nötig; das Passwort wurde bewusst **nicht**
verwendet, gespeichert oder geloggt. Die Anmeldung muss über den Browser oder
einen sicheren Secret-Kanal erfolgen.

```text
JOBSEARCH LOGIN:       BLOCKED
ACCESS TOKEN:          BLOCKED
ISSUER:                VERIFIED (Code/Config)
CLIENT:                VERIFIED (Code/Config)
SUBJECT BINDING:       BLOCKED
```

---

## 3. Phase B — RIS-DEV-Autorisierung (read-only)

| Prüfpunkt | Ergebnis |
|---|---|
| AWS-Identität | `992382612204` / `maymilly` — **nicht** RIS-dev-Account `240571105849` |
| Zugriff auf ris-dev Cognito/DynamoDB/Lambda | **nicht autorisiert** |
| Partner-Registry-Eintrag für Jobsearch | **NOT VERIFIED** |
| `X-Api-Credential` für Jobsearch | **BLOCKED** (nicht vorhanden) |
| Tenant-Zuordnung | **BLOCKED** |
| `PARTNER_SURFACE_ENABLED` | Quelle/Terraform: `false`; **Live-Zustand NOT VERIFIED** |
| Positive RIS-DEV-E2E | laut RIS-Report **BLOCKED** |

```text
RIS-DEV IDENTITY COMPATIBILITY:  BLOCKED
RIS PARTNER REGISTRATION:        NOT VERIFIED
RIS PARTNER CREDENTIAL:          BLOCKED
RIS PARTNER SURFACE:             NOT LIVE VERIFIED (Quelle: DISABLED)
```

Keine AWS-Mutation, keine Registry-/Credential-Erzeugung.

---

## 4. Phase C — ApplicationV1-Endpunkte

| Operation | RIS-Quellcode | ris-dev2 | ris-dev deployt | ris-dev live |
|---|---|---|---|---|
| Create | implementiert | VERIFIED (historisch) | ja (Route) | **BLOCKED** (Surface 503) |
| List | implementiert | VERIFIED | ja | **BLOCKED** |
| Detail | implementiert | VERIFIED | ja | **BLOCKED** |
| Patch | implementiert | VERIFIED | ja | **BLOCKED** |
| Metrics | implementiert | VERIFIED | ja | **BLOCKED** |
| Export | implementiert | VERIFIED | ja | **BLOCKED** |
| Delete | implementiert | VERIFIED | ja | **BLOCKED** |
| Status/Stage | implementiert | VERIFIED | ja | **BLOCKED** |
| History | implementiert | VERIFIED | ja | **BLOCKED** |
| Cover-Letter-Versionen | implementiert | VERIFIED | ja | **BLOCKED** |

Keine echten Schreib-/Löschoperationen ausgeführt.

---

## 5. Phase D — Jobsearch-BFF (lokal, Mock-RIS)

### Dateien

| Datei | Zweck |
|---|---|
| `api/_lib/ris/config.mjs` | Server-Config, Feature-Flag, HTTPS-/Pflichtfeldprüfung |
| `api/_lib/ris/auth.mjs` | Cognito-Access-Token-Verifikation (RS256/JWKS, `iss`, `client_id`, `token_use=access`, `exp`, `sub`) |
| `api/_lib/ris/client.mjs` | genau ein RIS-Request, 10 s Timeout, kein Retry, feste Pfad-Allowlist |
| `api/_lib/ris/map.mjs` | explizites Feld-/Status-Mapping, 422 bei nicht verlustfreien Feldern |
| `api/ris/applications.mjs` | BFF-Fassade für Create/List/Get/Patch/Delete/Status/History/Cover-Letter/Export |
| `tests/api/ris-applications.test.mjs` | 13 Mock-Tests |
| `.env.example` | neue Server-Variablen, keine Secrets |

### Sicherheitsgrenzen

- Feature standardmäßig **OFF** (`RIS_APPLICATION_STORAGE_ENABLED=false`).
- Kein offener Proxy: feste RIS-Basis, feste Pfade, `applicationId` per Regex.
- Credential nur serverseitig; nie in `VITE_*`, nie in Antworten/Logs.
- JWT wird kryptografisch gegen JWKS geprüft; Client-/Tenant-Angaben aus dem Body werden ignoriert.
- Kein Wildcard-CORS auf der Auth-Route.
- `Cache-Control: no-store, private`, `X-Content-Type-Options: nosniff`.
- Body-Limit 200 KB; Timeout 10 s; keine Wiederholung mutierender Requests.
- Fehlgeschlagene Speicherung wird nie als Erfolg gemeldet.

### Mapping-Entscheidungen (explizit, keine stille Konvertierung)

| Feld | Verhalten |
|---|---|
| `location[]` | genau 1 Wert → String; 0 oder >1 → **422** `unsupported_location_*` |
| `source[]` | genau 1 Wert → String; 0 oder >1 → **422** `unsupported_source_*` |
| `jobOrigin` | bei `manual` muss `source="manual"` sein; Feld wird nicht gesendet |
| `cvSource="builder"` | **422** `builder_cv_unsupported` |
| Cover-Letter-Quelle | `generated`/`revised`/`manual`; `imported` → 422 |
| Status | Jobsearch-Status → RIS `stage`; `confirm=true` bei `submitted` |
| `expectedVersion` | Body oder `If-Match` |
| Idempotenz | `Idempotency-Key`-Header oder `body.idempotencyKey` |
| Delete | RIS `204` → lokales Receipt `{deleted:true, idempotent:false}` (kein Server-Receipt) |
| `ownerId` | aus verifiziertem `sub`, nie aus dem Body |

### Fehler-Mapping

`401 → unauthenticated/upstream_unauthenticated`, `403 → forbidden`,
`404 → not_found`, `409 VERSION_CONFLICT → version_conflict`,
`409 IDEMPOTENCY_PAYLOAD_CONFLICT → idempotency_conflict`,
`422 → validation_error`, `503 → unavailable`.

---

## 6. Phase E — Tests

| Prüfung | Ergebnis |
|---|---|
| BFF-Mock-Tests | **13 / 13 PASS** |
| Gesamtsuite | **1427 passed / 5 skipped** (141 Dateien: 138 passed, 3 skipped) |
| `npm run build` | **PASS** |
| `git diff --check` | **PASS** |
| `node --check` neue API-Dateien | **PASS** |

Abgedeckt: fehlender Token, deaktiviertes Feature, falscher Issuer, falscher
Client, Create mit Credential/Mapping, Multi-Location-422, Builder-CV-422,
Get, Patch-`expectedVersion`, Delete-Receipt, RIS-409, RIS-503, keine
Token-/Credential-Leaks in der Antwort.

**Umgebungsbefund:** Der erste Suite-Lauf scheiterte an fehlendem `pdf-lib`
im alten `node_modules`. Nach `npm ci` (exakt aus dem Lockfile, keine
Versionsänderung) war die Suite grün. `npm ci` meldet 7 bekannte
Dependency-Audit-Findings; **kein** `npm audit fix` ausgeführt.

---

## 7. Offene RIS-DEV-Voraussetzungen

1. Jobsearch-Issuer/Client im ris-dev-Partner-Registry autorisieren.
2. `X-Api-Credential` für Jobsearch bereitstellen (serverseitig).
3. Tenant-Zuordnung bestätigen.
4. `PARTNER_SURFACE_ENABLED` im Testfenster freigeben (danach zurückstellen).
5. Synthetischen Testbenutzer für RIS autorisieren (bzw. Tenant/Entitlement).
6. Cleanup-Verfahren und synthetische Daten freigeben.
7. Ausdrückliche Freigabe für mutierende Requests.
8. Entscheidung zu `statusHistory`/`history` (Detail/List liefern sie nicht).
9. OpenAPI-Drift korrigieren (`job.url`, Cover-Letter-`source`).
10. Builder-CV-Referenz separat freigeben.

---

## 8. Abschlussentscheidung

```text
JM-RIS-INTEGRATION-01B

JOBSEARCH TEST USER:            BLOCKED (nicht verwendet)
COGNITO LOGIN:                  BLOCKED
EXISTING ACCESS TOKEN:          BLOCKED
RIS-DEV IDENTITY AUTHORIZATION: BLOCKED
RIS-DEV PARTNER BINDING:        BLOCKED
RIS-DEV PARTNER SURFACE:        NOT LIVE VERIFIED (Quelle: DISABLED)
JOBSEARCH BFF:                  LOCAL VERIFIED
APPLICATIONV1 MOCK TESTS:       PASS (13/13)
REAL RIS-DEV E2E:               NOT AUTHORIZED
PRODUCTION STORAGE:             DISABLED
AWS/TERRAFORM:                  UNCHANGED
COGNITO/CLOUDFRONT:             UNCHANGED
GITHUB PUSH:                    NOT AUTHORIZED
```

**HARD STOP.** Kein realer RIS-DEV-Write, keine AWS-/Terraform-/Cognito-/
CloudFront-Änderung, kein Push, kein Deployment. Phase 01C ist nicht begonnen.

---

## 9. Evidence

- `src/lib/oidcConfig.ts:2-3,19-20`
- `api/_lib/ris/{config,auth,client,map}.mjs`
- `api/ris/applications.mjs`
- `tests/api/ris-applications.test.mjs`
- `.env.example` (RIS-Abschnitt)
- RIS `jobsearch/application_contract.py`, `jobsearch/application_repository.py`, `lambda/handler.py`, `terraform/modules/lambda/main.tf:629`
- RIS `docs/reports/RIS-R08-RIS-DEV-UPGRADE-EXECUTION.md`
- `docs/reports/JM-RIS-INTEGRATION-01A-CONTRACT.md`
