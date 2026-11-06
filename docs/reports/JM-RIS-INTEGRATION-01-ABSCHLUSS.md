# JM-RIS-INTEGRATION-01 — Abschlussbericht

**Art:** Konsolidierter Abschluss der Jobsearch↔RIS-ApplicationV1-Integration
**Datum:** 2026-11-05
**Ziel:** `ris-dev2` / `ris-dev` · **Modus:** lokal/mock verifiziert; Live-Test nicht freigegeben
**Status:** **LOCAL VERIFIED · LIVE E2E BLOCKED**

---

## 1. Git-Baseline

| Element | Stand |
|---|---|
| Jobsearch | `main` `da10601` + Abschlussstand |
| RIS (öffentlich) | `main` `5ebefbd`, R08-Merge `e0a3fe4`, Referenz `c28c668` |
| Jobsearch-Logik | 01A–01F implementiert und getestet |
| RIS-AWS | in diesem Lauf **nicht** abgefragt |

### Commits der Integration

| Phase | Commit | Inhalt |
|---|---|---|
| 01A | `92be5c1` | Contract-/Identity-Reconciliation |
| 01B | `67af66a` | serverseitiger RIS-BFF |
| 01C | `68ae5de` | Remote-Adapter |
| 01D | `a3c9a04` | UI-Repository-Integration |
| 01E | `362592d` | Session-Migration |
| 01F | `d60ce6a` | Security/Regression |
| Boundary | `da10601` | externe RIS-Grenze + Incident |
| Abschluss | dieser Commit | Konsolidierung, `RIS_API_KEY`-Alias |

---

## 2. Implementierte BFF-Routen

Fassade: `api/ris/applications.mjs`, Bibliothek: `api/_lib/ris/*`.

| Methode | Route/Aktion | Zweck |
|---|---|---|
| GET | `/api/ris/applications` | Liste + Cursor |
| GET | `?id=` | Detail |
| POST | `/api/ris/applications` | Create + `Idempotency-Key` |
| PATCH | `?id=` | Update + `expectedVersion` |
| DELETE | `?id=` | Delete + `expectedVersion` |
| POST | `?id=&action=status` | Status/Stage |
| POST | `?id=&action=history` | History (nicht im UI-Adapter) |
| POST | `?id=&action=cover-letter` | Cover-Letter-Version (nicht im UI-Adapter) |
| GET | `?id=&action=export` | Export |
| GET | `?action=metrics` | Metrics |

Sicherheit: feste RIS-Basis, Pfad-/ID-Allowlist, kein offener Proxy,
Credential nur serverseitig, JWT-Verifikation, 10-s-Timeout, keine Retries.
`RIS_PARTNER_CREDENTIAL`, `RIS_API_KEY` und `RIS_API_CREDENTIAL` werden als
serverseitige Aliase akzeptiert.

---

## 3. ApplicationV1-Feldmatrix (Auszug)

| Jobsearch | RIS | Bewertung |
|---|---|---|
| `job.companyName` | `job.company` | Rename, verlustfrei |
| `job.location[]` | `job.location` | **nur genau 1 Wert**, sonst 422 |
| `job.source[]` | `job.source` | **nur genau 1 Wert**, sonst 422 |
| `job.originalUrl` | `job.url` | http(s), optional bei manuell |
| `job.jobOrigin` | nicht im RIS-Contract | manuelle Stellen blockiert |
| `documents.cvReference.cvSource` | nicht im RIS-Contract | Builder-CV blockiert |
| `status` | `stage` + abgeleiteter `status` | Mapping verlustfrei |
| `statusHistory` | nicht in Detail/List | **GAP** |
| `history` | nur im Export | **GAP** |
| `documents.coverLetterVersions` | RIS-Schema | Mapping vorhanden |
| `followUp` | RIS-Schema | Mapping vorhanden |
| `salary` | Decimal | keine Rundung im Adapter |
| `expectedVersion` | `expectedVersion` | Konfliktkontrolle |
| `applicationId` | server-generiert | UI-`localId` nur intern |
| Delete | `204` | lokales Receipt, kein Server-Receipt |

---

## 4. Verfügbare und fehlende Operationen

**Lokal verifiziert:** List, Detail, Create, Update, Status, Export, Delete,
Metrics, Pagination/Cursor.

