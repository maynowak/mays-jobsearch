# JM-RIS-INTEGRATION-GAP-CLOSURE-01

**Art:** Gap-Audit / Anschlussplan / Vercel-Env-Prüfung
**Datum:** 2026-11-05
**Status:** **GAP OPEN · NO MUTATIONS · LIVE E2E BLOCKED**

---

## 1. Git-Status (Mays-Jobsearch)

| Element | Wert |
|---|---|
| Branch | `main` |
| HEAD | `3e60010` |
| `origin/main` | `fec135c` |
| Divergenz | **9 ahead / 0 behind** |
| Pull | **No-op** — kein neuer Remote-Stand |
| Untracked | 4 bewusst belassene Dokumente |
| Worktrees | nur Primär-Checkout |

Die neun lokalen Commits enthalten BFF, Adapter, UI, Migration, Security und
die RIS-Gap-Dokumentation. Sie sind **nicht gepusht**. Der Vercel-Produktionsstand
(`origin/main`-Basis) enthält diese Commits daher **nicht**.

---

## 2. Vercel-Env-Audit (read-only)

Linked Project: `maymilly/mays-job-matcher`.

| Variable | Production | Development/Preview |
|---|---|---|
| `RIS_API_KEY` | **vorhanden (Secret)** | **fehlt** |
| `RIS_API_BASE_URL` | **fehlt** | fehlt |
| `RIS_COGNITO_ISSUER` | **fehlt** | fehlt |
| `RIS_COGNITO_CLIENT_ID` | **fehlt** | fehlt |
| `RIS_APPLICATION_STORAGE_ENABLED` | **fehlt** | fehlt |
| `VITE_RIS_APPLICATION_STORAGE_ENABLED` | **fehlt** | fehlt |

Zusätzlich: Das separate Projekt `mays-jobsearch` hat **keine** Env-Variablen.
`.env.local` enthält keine RIS-Variablen.

**Konsequenz:** Der vorhandene `RIS_API_KEY` allein genügt nicht. Der BFF
meldet ohne Base URL/Issuer/Client `missing_config`; ohne Feature-Flag bleibt
er deaktiviert. Der Key ist nur in Production, nicht in Development — lokales
`vercel dev` müsste Production-Env gezielt beziehen.

---

## 3. RIS-DEV-Gap (read-only verifiziert)

| Objekt | Status |
|---|---|
| Partner Applications | 0 |
| APIProfiles | 0 |
| Credentials | 0 |
| Offers | 0 |
| Entitlements | 0 |
| Partner-/User-Profiles | 0 |
| Applications | 0 |
| Agent Catalog | 2 (`jobsearch-agent`, `reference_agent`) |
| `PARTNER_SURFACE_ENABLED` | false |
| Human JWT Authorizer | `ojbmoiYGM` / `7ldh…` |

Testbenutzer: Jobsearch-Pool `ZURSMpD2O`, Client `5hb3…`,
`sub 93a43852-a051-7036-28e3-0eee4362cffb`, bestätigt,
**kein `custom:tenant_id`**.

Der Jobsearch-Token wird vom aktuellen Authorizer nicht akzeptiert; die
Partnerroute bleibt 503.

---

## 4. Gap-Matrix

| # | Gap | Blockiert durch | Owner |
|---|---|---|---|
| G1 | Partner Application/APIProfile/Credential/Offer/Grant/Entitlement fehlen | `RIS_ADMIN_AUTHORIZATION_FILE` (out-of-band) | RIS-Owner |
| G2 | Jobsearch-Issuer/Client nicht im Authorizer | API-Gateway-/Authorizer-Änderung | RIS |
| G3 | `PARTNER_SURFACE_ENABLED=false` | Testfenster-Freigabe | RIS |
| G4 | Testbenutzer hat keinen Grant/Entitlement | G1 + `sub` | RIS-Admin |
| G5 | `custom:tenant_id` fehlt im Access-Token | Registry-/Credential-Tenant-Auflösung bestätigen | RIS |
| G6 | Vercel: Base URL/Issuer/Client/Flags fehlen | G1–G5 + Env-Setzung | Jobsearch |
| G7 | Vercel-Produktion enthält BFF-Commits nicht | Push/Deploy (nicht freigegeben) | Jobsearch |
| G8 | History/Cover-Letter-Adapter unvollständig | RIS-Response-Vertrag | beide |
| G9 | Server-Consent fehlt | Produkt/Recht | beide |

