# RIS-JOBSEARCH-DEV-CONNECT-01 — Ist-Abgleich und Anschlussplan

**Art:** Read-only RIS-DEV-Verifikation + Provisionierungsplan
**Datum:** 2026-11-05
**AWS:** `240571105849` (`user/Mayaws`), `eu-central-1` — **read-only**
**Status:** **GAP VERIFIED · PROVISIONING REQUIRED · NO MUTATIONS**

---

## 1. Verifizierter Ist-Zustand (`ris-dev`)

| Prüfung | Ergebnis |
|---|---|
| AWS-Identität | `240571105849` / `arn:aws:iam::240571105849:user/Mayaws` |
| Region | `eu-central-1` |
| Partner Applications | **0** |
| APIProfiles | **0** |
| Credentials | **0** |
| Offers | **0** |
| Entitlements | **0** |
| Partner Profiles | **0** |
| User Profiles | **0** |
| Applications | **0** |
| Agent Catalog | **2** (`jobsearch-agent`, `reference_agent`) |
| Lambda `PARTNER_SURFACE_ENABLED` | **false** |
| Lambda `ERASURE_APPLICATIONS_ENABLED` | false |
| Lambda `DELETION_LEDGER_ENABLED` | false |
| API Gateway | `g6901and25` (`https://g6901and25.execute-api.eu-central-1.amazonaws.com`) |
| Human JWT Authorizer | Issuer `eu-central-1_ojbmoiYGM`, Audience `7ldhihlpdgsgcl3puvu4oi7ksv` |

Damit ist klar: **Das historische Jobsearch-Partnerangebot existiert nicht auf
`ris-dev`.** Es müssen Partner Application, APIProfile, Credential, Offer,
Grant und Entitlement neu provisioniert werden. Die Agenten sind vorhanden.

---

## 2. Testbenutzer

| Prüfung | Ergebnis |
|---|---|
| Pool | Jobsearch `eu-central-1_ZURSMpD2O` |
| Client | `5hb3f6dj5ialg77jf4blur9g6g` |
| Username / `sub` | `93a43852-a051-7036-28e3-0eee4362cffb` |
| Status | `CONFIRMED`, `Enabled: true`, `email_verified: true` |
| `custom:tenant_id` | **nicht vorhanden** |
| RIS-Pool `ojbmoiYGM` | Testbenutzer **nicht** vorhanden (nur `RISSE-ADM`, `mayDevTest`) |

Der Testbenutzer kann sich im Jobsearch-Pool anmelden. Sein Access-Token wird
vom aktuellen RIS-Authorizer **nicht** akzeptiert, weil Issuer/Audience nicht
übereinstimmen.

---

## 3. Identitätsentscheidung (zwingend)

| Option | Änderung | Auswirkung | Bewertung |
|---|---|---|---|
| **A. RIS autorisiert Jobsearch-Pool/Client** | Neue JWT-Authorizer-Konfiguration für `ZURSMpD2O`/`5hb3…`; Partner-Registry mit diesem Client | Jobsearch-Login bleibt unverändert; **RIS-Infra-Änderung** | **bevorzugt** (Partner-Modell: eigener Pool je Partner) |
| **B. Jobsearch nutzt RIS-Pool-Client** | Jobsearch-Env auf `ojbmoiYGM`/`7ldh…`; Testbenutzer müsste im RIS-Pool existieren | betrifft alle Jobsearch-Logins; Testbenutzer nicht vorhanden | nur mit Produktentscheidung |
| **C. Token-Übersetzung** | neue Auth-Bridge | Sicherheits-/Architekturrisiko | **abgelehnt** |

Für den bereitgestellten Testbenutzer ist **Option A** erforderlich, sofern
Jobsearch seinen eigenen Pool behalten soll. Das ist eine RIS-seitige
API-Gateway-/Authorizer-Änderung, keine Jobsearch-Codeänderung.

**Tenant:** Der Testbenutzer hat keinen `custom:tenant_id`. RIS muss den Tenant
über Partner-Registry/Credential auflösen (L03-Vertrag). Das ist vor dem
E2E zu bestätigen.

---

## 4. Erforderliche Provisionierung (`ris-dev`)

Voraussetzung: **owner-only `RIS_ADMIN_AUTHORIZATION_FILE`**, ausgestellt durch
den RIS-Owner/Security für den exakten Principal
`arn:aws:iam::240571105849:user/Mayaws`, Rolle `admin`, Tenant `mays-ris-dev`,
kurze Gültigkeit. **Diese Datei darf nicht selbst erzeugt oder erfunden
werden.** Ohne sie fail-closed.

```bash
export AWS_PROFILE=mayaws AWS_REGION=eu-central-1
export RIS_ADMIN_AUTHORIZATION_FILE=/secure/path/ris-admin-auth.json

# 1) APIProfile (PENDING) + aktivieren
python tools/ris_admin/cli.py apiprofile create \
  --name "Mays-Jobsearch" --description "Jobsearch ApplicationV1" \
  --authorization-file "$RIS_ADMIN_AUTHORIZATION_FILE"
python tools/ris_admin/cli.py apiprofile activate \
  --apiProfileId <aprof_...> --reason "Jobsearch onboarding" \
  --authorization-file "$RIS_ADMIN_AUTHORIZATION_FILE"

# 2) Credential (Secret wird NUR in Datei geschrieben, nie ausgegeben)
python tools/ris_admin/cli.py credential issue \
  --apiProfileId <aprof_...> --expiresAt 2026-12-31 \
  --output-file ~/.secrets/mays-jobsearch-ris-dev.key \
  --label jobsearch-dev --reason "Jobsearch DEV" \
  --authorization-file "$RIS_ADMIN_AUTHORIZATION_FILE"

# 3) Partner Application
python tools/ris_admin/cli.py partner create partner-mays-jobsearch-dev \
  --cognitoClientId 5hb3f6dj5ialg77jf4blur9g6g \
  --apiProfileId <aprof_...> --reason "Jobsearch partner" \
  --authorization-file "$RIS_ADMIN_AUTHORIZATION_FILE"

# 4) Offer
python tools/ris_admin/cli.py offer create \
  --name "Mays-Jobsearch-Partnerpaket-dev" \
  --agent-ids jobsearch-agent reference_agent \
  --authorization-file "$RIS_ADMIN_AUTHORIZATION_FILE"

# 5) Grant für den Testbenutzer-sub
python tools/ris_admin/cli.py offer grant \
  --offerId <off_...> --user-id 93a43852-a051-7036-28e3-0eee4362cffb \
  --scope USER --valid-from 2026-11-05 --valid-until 2026-12-31 \
  --reason "Jobsearch synthetic E2E" \
  --authorization-file "$RIS_ADMIN_AUTHORIZATION_FILE"
```

