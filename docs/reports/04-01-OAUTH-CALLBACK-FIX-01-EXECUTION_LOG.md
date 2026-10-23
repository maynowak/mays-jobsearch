# JOBMATCHER-OAUTH-CALLBACK-FIX-01 — Execution Log

## Status
**YELLOW** — Callback/Logout-URLs im Cognito App Client korrigiert und verifiziert.
Vorgelagerter Blocker bleibt: Managed-Login-Branding fehlt → Login-Seite meldet
"Login pages unavailable". Kein Frontend-/Code-Change nötig.

## Datum/Uhrzeit
2026-10-23 16:08 Europe/Berlin

## Git
- Branch: `main`
- HEAD vor Task: `8a7f1b0`
- Working Tree: nur untracked Bestandsdateien (unangetastet)

## Scope
- User Pool: `eu-central-1_ZURSMpD2O` (Account `240571105849`, Region `eu-central-1`)
- App Client: `5hb3f6dj5ialg77jf4blur9g6g`
- Keine User-Pool-Änderung, keine Domainänderung, keine neuen AWS-Ressourcen,
  keine RIS-Änderung, kein Deployment.

## 1. Callback-Verarbeitung in React (verifiziert)
- `vercel.json` Rewrite: `/auth/callback` → `/index.html` (SPA-Route vorhanden)
- `src/App.tsx:91` erkennt `window.location.pathname === "/auth/callback"`
- `src/App.tsx:2421-2422` rendert `<AuthCallback />`
- `src/components/AuthCallback.tsx` liest `auth.isLoading` / `auth.error` /
  `auth.isAuthenticated`, redirectet bei Erfolg nach `/profil`
- Code-Exchange/State/PKCE übernimmt `react-oidc-context` (Provider in `src/main.tsx`)
- Ergebnis: **/auth/callback verarbeitet OIDC-Callbacks tatsächlich**

## 2. Effektive Production redirect_uri (verifiziert)
Vercel Production Env (read-only gepullt, keine Secrets ausgegeben):

| Variable | Wert |
| --- | --- |
| `VITE_AWS_REGION` | `eu-central-1` |
| `VITE_COGNITO_USER_POOL_ID` | `eu-central-1_ZURSMpD2O` |
| `VITE_COGNITO_CLIENT_ID` | `5hb3f6dj5ialg77jf4blur9g6g` |
| `VITE_REDIRECT_URI` | `https://www.mays-job-matcher.app/auth/callback` |
| `VITE_POST_LOGOUT_REDIRECT_URI` | `https://www.mays-job-matcher.app` (ohne Trailing Slash) |

- Callback stimmt exakt mit der gewünschten Production-URL überein → Voraussetzung erfüllt.
- Logout-Wert weicht formal ab (ohne `/`). Cognito vergleicht `logout_uri` exakt,
  daher wurde zusätzlich die Variante ohne Trailing Slash registriert (siehe 4).

## 3. OIDC-Discovery (Beweis für Hosted-UI-Domain)
`https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O/.well-known/openid-configuration`:

```
authorization_endpoint: https://auth.mays-job-matcher.app/oauth2/authorize
token_endpoint:         https://auth.mays-job-matcher.app/oauth2/token
userinfo_endpoint:      https://auth.mays-job-matcher.app/oauth2/userInfo
end_session_endpoint:   https://auth.mays-job-matcher.app/logout
issuer:                 https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O
```

Das Frontend hardcodet die Custom Domain nicht — sie kommt aus der Discovery.
Damit ist erklärt, warum der Browser zu `auth.mays-job-matcher.app` navigiert.

## 4. AWS-Änderung (freigegebener Scope)
`update-user-pool-client` auf `5hb3f6dj5ialg77jf4blur9g6g` — nur Callback- und
Logout-URLs ergänzt, bestehende Einträge erhalten, OAuth-Flows/-Scopes unverändert:

```json
{
  "CallbackURLs": [
    "http://localhost:5173/auth/callback",
    "https://mays-job-matcher.vercel.app/auth/callback",
    "https://www.mays-job-matcher.app/auth/callback"
  ],
  "LogoutURLs": [
    "http://localhost:5173/",
    "https://mays-job-matcher.vercel.app/",
    "https://www.mays-job-matcher.app/",
    "https://www.mays-job-matcher.app"
  ],
  "AllowedOAuthFlows": ["code"],
  "AllowedOAuthScopes": ["email", "openid", "profile"],
  "AllowedOAuthFlowsUserPoolClient": true,
  "EnableTokenRevocation": true,
  "HasClientSecret": false
}
```

- Public Client ohne Secret geblieben (keine unbeabsichtigte Secret-Erzeugung).
- `ExplicitAuthFlows` war vorher nicht gesetzt und ist unverändert nicht gesetzt.

## 5. Verification (read-only, ohne Zugangsdaten)
Alle Tests gegen die OAuth-Endpunkte mit PKCE (`S256`) und `redirect_uri=https://www.mays-job-matcher.app/auth/callback`:

