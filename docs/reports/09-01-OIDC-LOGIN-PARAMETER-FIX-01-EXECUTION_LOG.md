# JOBMATCHER-OIDC-LOGIN-PARAMETER-FIX-01 - Execution Log

Datum: 2026-10-23
Branch: main
Autor: OpenCode

## Problem (Production)
Cognito /login lieferte HTTP 400. Firefox zeigte doppelte client_id, logout_uri beim Login, sowie redirect_uri/response_type/scope/PKCE. Verdacht: Logout-spezifische extraQueryParams in globaler OIDC-Konfiguration beeinflussten den Login-Request.

## Analyse
- `src/lib/oidcConfig.ts` enthielt `extraQueryParams { client_id, logout_uri }` und `post_logout_redirect_uri` — wurde von react-oidc-context/oidc-client-ts an Requests angehängt und kontaminierte den Login-Flow (doppelte Parameter).
- `signIn` nutzte `auth.signinRedirect()` ohne Kontrolle.
- `signOut` setzte direkt Parameter; nötig sauber getrennt.
- Direkter Test: Login-URL ohne Logout-Parameter → HTTP 200. Shape mit doppeltem client_id + logout_uri → HTTP 400.

## Fix (minimal)
- `src/lib/oidcConfig.ts`: Entfernt `extraQueryParams`, entfernt `post_logout_redirect_uri` aus Konfig. Nur Login-Parameter (authority, client_id, redirect_uri, response_type, scope). `POST_LOGOUT_REDIRECT_URI` exportiert separat für Logout.
- `src/lib/authFlow.ts` (neu): `signIn` ohne extraQueryParams, `signOut` nur mit `client_id` + `logout_uri`. Logout-Parameter strikt getrennt.
- `src/components/LoginForm.tsx`: nutzt `signIn(auth)`.
- `src/components/Navbar.tsx`, `src/components/Profile.tsx`: nutzen `signOut(auth)`.
- Keine AWS-Änderungen, keine neuen Libraries.

## Regressionstests (neu)
- `src/lib/oidcConfig.test.ts`: Verhindert extraQueryParams/logout_uri/post_logout_redirect_uri/id_token_hint; client_id genau einmal; Login-Parameter unverändert; Logout-Ziel getrennt.
- `src/lib/authFlow.test.ts`: Login ohne extraQueryParams; Logout nur client_id+logout_uri; kein post_logout_redirect_uri/id_token_hint; kein doppelter client_id.

## Verifikation (lokal + HTTP)
- Preview-Test: Login über Button → Cognito /login mit genau `client_id` (1x), `redirect_uri`, `response_type=code`, `scope`, PKCE (`code_challenge`+`S256`), kein `logout_uri`. HTTP 200.
- Logout mit eingeloggtem Session-Simuliertest: Request an `/logout` mit `id_token_hint` + `client_id` + `logout_uri` → 302 zu `https://www.mays-job-matcher.app/`.
- Cognito-Regression: Doppelter client_id + logout_uri am /login → HTTP 400 (bestätigt Ursache).
- Build: `npm run build` erfolgreich. `node --check api/**/*.mjs` erfolgreich. `npx vitest run`: 71 passed | 3 skipped (74 files), 814 passed | 5 skipped (819 tests).

## Geänderte Dateien
- `src/lib/oidcConfig.ts` (bereinigt)
- `src/lib/authFlow.ts` (neu)
- `src/lib/oidcConfig.test.ts` (neu)
- `src/lib/authFlow.test.ts` (neu)
- `src/components/LoginForm.tsx` (nutzt signIn)
- `src/components/Navbar.tsx` (nutzt signOut)
- `src/components/Profile.tsx` (nutzt signOut)

## Deployment
- Kein Production-Deployment ohne Freigabe (wie gefordert).
