# JOBMATCHER-COGNITO-SIGNUP-DIAGNOSTICS-01 — Registrierung / Fehleranzeige

## Status
**GREEN** — Fehleranzeige implementiert, Tests grün, Build ok. Externe Cognito-Konfiguration muss in AWS geprüft werden.

## Datum/Uhrzeit
2026-10-21 19:55 Europe/Berlin

## Git
- Branch: `main`
- HEAD: aktuell
- Working Tree: clean nach Commit

## Problem
Beim Klick auf „Registrieren“ erscheint im Debugger die HTML-Startseite der React-Anwendung. Keine verständliche Fehlermeldung für den Benutzer. Stattdessen erfolgte ein stummer Redirect auf `/`.

## Bestandaufnahme

### Betroffene Dateien
- `src/components/RegisterForm.tsx` – `auth.signinRedirect({ extraQueryParams:{screen_hint:"signup"} })`
- `src/components/LoginForm.tsx` – `auth.signinRedirect()`
- `src/lib/oidcConfig.ts` – authority `eu-central-1_ojbmoiYGM`, client_id `24qns4st861fc72bk7cucjc375`, redirect_uri `https://www.mays-job-matcher.app/auth/callback`
- `src/components/AuthCallback.tsx` – Fehlerfall führte zu `window.location.replace("/")` ohne Anzeige
- `vercel.json` – SPA-Rewrites für `/registrieren`, `/anmelden`, `/auth/callback`
- Auth-Tests vorhanden, bereits grün

### Mögliche Ursachen
1. **Stumme Fehlerbehandlung im Callback**: `AuthCallback` hat bei `auth.error` nur zu `/` weitergeleitet, ohne Meldung.
2. **SigninRedirect-Fehler nicht sichtbar**: `signinRedirect()` kann synchron fehlschlagen, z.B. bei ungültiger Konfiguration, nicht registrierter Redirect URI oder Client-Pool-Mismatch. Fehler wurde nicht abgefangen.
3. **Cognito-Konfiguration**: Nach User-Pool-Wechsel auf `eu-central-1_ojbmoiYGM` müssen Redirect URIs und Client-Einstellungen in Cognito konsistent sein. Ein `invalid_redirect_uri` / `invalid_client` führt dazu, dass Cognito zum Callback mit Fehler zurückkehrt und die App still auf Startseite springt.

Keine Routing-Interferenz nachgewiesen. SPA-Rewrites sind korrekt.

## Durchgeführte Maßnahmen

### 1. Fehleranzeige AuthCallback
- `AuthCallback` zeigt jetzt Lade-Status, bei `auth.error` wird eine benutzerfreundliche Fehlerkarte mit deutscher Meldung, Fehlerhinweis und Buttons „Zurück zur Anmeldung“ / „Zur Jobsuche“ angezeigt.
- Kein Silent-Redirect mehr, keine Secrets/Tokens in der Anzeige.

### 2. Fehlerabfang Login / Registrierung
- `LoginForm` und `RegisterForm` fangen `signinRedirect` Exceptions ab.
- Bei Fehler wird inline `auth-error` Meldung gerendert: 
  - Login: „Anmeldung konnte nicht gestartet werden. Bitte versuche es später erneut.“
  - Registrierung: „Registrierung konnte nicht gestartet werden. Bitte versuche es später erneut.“
- `useState` für lokale Fehler, barrierefreier `role="alert"`.

### 3. Styling
- `.auth-error` in `src/styles.css` ergänzt, rot hinterlegt, barrierefrei.

### 4. Tests
- Bestehende Tests weiterhin grün: 794 passed
- Build erfolgreich

## Routing & Sicherheit
- Keine Änderungen an `vercel.json`
- Keine SPA-Fallback-Interferenz für OAuth
- Keine Secrets, Tokens oder OAuth Codes in UI
- RIS_API_KEY bleibt serverseitig
- Keine AWS/Terraform Änderungen

## Offene Punkte / Extern
- **Cognito Konfiguration muss in AWS verifiziert werden**:
  - Client `24qns4st861fc72bk7cucjc375` muss zum User Pool `eu-central-1_ojbmoiYGM` gehören
  - Redirect URI `https://www.mays-job-matcher.app/auth/callback` muss im App Client registriert sein
  - Logout URI `https://www.mays-job-matcher.app/` registriert
  - OAuth Flüsse: Authorization Code + PKCE aktiviert, Scopes `openid email profile`
- Falls Client/Pool-Mismatch besteht, muss die Cognito Konfiguration durch Betreiber angepasst werden. Das ist extern und kann vom Agenten nicht verändert werden.

## Abschlusskriterien
- Ursache untersucht: stille Fehlerbehandlung + mögliche Cognito-Konfigurationsinkonsistenz
- Benutzerfreundliche Fehleranzeige implementiert, Deutsch/Englisch Grundtext vorhanden
- Regressionstests grün
- Build erfolgreich
- Dokumentation erstellt

## Klassifikation
GREEN – Frontend-Fehlerhandling verbessert. Externe Cognito-Konfiguration bleibt als OPEN, aber nicht blockierend für die Implementierung.

## Nächste Schritte
- Betreiber prüft Cognito App Client Konfiguration für User Pool `eu-central-1_ojbmoiYGM`
- Produktiv-E2E-Test nach Freigabe durchführen
