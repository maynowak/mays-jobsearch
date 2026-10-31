# JM-AUTH-SAME-DOMAIN-LOGIN-01

**Art:** Auth-Architektur / Machbarkeitsprüfung
**Baseline:** `175d477`
**Status:** **BLOCKED — keine Implementierung**
**Grund:** Die vorhandene Cognito-App-Client-Konfiguration erlaubt keinen direkten Login; eine AWS-Konfigurationsänderung wäre erforderlich.
**AWS-Deployment:** keines
**Vercel-Deployment:** keines

## 1. Git-Preflight

| Prüfung | Ergebnis |
|---|---|
| Branch | `main` |
| HEAD | `175d477` |
| `origin/main` | synchron (`0 0`) |
| Working Tree | nur vorbestehende untracked Dateien |
| Bestehende Änderungen überschrieben | nein |

## 2. Ist-Zustand

### 2.1 Aktueller Login-Pfad

`src/main.tsx` umschließt die App mit `AuthProvider` aus `react-oidc-context` und
`src/lib/oidcConfig.ts`.

`src/lib/oidcConfig.ts` verwendet:

- Authority: `https://cognito-idp.<region>.amazonaws.com/<user-pool-id>`
- `client_id`
- `redirect_uri` (`/auth/callback`)
- `response_type: "code"`
- Scope `openid email profile`

`src/components/LoginForm.tsx` ruft `signIn(auth)` auf.
`src/lib/authFlow.ts` ruft `auth.signinRedirect()` auf. Damit verlässt der
Browser den Job-Matcher-Host und öffnet Cognito Managed Login auf
`auth.mays-job-matcher.app`.

`src/components/AuthCallback.tsx` verarbeitet den Authorization-Code über
`react-oidc-context`. Danach leitet es intern auf `/` weiter.

### 2.2 Abhängigkeitsmatrix

| Datei | Abhängigkeit |
|---|---|
| `src/main.tsx` | `AuthProvider` + `oidcConfig` |
| `src/lib/oidcConfig.ts` | Authority, Client-ID, Redirect-URI, Code-Flow, Scopes |
| `src/lib/authFlow.ts` | `signinRedirect`, `signoutRedirect` |
| `src/components/LoginForm.tsx` | `useAuth()` + `signIn()` |
| `src/components/AuthCallback.tsx` | `useAuth()`; wartet auf Code-Austausch |
| `src/components/Profile.tsx` | `useAuth()` + `signOut()` |
| `src/components/Navbar.tsx` | `useAuth()` für Login-/Logout-/Profilstatus |
| `src/components/DashboardV2AuthenticatedPreview.tsx` | `useAuth()` + `signIn`/`signOut` |
| `src/App.tsx` | `isAuthenticated`, `auth.user.profile`, Identitätswechsel |
| Auth-/Profil-Tests | mocken `useAuth()` bzw. prüfen Redirect-Parameter |

### 2.3 Weitere Abweichung: Ziel nach erfolgreichem Login

`AuthCallback` leitet nach erfolgreicher Authentifizierung auf `/` weiter, nicht
auf `/profil`. Das gewünschte Ziel `/profil` ist damit ebenfalls noch nicht
erfüllt und müsste bei einer Implementierung angepasst werden.

### 2.4 Identitäts- und Sessionmodell

- `src/lib/authIdentity.ts` akzeptiert ausschließlich validierte `iss` + `sub`
  als stabile Profilidentität. E-Mail ist kein Identitätsersatz.
- `react-oidc-context`/`oidc-client-ts` validiert ID-Token, Issuer, Audience und
  Ablaufzeit über die Cognito-JWKS.
- `oidc-client-ts` speichert den User standardmäßig in `sessionStorage`; der
  OIDC-State liegt standardmäßig in `localStorage`.
- Refresh und Session-Wiederherstellung laufen über `oidc-client-ts`.
- Logout läuft über Cognito `/logout` mit `client_id` + `logout_uri`.

### 2.5 Bereits vorhandene direkte Cognito-Aufrufe

`src/lib/cognitoAuthApi.ts` nutzt bereits `fetch()` gegen den Cognito-IdP-
Endpoint für:

- `SignUp`
- `ConfirmSignUp`
- `ResendConfirmationCode`

Diese Operationen sind unauthentifizierte Public-Client-Operationen. Ein
direkter Login über `InitiateAuth` ist dort **nicht** implementiert.

## 3. Nachgewiesene Cognito-Konfiguration

Grundlage sind die committeten Read-only-Audits:

- `docs/reports/04-02-MANAGED-LOGIN-ERROR-01-EXECUTION_LOG.md`
- `docs/reports/04-03-COGNITO-IDP-FIX-01-EXECUTION_LOG.md`
- `docs/reports/JOBMATCHER-COGNITO-DEDICATED-POOL-INTEGRATION-06.md`

