# JM-RIS-COGNITO-SAME-HOST-LOGIN-02

**Art:** Auth-Implementierungsgate / Dependency-Freigabe
**Baseline:** `d1e6d4c`
**Status:** **BLOCKED — keine Implementierung**
**Grund:** Keine freigegebene SRP-/JWT-Bibliothek; zusätzlich ist die RIS-Akzeptanz des aktuellen Issuers nicht verifiziert.
**AWS-/Vercel-Deployment:** keines

## 1. Git-Preflight

| Prüfung | Ergebnis |
|---|---|
| Branch | `main` |
| HEAD | `d1e6d4c` |
| `origin/main` | synchron (`0 0`) |
| Working Tree | nur vorbestehende untracked Dateien |
| Bestehende Änderungen überschrieben | nein |

## 2. Verbindliche Grundlagen

Berücksichtigt:

- `docs/reports/JM-AUTH-SAME-DOMAIN-LOGIN-01.md`
- `docs/reports/JM-AUTH-SAME-DOMAIN-LOGIN-DIAGNOSIS-01.md`
- `docs/reports/JOBMATCHER-RIS-COGNITO-INTEGRATION-04.md`
- `Mays-Recruiting-Intelligent-System/docs/architecture/RIS_AUTH_CONTRACT.md`
- `Mays-Recruiting-Intelligent-System/docs/architecture/PARTNER_USER_DUAL_AUTH_ADR.md`
- `Mays-Recruiting-Intelligent-System/docs/API/PLATFORM_FRONTEND_INTEGRATION.md`

Keine erneute allgemeine Architekturuntersuchung. Die Diagnose ist abgeschlossen:
Der aktuelle Host-Wechsel kommt von `signinRedirect()` im OIDC-Code-Flow.

## 3. Read-only-Verifikation des aktuellen App Clients

Profil `mayaws`, Region `eu-central-1`, keine Mutation:

```text
User Pool: eu-central-1_ZURSMpD2O (ris-dev-jobsearch-dev-users)
App Client: 5hb3f6dj5ialg77jf4blur9g6g (ris-dev-jobsearch-dev-client)
```

| Feld | Wert |
|---|---|
| `AllowedOAuthFlows` | `["code"]` |
| `AllowedOAuthScopes` | `email`, `openid`, `profile` |
| `ExplicitAuthFlows` | **nicht gesetzt** (`null`) |
| `ClientSecret` | keiner (public client) |
| `EnableTokenRevocation` | `true` |
| `RefreshTokenValidity` | 30 Tage |
| `SupportedIdentityProviders` | `["COGNITO"]` |
| `MfaConfiguration` | `OFF` |
| `SignInPolicy.AllowedFirstAuthFactors` | `["PASSWORD"]` |
| `UsernameAttributes` | `["email"]` |

### Bewertung `USER_SRP_AUTH`

Nach AWS-Dokumentation unterstützt ein App Client ohne gesetztes
`ExplicitAuthFlows` standardmäßig:

- `ALLOW_REFRESH_TOKEN_AUTH`
- `ALLOW_USER_SRP_AUTH`
- `ALLOW_CUSTOM_AUTH`

Damit ist `USER_SRP_AUTH` **konfigurationsseitig verfügbar**. Das ist eine
Ableitung aus dem read-only `describe-user-pool-client` plus der dokumentierten
AWS-Semantik. Ein echter SRP-Handshake mit einem Testkonto wurde **nicht**
durchgeführt und ist **NOT LIVE VERIFIED**.

`ALLOW_USER_PASSWORD_AUTH` und `ALLOW_USER_AUTH` sind nicht Default und nicht
nachgewiesen; sie sind für diesen Auftrag nicht erforderlich.

Es wurden **keine AWS-Änderungen** vorgenommen.

## 4. Dependency-Prüfung

### Aktueller Stand

Im Repository ist keine SRP-Bibliothek installiert:

```text
amazon-cognito-identity-js: nicht installiert
aws-jwt-verify:             nicht installiert
```

`package.json` enthält derzeit nur:

- `oidc-client-ts`
- `react-oidc-context`

`oidc-client-ts` beherrscht den Authorization-Code-Redirect, aber keinen
Cognito-`USER_SRP_AUTH`-Flow. Eine eigene SRP-Implementierung ist ausdrücklich
nicht erlaubt.

### Vorgeschlagene Abhängigkeiten