**Bewusst nicht unterstützt:** `addFeedback`, `addInterview`, `addNote`,
`addCoverLetterVersion` im UI-Adapter. Der BFF liefert nur `{history}` bzw.
`{version}`, keine vollständige `ApplicationV1`; ein vollständiges Objekt zu
erfinden wäre falsch.

---

## 5. Identitäts- und Credential-Vertrag

| Umgebung | Issuer | Client |
|---|---|---|
| Jobsearch | `eu-central-1_ZURSMpD2O` | `5hb3f6dj5ialg77jf4blur9g6g` |
| RIS DEV2 (öffentlicher Handoff) | `eu-central-1_K3dkdSipZ` | `21j28p71vogg0m41tcue0ib3l4` |
| RIS-DEV (historisch dokumentiert) | `eu-central-1_ojbmoiYGM` | `7ldhihlpdgsgcl3puvu4oi7ksv` |

- Jede Partnerseite hat ihren eigenen Pool/Client. **Keine automatische
  JWT-Kompatibilität.**
- RIS muss den Jobsearch-Issuer/Client ausdrücklich autorisieren.
- BFF sendet `Authorization: Bearer <Access Token>` + `X-Api-Credential`;
  der Browser erhält niemals das Credential.
- `ownerId` wird aus verifiziertem `sub` abgeleitet; keine E-Mail, kein
  Browser-Wert.
- **Offener Vertragspunkt:** Der DEV2-Handoff beobachtete `custom:tenant_id`
  nur im ID-Token, nicht im Access-Token. RIS muss bestätigen, ob die
  Tenant-Auflösung über Registry/Credential erfolgt (öffentliche ADR erlaubt
  fehlenden Claim) oder ob ein anderes Token-/Claim-Vertrag gilt. Kein
  Workaround durch falschen Token-Typ.

---

## 6. Test- und Integrationsnachweise

### Jobsearch (lokal, Mock)

| Suite | Ergebnis |
|---|---|
| BFF | **26 / 26 PASS** |
| Migration | **16 / 16 PASS** |
| Migration-Dialog | **2 / 2 PASS** |
| Remote-Adapter | **21 / 21 PASS** |
| UI-Bridge | **12 / 12 PASS** |
| UI Remote/Session | **2 / 2 PASS** |
| Boundary | **5 / 5 PASS** |
| Gesamtsuite | **1498 passed / 5 skipped** |
| Build / `git diff --check` | **PASS** |

### RIS DEV2 (öffentliche RIS-Berichte)

| Prüfung | Ergebnis |
|---|---|
| Gateway/JWT/Partner-Key (RIS-intern) | **PASS** (RIS-seitig) |
| Application CRUD / Decimal / Resolver | **PASS** (RIS-intern) |
| Jobsearch-spezifische DEV2-Routen | **BLOCKED** laut `RIS-R08-DEV2-JOBSEARCH-INTEGRATION-HANDOFF` (keine Partnerbindung) |
| `custom:tenant_id` im Access-Token | **nicht vorhanden** (nur ID-Token) → Vertrag offen |
| CORS | keine API-Gateway-Konfiguration |

**Wichtig:** Der RIS-interne DEV2-E2E ist **kein** Nachweis für den
Jobsearch-Pfad. Der Jobsearch-spezifische DEV2-Handoff sagt ausdrücklich:
Routen vorhanden, aber ohne Partnerbindung **BLOCKED**; Metrics mit
synthetischem Token → 401.

### ris-dev

- `RIS-R08-RIS-DEV-UPGRADE-EXECUTION` dokumentiert Apply und
  `PARTNER_SURFACE_ENABLED=false`.
- Der öffentliche Hands-on-Handoff (05.11.2026) sagt dagegen, es gebe
  „bislang KEIN verifiziertes lokales Profil“ und die Live-Inventur sei
  **BLOCKED**.
- Dieser Quellenkonflikt wird nicht von Jobsearch aufgelöst. Der RIS-Betrieb
  muss den aktuellen Stand attestieren. In diesem Lauf wurden **keine**
  AWS-Abfragen durchgeführt.

---

## 7. Abnahme-Gates

| Gate | Status |
|---|---|
| Vertragsabgleich | **PASS (PARTIAL bei History/Cover-Letter)** |
| BFF-Security | **PASS** |
| ApplicationV1 Remote Adapter | **PASS (lokal)** |
| Bewerbungsverwaltung lokal | **PASS** |
| Session-Isolation | **PASS** |
| Versionskonflikte | **PASS** |
| Optionale Migration | **PASS (NO-LOSS PARTIAL)** |
| RIS-DEV2 E2E (Jobsearch-Pfad) | **BLOCKED** |
| Echte Kundendaten | **NICHT FREIGEGEBEN** |
| Vercel Production | **NICHT FREIGEGEBEN** |

