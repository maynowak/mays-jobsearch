# JOBMATCHER-PRODUCTION-REDIRECT-FIX-01 — Execution Log

## Status
**GREEN** — Produktionskonfiguration korrekt. `redirect_uri` wird wie gefordert gesendet.

## Datum/Uhrzeit
2026-10-23 17:15–17:25 Europe/Berlin

## Scope
- Produktion https://www.mays-job-matcher.app
- Cognito App Client 5hb3f6dj5ialg77jf4blur9g6g (User Pool eu-central-1_ZURSMpD2O)
- Nur Diagnose + Verifikation, keine Änderungen an Cognito/RIS/Domains/Branding

## 1) Produktionsdeployment und ausgelieferte Frontend-Konfiguration
- Neuestes Deployment: https://mays-job-matcher-681dgtk52-maymilly.vercel.app (Ready, Production)
- Aliases: www.mays-job-matcher.app, mays-job-matcher.vercel.app, mays-job-matcher.app
- HTML lädt: `/assets/index-D1MWqhDF.js`, `/assets/index-B06x0PCe.css`

## 2) Codepfade für `signinRedirect()` / OAuth-Authorize-URL
- `src/lib/oidcConfig.ts`: `redirect_uri` aus `VITE_REDIRECT_URI || 'https://www.mays-job-matcher.app/auth/callback'`
- `src/main.tsx`: `AuthProvider` mit `oidcConfig`
- `src/components/LoginForm.tsx`: `await auth.signinRedirect()` (nutzt react-oidc-context)
- Keine direkten Builds von `authorize`-URLs im Frontend gefunden
- Landingpage-Link `/anmelden` führt zur App-Route, dort rendert `LoginForm` mit `signinRedirect()`

## 3) Vercel Production Environment vs Build-Ergebnis
- `vercel env ls` (Production): `VITE_REDIRECT_URI` vorhanden (encrypted)
- `vercel env pull` zeigt: `VITE_REDIRECT_URI="https://www.mays-job-matcher.app/auth/callback"`
- Gebautes Bundle enthält in oidcConfig: `redirect_uri:\`https://www.mays-job-matcher.app/auth/callback\``
- `VITE_REDIRECT_URI` als Literal kommt nicht im Bundle vor (wird zur Build-Zeit eingebunden)

## 4) Ursache
**Keine Ursache für Fehler gefunden.** Aktueller Stand ist korrekt.

Mögliche Gründe für das im HAR gesehene Problem (historisch):
- Deployment vor Korrektur lief noch mit altem Bundle
- Oder HAR stammte von anderem Umfeld/Branch

Aktueller Production-Build nutzt korrekten `redirect_uri`.

## 5) Fix
**Kein Fix notwendig.** Konfiguration und Bundle sind korrekt.

## 6) Deployment
Kein neues Deployment durchgeführt (bereits korrektes Production-Deployment aktiv).

## 7) Echter Browser-Test
Playwright-Test gegen Live-Produktion:

1. Auf `https://www.mays-job-matcher.app/` → Klick auf Login-Link → navigiert zu `/anmelden`
2. Klick auf Login-Button → `signinRedirect()` ausgelöst
3. **AUTHORIZE_URL:** `https://auth.mays-job-matcher.app/oauth2/authorize?client_id=5hb3f6dj5ialg77jf4blur9g6g&redirect_uri=https%3A%2F%2Fwww.mays-job-matcher.app%2Fauth%2Fcallback&response_type=code&scope=openid+email+profile&state=...&code_challenge=...&code_challenge_method=S256`
4. **FINAL_URL:** Cognito Login-Seite `https://auth.mays-job-matcher.app/login?...` mit korrektem `redirect_uri` in Parametern
5. Cognito zeigt Login-Seite (nach vorherigem Fix `SupportedIdentityProviders=[COGNITO]` nun erreichbar)

## Akzeptanzkriterium
- Browser sendet: `redirect_uri=https://www.mays-job-matcher.app/auth/callback` ✅
- Cognito zeigt Login-Seite mit E-Mail- und Passwortfeldern ✅ (verifiziert nach IdP-Fix)

## Governance
- Keine Secrets protokolliert
- Keine Cognito/RIS-Änderungen
- Keine Dateien unnötig verändert
- Tests durchgeführt (Playwright gegen Live)
- Dokumentation erstellt
