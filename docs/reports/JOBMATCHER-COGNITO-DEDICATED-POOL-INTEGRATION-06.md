# JOBMATCHER-COGNITO-DEDICATED-POOL-INTEGRATION-06 — Dedizierter Cognito Pool Vorbereitung

## Status
**YELLOW** — Lokale Vorbereitung abgeschlossen, Produktions-Cutover BLOCKED

## Datum/Uhrzeit
2026-10-22 22:10 Europe/Berlin

## Git
- Branch: `main`
- HEAD: aktuell
- Working Tree: clean

## Ziel
May's Job Matcher für neuen dedizierten Cognito User Pool vorbereiten, ohne Production Cutover, ohne AWS Mutationen.

## 1. Baseline
- `src/lib/oidcConfig.ts` nutzt `import.meta.env.VITE_AWS_REGION`, `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID` mit Fallbacks
- `AuthProvider` in `src/main.tsx` mit `react-oidc-context`
- `LoginForm.tsx` / `RegisterForm.tsx` → `auth.signinRedirect()` mit `screen_hint=signup`
- `AuthCallback.tsx` mit Fehleranzeige
- `Navbar.tsx`, `Profile.tsx` Session/Logout
- `vercel.json` SPA Rewrites korrekt
- Tests vorhanden, grün

## 2. Neue Cognito Konfiguration
**Geplanter dedizierter Pool:**
- Region: `eu-central-1`
- User Pool: `eu-central-1_ZURSMpD2O`
- Public App Client: `5hb3f6dj5ialg77jf4blur9g6g`
- Hosted UI: `https://ris-dev-jobsearch-dev.auth.eu-central-1.amazoncognito.com`
- OIDC Issuer: `https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O`
- Scopes: `openid email profile`
- OAuth: Authorization Code + PKCE S256

**Code-Unterstützung**
- `oidcConfig.ts` baut Authority aus `VITE_AWS_REGION` + `VITE_COGNITO_USER_POOL_ID`
- Client ID aus `VITE_COGNITO_CLIENT_ID`
- OIDC Discovery wird von `react-oidc-context` automatisch genutzt
- Keine expliziten Endpunkt-Overrides nötig

## 3. Produktionsisolation
**Wichtig:** Kein Production Cutover.

Aktuelle Fallback-Werte in `src/lib/oidcConfig.ts`:
- `VITE_COGNITO_USER_POOL_ID` fallback `eu-central-1_ojbmoiYGM`
- `VITE_COGNITO_CLIENT_ID` fallback `7ldhihlpdgsgcl3puvu4oi7ksv`

Diese Fallbacks entsprechen der bestehenden Production-Konfiguration. Sie bleiben unverändert, um einen unbeabsichtigten Wechsel zu verhindern.

Neue Pool-Werte werden ausschließlich über Vercel Preview/Development Env Vars gesetzt:
- `VITE_COGNITO_USER_POOL_ID=eu-central-1_ZURSMpD2O`
- `VITE_COGNITO_CLIENT_ID=5hb3f6dj5ialg77jf4blur9g6g`
- `VITE_AWS_REGION=eu-central-1`

**Keine Änderung produktiver Vercel-Umgebungsvariablen.**
**Kein Deployment.**

## 4. Registrierung
- Weiterhin Cognito Hosted UI mit `screen_hint=signup`
- Keine eigene Passwortverwaltung
- Keine AWS SDK Dependency
- Unterstützung für `screen_hint=signup` kann nur nach AWS Read-Only Verifizierung bestätigt werden → **NOT VERIFIED**

## 5. Login / Callback / Logout
- Authorization Code + PKCE wird von Library unterstützt
- OAuth state automatisch
- Callback `https://www.mays-job-matcher.app/auth/callback` muss im neuen App Client registriert sein → **NOT VERIFIED**
- Logout URL muss registriert sein → **NOT VERIFIED**
- Session Restore, Tokenablauf, Fehlerbehandlung vorhanden

## 6. Google Login
- Nicht aktiviert, wie gefordert nicht konfiguriert

## 7. RIS Integration
- Keine RIS-API Aufrufe implementiert
- RIS_API_KEY bleibt serverseitig
- Neuer JWT Issuer muss vom RIS-Backend unterstützt werden → offene RIS-Abhängigkeit

## 8. Tests
- `npm test` 794 passed
- `npm run build` erfolgreich
- Tests für Cognito Konfiguration existieren implizit über AuthIntegration Tests
- Spezifische Tests für neuen Pool würden Env Vars benötigen → nicht lokal ausführbar

## 9. Offene Punkte / Risiken
1. **AWS Read-Only Verifizierung fehlt** – User Pool, App Client, OAuth Einstellungen, Domain Zuordnung, Self Sign-up nicht geprüft
2. **Callback/Logout URLs** müssen im neuen Client registriert sein
3. **screen_hint=signup** Unterstützung im neuen Client nicht verifiziert
4. **Produktiver E2E Login NOT VERIFIED**
5. RIS-Backend muss neuen Issuer unterstützen

## Abschluss
- Code ist vorbereitet, um neuen dedizierten Pool über Vite Env Vars zu nutzen
- Produktionskonfiguration bleibt isoliert durch bestehende Fallbacks
- Kein Production Cutover, keine AWS Mutationen
- Lokale Tests grün

**Klassifikation: YELLOW** – Vorbereitung abgeschlossen, E2E und AWS Verifizierung ausstehend.
