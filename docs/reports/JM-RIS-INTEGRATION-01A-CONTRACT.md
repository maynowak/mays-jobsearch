# JM-RIS-INTEGRATION-01A — Contract & Identity Reconciliation

**Art:** Read-only Contract-/Identity-Abgleich (Phase 01A)
**Datum:** 2026-11-05
**Zielumgebung:** `ris-dev` · **Referenz:** `ris-dev2`
**Status:** **PARTIAL / BLOCKED** — keine RIS-Anbindung, keine AWS-/Terraform-/Cognito-Änderung

---

## 1. Baseline

| System | Stand |
|---|---|
| Mays-Jobsearch | `main` `fec135c`, Version `2.2.0`, 4 bewusst untracked Dokumente |
| Mays-RIS (lokal) | `Mays-Recruiting-Intelligent-System`, `main` `5ebefbd` |
| RIS-Baseline im Auftrag | `c28c668` (enthalten), R08-Merge `e0a3fe4` (enthalten) |
| RIS-Working-Tree | 1 untracked TF-Report (nicht angefasst) |
| `ris-dev` | R08-Apply 52/4/0/0; 70 API-Routen, davon 10 Applications; `PARTNER_SURFACE_ENABLED=false` |
| `ris-dev2` | nur Referenz für bestehende E2E-Nachweise |

---

## 2. Identitätsabgleich

| Prüfpunkt | Jobsearch | RIS-Erwartung | Status |
|---|---|---|---|
| Issuer | `https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O` (`src/lib/oidcConfig.ts:2,19`) | Cognito Access Token, `iss` + `aud`/`client_id`, `token_use=access` | **nicht als Partner registriert verifiziert** |
| Client | `5hb3f6dj5ialg77jf4blur9g6g` (`:3,20`) | Partner Application Registry: `client_id → tenant/apiProfile` | **BLOCKED** |
| Scope | `openid email profile` | „appropriate scope“ (nicht spezifiziert) | **OFFEN** |
| Token im API-Call | **kein** `Authorization`-Header im aktuellen Frontend/API-Client | `Authorization: Bearer <access JWT>` + `X-Api-Credential` | **GAP: BFF muss erst entstehen** |
| RIS-Pool | — | `eu-central-1_ojbmoiYGM` (`ris-dev-dev-users`) für RIS-eigene Nutzer | getrennt, unverändert |
| Partner-Credential | nicht vorhanden | `X-Api-Credential: ris_...` serverseitig | **BLOCKED** |
| Tenant | nicht vorhanden | serverseitig aus Registry/Credential/`custom:tenant_id` | **BLOCKED** |

**Wichtig:** Die Jobsearch- und RIS-Pools sind unterschiedlich. Eine JWT-Kompatibilität wird **nicht** behauptet. RIS muss Issuer und Client ausdrücklich als Partner autorisieren. Dafür fehlen auf `ris-dev` ein freigegebener Partner-Registry-Eintrag, ein Credential und ein Tenant.

Zusätzlich: Das Frontend sendet derzeit **kein** Access-Token an eigene API-Routen. Ein BFF müsste das Token entgegennehmen, gegen Issuer/Client/`token_use` prüfen und das Partner-Credential serverseitig ergänzen. Das ist noch nicht implementiert.

---

## 3. Endpoint-Matrix

RIS-Basis: `/v1/partner/me/applications` (`lambda/handler.py:583,671`), Dual-Auth (`JwtAuth` + `X-Api-Credential`).

| Jobsearch `ApplicationPersistencePort` | RIS-Route | Status |
|---|---|---|
| `list()` | `GET /v1/partner/me/applications?limit&cursor&status&stage` | vorhanden |
| `get(id)` | `GET /v1/partner/me/applications/{id}` | vorhanden |
| `create()` | `POST /v1/partner/me/applications` | vorhanden |
| `update()` | `PATCH /v1/partner/me/applications/{id}` | vorhanden |
| `transitionStatus()` | `POST /{id}/status` | vorhanden |
| `addFeedback()` / `addInterview()` / `addNote()` | `POST /{id}/history` | vorhanden |
| `addCoverLetterVersion()` | `POST /{id}/cover-letter-versions` | vorhanden |
| `export()` | `GET /{id}/export` | vorhanden |
| `delete()` | `DELETE /{id}` mit `{expectedVersion}` | vorhanden, **204 ohne Receipt** |
| _(kein Port-Method)_ | `GET /metrics` | vorhanden, optional |

---

## 4. Feldmatrix und GAPs

