# JOBMATCHER-RIS-AUTH-01 — EXECUTION LOG

- **Status:** HARD STOP
- **Datum/Uhrzeit:** 2026-10-09
- **GATE:** JOBMATCHER-RIS-AUTH-01
- **Branch / HEAD:** main / 3f7435f

## Audit Scope
Echte Benutzeranmeldung über Mays-RIS/Cognito Identity-Plattform. OAuth2 Authorization Code + PKCE. Wiederverwendung bestehender RIS Cognito User Pool.

## Completed sections
- Quell-Repos identifiziert
- RIS Architektur-Dokumente gelesen:
  * AUTHENTICATION.md
  * AUTH_FLOW.md
  * RIS_AUTH_CONTRACT.md
  * PLATFORM_FRONTEND_INTEGRATION.md
  * GATE-13A-GOOGLE-IDENTITY-FEDERATION-FOUNDATION-01.md
- Terraform Cognito Modul geprüft: /Mays-Recruiting-Intelligent-System/terraform/modules/cognito/main.tf
- Job-Matcher UI geprüft: LoginForm, RegisterForm, App-Routing

## Findings
### RIS
- AWS Account 240571105849, Region eu-central-1
- Cognito User Pool existiert, Domain geplant auth.mays-job-matcher.app
- Aktueller Client: explicit_auth_flows = ALLOW_USER_PASSWORD_AUTH, ALLOW_REFRESH_TOKEN_AUTH
- OAuth Flows aktuell DEAKTIVIERT (abhängig von var.google_client_id != "")
- allowed_oauth_flows_user_pool_client, callback_urls etc. nur bei google_client_id gesetzt
- Terraform zeigt: OAuth noch nicht für JobMatcher aktiviert. Kein öffentlicher App-Client ohne Secret für Authorization Code + PKCE konfiguriert.
- GET /me, GET /me/profile Endpunkte definiert per Contract, JWT Authorizer aktiv.

### Job-Matcher
- LoginForm & RegisterForm existieren als UI-Only Placeholder. Kein Backend, kein Cognito, keine Session.
- Routing via window.location.pathname, Routen /anmelden, /registrieren vorhanden.
- Keine Auth-Hilfsfunktionen, keine Session, keine Token-Refresh Logik.
- Vercel Rewrites geprüft: vercel.json enthält Rewrites für /registrieren, /anmelden, /search, keine /auth/callback Rewrite.
- Keine Auth/Session Helper in src/lib / src/hooks.
- Kein Cognito/OAuth Code im Frontend. Login/Register bewusst nicht verdrahtet per REGISTRATION-UI-01.
- Keine Secrets im Repo.

## Evidence
- RIS docs gelesen
- Terraform cognito/main.tf Zeilen 48-70
- src/components/LoginForm.tsx Zeilen 12-16: UI-only Hinweis
- src/components/RegisterForm.tsx Zeilen 16-19: bewusst nicht verdrahtet
- src/App.tsx Zeilen 65-72 Route-Erkennung

## Classification
- DISCOVERY: YELLOW
- ARCHITECT: YELLOW
- IMPLEMENTATION: HARD STOP
- Blocker: Cognito OAuth Flow nicht aktiviert für JobMatcher. Kein App-Client für PKCE konfiguriert. Callback URL https://www.mays-job-matcher.app/auth/callback nicht in Terraform hinterlegt.
- HARD STOP aktiv: KEIN AWS Apply, keine Terraform-Mutation ohne explizite Freigabe.

## Git status
- main 3f7435f, clean

## Files changed
- keine

## Open questions / Risks
- Benötigt Terraform Änderung im RIS Repo für OAuth Client, Callback URLs, PKCE.
- HARD STOP Regel: KEIN AWS Apply ohne Freigabe.
- Domain Callback muss exakt konfiguriert werden.
- Frontend Session Storage sicher?
- Token Refresh Implementierung.

## Architect Gap Analysis
Benötigte Cognito-Konfiguration für OAuth2 Authorization Code + PKCE:
- Neuer öffentlicher App-Client ohne Client Secret, `generate_secret = false`
- `allowed_oauth_flows_user_pool_client = true`
- `allowed_oauth_flows = ["code"]`
- `allowed_oauth_scopes = ["openid", "email", "profile"]`
- `callback_urls = ["https://www.mays-job-matcher.app/auth/callback"]`
- `logout_urls = ["https://www.mays-job-matcher.app/"]`
- `supported_identity_providers = ["COGNITO"]`
- PKCE wird von Cognito Hosted UI unterstützt, kein Client Secret nötig

Aktuelle Terraform: Kein solcher Client. OAuth-Felder sind nur an `var.google_client_id != ""` gekoppelt, Cognito Client nutzt `ALLOW_USER_PASSWORD_AUTH` + `ALLOW_REFRESH_TOKEN_AUTH`. Keine Callback URLs hinterlegt.

Frontend Gap:
- Keine `/auth/callback` Route in vercel.json und App
- Keine Auth-Helper, keine Token Speicherung, kein PKCE Flow
- Login/Register Forms UI-only

## Resume point
HARD STOP erreicht. Cognito OAuth-Konfiguration fehlt. Implementierung gesichert, Blocker exakt dokumentiert. Freigabeschritt vorbereitet:
1. Terraform Anpassung im RIS Repo für Public App Client mit PKCE + Callback URLs
2. AWS Apply Freigabe durch Auth-Team
3. Danach Frontend Implementierung Start.

Keine Frontend-Änderungen vor Cognito Freigabe. Kein Production Deploy.
