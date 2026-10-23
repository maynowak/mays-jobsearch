# JOBMATCHER-LOGOUT-FIX-02 - Execution Log

Datum: 2026-10-23
Branch: main
Autor: OpenCode

## Ziel
Firefox-HAR beweist: GET /logout mit `id_token_hint`, `post_logout_redirect_uri`, `logout_uri` → 302 zu `/login` → HTTP 400. Cognito-Logout muss direkt zur Jobsearch-Startseite zurückführen.

## Diagnose
- Direkter Test: `logout?client_id=...&logout_uri=https://www.mays-job-matcher.app/` → 302 zu `https://www.mays-job-matcher.app/` (OK)
- Mit nur `post_logout_redirect_uri` → 302 zu Cognito Login
- Kombination `client_id + logout_uri` führt korrekt zur App
- Anwesenheit von `id_token_hint` + widersprüchlichen Parametern kann zu unerwünschtem Verhalten führen
- oidc-client-ts fügt bei signoutRedirect je nach Konfiguration `post_logout_redirect_uri` und ggf. `id_token_hint` hinzu

## Fix (minimal)
- `src/lib/oidcConfig.ts`: `post_logout_redirect_uri` auf `undefined` gesetzt, `extraQueryParams` setzt nur `client_id` und `logout_uri` (Startseite). Kein Widerspruch zwischen Parametern.
- `src/components/Navbar.tsx` und `src/components/Profile.tsx`: `signoutRedirect` nutzt nur `extraQueryParams` mit `client_id` und `logout_uri`. Entfernt `post_logout_redirect_uri` aus Aufrufen.
- Keine AWS-Konfiguration verändert.

## HTTP-Evidence (Cognito direkt)
- `https://auth.mays-job-matcher.app/logout?client_id=5hb3f6dj5ialg77jf4blur9g6g&logout_uri=https%3A%2F%2Fwww.mays-job-matcher.app%2F` → HTTP/2 302, Location: `https://www.mays-job-matcher.app/` (ohne Redirect zu /login)
- Kombination ohne widersprüchliche Parameter führt direkt zur Startseite

## Tests / Build
- `npm run build` erfolgreich (tsc + vite)
- `node --check api/**/*.mjs` erfolgreich
- `npx vitest run` erfolgreich: 69 passed | 3 skipped (72), 807 passed | 5 skipped (812)

## Geänderte Dateien
- `src/lib/oidcConfig.ts`
- `src/components/Navbar.tsx`
- `src/components/Profile.tsx`

## Deployment
- Commit + Push auf `main` (folgt). Produktion erst nach expliziter Freigabe via `vercel --prod --scope maymilly`.