Aktueller App Client:

| Feld | Wert |
|---|---|
| User Pool | `eu-central-1_ZURSMpD2O` |
| App Client | `5hb3f6dj5ialg77jf4blur9g6g` |
| Client Secret | keiner (public client) |
| `AllowedOAuthFlows` | `["code"]` |
| `AllowedOAuthScopes` | `email`, `openid`, `profile` |
| `ExplicitAuthFlows` | **nicht gesetzt** |
| `SupportedIdentityProviders` | `["COGNITO"]` |
| `EnableTokenRevocation` | `true` |
| `RefreshTokenValidity` | 30 Tage |
| Username-Attribut | E-Mail |

Entscheidend: **`ExplicitAuthFlows` ist nicht gesetzt.** Die vorherigen Audits
halten ausdrücklich fest, dass `InitiateAuth` bzw. direkte SDK-Logins damit
nicht möglich sind und eine Ergänzung nötig wäre. Der Authorization-Code-Flow
funktioniert; er ist aber genau der Flow, der den Browser auf die
Cognito-Domain umleitet.

Eine erneute Live-AWS-Abfrage wurde in diesem Task nicht durchgeführt.
Die Aussage stützt sich auf die letzte committete Read-only-Evidenz; eine
aktuelle Live-Verifikation ist **NOT VERIFIED**.

## 4. Bewertete Lösungswege

| Lösung | Same-Origin | Sicherheit | Status |
|---|---|---|---|
| OIDC Code + PKCE (aktuell) | nein, Redirect zu Cognito | validiert, etabliert | funktioniert, erfüllt Ziel nicht |
| `USER_SRP_AUTH` direkt | ja | Passwort verlässt Browser nicht im Klartext; SRP | **BLOCKED** — `ALLOW_USER_SRP_AUTH` fehlt |
| `USER_PASSWORD_AUTH` direkt | ja | Passwort über TLS an Cognito; schwächer als SRP | **BLOCKED** — `ALLOW_USER_PASSWORD_AUTH` fehlt |
| `USER_AUTH` direkt | ja | abhängig von Challenge-Konfiguration | **BLOCKED** — `ALLOW_USER_AUTH` fehlt |
| Cognito Managed Login im iframe | optisch ja | externe Login-Seite, Framing-/CSP-Risiko | verworfen |
| Reverse-Proxy für Cognito | optisch ja | Cookie-/CSRF-/Origin-Komplexität | verworfen |
| BFF mit HttpOnly-Session | ja | stärkere Tokenlagerung | außerhalb Scope; neue Architektur |

### `USER_SRP_AUTH`

Benötigt `ALLOW_USER_SRP_AUTH` am App Client. Der Browser müsste SRP-Prove
erzeugen. Das ist ohne getestete Bibliothek (z. B.
`amazon-cognito-identity-js`) oder eine eigene, sicherheitskritische
SRP-Implementierung nicht vertretbar. Eine neue npm-Abhängigkeit ist nach
`AGENTS.md` freigabepflichtig.

Zusätzlich müssen behandelt werden:

- `NEW_PASSWORD_REQUIRED`
- `SMS_MFA` / `SOFTWARE_TOKEN_MFA` / `MFA_SETUP`
- `PASSWORD_RESET_REQUIRED`
- Refresh über `REFRESH_TOKEN_AUTH`
- Logout/Revoke
- sichere Tokenvalidierung und -speicherung

### `USER_PASSWORD_AUTH`

Würde `ALLOW_USER_PASSWORD_AUTH` erfordern. Der Aufruf wäre mit dem vorhandenen
`cognitoRpc`-Muster per `fetch()` möglich. Das Passwort würde aber direkt an
Cognito übertragen; AWS empfiehlt für Produktions-Clients SRP. Auch hier fehlen
MFA-, New-Password-, Refresh-, Validierungs- und Storage-Konzept.

### `USER_AUTH`

Würde `ALLOW_USER_AUTH` und eine definierte Challenge-/Factor-Konfiguration
erfordern. Dafür gibt es weder Konfigurationsnachweis noch Implementierung.
Nicht empfohlen, solange SRP nicht sauber verfügbar ist.

## 5. Token- und Sessionanforderungen (falls später freigegeben)

1. **Identität:** `iss` + `sub` müssen aus einem validierten ID-Token stammen.
   Die bestehende Profilzuordnung darf sich nicht ändern.
2. **Validierung:** Signatur über JWKS, Issuer, Audience, Ablaufzeit. Keine
   selbst entwickelte JWT-Validierung.
3. **Refresh:** `InitiateAuth` mit `REFRESH_TOKEN_AUTH`, Single-Flight,
   definiertes Verhalten bei abgelaufenem Refresh-Token.