| Jobsearch | RIS | Bewertung |
|---|---|---|
| `job.companyName` | `job.company` | Rename, verlustfrei |
| `job.location: string[]` | `job.location: string` | **GAP / LOSSY** — Mehrfachwerte nicht abbildbar; Entscheidung nötig (join vs. 422) |
| `job.source: string[]` | `job.source: string` | **GAP / LOSSY** — gleiche Entscheidung |
| `job.originalUrl` | `job.url` | im RIS-Code erlaubt (`validate_job`), in der OpenAPI-Create-Schema **nicht gelistet** → Doku-Drift |
| `job.jobOrigin` | **nicht erlaubt** (`UNKNOWN_FIELD`) | **GAP** — manuelle Herkunft geht verloren; `source:"manual"` + `jobId:"manual:..."` könnte sie implizit tragen |
| `status` (7 Werte) | `stage` (7 Werte) + `status` (5 Werte) | Mapping möglich, siehe §5 |
| `documents.cvReference.cvSource` | **nicht erlaubt** (nur `cvId`,`documentId`,`label`) | **GAP** — Builder-CV-Referenz nicht abbildbar; separates Gate |
| `documents.coverLetterVersions[].source` | Code: `generated|revised|manual` | **passt**; OpenAPI nennt `manual|generated|imported` → **Doku-Drift** |
| `profileRef` | vorhanden (`{id,version}`) | Jobsearch nutzt es nicht → optional |
| `applicationDate` | ISO-DateTime | passt |
| `applicationChannel` | `online|email|portal|postal|other` | passt |
| `contact` | `name|email|phone` | passt |
| `notes` | max. 10.000 | Jobsearch-Limit nicht spezifiziert → prüfen |
| `salary` | `{expectation|offer:{amount,currency,period}}` | passt, Decimal-Präzision 38 Stellen |
| `followUp` | `dueOn` (YYYY-MM-DD), `note`, `status`, `completedAt` | passt |
| `statusHistory[]` | **nicht in `GET`/`LIST`** (`_public` liefert nur den META-Row) | **GAP** — nur im Export als `history`-Kinder enthalten |
| `history[]` | dito, nur im Export | **GAP** — Detail/Liste liefern keine Timeline |
| `applicationId` | server-generiert (`uuid4`) | passt |
| `localId` | niemals senden | Regel bestätigt |
| `expectedVersion` | `expectedVersion` in Patch/Delete/Status/History/Cover-Letter | passt |
| `idempotencyKey` | Create akzeptiert `idempotencyKey` (1–200) | passt |
| Delete-Receipt | `204 No Content` | **GAP** — Jobsearch erwartet `ApplicationDeletionReceiptV1` |
| Pagination | `limit` (1–100), `cursor`, `nextCursor` | passt (opak) |

RIS validiert Job-Felder strikt gegen `{jobId, source, title, company, location, url}`
(`jobsearch/application_contract.py:65-76`); unbekannte Felder führen zu `UNKNOWN_FIELD`.
`documents.cvReference` erlaubt nur `{cvId, documentId, label}` (`:194-204`).

---

## 5. Status-/Stage-Mapping (PROPOSED, verlustfrei)

| Jobsearch `status` | RIS `stage` | RIS `status` (abgeleitet) |
|---|---|---|
| `draft` | `draft` | `DRAFT` |
| `submitted` | `submitted` | `SUBMITTED` |
| `feedback` | `feedback` | `SUBMITTED` |
| `interview` | `interview` | `SUBMITTED` |
| `offer` | `offer` | `SUBMITTED` |
| `rejected` | `rejected` | `SUBMITTED` |
| `withdrawn` | `withdrawn` | `WITHDRAWN` |

RIS setzt beim Create `status=DRAFT`, `stage=draft` (`application_repository.py:256-257`).
Der Status-Endpunkt akzeptiert **genau eines** von `status` oder `stage`
(`lambda/handler.py:704-707`) und verlangt `confirm:true` für `submitted`
(`application_contract.py:358-365`). `READY`/`ARCHIVED` haben im Jobsearch-Modell
keine Entsprechung und werden nicht verwendet.

---

## 6. Fehler-Mapping

| RIS | Jobsearch `ApplicationRepositoryErrorCode` |
|---|---|
| `401` | `unauthorized` |
| `403` | `forbidden` / `owner_mismatch` |
| `404` | `not_found` |
| `409 VERSION_CONFLICT` | `version_conflict` |
| `409 IDEMPOTENCY_PAYLOAD_CONFLICT` | `idempotency_conflict` |
| `409 HISTORY_CONFLICT` / `COVER_LETTER_CONFLICT` | `conflict` |
| `422` | `validation_error` |
| `503` | `unavailable` |

RIS-Fehlerbody: `{error, code}` (`lambda/handler.py` `_application_response`).

---

## 7. Live-Gates / Blocker (ris-dev)

