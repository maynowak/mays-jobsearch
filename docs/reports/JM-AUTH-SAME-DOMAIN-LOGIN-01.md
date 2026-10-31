# JM-AUTH-SAME-DOMAIN-LOGIN-01

**Art:** Auth-Architektur / Machbarkeitsprüfung
**Baseline:** `175d477`
**Status:** **BLOCKED — keine Implementierung**
**Grund:** `USER_SRP_AUTH` ist konfigurationsseitig per Default verfügbar, aber die sichere SRP-/Token-Implementierung erfordert freigabepflichtige Abhängigkeiten, eine Storage-Entscheidung und ein Testkonto; sie ist nicht nachgewiesen.
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

**Präzisierung nach AWS-Dokumentation:** Wenn `ExplicitAuthFlows` nicht gesetzt
ist, unterstützt der App Client standardmäßig
`ALLOW_REFRESH_TOKEN_AUTH`, `ALLOW_USER_SRP_AUTH` und `ALLOW_CUSTOM_AUTH`.
`USER_SRP_AUTH` ist damit der einzige direkte Login-Flow, der ohne Änderung der
Cognito-Konfiguration plausibel verfügbar ist. `ALLOW_USER_PASSWORD_AUTH` und
`ALLOW_USER_AUTH` sind **nicht** Default und nicht nachgewiesen.

Die frühere Formulierung, direkter Login sei generell unmöglich, ist damit zu
korrigieren: SRP ist konfigurationsseitig möglich, aber die sichere
Implementierung (SRP-Bibliothek, Tokenvalidierung, Storage) ist nicht
nachgewiesen.

Eine erneute Live-AWS-Abfrage wurde in diesem Task nicht durchgeführt.
Die Aussage stützt sich auf die letzte committete Read-only-Evidenz und die
AWS-Dokumentation; eine aktuelle Live-Verifikation ist **NOT VERIFIED**.

## 4. Bewertete Lösungswege

| Lösung | Same-Origin | Sicherheit | Status |
|---|---|---|---|
| OIDC Code + PKCE (aktuell) | nein, Redirect zu Cognito | validiert, etabliert | funktioniert, erfüllt Ziel nicht |
| `USER_SRP_AUTH` direkt | ja | Passwort verlässt Browser nicht im Klartext; SRP | **NICHT IMPLEMENTIERT** — Flow per Default verfügbar, aber SRP-/Validierungsabhängigkeit und Storage offen |
| `USER_PASSWORD_AUTH` direkt | ja | Passwort über TLS an Cognito; schwächer als SRP | **BLOCKED** — `ALLOW_USER_PASSWORD_AUTH` nicht default/ nicht nachgewiesen |
| `USER_AUTH` direkt | ja | abhängig von Challenge-Konfiguration | **BLOCKED** — `ALLOW_USER_AUTH` nicht default/ nicht nachgewiesen |
| Cognito Managed Login im iframe | optisch ja | externe Login-Seite, Framing-/CSP-Risiko | verworfen |
| Reverse-Proxy für Cognito | optisch ja | Cookie-/CSRF-/Origin-Komplexität | verworfen |
| BFF mit HttpOnly-Session | ja | stärkere Tokenlagerung | außerhalb Scope; neue Architektur |

### `USER_SRP_AUTH`

`ALLOW_USER_SRP_AUTH` ist bei nicht gesetztem `ExplicitAuthFlows` per Default
aktiv. Der Browser müsste dennoch SRP-Prove erzeugen. Das ist ohne getestete
Bibliothek (z. B. `amazon-cognito-identity-js`) oder eine eigene,
sicherheitskritische SRP-Implementierung nicht vertretbar. Eine neue
npm-Abhängigkeit ist nach `AGENTS.md` freigabepflichtig.

Zusätzlich müssen behandelt werden:

- `NEW_PASSWORD_REQUIRED`
- `SMS_MFA` / `SOFTWARE_TOKEN_MFA` / `MFA_SETUP`
- `PASSWORD_RESET_REQUIRED`
- Refresh über `REFRESH_TOKEN_AUTH`
- Logout/Revoke
- sichere Tokenvalidierung und -speicherung

### `USER_PASSWORD_AUTH`

Würde `ALLOW_USER_PASSWORD_AUTH` erfordern; dieser Flow ist nicht default und
nicht nachgewiesen. Der Aufruf wäre mit dem vorhandenen `cognitoRpc`-Muster per
`fetch()` möglich. Das Passwort würde aber direkt an Cognito übertragen; AWS
empfiehlt für Produktions-Clients SRP. Auch hier fehlen MFA-, New-Password-,
Refresh-, Validierungs- und Storage-Konzept.

### `USER_AUTH`