| Paket | Version | Lizenz | Zweck |
|---|---|---|---|
| `amazon-cognito-identity-js` | `^6.3.22` | Apache-2.0 | Cognito User Pools, SRP, MFA, New-Password, Refresh, GlobalSignOut |
| `aws-jwt-verify` | `^5.2.1` | Apache-2.0 | Signatur-/Issuer-/Audience-/Expiry-Validierung der Cognito-ID-Tokens |

Begründung:

- `amazon-cognito-identity-js` ist die offizielle AWS-SRP-Bibliothek und
  vermeidet eigene Kryptografie.
- `aws-jwt-verify` ist die von AWS empfohlene JWT-Validierung, hat keine
  Runtime-Abhängigkeiten und unterstützt Browser/Vite.
- Kein AWS Amplify, kein neues AWS-Projekt, keine neue Infrastruktur.

`amazon-cognito-identity-js@6.3.22` bringt transitive Laufzeitabhängigkeiten
(u. a. `buffer@4.9.2`, `js-cookie`, `@aws-crypto/sha256-js`) mit. Diese sind vor
der Installation einem kurzen Lizenz-/Security-Review zu unterziehen.
`aws-jwt-verify@5.2.1` hat keine Runtime-Abhängigkeiten.

**Diese Pakete wurden nicht installiert.** Nach `AGENTS.md` ist eine neue
npm-Abhängigkeit erst nach ausdrücklicher Freigabe zulässig.

**HARD STOP an dieser Stelle.**

## 5. Geplante Integration (nur Entwurf, nicht implementiert)

Nach Dependency-Freigabe:

1. **Einheitlicher Auth-Adapter**
   - `CognitoAuthProvider` oder ein bestehender `useAuth`-kompatibler Adapter.
   - Kein paralleler `react-oidc-context`-Provider.
   - `Navbar`, `Profile`, `Dashboard`, `App` und Routing beziehen den Zustand
     aus genau einer Quelle.
   - Alte OIDC-Session-Keys werden beim Cutover einmalig entfernt, damit keine
     widersprüchliche OIDC-/SRP-Session bestehen bleibt.

2. **Login-UI**
   - Bestehende `AuthCard`/`LoginForm`-Optik bleibt erhalten.
   - E-Mail + Passwort als Felder.
   - `USER_SRP_AUTH` über `CognitoUser.authenticateUser`.
   - Kein `signinRedirect()` beim normalen Login.
   - Keine Navigation zu einer externen Login-Domain.
   - Erfolg → intern `/profil`.

3. **Cognito-Zusatzschritte**
   - `NEW_PASSWORD_REQUIRED` → Passwortänderungsformular.
   - `SMS_MFA`, `SOFTWARE_TOKEN_MFA`, `MFA_SETUP` → Challenge-UI, kein Bypass.
   - `PASSWORD_RESET_REQUIRED` → Passwortzurücksetzung.
   - `UserNotConfirmedException` → Hinweis auf E-Mail-Bestätigung.
   - `NotAuthorizedException` → ungültige Zugangsdaten.
   - `TooManyRequestsException`/`LimitExceededException` → verständlicher
     Fehlerzustand.

4. **Session**
   - Erste Version: `sessionStorage` über eine explizite
     `amazon-cognito-identity-js`-`Storage`-Implementierung.
   - Kein stilles `localStorage`-Fallback.
   - Refresh über die SDK-Session; nach Refresh erneute ID-Token-Validierung.
   - Logout: `globalSignOut`, lokale Session löschen, alte OIDC-Keys löschen.
   - Session-Wiederherstellung: `getCurrentUser` + `getSession` + Validierung.
   - Identitätswechsel: bestehende `iss`-`sub`-Logik aus
     `src/lib/authIdentity.ts` beibehalten.

5. **Tokenvalidierung**
   - ID-Token mit `aws-jwt-verify` (`tokenUse: "id"`, `clientId`).
   - Access-Token für RIS wird **nicht** allein anhand von Browserclaims
     vertraut.
   - RIS/Backend muss Access-Token selbst validieren:
     Signatur, `iss`, `aud`, `exp`, `token_use=access`, `scope`.
   - Frontend-Claims sind nur UI-Identität, keine Berechtigung.

6. **Legacy-Callback**
   - `/auth/callback` wird für den normalen Login nicht mehr angesteuert.
   - Bestehende OIDC-Reste/Callbacks werden kontrolliert entfernt oder als
     Legacy-Pfad ohne Sessionwirkung behandelt.

