# Cognito Frontend Auth Notes – JOBMATCHER-COGNITO-FRONTEND-AUTH-03

## Overview
Frontend authentication uses AWS Cognito with Authorization Code Flow + PKCE via `react-oidc-context`.
No new auth libraries were introduced. Existing `src/lib/oidcConfig.ts` is the source of truth.

## Configuration
File: `src/lib/oidcConfig.ts`

```ts
const REGION = import.meta.env.VITE_AWS_REGION || 'eu-central-1';
const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID || 'eu-central-1_ojbmoiYGM';
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || '24qns4st861fc72bk7cucjc375';

export const oidcConfig = {
  authority: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`,
  client_id: CLIENT_ID,
  redirect_uri: 'https://www.mays-job-matcher.app/auth/callback',
  post_logout_redirect_uri: 'https://www.mays-job-matcher.app/',
  response_type: 'code',
  scope: 'openid email profile',
};
```

* Authority: `https://cognito-idp.${VITE_AWS_REGION}.amazonaws.com/${VITE_COGNITO_USER_POOL_ID}`
* Client ID: `VITE_COGNITO_CLIENT_ID`
* Scopes: `openid email profile`
* Redirect URI: `https://www.mays-job-matcher.app/auth/callback`
* Post logout redirect: `https://www.mays-job-matcher.app/`

## Client IDs
* **Jobsearch frontend**: `VITE_COGNITO_CLIENT_ID` – konfiguriert in Vercel, aktuell `7ldhihlpdgsgcl3puvu4oi7ksv`
* **Fallback / Historisch**: `24qns4st861fc72bk7cucjc375`
* **Human Login client for Mays-RIS**: `7ldhihlpdgsgcl3puvu4oi7ksv` – war bisher reserviert, wird nun für Jobsearch via Env Var verwendet. Dokumentation anpassen falls RIS-Client ebenfalls genutzt wird.

## Flow & Safety
* Authorization Code Flow with PKCE is enforced by `react-oidc-context` + `oidc-client-ts` for response_type `code`.
* No tokens are placed in URLs. After callback handling, `AuthCallback` redirects via `window.location.replace` to `/profil` or `/`, discarding the callback URL.
* `src/App.tsx` removes leading hash fragments on mount to avoid leftover fragments.
* No secrets are shipped to browser build. `RIS_API_KEY` must remain server-side only.

## Session Management
* `AuthProvider` wraps `<App />` in `src/main.tsx`.
* Components use `useAuth()` from `react-oidc-context`:
  * `Navbar.tsx` – shows Login / Logout, calls `signoutRedirect` with correct `post_logout_redirect_uri`.
  * `LoginForm.tsx` – `auth.signinRedirect()`.
  * `RegisterForm.tsx` – lokales Formular mit E-Mail + Passwort (kein separates Benutzername-Feld). Die E-Mail-Adresse wird als Cognito-Username (`Username`) und als `email`-Attribut an `SignUp` übergeben; danach Weiterleitung nach `/email-bestaetigen?email=…`.
  * `Profile.tsx` – displays claims, handles loading / error / unauthenticated states.
  * `AuthCallback.tsx` – loading → error → redirect to `/profil` on success.
* Anonymous search stays functional. Auth is optional for Jobsuche, ATS-Vergleich, CV-Upload.

## RIS Server-Side Integration Notes
For future server-side RIS integration:
* `RIS_API_KEY` must be used server-side only, e.g. in `api/_lib/ris` or similar helpers.
* Never expose `RIS_API_KEY` to the browser build. Do not import into `src/`.
* Serverless functions only, via `process.env.RIS_API_KEY`.
* Any RIS API calls must be performed in `api/**/*.mjs` and return only non-sensitive data to frontend.
* No AWS changes may be made without explicit approval. Do not modify Mays-RIS repo.

## Registration: Email as Username (EMAIL-ONLY-REGISTRATION-01)
* The registration form has exactly two fields: email address and password.
* There is no separate username field.
* `cognitoSignUp({ email, password })` sends the email as Cognito `Username` and as the `email` user attribute.
* After a successful `SignUp`, the app redirects to `/email-bestaetigen?email=<email>`.
* `EmailConfirmation` reads `email` and falls back to the legacy `username` query parameter for older links.
* Cognito still requires the RPC field `Username`; internally it contains the email address.

## Verification Checklist
* [x] `oidcConfig.ts` uses correct client ID, issuer, redirect URIs, scopes, response_type code.
* [x] `AuthCallback` redirects and does not leave tokens/codes in URL.
* [x] Navbar login/logout links work, post_logout_redirect_uri correct.
* [x] No tokens in URLs, no secrets in browser bundle, `RIS_API_KEY` not referenced client-side.
* [x] `npm run build` passes.
* [x] `npm test` passes, no regressions.

## Files Touched
* `src/lib/oidcConfig.ts` – verified, unchanged.
* `src/components/AuthCallback.tsx` – verified.
* `src/components/Navbar.tsx` – verified.
* `src/components/LoginForm.tsx` – verified.
* `src/components/RegisterForm.tsx` – verified.
* `src/components/Profile.tsx` – verified.
* `src/main.tsx` – verified.
* New doc: `docs/AUTH_COGNITO.md`