4. **Speicherung:** `sessionStorage` ist wie beim aktuellen OIDC-Client
   XSS-lesbar. Eine HttpOnly-Cookie-Lösung würde einen BFF und eine neue
   Session-Architektur erfordern. Diese Entscheidung ist offen.
5. **Logout:** `GlobalSignOut` oder `RevokeToken` plus lokales Löschen; keine
   stillen Parallel-Sessions.
6. **MFA:** Challenges dürfen nicht umgangen werden; die UI muss sie abbilden.
7. **Passwort:** `NEW_PASSWORD_REQUIRED` und Passwortzurücksetzung benötigen
   eigene Schritte; die aktuelle Login-Maske hat dafür keine Felder.
8. **Keine Parallelität:** Der bestehende Redirect-Flow und ein neuer direkter
   Flow dürfen nicht gleichzeitig aktiv sein.
9. **Keine Secrets:** keine Passwörter, Tokens oder MFA-Codes loggen; keine
   AWS-Secrets im Frontend.
10. **Zielroute:** Nach erfolgreicher Anmeldung intern `/profil` ansteuern.
    Aktuell leitet `AuthCallback` auf `/` weiter.

## 6. Erforderliche AWS-Änderungen (nicht ausgeführt)

Für den bevorzugten SRP-Weg:

```text
ExplicitAuthFlows = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
```

Alternativ, mit Sicherheitsabwägung:

```text
ExplicitAuthFlows = ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
```

Für `USER_AUTH` zusätzlich:

```text
ExplicitAuthFlows = ["ALLOW_USER_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
```

Weitere Voraussetzungen:

- MFA-Konfiguration und Testkonto verifizieren.
- `EnableTokenRevocation=true` beibehalten (bereits gesetzt).
- Public Client ohne Secret beibehalten.
- Nach der Änderung: Read-only `describe-user-pool-client` und echter
  E2E-Test mit Testkonto.
- Keine Änderung an Pool, Domain, Callback-URLs oder RIS ohne separate Freigabe.

**Es wurde keine AWS-Konfiguration geändert.**

## 7. Hard-Stop-Begründung

Der Task verlangt den Stopp vor der Implementierung, wenn die vorhandene
Cognito-Konfiguration den sicheren direkten Login nicht unterstützt. Das ist
hier der Fall:

1. `ALLOW_USER_SRP_AUTH`, `ALLOW_USER_PASSWORD_AUTH` und `ALLOW_USER_AUTH` sind
   nicht nachgewiesen; `ExplicitAuthFlows` ist nicht gesetzt.
2. Eine Änderung der Cognito-Konfiguration ist erforderlich.
3. Die sichere Tokenverwaltung für einen direkten Flow ist nicht entschieden
   und ohne Zusatzbibliothek bzw. BFF nicht nachgewiesen.
4. MFA-, New-Password- und Passwortzurücksetzungs-Verhalten ist nicht
   verifiziert.
5. Eine neue Abhängigkeit wäre nach `AGENTS.md` freigabepflichtig.

Deshalb wurden **keine** Änderungen an `LoginForm`, `authFlow`, `oidcConfig`,
`AuthCallback`, `Profile`, `Navbar`, `App` oder den Auth-Tests vorgenommen.
Gastmodus, Apify, Redis, Budgets, Cookie-Freiheit, CV/ATS und 10/2/5 bleiben
unverändert.

## 8. Testnachweise (Baseline, keine neue Implementierung)

| Prüfung | Ergebnis |
|---|---|
| Auth-Tests (`authFlow`, `oidcConfig`, `LoginForm`, `AuthRoutes`, `ProfileRoute`) | PASS — 22 Tests |
| `npm test -- --run` | PASS — 1031 passed, 5 skipped |
| `npx tsc --noEmit -p tsconfig.app.json` | PASS |
| `npm run build` | PASS |
| `git diff --check` | PASS |
| Same-Origin-Login-Test | **nicht ausgeführt** — keine Implementierung |
| MFA-/Passwort-Reset-Test | **nicht ausgeführt** — keine Implementierung |
| AWS-Live-Verifikation | **NOT VERIFIED** |
| Vercel-Deployment | keines |

## 9. Offene Freigaben

1. AWS-App-Client um `ALLOW_USER_SRP_AUTH` + `ALLOW_REFRESH_TOKEN_AUTH`
   erweitern (oder begründete Alternative).
2. Entscheidung zur SRP-Bibliothek bzw. neuen Abhängigkeit.
3. Entscheidung zur Token-/Session-Speicherung (sessionStorage vs. BFF/HttpOnly).
4. MFA-, New-Password- und Passwortzurücksetzungs-UX.
5. Implementierungsfreigabe.
6. Kein Deployment in diesem Task.

## 10. Git

- Keine Codeänderung.
- Dokumentations-Commit: `e31a6da`
- Remote-Synchronität: `origin/main` = `0 0` nach Push
- Kein AWS-/Vercel-Deployment.
