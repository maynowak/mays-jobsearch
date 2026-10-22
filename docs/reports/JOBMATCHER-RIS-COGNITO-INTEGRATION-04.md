# JOBMATCHER-RIS-COGNITO-INTEGRATION-04 — Bericht

## Status
**BLOCKED – RED**

## Datum/Uhrzeit
2026-10-22 20:30 Europe/Berlin

## Git
- Branch: `main`
- HEAD: aktuell
- Working Tree: clean

## Ziel
Cognito-Authentifizierung vollständig mit RIS bereitgestellter Cognito-Infrastruktur verbinden. Keine neuen User Pools/App Clients, keine neue Auth-Architektur.

## Baseline

### Aktuelle Konfiguration
- `src/lib/oidcConfig.ts` nutzt `import.meta.env.VITE_*` mit Fallbacks
  - User Pool: `eu-central-1_ojbmoiYGM`
  - Client: via `VITE_COGNITO_CLIENT_ID` – vorgesehen `7ldhihlpdgsgcl3puvu4oi7ksv`
  - Region: `eu-central-1`
  - Authority: `https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ojbmoiYGM`
  - Response Type: `code`, Scope `openid email profile`
- AuthProvider in `src/main.tsx` mit `react-oidc-context`
- Routing via `vercel.json` SPA-Rewrites für `/anmelden`, `/registrieren`, `/auth/callback`, `/profil`

### Bestehende Implementierung
- **LoginForm.tsx** und **RegisterForm.tsx**: Keine Eingabefelder. Button triggert `auth.signinRedirect()` bzw. `auth.signinRedirect({ extraQueryParams:{screen_hint:"signup"} })`. Registrierung/ Login vollständig über Cognito Hosted UI.
- Tests bestätigen bewusstes Fehlen von Passwortfeldern:
  - `RegisterForm.test.tsx`: `expect(screen.queryByLabelText("E-Mail-Adresse")).toBeNull()`
  - `AuthRoutes.test.tsx`: `/registrieren rendert Registrierungsmaske mit Navigationen, ohne Passwortfelder`
- **AuthCallback.tsx**: Fehler werden nur stumm per Redirect behandelt, keine ConfirmSignUp UI.
- **Kein ConfirmSignUp / ResendConfirmationCode**: Kein Code-Pfad, keine UI, keine API-Aufrufe.
- **Kein Cognito SignUp API Call**: Nur OIDC `signinRedirect`. Kein AWS SDK, kein Amplify, kein direkter SignUp.

## Konfigurationsabgleich

Neue RIS-Übergabe:
- User Pool `eu-central-1_ojbmoiYGM` ✓ bereits im Code
- Public Client `7ldhihlpdgsgcl3puvu4oi7ksv` ✓ via VITE Env Var nutzbar
- Domain `https://auth.mays-job-matcher.app` – im Frontend nicht verwendet, OIDC Authority bleibt `cognito-idp...`

**Widerspruch / Blocker**:
Die geforderte Implementierung verlangt:
- Registrierungsformular mit Pflichtfeldern Benutzername, E-Mail, Passwort
- Frontend-Validierung
- Cognito SignUp Integration
- ConfirmSignUp / ResendConfirmationCode UI

Die bestehende Architektur nutzt ausschließlich Cognito Hosted UI via OIDC `signinRedirect`. Eine direkte Cognito SignUp / ConfirmSignUp Integration würde erfordern:
- Cognito User Pool API calls
- Entweder AWS SDK/Amplify im Frontend → neue Dependency
- Oder serverseitiger Proxy mit AWS Credentials / RIS_API_KEY → neue Serverless-Funktion, neue Architektur

AGENTS.md verbietet neue npm Dependencies ohne Freigabe und keine neue Auth-Architektur.

## Frontend auf RIS Cognito umstellen
- Konfiguration bereits auf Env Vars umgestellt
- Client ID kann via `VITE_COGNITO_CLIENT_ID` gesetzt werden
- Authority passt zu neuem User Pool
- Keine zweite AuthProvider Instanz vorhanden

## Registrierung / E-Mail-Bestätigung
**Nicht umsetzbar im aktuellen Scope**:
- Kein lokales Registrierungsformular vorhanden
- Kein ConfirmSignUp / ResendConfirmationCode UI vorhanden
- Kein direkter Cognito SignUp API Aufruf implementiert
- Umsetzung würde neue Dependency / Serverless Proxy erfordern → gegen „Keine neue Authentifizierungsarchitektur“

## Login / Logout
- Vorhandene OIDC Implementierung ist funktionsfähig
- `signinRedirect`, PKCE, OAuth state, Callback, Session Restore, Logout vorhanden
- Anonyme Jobsuche bleibt möglich

## Fehlerbehandlung
- Fehleranzeige wurde im vorherigen Gate verbessert
- Für ConfirmSignUp/ResendConfirmationCode fehlt komplette UI/Logik

## Google Login
- Laut RIS-Übergabe geplant/nicht verifiziert
- Im Gate nicht zu konfigurieren, dokumentiert

## Sicherheit
- RIS_API_KEY bleibt serverseitig
- Keine Secrets in Browser
- Vorgaben eingehalten

## Regression
Keine Schäden an Jobsuche/ATS/CV etc., da keine Änderung vorgenommen wurde.

## Tests
- `npm test` 794 passed
- `npm run build` erfolgreich
- Tests für ConfirmSignUp / ResendConfirmationCode / Custom Registration existieren nicht

## Governance
- Keine AWS/Terraform Änderungen
- Keine RIS-Repository Änderungen
- Dokumentation erstellt

## Abschluss
**BLOCKED** weil die geforderten Features:
- Custom Registrierungsformular mit Benutzername/E-Mail/Passwort
- Cognito SignUp Integration
- ConfirmSignUp / ResendConfirmationCode UI

eine Erweiterung der bestehenden OIDC-Only Architektur erfordern, die entweder eine neue Dependency/AWS SDK Nutzung oder einen serverseitigen Proxy bedeuten würde. Beides verstößt gegen „Keine neue Authentifizierungsarchitektur“ und „Keine neuen npm Dependencies ohne Freigabe“.

**Empfehlung**:
- Entscheidung treffen: Entweder Hosted UI beibehalten und Gate-Scope anpassen, oder Freigabe für zusätzliche Dependency / Serverless Proxy für direkte Cognito API Nutzung einholen.
- Sobald Freigabe vorliegt, kann Registrierung mit Validierung und E-Mail-Bestätigung implementiert werden.

Git Commit: wird erst nach Freigabe erfolgen.