Würde `ALLOW_USER_AUTH` und eine definierte Challenge-/Factor-Konfiguration
erfordern; beides ist nicht default und nicht nachgewiesen. Dafür gibt es weder
Konfigurationsnachweis noch Implementierung. Nicht empfohlen, solange SRP nicht
sauber implementiert ist.

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

## 6. AWS-Konfiguration und Voraussetzungen

### Für `USER_SRP_AUTH`

Nach AWS-Dokumentation ist `ALLOW_USER_SRP_AUTH` bei nicht gesetztem
`ExplicitAuthFlows` standardmäßig aktiv. Für den SRP-Weg ist damit **keine
AWS-Konfigurationsänderung zwingend erforderlich**.

Optional – nur zur expliziten Dokumentation, nicht erforderlich:

```text
ExplicitAuthFlows = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
```

### Für `USER_PASSWORD_AUTH` / `USER_AUTH`

Diese Flows sind nicht Default. Sie würden eine Änderung erfordern:

```text
ExplicitAuthFlows = ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
```

oder:

```text
ExplicitAuthFlows = ["ALLOW_USER_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
```

Diese Varianten wurden nicht gewählt: `USER_PASSWORD_AUTH` ist sicherheitlich
schwächer als SRP; `USER_AUTH` ist nicht nachgewiesen und für den aktuellen
Bedarf nicht erforderlich.

### Weitere Voraussetzungen vor einer Implementierung

- Freigabe für eine SRP-Bibliothek (z. B. `amazon-cognito-identity-js`).
- Freigabe für eine JWT-Validierungsbibliothek (z. B. `aws-jwt-verify`) oder
  eine gleichwertige, nicht selbst entwickelte Validierung.
- Entscheidung zur Token-/Session-Speicherung.
- Testkonto für Login, falsches Passwort, MFA, New-Password und Passwortreset.
- `EnableTokenRevocation=true` beibehalten (bereits gesetzt).
- Public Client ohne Secret beibehalten.
- Keine Änderung an Pool, Domain, Callback-URLs oder RIS ohne separate Freigabe.

**Es wurde keine AWS-Konfiguration geändert.**

## 7. Hard-Stop-Begründung

Der Task verlangt den Stopp vor der Implementierung, wenn die sichere
Tokenverwaltung nicht nachgewiesen ist. Das ist hier der Fall:

1. `USER_SRP_AUTH` ist konfigurationsseitig per Default verfügbar; die
   Behauptung, der Flow sei generell gesperrt, war zu korrigieren.
2. Die sichere SRP-Implementierung erfordert eine neue, freigabepflichtige
   Bibliothek oder eine sicherheitskritische Eigenimplementierung.
3. Die sichere Tokenvalidierung erfordert eine geeignete Bibliothek; die
   aktuelle `oidc-client-ts`-Validierung validiert nur den Redirect-Callback,
   nicht einen selbst erzeugten `User` aus einem direkten Login.
4. Die Token-/Session-Speicherung ist offen. `amazon-cognito-identity-js` nutzt
   standardmäßig `localStorage`; das wäre schwächer als die aktuelle
   `sessionStorage`-Lösung. Eine HttpOnly-Cookie-Lösung würde einen BFF und
   eine neue Session-Architektur erfordern.
5. MFA-, `NEW_PASSWORD_REQUIRED`- und Passwortzurücksetzungs-Flows sind ohne
   Testkonto nicht verifiziert.
6. Eine neue Abhängigkeit ist nach `AGENTS.md` freigabepflichtig.

Deshalb wurden **keine** Änderungen an `LoginForm`, `authFlow`, `oidcConfig`,
`AuthCallback`, `Profile`, `Navbar`, `App` oder den Auth-Tests vorgenommen.
Gastmodus, Apify, Redis, Budgets, Cookie-Freiheit, CV/ATS und 10/2/5 bleiben
unverändert. Es wurde keine AWS-Konfiguration geändert.

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

1. Freigabe für eine SRP-Bibliothek (z. B. `amazon-cognito-identity-js`).
2. Freigabe für eine JWT-Validierungsbibliothek (z. B. `aws-jwt-verify`).
3. Entscheidung zur Token-/Session-Speicherung (sessionStorage vs. BFF/HttpOnly).
4. MFA-, New-Password- und Passwortzurücksetzungs-UX.
5. Testkonto für echte Login-/Fehler-/MFA-Tests.
6. Optional: `ExplicitAuthFlows` explizit dokumentieren; für SRP nicht
   zwingend erforderlich.
7. Implementierungsfreigabe.
8. Kein Deployment in diesem Task.

## 10. Git

- Keine Codeänderung.
- Erster Dokumentations-Commit: `e31a6da`
- Korrektur-Commit (SRP-Default/Präzisierung): `db610de`
- Remote-Synchronität: `origin/main` = `0 0` nach Push
- Kein AWS-/Vercel-Deployment.