7. **Unverändert**
   - Registrierung (`SignUp`), E-Mail-Bestätigung (`ConfirmSignUp`) und
     Resend-Code werden nicht neu implementiert.
   - `cognitoAuthApi.ts` bleibt die Quelle für diese Public-Client-Operationen.

## 6. RIS-Vertragsprüfung

`RIS_AUTH_CONTRACT.md` fordert für RIS:

- Cognito Access Token
- `iss = https://cognito-idp.eu-central-1.amazonaws.com/<user-pool-id>`
- `aud = <client-id>`
- passender Scope
- `token_use = access`
- `sub` → RIS-Userprofil
- `custom:tenant_id` für Tenant, sofern vorhanden

Der aktuelle Jobsearch-Pool ist `eu-central-1_ZURSMpD2O`, Client
`5hb3f6dj5ialg77jf4blur9g6g`.

**Offener Punkt:** Die RIS-Verträge/ADR nennen an anderer Stelle abweichende
Pool-IDs (u. a. `eu-central-1_IfucuxPC1` bzw. historisch `ojbmoiYGM`). Es wurde
keine Migration durchgeführt. Vor einer RIS-Nutzung muss read-only bestätigt
werden, dass RIS den aktuellen Issuer und Client akzeptiert. Das ist in diesem
Task **NOT VERIFIED**.

**Zweiter offener Punkt:** `RIS_AUTH_CONTRACT.md` beschreibt „initiate OAuth
flow“. `USER_SRP_AUTH` ist kein OAuth-Authorization-Code-Flow, liefert aber
denselben Cognito-Access-Token. Ob RIS diese direkte Authentifizierung
vertraglich akzeptiert, muss der RIS-/Architektur-Owner bestätigen. Es wurde
kein RIS-Vertrag geändert.

## 7. Sicherheitsgrenzen

- Keine eigene SRP-/JWT-Kryptografie.
- Keine Passwörter, Tokens oder MFA-Codes loggen.
- Keine AWS-Secrets im Frontend.
- Keine MFA-Umgehung.
- Kein `localStorage` als stiller Fallback.
- Keine parallelen OIDC-/SRP-Sessions.
- Keine Änderung an Gast-Jobsuche, Apify, Redis, Budgets, CV/ATS oder 10/2/5.
- Kein `mj_session`.
- Keine Cognito-Infrastruktur- oder RIS-Änderung.

## 8. Teststatus

| Prüfung | Ergebnis |
|---|---|
| Auth-Baseline | PASS — 22 Tests |
| Gesamtsuite | PASS — 1031 passed, 5 skipped |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| Neuer Same-Host-Login | **nicht implementiert** |
| Echter Cognito-SRP-Login | **NOT LIVE VERIFIED** |
| MFA/New-Password/Reset | **nicht verifiziert** |
| RIS-Tokenakzeptanz | **NOT VERIFIED** |
| AWS-/Vercel-Deployment | keines |

## 9. Hard-Stop-Begründung

1. Es ist keine freigegebene SRP-Bibliothek installiert.
2. Eine neue npm-Abhängigkeit darf ohne ausdrückliche Freigabe nicht installiert
   werden.
3. Ohne `aws-jwt-verify` oder gleichwertige Validierung wäre die
   Token-/Session-Sicherheit nicht nachgewiesen.
4. Die RIS-Akzeptanz des aktuellen Issuers/Clients und des direkten SRP-Flows
   ist nicht bestätigt.
5. Ein echter Browser-Login-Test ist ohne Testkonto nicht möglich.

Daher wurden **keine** Änderungen an `LoginForm`, `authFlow`, `oidcConfig`,
`main.tsx`, `AuthCallback`, `Profile`, `Navbar`, `App` oder Tests vorgenommen.

## 10. Erforderliche Freigaben

1. `amazon-cognito-identity-js@^6.3.22`
2. `aws-jwt-verify@^5.2.1`
3. Bestätigung, dass RIS den aktuellen Issuer/Client akzeptiert
4. Bestätigung, dass direkter `USER_SRP_AUTH` für die Jobsearch-RIS-Integration
   zulässig ist
5. Testkonto für Login, falsches Passwort, New-Password, MFA, Reset, Refresh
6. Umsetzungsfreigabe
7. Kein Vercel-Deployment vor erfolgreichem echtem Browser-Login-Test

## 11. Git

- Keine Codeänderung.
- Dokumentations-Commit: nach diesem Bericht.
- Remote-Synchronität: nach Push geprüft.
- Kein AWS-/Vercel-Deployment.
