# JOBMATCHER-COGNITO-HOSTED-UI-RECOVERY-05 — Hosted UI Recovery

## Status
**YELLOW** — Lokale Konfiguration konsistent, Produktiv-E2E NOT VERIFIED

## Datum/Uhrzeit
2026-10-22 21:00 Europe/Berlin

## Git
- Branch: `main`
- HEAD: aktuell
- Working Tree: clean nach Commit

## Kontext
Vorheriges Gate JOBMATCHER-RIS-COGNITO-INTEGRATION-04 BLOCKED wegen geforderter Custom SignUp API. Entscheidung: Cognito Hosted UI bleibt bevorzugter Weg. Keine neue Auth Architektur, keine AWS SDK Dependency.

## 1. Frontend Konfiguration geprüft

### `src/lib/oidcConfig.ts`
```ts
const REGION = import.meta.env.VITE_AWS_REGION || 'eu-central-1';
const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID || 'eu-central-1_ojbmoiYGM';
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || '7ldhihlpdgsgcl3puvu4oi7ksv';

export const oidcConfig = {
  authority: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`,
  client_id: CLIENT_ID,
  redirect_uri: 'https://www.mays-job-matcher.app/auth/callback',
  post_logout_redirect_uri: 'https://www.mays-job-matcher.app/',
  response_type: 'code',
  scope: 'openid email profile',
};
```
- Fallback Client ID auf `7ldhihlpdgsgcl3puvu4oi7ksv` aktualisiert
- Env Vars `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_AWS_REGION` werden verwendet
- Keine Hardcodierung alter Client ID mehr

### Vite Umgebungsvariablen
- `VITE_COGNITO_USER_POOL_ID` → `eu-central-1_ojbmoiYGM`
- `VITE_COGNITO_CLIENT_ID` → `7ldhihlpdgsgcl3puvu4oi7ksv`
- `VITE_AWS_REGION` → `eu-central-1`
- Alle drei sind Public VITE Vars, damit im Browser Build enthalten. Client ID und Pool ID sind nicht geheim.

### Vercel Rewrites
`vercel.json`:
- `/auth/callback` → `/index.html`
- `/registrieren` → `/index.html`
- `/anmelden` → `/index.html`
- `/profil` → `/index.html`

SPA Fallback korrekt, OAuth Anfragen werden nicht abgefangen.

## 2. Registrierung über Hosted UI

`src/components/RegisterForm.tsx`
```ts
auth.signinRedirect({ extraQueryParams: { screen_hint: "signup" } });
```
- Nutzt Cognito Hosted UI Sign-up Flow
- Kein lokales Formular, kein Passwort Handling im Frontend
- Entspricht Architekturentscheidung „Hosted UI bleibt“

`src/components/LoginForm.tsx`
```ts
auth.signinRedirect();
```
Standard Login Flow

## 3. Cognito Domain
- RIS Übergabe Domain: `https://auth.mays-job-matcher.app`
- OIDC Authority bleibt `https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ojbmoiYGM`
- Custom Domain wird von Cognito für Hosted UI verwendet, OIDC Discovery funktioniert mit cognito-idp
- Keine Anpassung im `oidcConfig` erforderlich

## 4. OAuth Konfiguration
Vorgaben:
- Authorization Code + PKCE → `response_type: 'code'`, `react-oidc-context` nutzt PKCE automatisch
- Scopes: `openid email profile`
- Callback: `https://www.mays-job-matcher.app/auth/callback`
- Post Logout: `https://www.mays-job-matcher.app/`

Verifizierung ohne AWS Read-Only:
- **NOT VERIFIED** – User Pool, App Client, OAuth Grants, Callback URLs, Self Sign-up können nicht ohne AWS Zugriff geprüft werden
- Keine AWS Mutation vorgenommen

## 5. Login / Callback / Session / Logout
- `AuthCallback.tsx` zeigt Lade-Status und benutzerfreundliche Fehleranzeige
- `Navbar.tsx` zeigt Login/Logout je nach `auth.isAuthenticated`
- `signoutRedirect` mit korrektem `post_logout_redirect_uri`
- Session Restore über `react-oidc-context`
- Anonyme Jobsuche bleibt funktionsfähig

## 6. Tests
- `npm test` → 794 passed | 5 skipped
- `npm run build` → erfolgreich
- Keine Regressionen

## 7. Offene Blocker
- **Produktiver E2E Login / Registrierung NOT VERIFIED** – Kein Browserzugang / keine Testbenutzer Credentials
- AWS Read-Only Verifizierung von User Pool, App Client, OAuth Einstellungen, Domain Zuordnung, Self Sign-up nicht möglich
- Falls Client `7ldhihlpdgsgcl3puvu4oi7ksv` nicht mit User Pool `eu-central-1_ojbmoiYGM` verknüpft ist oder Callback URLs fehlen, würde Cognito mit `invalid_client` / `invalid_redirect_uri` antworten → würde in AuthCallback als Fehler angezeigt

## 8. Erforderliche Vercel Änderungen
- VITE Vars bereits gesetzt laut Vorgabe
- Keine weiteren Änderungen nötig

## Abschluss
- Lokale Konfiguration konsistent mit RIS Übergabe
- Hosted UI Flow beibehalten
- Fallback Client ID aktualisiert, kein Risiko alter Client ID im Build
- Produktiver Login/Registrierung bleibt **NOT VERIFIED** bis Live-Test

**Klassifikation: YELLOW** – Implementierung bereit, E2E nicht nachgewiesen.
