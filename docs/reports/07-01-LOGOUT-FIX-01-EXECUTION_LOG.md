# JOBMATCHER-LOGOUT-FIX-01 - Execution Log

Datum: 2026-10-23
Branch: main
Autor: OpenCode

## Ziel
Nach erfolgreichem Cognito-Login funktioniert der Logout-Button nicht. Firefox zeigt `auth.mays-job-matcher.app` HTTP 400 Bad Request. Logout muss die Cognito-Session beenden und zur Production-Startseite `https://www.mays-job-matcher.app/` zurückleiten.

## Diagnose (Phase 1)

### Cognito-Konfiguration (AWS)
- User Pool: `eu-central-1_ZURSMpD2O`
- App Client: `5hb3f6dj5ialg77jf4blur9g6g`
- LogoutURLs (beschrieben): `http://localhost:5173/`, `https://mays-job-matcher.vercel.app/`, `https://www.mays-job-matcher.app`, `https://www.mays-job-matcher.app/`
- OIDC Discovery `end_session_endpoint`: `https://auth.mays-job-matcher.app/logout`

### Verhaltensprüfung direkt gegen Cognito
- `logout?client_id=...&logout_uri=https://www.mays-job-matcher.app/` → 302 nach `https://www.mays-job-matcher.app/` (OK)
- `logout?client_id=...&post_logout_redirect_uri=https://www.mays-job-matcher.app/` → 302 nach `auth.mays-job-matcher.app/login?...` (zeigt Login, kein direkter Redirect zur App)
- `logout?client_id=...&post_logout_redirect_uri=https://www.mays-job-matcher.app/&logout_uri=https://www.mays-job-matcher.app/` → 302 nach `https://www.mays-job-matcher.app/` (OK)

### react-oidc-context / oidc-client-ts
- `signoutRedirect()` nutzt `post_logout_redirect_uri` aus Settings/Args und baut Request an `end_session_endpoint` (logout).
- Cognito benötigt für korrekten Redirect zur App entweder `logout_uri` (und/oder korrekte Kombination) passend zu konfigurierten LogoutURLs. Nur `post_logout_redirect_uri` reicht im getesteten Fall nicht für den gewünschten Flow.

### Ursache (belegt)
- Der Aufruf über `signoutRedirect({ post_logout_redirect_uri: "..." })` sendet primär `post_logout_redirect_uri`. Bei Cognito führt dies ohne `logout_uri` dazu, dass nach Logout nicht direkt zur konfigurierten App zurückgeleitet wird bzw. der Flow anders reagiert; die Kombination mit `logout_uri` führt zum korrekten Redirect zur Startseite. Firefox zeigt dabei HTTP 400 im Kontext des Logout-Redirects - verursacht durch die fehlerhafte Parameterkombination/Nichtübereinstimmung mit den erwarteten Cognito-Parametern.

## Fix (Phase 2 - minimal)
- Alle `auth.signoutRedirect(...)` Aufrufe in `src/components/Navbar.tsx` und `src/components/Profile.tsx` ergänzt um `extraQueryParams: { logout_uri: "https://www.mays-job-matcher.app/" }` neben bestehendem `post_logout_redirect_uri`.
- Zusätzlich `oidcConfig` um `extraQueryParams: { logout_uri: POST_LOGOUT_REDIRECT_URI }` erweitert (globale Konfiguration, behält bestehende Integration).
- Keine AWS-Änderungen, keine neuen Libraries.

## Tests / Build (Phase 3)
- `npm run build` erfolgreich (tsc + vite)
- `node --check api/**/*.mjs` erfolgreich
- `npx vitest run` erfolgreich: 69 passed | 3 skipped (72 files), 807 passed | 5 skipped (812 tests)

## Geänderte Dateien
- `src/components/Navbar.tsx` (Logout-Calls angepasst)
- `src/components/Profile.tsx` (Logout-Call angepasst) 
- `src/lib/oidcConfig.ts` (extraQueryParams für logout_uri ergänzt)

## Testergebnisse (lokal/HTTP)
- HTTP-Test gegen Cognito: Mit `logout_uri` + `post_logout_redirect_uri` → 302 zu `https://www.mays-job-matcher.app/`. Ohne korrekte Parameterkombination → Redirect zu Login oder unerwünschtes Verhalten.

## Deployment
- Noch nicht deployed (nur lokal getestet/geändert). Änderungen auf `main` committen/pushen wie angefordert.

## Hinweise
- Keine Tokens/Cookies in Logs gespeichert
- Bestehende OIDC-Integration unverändert
- LogoutURLs in Cognito unverändert (reichen aus)
