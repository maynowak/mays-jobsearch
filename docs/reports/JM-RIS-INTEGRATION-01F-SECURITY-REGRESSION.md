# JM-RIS-INTEGRATION-01F — Security, Integration und Regression

**Art:** Sicherheits-/Integrations-/Regressionsprüfung
**Datum:** 2026-11-05
**Ziel:** `ris-dev` (nicht live) · **Modus:** LOCAL MOCK ONLY
**Status:** **SECURITY PASS (lokal) · RIS-DEV LIVE NOT AUTHORIZED**

---

## 1. Baseline

| Element | Stand |
|---|---|
| Jobsearch | `main` `362592d` + Security-Härtung |
| Integration | 01A–01E |
| Testbasis vor 01F | 1481 passed / 5 skipped |
| Testbasis nach 01F | **1492 passed / 5 skipped** |

---

## 2. Identitäts- und Sicherheitsmatrix

| Prüfung | Ergebnis | Nachweis |
|---|---|---|
| JWT-Signatur via JWKS (RS256) | **PASS** | `api/_lib/ris/auth.mjs`; `invalid_signature`-Test |
| Erwarteter Issuer | **PASS** | `invalid_issuer` |
| Erwarteter Client (`client_id`/`aud`) | **PASS** | `invalid_client` |
| `token_use=access` | **PASS** | ID-Token → 401 `invalid_token_use` |
| Ablaufzeit `exp` | **PASS** | abgelaufenes Token → 401 `token_expired` |
| `nbf` (falls vorhanden) | **PASS** | `token_not_yet_valid` |
| `sub` verpflichtend | **PASS** | leerer `sub` → 401 `invalid_subject` |
| E-Mail ist keine Identität | **PASS** | gleiche E-Mail, verschiedene `sub` → getrennte `ownerId` |
| Browser-`ownerId` wird ignoriert | **PASS** | Body-Spoof-Test; RIS-Payload ohne `ownerId` |
| Tenant nicht aus Browser | **PASS** | BFF setzt keinen Tenant aus Body |
| Partner-Credential nur serverseitig | **PASS** | `RIS_PARTNER_CREDENTIAL` nur im BFF |
| Token/Credential in Antworten/Logs | **PASS** | Leak-Test; keine Logausgabe von Secrets |

**Härtung in 01F:** JWKS-Ausfall wird jetzt als **503 `unavailable`** statt 401
gemeldet; JWKS-Fetch hat ein 5-s-Timeout; `nbf` wird geprüft; Body-Limit greift
auch bei bereits geparsten Objekten (413).

---

## 3. BFF-Sicherheit

| Prüfung | Ergebnis |
|---|---|
| Server-Flag `RIS_APPLICATION_STORAGE_ENABLED` default OFF | **PASS** |
| Browser-Flag `VITE_RIS_APPLICATION_STORAGE_ENABLED` default OFF | **PASS** |
| RIS-Zieladresse nur serverseitig, HTTPS, fest | **PASS** |
| Kein offener Proxy | **PASS** (feste Pfade, `applicationId`-Regex, Aktions-Allowlist) |
| Keine beliebigen RIS-Operationen | **PASS** (unbekannte Aktion → 422) |
| Kein Credential-Leak | **PASS** |
| Keine Token-Leaks | **PASS** |
| Body-/Methodenvalidierung | **PASS** (200 KB, 413; PUT → 405) |
| Timeout/Abort | **PASS** (10 s RIS, 5 s JWKS, kein Retry) |
| 401/403/404/409/422/429/502/503 | **PASS** (Mapping getestet) |
| Pfadmanipulation (`id=../../`) | **PASS** (422 `invalid_application_id`) |
| Same-Origin/Auth-Route | **PASS** (kein Wildcard-CORS) |

---

## 4. ApplicationV1-Operationen

| Operation | Status |
|---|---|
| List + Cursor | **VERIFIED** (Mock) |
| Detail | **VERIFIED** |
| Create + Idempotency | **VERIFIED** |
| Update + `expectedVersion` | **VERIFIED** |
| Status/Stage | **VERIFIED** |
| Export | **VERIFIED** (ApplicationExportV1) |
| Delete | **VERIFIED** (Receipt erst nach Bestätigung) |
| Metrics | **VERIFIED** (Mock) |
| `addFeedback`/`addInterview`/`addNote`/`addCoverLetterVersion` | **NOT SUPPORTED** (bewusst; BFF liefert keine vollständige `ApplicationV1`) |

Keine vollständigen Objekte aus unvollständigen Responses werden konstruiert.

---

## 5. Migrationssicherheit

| Prüfung | Ergebnis |
|---|---|
| Keine automatische Kontospeicherung | **PASS** |
| Ausdrückliche Bestätigung (`confirmed:true`) | **PASS** |
| Kompatibilitätsprüfung | **PASS** |
| Keine stillen Datenverluste | **PARTIAL** — inkompatible Datensätze werden blockiert, nicht übertragen |
| Stabile Idempotenzschlüssel | **PASS** (`<migrationKey>:<localId>`) |
| Wiederholung nach Timeout | **PASS** (Remote-Abgleich, kein neuer Key) |
| Duplikaterkennung | **PASS** (CONFLICT, kein Auto-Merge) |
| Teilübertragungen | **PASS** (pro Bewerbung ein Status) |
| Lokale Bewerbung bleibt erhalten | **PASS** |
| Logout/Benutzerwechsel | **PASS** (`session_ended`, verspätete Antworten verworfen) |
| Keine falschen Erfolgsmeldungen | **PASS** |
| Server-ID + erneuter Abruf | **PASS** (`get` nach Create) |