| Test | Ergebnis |
| --- | --- |
| Custom Domain `GET /oauth2/authorize` (registrierte Callback-URL) | `302` → `/login`, **kein** `redirect_mismatch` |
| Prefix Domain `GET /oauth2/authorize` (registrierte Callback-URL) | `302` → `/login`, **kein** `redirect_mismatch` |
| Negativkontrolle mit `https://evil.example.com/cb` | `302` → `/error?error=redirect_mismatch` (**Validierung aktiv**) |
| Custom Domain `GET /logout?logout_uri=…app/` | `302` → `https://www.mays-job-matcher.app/` |
| Custom Domain `GET /logout?logout_uri=…app` (ohne Slash) | `302` → `https://www.mays-job-matcher.app` |
| DNS `auth.mays-job-matcher.app` (autoritativ `ns.checkdomain.de`) | CNAME → `d2oa751y8iy3p0.cloudfront.net` (= Cognito Custom-Domain-CloudFront) |
| Custom Domain `GET /` | `404` (erwartet, kein Root-Pfad in Cognito) |
| Custom Domain `GET /login` (voller Flow mit Cookies) | **`403` — "Login pages unavailable"** |

## 6. Verbleibender Blocker (nicht Teil des freigegebenen Scopes)
**Managed-Login-Branding fehlt:**

```
aws cognito-idp describe-managed-login-branding-by-client \
  --user-pool-id eu-central-1_ZURSMpD2O --client-id 5hb3f6dj5ialg77jf4blur9g6g
→ ResourceNotFoundException: ManagedLoginBranding ... does not exist
```

`describe-user-pool-domain --domain auth.mays-job-matcher.app` zeigt
`"Status": "ACTIVE"` und `"ManagedLoginVersion": 2`. Managed Login v2 benötigt
eine Branding-Konfiguration; ohne sie rendert `/login` die Seite
"Login pages unavailable. Please contact an administrator."

→ **Keine AWS-Änderung durchgeführt** (wäre neue Konfiguration/neue Ressource,
nicht durch diesen Task freigegeben). Login ist bis dahin nicht möglich,
obwohl `redirect_mismatch` behoben ist.

## IST / SOLL / EVIDENCE / ABWEICHUNG

| IST-WERT | SOLL-WERT | EVIDENCE | ABWEICHUNG |
| --- | --- | --- | --- |
| CallbackURLs ohne `www.mays-job-matcher.app/auth/callback` | URL registriert | `describe-user-pool-client` vor/nach Update | **BEHOBEN** |
| LogoutURLs ohne `www.mays-job-matcher.app/` | URL registriert | `describe-user-pool-client` vor/nach Update | **BEHOBEN** |
| LogoutURL ohne Variante ohne Slash (Vercel-Env-Wert) | beide Varianten akzeptiert | `GET /logout` mit/ohne Slash → `302` auf Ziel | **BEHOBEN** |
| `/auth/callback` verarbeitet OIDC-Code | Code-Exchange + Redirect `/profil` | `vercel.json`, `App.tsx:91`, `App.tsx:2421`, `AuthCallback.tsx` | keine |
| Production `VITE_REDIRECT_URI` | `https://www.mays-job-matcher.app/auth/callback` | Vercel Production Env | keine |
| Production `VITE_POST_LOGOUT_REDIRECT_URI` | `https://www.mays-job-matcher.app/` | Vercel Production Env = ohne Slash | **formal abweichend**, durch zusätzliche Logout-URL abgedeckt |
| DNS `auth.mays-job-matcher.app` | CNAME auf Cognito-CloudFront | `dig` autoritativ → `d2oa751y8iy3p0.cloudfront.net` | keine (inzwischen vorhanden) |
| `/login` rendert Anmeldeformular | Managed Login mit Branding | `403` + "Login pages unavailable"; Branding `ResourceNotFoundException` | **OFFEN — Blocker** |
| Pool/Kunde/Flows | unverändert | `describe-user-pool`, `describe-user-pool-client` | keine |

## Klassifikation
- Callback-/Logout-Konfiguration: **GREEN** (verifiziert, `redirect_mismatch` weg)
- DNS: **GREEN** (CNAME vorhanden, autoritativ bestätigt)
- Login-Rendering: **RED** (Managed-Login-Branding fehlt) — außerhalb freigegebenem Scope
- Code/Frontend: **GREEN**, keine Änderung erforderlich

## Risiken
- Ohne Branding ist der Login weiterhin nicht nutzbar; Fehlermeldung wirkt wie
  ein Infrastrukturfehler, ist aber eine fehlende Managed-Login-Konfiguration.
- Logout-Env-Wert ohne Trailing Slash bleibt uneinheitlich; aktuell funktional,
  sollte bei nächster Env-Pflege normalisiert werden (`.../`).

## Empfohlene nächste Aktionen (Freigabe erforderlich)
1. Branding für Managed Login am Jobsearch-Client anlegen
   (`create-managed-login-branding`, Cognito-Default-Assets, keine RIS-Berührung).
2. Danach echter E2E-Test mit dedizierter Testadresse (SignUp → Confirm → Login → `/profil`).
3. Optional: `VITE_POST_LOGOUT_REDIRECT_URI` auf `https://www.mays-job-matcher.app/` normalisieren,
   dann die slash-lose Logout-URL wieder entfernen.
4. Passwort-Incident separat bewerten: React-Registrierung maskiert korrekt
   (`type="password"`, Toggle nur nach Klick, `autoComplete="new-password"`,
   `showPassword=false` initial, kein CSS-Override). Sichtbarkeit beim Einfügen
   betrifft nur die Cognito-Managed-Login-Seite, nicht das React-Formular.

## Git-Status / Dateien
- Keine Quellcode-Änderung.
- Neu: dieser Execution Log.
- Untracked Bestandsdateien unverändert.

## Resume Point
- Callback-Fix abgeschlossen und verifiziert.
- Nächster Schritt benötigt Freigabe: Managed-Login-Branding.