Zusätzlich erforderlich:

1. **JWT-Authorizer** für `eu-central-1_ZURSMpD2O` / `5hb3…` an den
   Partner-Routen (Option A).
2. **`PARTNER_SURFACE_ENABLED=true`** im Testfenster; danach zurück auf
   `false`.
3. Keine Änderung an `ERASURE_APPLICATIONS_ENABLED`/`DELETION_LEDGER_ENABLED`.

---

## 5. Jobsearch-Konfiguration (nach Provisionierung)

Serverseitig (Vercel Env, kein Deployment in diesem Schritt):

```dotenv
RIS_APPLICATION_STORAGE_ENABLED=true
RIS_API_BASE_URL=https://g6901and25.execute-api.eu-central-1.amazonaws.com
RIS_PARTNER_CREDENTIAL=<Inhalt aus ~/.secrets/mays-jobsearch-ris-dev.key>
RIS_COGNITO_ISSUER=https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O
RIS_COGNITO_CLIENT_ID=5hb3f6dj5ialg77jf4blur9g6g
```

Browser-Flag (nur Remote-Modus, kein Secret):

```dotenv
VITE_RIS_APPLICATION_STORAGE_ENABLED=true
VITE_RIS_APPLICATION_MIGRATION_MOCK=false
```

Das Credential darf **nie** in `VITE_*`, Browser-Bundle, Logs oder Reports.

---

## 6. E2E-Plan (nach Freigabe)

1. Testbenutzer im Jobsearch-Pool anmelden.
2. BFF-Request mit Access-Token; Server ergänzt `X-Api-Credential`.
3. `POST /v1/partner/me/applications` mit synthetischer Bewerbung.
4. Antwort-`applicationId` übernehmen.
5. Seite neu laden; `GET /{applicationId}`.
6. `PATCH` mit `expectedVersion`.
7. `GET /export`.
8. `DELETE` mit `expectedVersion`.
9. Cleanup prüfen (keine Anwendung, kein Testgrant, Surface `false`).
10. Logout/Benutzerwechsel: keine Fremddaten.

Nur synthetische Daten; keine echten Bewerberdaten.

---

## 7. Freigaben / Blocker

| Punkt | Status |
|---|---|
| Owner-only `RIS_ADMIN_AUTHORIZATION_FILE` für `Mayaws` | **FEHLT — out-of-band erforderlich** |
| Provisionierung APIProfile/Credential/Partner/Offer/Grant | **NICHT AUSGEFÜHRT** |
| Jobsearch-Issuer/Client im RIS-Authorizer | **FEHLT (Option A)** |
| Partner-Surface `true` im Testfenster | **AUS** |
| Testbenutzer-Grant | **FEHLT** |
| Server-Consent | **FEHLT** |
| E2E-Freigabe | **NICHT ERTEILT** |

Ohne Trust Anchor bleibt die Provisionierung **BLOCKED**; ohne Authorizer
bleibt der Jobsearch-Token **401**; ohne Surface bleibt die Partnerroute
**503**.

---

## 8. Status

```text
RIS-JOBSEARCH-DEV-CONNECT-01

TARGET:                    ris-dev
AWS ACCOUNT:               VERIFIED (240571105849)
PARTNER RESOURCES:         MISSING (0)
TEST USER:                 Jobsearch-Pool, sub verified
COGNITO COMPATIBILITY:     BLOCKED (authorizer audience mismatch)
PARTNER SURFACE:           DISABLED (false)
PROVISIONING:              BLOCKED (trust anchor missing)
LIVE E2E:                  NOT AUTHORIZED
AWS MUTATIONS:             NONE
COGNITO/CLOUDFRONT/DNS:    UNCHANGED
GITHUB PUSH:               NOT AUTHORIZED
```

**HARD STOP.** Keine Provisionierung, keine Credential-Erzeugung, keine
Surface-Aktivierung, kein Terraform Apply, keine echten RIS-Writes, kein Push.

---

## 9. Evidence

- AWS read-only: STS, DynamoDB counts, Lambda env, API Gateway authorizers,
  Cognito pools/clients/users (2026-11-05).
- RIS öffentlich: `tools/ris_admin/cli.py`, `partner_registry.py`,
  `RIS-R08-DEV2-ADMIN-BOOTSTRAP-19.md`,
  `RIS-R08-DEV2-JOBSEARCH-INTEGRATION-HANDOFF.md`,
  `RIS-R08-RIS-DEV-UPGRADE-EXECUTION.md`.
- Jobsearch: `docs/reports/JM-RIS-INTEGRATION-01-ABSCHLUSS.md`,
  `api/_lib/ris/*`, `api/ris/applications.mjs`.
