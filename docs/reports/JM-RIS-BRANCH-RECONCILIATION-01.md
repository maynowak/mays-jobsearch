# JM-RIS-BRANCH-RECONCILIATION-01

**Art:** Branch Reconciliation / Server-side Test-User Allowlist
**Datum:** 2026-11-05
**Branch:** `feature/jm-ris-testuser-allowlist-reconciliation-01`
**Basis:** lokaler `main` `bef81b9`
**Status:** **LOCAL VERIFIED · NO MERGE · NO PUSH**

---

## 1. Baseline

| Element | Wert |
|---|---|
| Ausgangsbranch | `main` |
| Ausgangs-HEAD | `bef81b9` |
| Working Tree | clean (nur 4 bewusst untracked Dokumente) |
| Boundary-Regeln | `AGENTS.md` „External system boundary — Mays-RIS“ |
| BFF | `api/ris/applications.mjs` + `api/_lib/ris/*` |
| Alter Branch | `origin/feature/jm-ris-integration-gap-closure-01` @ `656566b` |

Der alte Branch wurde **nicht** verändert, gelöscht oder gemergt. Er wurde
ausschließlich als Jobsearch-Quellcode gelesen.

---

## 2. Was aus dem alten Branch übernommen wurde

Nur die **Idee einer Testbenutzer-Allowlist**. Die Umsetzung wurde vollständig
neu und serverseitig in die bestehende BFF-Architektur integriert:

- Neue Server-Variable `RIS_TEST_USER_ALLOWLIST`.
- Format: `<issuer>|<sub>,<issuer>|<sub>` (Komma/Newline).
- Prüfung **nach** der bestehenden JWT-Verifikation (RS256/JWKS, Issuer,
  Client, `token_use`, `exp`, `nbf`, `sub`).
- Exakte Bindung an **Issuer + `sub`**; gleiche `sub` mit anderem Issuer wird
  nicht akzeptiert.
- Fehlende/leere Allowlist → **403 `test_user_not_allowed`** (fail-closed).
- Keine RIS-Anfrage bei Ablehnung.
- Keine echten Benutzerkennungen im Repository; Tests verwenden synthetische
  `user-1`, `user-A`, `user-B`, `user-real`.
- Feature-Flags bleiben standardmäßig **OFF**.
- Die Allowlist ist eine **zusätzliche Testzugangsbeschränkung**, kein Ersatz
  für RIS-Partnerberechtigungen.

### Betroffene Dateien

- `api/_lib/ris/config.mjs` — Parsing + `isAllowedTestUser`.
- `api/ris/applications.mjs` — serverseitige Durchsetzung.
- `tests/api/ris-applications.test.mjs` — Allowlist-Tests.
- `tests/api/ris-boundary.test.mjs` — Nachweis: keine Client-Allowlist.
- `.env.example` — dokumentierte Server-Variable.
- `AGENTS.md` — Boundary-Regel ergänzt.

---

## 3. Was bewusst **nicht** übernommen wurde

| Branch-Bestandteil | Grund |
|---|---|
| `api/ris/[...path].mjs` (Catch-all) | bestehende explizite BFF-Route bleibt; kein Catch-all |
| `src/lib/applications/ris/*` | bestehende Adapter-/UI-Architektur bleibt |
| `VITE_RIS_REMOTE_TEST_SUBS` / `VITE_RIS_APPLICATIONS_REMOTE` | clientseitige Allowlist ist kein Sicherheitsgate |
| `location.join(", ")` / `source[0]` | verlustbehaftetes Mapping; bestehende 422-Regel bleibt |
| `ownerId: payload.ownerId ?? ""` | `ownerId` bleibt serverseitig aus verifiziertem `sub` |
| „nur Preview-Deployment fehlt“ | RIS-seitige Voraussetzungen bleiben separat; keine RIS-Interna als Evidence |
| Migration-/Consent-Änderungen | nicht Teil dieses Branches |

---

## 4. Sicherheitsnachweis

| Prüfung | Ergebnis |
|---|---|
| Erlaubter Testbenutzer (`issuer|sub`) | **PASS** (Request erreicht Mock-RIS) |
| Nicht erlaubter `sub` | **403 `test_user_not_allowed`**, kein RIS-Call |
| Gleiche `sub`, anderer Issuer | **401 `invalid_issuer`**, kein RIS-Call |
| Fehlende/leere Allowlist | **403 `test_user_not_allowed`** |
| Ungültiger/abgelaufener/ID-Token | **401** (bestehende Tests) |
| Feature-Flag OFF | **503 `ris_disabled`** |
| Cross-User | `ownerId` weiterhin aus verifiziertem `sub`; keine Fremddaten |
| Client-Allowlist | **nicht vorhanden** (Boundary-Test) |
| Catch-all/offener Proxy | **nicht vorhanden** |
| Secrets in Antworten/Logs | keine |

Die Allowlist ersetzt **nicht** die RIS-Partner-/Tenant-/Entitlement-Prüfung.
Sie verhindert lediglich, dass normale oder fremde Jobsearch-Benutzer den
Remote-Pfad im Testmodus erreichen.

---

## 5. Tests

| Suite | Ergebnis |
|---|---|
| BFF (`tests/api/ris-applications.test.mjs`) | **29 / 29 PASS** |
| Boundary (`tests/api/ris-boundary.test.mjs`) | **6 / 6 PASS** |
| Gesamtsuite | **1502 passed / 5 skipped** |
| `npm run build` | **PASS** |
| `git diff --check` | **PASS** |

Neue Fälle: Allowlist erlaubt, nicht erlaubt, fehlende Allowlist, gleiche
`sub`/anderer Issuer, keine Client-Allowlist. Bestehende JWT-/Mapping-/UI-/
Migrations-Tests bleiben grün.

---

## 6. Offene Punkte

1. Der **echte** Allowlist-Wert (`<ris-issuer>|<test-sub>`) muss serverseitig
   in Vercel gesetzt werden; er darf nicht im Repository stehen.
2. RIS-Partnerressourcen (APIProfile/Credential/Offer/Grant/Entitlement),
   Authorizer und Partner-Surface bleiben separat erforderlich.
3. Vercel-Env (`RIS_API_BASE_URL`, `RIS_COGNITO_ISSUER`,
   `RIS_COGNITO_CLIENT_ID`, `RIS_APPLICATION_STORAGE_ENABLED`) bleibt offen.
4. Live-E2E bleibt nicht freigegeben.
5. Der alte Branch bleibt unverändert und wird nicht gelöscht/archiviert.

---

## 7. Status

```text
JM-RIS-BRANCH-RECONCILIATION-01

BASIS:                    main bef81b9
BRANCH:                   feature/jm-ris-testuser-allowlist-reconciliation-01
ALLOWLIST:                SERVER-SIDE, ISSUER+SUB, FAIL-CLOSED
CLIENT-ALLOWLIST:         NOT ADOPTED
CATCH-ALL BFF:            NOT ADOPTED
LOSSY MAPPINGS:           NOT ADOPTED
BFF/ADAPTER ARCHITECTURE: PRESERVED
MIGRATION:                UNCHANGED
TESTS:                    1502 passed / 5 skipped
BUILD:                    PASS
MERGE TO MAIN:            NOT EXECUTED
PUSH:                     NOT EXECUTED
OLD BRANCH:               UNTOUCHED
```

**HARD STOP.** Kein Merge, kein Push, kein Deployment, keine RIS-/AWS-/
Cognito-/Terraform-Änderung. Der alte Branch bleibt unverändert.