| Gate | Befund | Status |
|---|---|---|
| Partner-Surface | `PARTNER_SURFACE_ENABLED=false` (`terraform/modules/lambda/main.tf:629`; `lambda/handler.py:185`) → alle `/v1/partner/me/*` = **503** | **BLOCKED** |
| Partner-Registry | Kein verifizierter Eintrag für Jobsearch-Issuer/Client auf `ris-dev` | **BLOCKED** |
| Partner-Credential | Kein `ris_...`-Credential für Jobsearch vorhanden | **BLOCKED** |
| Tenant | Keine freigegebene Tenant-Zuordnung | **BLOCKED** |
| Synthetische Identität | Kein freigegebener Testnutzer/Cleanup-Verfahren | **BLOCKED** |
| Positive E2E | Laut RIS-Report ausdrücklich BLOCKED | **BLOCKED** |

`ris-dev2`-E2E-Nachweise bleiben Referenz, **kein** Beweis für `ris-dev`.

---

## 8. Entscheidungen vor Phase 01B

1. **`location[]` → `location`:** joinen (z. B. `", "`) oder bei >1 Wert `422`?
2. **`source[]` → `source`:** joinen, ersten Wert nehmen oder `422`?
3. **`jobOrigin`:** verwerfen (aus `source:"manual"` ableitbar) oder RIS-Feld erweitern?
4. **Builder-CV (`cvSource`):** bis RIS-Unterstützung blockieren (`422`) oder separates Gate?
5. **`statusHistory`/`history` im Detail:** RIS-Vertrag erweitern oder Jobsearch ohne Timeline lesen?
6. **Delete-Receipt:** Jobsearch-Receipt lokal erzeugen (klar als „server 204, kein Receipt“) oder RIS-Vertrag erweitern?
7. **OpenAPI-Drift:** `job.url` im Create-Schema ergänzen; `CoverLetterVersion.source` korrigieren.
8. **`notes`-Limit:** Jobsearch-seitig auf 10.000 begrenzen.
9. **Identität:** Jobsearch-Issuer/Client im ris-dev-Partner-Registry autorisieren, Credential + Tenant bereitstellen.
10. **`profileRef`:** bewusst nicht senden (Jobsearch hat kein RIS-Profil).

---

## 9. Ergebnis

```text
APPLICATION CONTRACT:        PARTIAL
IDENTITY AUTHORIZATION:      BLOCKED
BFF:                          NOT STARTED (Gate)
PERSISTENCE ADAPTER:          NOT STARTED (Gate)
SESSION COMPATIBILITY:        VERIFIED (bestehendes Session-Repository unverändert)
RIS-DEV LIVE E2E:             NOT AUTHORIZED
PRODUCTION STORAGE:           NOT AUTHORIZED
AWS/TERRAFORM:                UNCHANGED
COGNITO/CLOUDFRONT/DNS:       UNCHANGED
GITHUB PUSH:                  NOT AUTHORIZED
VERCEL DEPLOYMENT:            NOT AUTHORIZED
```

**Keine Implementierung von 01B–01F in diesem Schritt.** Die Identitätsautorisation
ist nicht belegt, und vier Pflichtfelder (`location[]`, `source[]`, `jobOrigin`,
`cvSource`) sind nicht verlustfrei abbildbar. Eine stille Konvertierung wäre ein
Datenverlust und ist untersagt.

---

## 10. Evidence

- `src/lib/oidcConfig.ts:2-3,19-20`
- `src/lib/applications/repositoryTypes.ts:154-193`
- `src/lib/applications/contractTypes.ts:29-50,131-149`
- `docs/contracts/MAYS-RIS-APPLICATION-PERSISTENCE-HANDOFF-V1.md`
- RIS `jobsearch/application_contract.py:17-24,65-76,194-204,270-300,358-365`
- RIS `jobsearch/application_repository.py:236-257,477-500`
- RIS `lambda/handler.py:185,583,671-730`
- RIS `terraform/modules/lambda/main.tf:629`
- RIS `jobsearch/openapi.yaml` (Applications + Schemas)
- RIS `docs/architecture/RIS_AUTH_CONTRACT.md`
- RIS `docs/architecture/PARTNER_USER_DUAL_AUTH_ADR.md`
- RIS `docs/architecture/M2M_CLIENT_APIPROFILE_BINDING_ADR.md`
- RIS `docs/reports/RIS-R08-RIS-DEV-UPGRADE-EXECUTION.md` §8/12
- RIS `docs/architecture/APPLICATION-V1-PRIVACY-MATRIX.md`

**Keine AWS-/Terraform-/RIS-Mutation. Keine Cognito-/CloudFront-/DNS-Änderung.
Kein Push, kein Deployment.**