**No-Loss bleibt PARTIAL:** blockiert werden mehrere Standorte/Quellen,
manuelle Stellen, Builder-CVs, History/StatusHistory über Initial,
Notes > 10.000 und fehlende Quell-URLs. Das ist **keine** vollständige
Migrationsfähigkeit.

---

## 6. Consent-Gate

| Fall | Ergebnis |
|---|---|
| `consentSource=simulated` | **nur lokaler Mock** |
| `consentSource=server` | **BLOCKED** (`storage_consent_required`) |
| fehlende Freigabe | **BLOCKED** |
| produktiver Remote-Write | **DEAKTIVIERT** |
| künstliche Consent-Receipts | **keine** |

Die UI-Checkbox ist nur die Bestätigung der konkreten Übertragung; sie ist
**keine** serverseitige Speicherfreigabe.

---

## 7. Session- und Benutzerisolation

- Session-Generation + `invalidate()` in Session-Repository, Remote-Adapter
  und Migration.
- Logout/Benutzerwechsel → `session_ended`; verspätete Antworten werden
  verworfen.
- Keine Übernahme von Bewerbungen zwischen Benutzern.
- BFF bindet `ownerId` an `sub`; gleiche E-Mail erzeugt keine gemeinsame
  Identität.
- Keine Browser-Tenant-/Owner-Autorisierung.

---

## 8. RIS-Partnerabhängigkeiten (dokumentiert, nicht live verifiziert)

Die Integration setzt auf vorhandene RIS-Komponenten:

| Komponente | Dokumentiert in RIS | Verfügbarkeit auf `ris-dev` |
|---|---|---|
| Partner Application Registry | `PARTNER_USER_DUAL_AUTH_ADR`, `M2M_CLIENT_APIPROFILE_BINDING_ADR` | **NOT LIVE VERIFIED** |
| APIProfile | dito; `RIS-P17-CREDENTIAL-LIFECYCLE-E2E-01` (Management teils nicht verdrahtet) | **NOT LIVE VERIFIED** |
| Partner-Credential (`X-Api-Credential`) | `RIS_AUTH_CONTRACT`, P17 | **BLOCKED** (nicht bereitgestellt) |
| Tenant-Bindung | `PARTNER_USER_DUAL_AUTH_ADR` (L03) | **NOT LIVE VERIFIED** |
| Entitlements | `RIS-ENTITLEMENTS-IAM-ANALYSIS` | **NOT LIVE VERIFIED** |
| Offer/Grant | `RIS-JOBSEARCH-CONSUMER-OFFER-03`, `RIS-OFFER-CRUD-ENTITLEMENT-GRANT-11` | **NOT LIVE VERIFIED** |
| RIS-Agenten-API | `RIS_AUTH_CONTRACT` | **NOT LIVE VERIFIED** |

Der historische RIS-Bericht dokumentiert eine entsprechende Einrichtung; es
wird **nicht** behauptet, dass sie nicht existiert. Für `ris-dev` fehlt
weiterhin der Nachweis: `RIS-DEV2-TEST-IDENTITY-04D` meldet
„RIS PARTNER PROVISIONING BLOCKED“ (kein Registry-Eintrag, kein APIProfile,
kein Credential, keine Tenant-Bindung). Es wurde keine neue Registrierung
oder Credential-Ausstellung ausgeführt.

---

## 9. Testergebnisse

| Suite | Ergebnis |
|---|---|
| BFF-Security/Contract | **25 / 25 PASS** |
| Migration | **16 / 16 PASS** |
| Migration-Dialog | **2 / 2 PASS** |
| Remote-Adapter | **21 / 21 PASS** |
| UI-Bridge | **12 / 12 PASS** |
| UI Remote/Session | **2 / 2 PASS** |
| Gesamtsuite | **1492 passed / 5 skipped** |
| `npm run build` | **PASS** |
| `git diff --check` | **PASS** |

Keine Tests deaktiviert; keine Timeouts erhöht. Ein früherer Volllauf in 01C
zeigte einen nicht reproduzierbaren Flake; die Folgeläufe waren grün.

---

## 10. Abschluss

```text
JM-RIS-INTEGRATION-01F

AUTH SECURITY:           PASS
SESSION ISOLATION:       PASS
BFF SECURITY:            PASS
APPLICATIONV1 CONTRACT:  PARTIAL
MIGRATION SECURITY:      PASS
NO-LOSS:                 PARTIAL
CONSENT GATE:            FAIL-CLOSED
REGRESSION:              PASS
RIS-DEV LIVE:            NOT AUTHORIZED
PRODUCTION STORAGE:      DISABLED
AWS/TERRAFORM:           UNCHANGED
COGNITO/CLOUDFRONT:      UNCHANGED
GITHUB PUSH:             NOT AUTHORIZED
```

**Offen für den echten RIS-DEV-E2E:** Partnerregistrierung/APIProfile/
Credential/Tenant/Entitlement, `PARTNER_SURFACE_ENABLED`, echter
Server-Consent, History-/Cover-Letter-Transfer, synthetische Identität,
Cleanup, ausdrückliche E2E-Freigabe.

**HARD STOP.** Keine RIS-Repo-Änderung, keine AWS-/Terraform-/Cognito-/DNS-
Mutation, keine echten RIS-DEV-Requests, keine produktive Speicherung, kein
Push, kein Deployment.