---

## 5. Schließungsreihenfolge

1. **RIS G1:** Owner stellt `RIS_ADMIN_AUTHORIZATION_FILE` für
   `arn:aws:iam::240571105849:user/Mayaws`, Rolle `admin`, Tenant
   `mays-ris-dev` bereit. Danach APIProfile → Credential → Partner → Offer →
   Grant für `sub 93a43852-…`.
2. **RIS G2:** JWT-Authorizer für `ZURSMpD2O`/`5hb3…` an den Partner-Routen
   (oder Entscheidung für RIS-Pool-Client `7ldh…`).
3. **RIS G3:** `PARTNER_SURFACE_ENABLED=true` im Testfenster; Rollback `false`.
4. **Jobsearch G6:** Vercel-Env ergänzen:
   ```text
   RIS_API_BASE_URL=https://g6901and25.execute-api.eu-central-1.amazonaws.com
   RIS_COGNITO_ISSUER=https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O
   RIS_COGNITO_CLIENT_ID=5hb3f6dj5ialg77jf4blur9g6g
   RIS_APPLICATION_STORAGE_ENABLED=false   # erst nach G1–G3 auf true
   VITE_RIS_APPLICATION_STORAGE_ENABLED=false
   ```
   `RIS_API_KEY` muss der neu ausgestellten Credential entsprechen; sonst
   ersetzen.
5. **G7:** Push/Deploy des Jobsearch-Stands nur mit separater Freigabe.
6. **E2E:** Testbenutzer im Browser, `vercel dev`/Preview mit Production-Env,
   synthetische Bewerbung, Reload, Read, Patch, Export, Delete, Cleanup.
7. **G8/G9:** separat; nicht Teil des ersten Live-E2E.

---

## 6. E2E-Pfad über Vercel

- Der RIS-Key liegt in Vercel Production (`RIS_API_KEY`).
- Für lokalen Test: `vercel env pull .env.local --environment=production`
  (gitignored; Secret nie ausgeben) und `vercel dev`.
- Alternativ: Preview-Deployment mit den Env-Variablen; Produktionsdeployment
  ist **nicht** freigegeben.
- Der Testbenutzer wird über die bestehende Jobsearch-Anmeldung verwendet;
  kein Passwort/Token in Reports/Logs.
- Ohne G1–G3 endet der Pfad bei 401/503; daher **kein E2E gestartet**.

---

## 7. Aktueller Status

```text
GIT:                     main 3e60010, 9 ahead / 0 behind, pull no-op
VERCEL KEY:              present (RIS_API_KEY, Production)
VERCEL CONFIG:           incomplete (base/issuer/client/flags missing)
RIS PARTNER RESOURCES:   0
RIS AUTHORIZER:          mismatch
RIS SURFACE:             false
TEST USER:               verified in Jobsearch pool
LIVE E2E:                BLOCKED
MUTATIONS:               NONE
PUSH/DEPLOY:             NOT AUTHORIZED
```

**HARD STOP.** Keine Vercel-Env-Mutation, keine RIS-Provisionierung, keine
AWS-/Terraform-/Cognito-Änderung, keine echten RIS-Writes, kein Push, kein
Deployment.

---

## 8. Benötigte Freigaben

1. RIS-Trust-Anchor / Provisionierungs-GO.
2. Entscheidung Authorizer-Option A oder B.
3. Surface-Testfenster + Rollback.
4. Vercel-Env-Setzung (inkl. Bestätigung, dass `RIS_API_KEY` zur
   ris-dev-Credential passt).
5. Push/Deploy-Freigabe für den Jobsearch-Stand (G7).
6. E2E-Freigabe mit synthetischen Daten.

---

## 9. Evidence

- `git status/log` (Mays-Jobsearch, 2026-11-05)
- `vercel env ls` (Production/Development/Preview; nur Namen)
- RIS read-only: DynamoDB counts, Lambda env, API-Gateway-Authorizer,
  Cognito-Pools/-Clients (2026-11-05)
- `docs/reports/RIS-JOBSEARCH-DEV-CONNECT-01.md`
- `docs/reports/JM-RIS-INTEGRATION-01-ABSCHLUSS.md`
