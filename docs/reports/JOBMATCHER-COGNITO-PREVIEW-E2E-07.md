# JOBMATCHER-COGNITO-PREVIEW-E2E-07 — Preview E2E Vorbereitung

## Status
**YELLOW** — Lokale Vorbereitung abgeschlossen, Browser-E2E NOT VERIFIED

## Datum/Uhrzeit
2026-10-22 22:45 Europe/Berlin

## Git
- Branch: `main`
- HEAD: aktuell
- Working Tree: clean nach Commit

## 1. Baseline prüfen
- Git HEAD, Branch und Working Tree geprüft
- OIDC Konfiguration in `src/lib/oidcConfig.ts` nutzt `VITE_AWS_REGION`, `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`
- AuthProvider in `src/main.tsx` mit `react-oidc-context`
- Login/Register über Hosted UI, AuthCallback mit Fehleranzeige
- `vercel.json` SPA Rewrites korrekt
- Tests vorhanden und grün

## 2. Preview-Isolation herstellen
**Implementiert:**
- `redirect_uri` und `post_logout_redirect_uri` werden nun über Env Vars gesteuert:
  - `VITE_REDIRECT_URI`
  - `VITE_POST_LOGOUT_REDIRECT_URI`
- Fallback für lokale Entwicklung: `http://localhost:5173/auth/callback` / `http://localhost:5173/`
- **Keine produktiven URLs mehr als Fallback**
- Preview-Deployment muss explizit `VITE_REDIRECT_URI` und `VITE_POST_LOGOUT_REDIRECT_URI` setzen, sonst Login nicht möglich → sichere Isolation
- Preview-Anmeldung führt nur zu der Domain, die in den Env Vars hinterlegt ist, nicht zur Production

## 3. Cognito-Konfiguration
**Geplante Werte für Preview:**
- User Pool: `eu-central-1_ZURSMpD2O`
- App Client: `5hb3f6dj5ialg77jf4blur9g6g`
- Hosted UI: `https://ris-dev-jobsearch-dev.auth.eu-central-1.amazoncognito.com`
- OIDC Issuer: `https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O`
- Scopes: `openid email profile`
- OAuth: Authorization Code + PKCE S256

**Prüfaufträge an RIS-Team:**
- Ist App Client `5hb3f6dj5ialg77jf4blur9g6g` für User Pool `eu-central-1_ZURSMpD2O` freigeschaltet?
- Sind folgende Callback URLs registriert?
  - Preview Domain: `https://<preview-domain>/auth/callback` → muss exakt übereinstimmen
  - Logout URL: `https://<preview-domain>/`
- Ist Self Sign-up aktiviert?
- Ist `screen_hint=signup` im Hosted UI unterstützt?
- Sind OAuth Grants `authorization_code` und PKCE S256 aktiviert?
- Ist die Hosted UI Domain `ris-dev-jobsearch-dev.auth.eu-central-1.amazoncognito.com` für diesen Client freigeschaltet?

Ohne AWS Read-Only Zugriff nicht verifizierbar → **NOT VERIFIED**

## 4. Registrierung vorbereiten
- Cognito Hosted UI beibehalten
- Registrierung über E-Mail/Passwort im Hosted UI
- E-Mail-Bestätigung durch Cognito
- `screen_hint=signup` wird verwendet, Unterstützung **NOT VERIFIED**
- Keine eigene Passwortverarbeitung

## 5. Tests
- `npm test` 806 passed | 5 skipped
- `npm run build` erfolgreich
- OIDC Konfiguration nutzt Env Vars, Redirect URIs umgebungsabhängig
- Produktionsisolation nachgewiesen durch Entfernung produktiver Fallbacks
- Browser-E2E **NOT VERIFIED** – kein Browserzugang

## 6. Grenzen eingehalten
- Keine AWS/Terraform Änderungen
- Keine RIS-Repository Änderungen
- Keine produktiven Vercel Variablen geändert
- `RIS_API_KEY` bleibt serverseitig

## 7. Offene Abhängigkeiten
1. RIS-Team bestätigt Callback/Logout URLs für Preview Domain
2. RIS-Team bestätigt Self Sign-up und `screen_hint` Support
3. Vercel Preview Env Vars setzen:
   - `VITE_COGNITO_USER_POOL_ID=eu-central-1_ZURSMpD2O`
   - `VITE_COGNITO_CLIENT_ID=5hb3f6dj5ialg77jf4blur9g6g`
   - `VITE_AWS_REGION=eu-central-1`
   - `VITE_REDIRECT_URI=https://<preview-domain>/auth/callback`
   - `VITE_POST_LOGOUT_REDIRECT_URI=https://<preview-domain>/`
4. Browser-E2E Test mit Testbenutzer durchführen

## Abschluss
- Preview-Isolation durch dynamische Redirect URIs implementiert
- Code vorbereitet für neuen dedizierten Pool
- Produktiver Cutover verhindert
- Lokale Tests grün

**Klassifikation: YELLOW** – Vorbereitung abgeschlossen, Live-Verifikation ausstehend.