---

## 8. Erfolgskriterium

**Lokal erfüllt:** Die bestehende Bewerbungsverwaltung arbeitet über den
sicheren BFF/Remote-Adapter; Create/Read/Update/Status/Export/Delete/Metrics
sind mock-verifiziert; Session-Funktionen bleiben erhalten; Migration ist
explizit, idempotent und fail-closed.

**Live noch nicht erfüllt:** Der Jobsearch-spezifische DEV2-Test
(Login → BFF → RIS → Create → Reload → Read → Patch → Export → Delete) ist
**BLOCKED**, weil Partnerbindung/Credential/Tenant für den Jobsearch-Client
nicht attestiert sind.

---

## 9. Offene Aufgaben

1. RIS attestiert Jobsearch-Issuer/Client für DEV2 (oder Entscheidung für
   RIS-Pool-Client).
2. Partner-Credential + Tenant-Bindung für den Jobsearch-Client.
3. Grant/Entitlement für den Testbenutzer-`sub` (nicht RISSE-ADM).
4. Klärung `custom:tenant_id` (Access vs. ID Token; Registry-Fallback).
5. Aktivierungsfenster der Partner-Surface.
6. History-/Cover-Letter-Response-Vertrag.
7. Echter Server-Consent (Textversion, Widerruf).
8. E2E mit synthetischen Daten + Cleanup + ausdrücklicher Freigabe.
9. Keine echten Bewerberdaten, kein Vercel-Production.

---

## 10. Status

```text
JM-RIS-INTEGRATION-01

TARGET:                    ris-dev2 / ris-dev
MODE:                      LOCAL MOCK ONLY
CONTRACT:                  PASS (PARTIAL: history/cover-letter)
BFF:                       LOCAL VERIFIED
REMOTE ADAPTER:            LOCAL VERIFIED
UI INTEGRATION:            LOCAL VERIFIED
SESSION ISOLATION:         PASS
VERSION CONFLICT:          PASS
MIGRATION:                 PASS (NO-LOSS PARTIAL)
RIS-DEV2 E2E (JOBSEARCH):  BLOCKED
REAL CUSTOMER DATA:        NOT AUTHORIZED
AWS/TERRAFORM:             UNCHANGED
COGNITO/CLOUDFRONT/DNS:    UNCHANGED
PRODUCTION DEPLOYMENT:     NOT AUTHORIZED
GITHUB PUSH:               NOT AUTHORIZED
```

**HARD STOP.** Keine RIS-Repo-Änderung, keine AWS-/Terraform-/Cognito-/DNS-
Mutation, keine echten RIS-Requests, keine produktive Speicherung, kein Push,
kein Deployment.

---

## 11. Evidence

- `docs/reports/JM-RIS-INTEGRATION-01A-CONTRACT.md`
- `docs/reports/JM-RIS-INTEGRATION-01B-TESTUSER-AND-BFF.md`
- `docs/reports/JM-RIS-INTEGRATION-01C-REMOTE-ADAPTER.md`
- `docs/reports/JM-RIS-INTEGRATION-01D-UI-HANDOFF.md`
- `docs/reports/JM-RIS-INTEGRATION-01E-SESSION-MIGRATION.md`
- `docs/reports/JM-RIS-INTEGRATION-01F-SECURITY-REGRESSION.md`
- `docs/reports/JM-RIS-BOUNDARY-01.md`
- RIS öffentlich: `docs/reports/RIS-R08-DEV2-JOBSEARCH-INTEGRATION-HANDOFF.md`,
  `docs/reports/RIS-R08-RESOLVER-DEV2-GATEWAY-E2E-27.md`,
  `docs/reports/RIS-APPLICATION-DEV2-APPLY-E2E-25.md`,
  `docs/testing/RIS-DEV2-PARTNER-GATEWAY-E2E-PLAYBOOK.md`,
  `docs/reports/RIS-R08-RIS-DEV-UPGRADE-EXECUTION.md`
- RIS Hands-on (PDF, 05.11.2026): ris-dev-Zugang/State-Inventur BLOCKED.
