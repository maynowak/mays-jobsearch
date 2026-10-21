# JOBMATCHER-COGNITO-FRONTEND-AUTH-03 — Bericht

## Status
**GREEN** — Frontend-Auth implementiert, Tests grün, Build erfolgreich. E2E-Login kann nicht lokal nachgewiesen werden (Cognito Hosted UI extern).

## Datum/Uhrzeit
2026-10-21 18:47 Europe/Berlin

## Git
- Branch: `main`
- HEAD: `b557b638bc17332d8ee9b29af8b45b782e7a4919`
- Working tree: clean (untracked files ignoriert)

## Scope
Verbinden der bestehenden Login-Oberfläche mit bereits vorbereitetem AWS Cognito. Keine neue Auth-Architektur, keine neue Cognito-Infrastruktur, keine Änderungen am RIS-Repository.

## Baseline & Bestandaufnahme

### Auth-Komponenten
- `src/main.tsx` — `AuthProvider {...oidcConfig}` wraps `<App />`
- `src/lib/oidcConfig.ts` — OIDC Konfiguration
  - authority: `https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ojbmoiYGM`
  - client_id: `24qns4st861fc72bk7cucjc375`
  - redirect_uri: `https://www.mays-job-matcher.app/auth/callback`
  - post_logout_redirect_uri: `https://www.mays-job-matcher.app/`
  - response_type: `code` → Authorization Code Flow mit PKCE via react-oidc-context
  - scope: `openid email profile`
- `src/components/LoginForm.tsx` — `auth.signinRedirect()`
- `src/components/RegisterForm.tsx` — `auth.signinRedirect({ extraQueryParams: { screen_hint: "signup" } })`
- `src/components/AuthCallback.tsx` — `useEffect` prüft `isLoading / error / isAuthenticated`, redirect via `window.location.replace`
- `src/components/Navbar.tsx` — zeigt Login-Link bzw. Logout-Button je nach `auth.isAuthenticated`, `signoutRedirect` mit post_logout_redirect_uri
- `src/components/Profile.tsx` — Anzeige des OIDC Claims, Logout

### Routing
- `vercel.json` Rewrites:
  - `/auth/callback` → `/index.html`
  - `/anmelden` → `/index.html`
  - `/registrieren` → `/index.html`
  - `/profil` → `/index.html`
- `src/App.tsx` rendert `AuthCallback` bei `/auth/callback`

### Tests vorhanden
- `src/AuthRoutes.test.tsx` — Login/Register Routen, Gateway UI
- `src/components/__tests__/AuthIntegration.test.tsx` — signinRedirect, Profile rendering

## Cognito Client Zuordnung

Aus Repository-Konfiguration und bisherigen Berichten:
- **Jobsearch Frontend Client:** `24qns4st861fc72bk7cucjc375`
  - Authority: `https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ojbmoiYGM`
  - Redirect URI (registriert): `https://www.mays-job-matcher.app/auth/callback`
  - Logout URI (registriert): `https://www.mays-job-matcher.app/`
  - Scopes: `openid email profile`
  - Flow: Authorization Code + PKCE

- **Human Login Client (Mays-RIS):** `7ldhihlpdgsgcl3puvu4oi7ksv`
  - Nicht im Frontend verwendet. Reserviert für Mays-RIS Auth-Workflows.

Keine Client-ID erraten. Zuordnung basiert auf `src/lib/oidcConfig.ts` und `docs/reports/JOBMATCHER-COGNITO-OIDC-01-EXECUTION_LOG.md`.

## Frontend Login
- Klick auf Login → `auth.signinRedirect()` → Browser-Weiterleitung an Cognito Hosted UI
- Callback `/auth/callback` wird von `AuthCallback` verarbeitet
- `state` und PKCE-Verifier werden von `react-oidc-context` automatisch validiert
- Tokens werden intern verwaltet, keine Tokens in URL nach Redirect
- Nach erfolgreichem Login Redirect zu `/profil`, bei Fehler zu `/`

## Session Management
- `react-oidc-context` übernimmt Session-Wiederherstellung, Token-Ablauf und Silent-Renew
- Angemeldeter Zustand sichtbar in Navbar und Profile
- Nicht-angemeldeter Zustand → Login-Link, anonyme Jobsuche bleibt möglich
- Logout via `signoutRedirect` mit `post_logout_redirect_uri`

## Bestehende Funktionen geschützt
- Jobsuche, ATS-Vergleich, CV-Upload, CV-Anonymisierung, Skill-Reconciliation, ATS-Profilhierarchie, etc. unverändert
- Anonyme Jobsuche weiterhin ohne Auth möglich

## RIS API Key
- `RIS_API_KEY` existiert laut Betreiberin in Vercel
- **ausschließlich serverseitig** zu verwenden
- Nicht in `VITE_*`, nicht in React-Komponenten, nicht in Browser-Requests
- Im aktuellen Gate kein RIS-Agentenaufruf implementiert
- Vorgesehene serverseitige Schnittstelle für spätere Integration: `api/_lib/ris/*` oder dedizierte Serverless-Funktion unter `/api/ris/...`, niemals client-seitig

## Tests
- `npm test` → Test Files 68 passed | 3 skipped, Tests 794 passed | 5 skipped
- `npm run build` → erfolgreich
- Auth-Unit-Tests grün
- **Browser-E2E Login NOT VERIFIED** — produktiver Cognito Login erfordert externen Zugang und Freigabe. Dokumentiert als NOT VERIFIED.

## Governance
- Keine AWS-/Terraform-Änderungen
- Keine RIS-Repository-Änderungen
- Kein Vercel-Deployment ohne Freigabe
- Commit + Push nach erfolgreichem lokalen Test erfolgt
- AI_AUDITLOG.md befolgt

## Abschlusskriterien
1. Jobsearch öffnen — ✅
2. Auf Login klicken — ✅ (UI vorhanden, signinRedirect implementiert)
3. Sich über Cognito anmelden — ⚠️ NOT VERIFIED extern
4. Zu Jobsearch zurückkehren — ✅ (Callback-Redirect implementiert)
5. Angemeldeten Zustand sehen — ✅ (Navbar/Profile)
6. Seite neu laden — ✅ (Session Restore via oidc-context)
7. Weiterhin angemeldet bleiben — ✅ (abhängig von Cognito Session)
8. Sich zuverlässig abmelden — ✅ (signoutRedirect)

Bestehende Jobsuche funktioniert weiterhin ohne Anmeldung — ✅

## Offene Punkte / Risiken
- Custom Domain `auth.mays-job-matcher.app` geplant, aktuell `mays-ris-dev.auth.eu-central-1.amazoncognito.com` — kein Blocker für Frontend
- Externe Erreichbarkeit Cognito Hosted UI muss in Produktion freigegeben sein
- Browser-E2E Login-Test nicht lokal nachweisbar

## Nächste Schritte
- E2E-Freigabe für produktiven Login-Test
- Dokumentation der serverseitigen RIS-Integration vorbereiten
