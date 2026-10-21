# Cognito Frontend Auth Notes – JOBMATCHER-COGNITO-FRONTEND-AUTH-03

## Overview
Frontend authentication uses AWS Cognito with Authorization Code Flow + PKCE via `react-oidc-context`.
No new auth libraries were introduced. Existing `src/lib/oidcConfig.ts` is the source of truth.

## Configuration
File: `src/lib/oidcConfig.ts`

```ts
export const oidcConfig = {
  authority: 'https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_IfucuxPC1',
  client_id: '24qns4st861fc72bk7cucjc375',
  redirect_uri: 'https://www.mays-job-matcher.app/auth/callback',
  post_logout_redirect_uri: 'https://www.mays-job-matcher.app/',
  response_type: 'code',
  scope: 'openid email profile',
};
```

* Authority: `https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_IfucuxPC1`
* Scopes: `openid email profile`
* Redirect URI: `https://www.mays-job-matcher.app/auth/callback`
* Post logout redirect: `https://www.mays-job-matcher.app/`

## Client IDs
* **Jobsearch frontend**: `24qns4st861fc72bk7cucjc375` – used in `oidcConfig.ts` and `AuthProvider`.
* **Human Login client for Mays-RIS**: `7ldhihlpdgsgcl3puvu4oi7ksv` – **do not use in frontend**. Reserved for Mays-RIS Human Login flows.

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
  * `RegisterForm.tsx` – `auth.signinRedirect({ extraQueryParams: { screen_hint: "signup" } })`.
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
