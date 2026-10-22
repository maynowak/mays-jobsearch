# JOBMATCHER-RIS-COGNITO-INTEGRATION-04 — Bericht

## Status
**GREEN (lokale Implementierung)** — Gesamte Integration (reale Registrierung/Login) erst GREEN nach produktivem Browser-Test.

## Datum/Uhrzeit
2026-10-22

## Git
- Branch: `main`
- HEAD: wird mit diesem Commit gesetzt
- Working Tree: hat uncommittete Nutzer-Dokumente (Datenschutzerklärung, Bilder) — nicht Teil dieses Gates

## Ziel
Die bestehende Cognito-Authentifizierung vollständig mit der RIS-Cognito-Infrastruktur verbinden. Keine neuen User Pools, keine neuen App Clients, keine neue Auth-Architektur.

## 1. Baseline

**Verwendete Cognito-Werte (alle AWS read-only verifiziert am 22.10.2026):**
- User Pool: `eu-central-1_ojbmoiYGM` (Name: `ris-dev-dev-users`) ✓
- Public Client: `7ldhihlpdgsgcl3puvu4oi7ksv` (Name: `ris-dev-dev-client`) ✓
- Domain: `auth.mays-job-matcher.app` → Pool `eu-central-1_ojbmoiYGM` ✓
- Callback-URLs: localhost:5173, mays-job-matcher.vercel.app, www.mays-job-matcher.app ✓
- OAuth: `code` + PKCE (Public Client ohne Secret) ✓
- Scopes: `email openid profile` ✓
- Self-Signup: nicht blockiert (`AdminOnlyAuthentication: None`) ✓
- Identity Providers: leer (Google GEPLANT/NICHT VERIFIZIERT) ✓
- Passwort-Policy: min. 8 Zeichen, Groß+Klein+Zahlen ✓

**Frontend-Konfiguration (oidcConfig.ts):** bereits auf RIS-Werte via `VITE_*` Env-Vars mit korrekten Defaults umgestellt (Commit `bc07c9b` + `4ae3db8`). Authority, Client-ID, Callback, Scopes korrekt. Keine zweite AuthProvider-Instanz.

## 2. Lösungsweg (Auflösung des vorherigen BLOCKED)

Der vorherige Versuch scheiterte an der Annahme, SignUp erfordere AWS SDK (neue Dependency) oder serverseitigen Proxy (neue Architektur). **Lösung:** Cognito dokumentiert SignUp/ConfirmSignUp/ResendConfirmationCode als **unauthentifizierte Operationen** (keine AWS-Credentials nötig, nur Client-ID). Direkt über `fetch()` mit `X-Amz-Target`-Header aufrufbar — kein SDK, kein Amplify, kein Proxy, keine neue Dependency. AGENTS.md: „prefer global fetch" — genau dieser Weg.

RIS-Commit `55886f9` (RIS-COGNITO-BACKEND-FINALIZE-05) bestätigt:
- „Cognito endpoints: SignUp: https://cognito-idp.eu-central-1.amazonaws.com/"
- „Frontend validation can enforce email requirement without backend enforcement."
- „Lambda not strictly necessary. Frontend contract can enforce email mandatory."

## 3. Implementierte Registrierung

**`src/lib/cognitoAuthApi.ts`** (neu):
- `cognitoSignUp({username, password, email})` → Cognito-RPC `SignUp`
- `cognitoConfirmSignUp({username, code})` → Cognito-RPC `ConfirmSignUp`
- `cognitoResendConfirmationCode({username})` → Cognito-RPC `ResendConfirmationCode`
- Typisierte Fehler-Codes (user-exists, invalid-password, code-mismatch, code-expired, too-many-requests, limit-exceeded, network, config, unknown)
- **Kein Logging von Passwörtern/Codes** — nur Error-Codes werden gemappt.
- Region/Client-ID werden aus `oidcConfig.ts` importiert (eine Quelle, kein Drift).

**`src/components/RegisterForm.tsx`** (ersetzt):
- Pflichtfelder: Benutzername, E-Mail, Passwort
- Frontend-Validierung: Pflichtfelder, E-Mail-Format (Regex), Passwort-Policy (≥8, Groß/Klein/Zahl — aus AWS-Passwort-Policy abgeleitet)
- Nach erfolgreichem SignUp (UNCONFIRMED): Weiterleitung `/email-bestaetigen?username=…`
- `aria-invalid`, `aria-describedby`, `role="alert"` — barrierearm
- Keine Passwortspeicherung, kein Passwort-Logging

**`src/components/EmailConfirmation.tsx`** (neu):
- Bestätigungscode-Feld (inputMode=numeric, autoComplete=one-time-code)
- „Bestätigen"-Button → `cognitoConfirmSignUp`
- „Code erneut senden"-Button → `cognitoResendConfirmationCode`
- Nach Bestätigung: Erfolgsmeldung + „Weiter zur Anmeldung" → `/anmelden`
- Ohne username-Parameter: klarer Hinweis + Link zur Registrierung
- Code wird ausschließlich an Cognito übertragen — nie geloggt

**Routing:** `/email-bestaetigen` via `App.tsx` Route + `vercel.json` Rewrite.

## 4. Login/Logout (unverändert wiederverwendet)

- `LoginForm.tsx`: OAuth `signinRedirect` mit PKCE — unverändert
- `AuthCallback.tsx`: Callback + Session Restore — unverändert
- Anonyme Jobsuche bleibt möglich (Auth-Masken sind reine GUI-Routen ohne Backend/Session)

## 5. Google Login (dokumentiert, nicht implementiert)

Google ist laut RIS-Übergabe GEPLANT/NICHT VERIFIZIERT (Identity Providers am Pool: leer). Später über Cognito: Identity Provider im Pool konfigurieren (Google), Cognito-Callback ergänzen, Hosted UI übernimmt dann den Google-Button automatisch. In diesem Gate: KEINE Google-OAuth-Konfiguration, KEINE Secrets, KEINE AWS-Änderungen.

## 6. Fehlerbehandlung (DE + EN, 26 neue i18n-Keys)

| Cognito-Fehler | Anzeige (DE) |
|---|---|
| UsernameExistsException | Benutzername oder E-Mail bereits registriert |
| InvalidPasswordException | Passwort-Policy nicht erfüllt |
| CodeMismatchException | Bestätigungscode ungültig |
| ExpiredCodeException | Code abgelaufen, neuen anfordern |
| TooManyRequestsException/LimitExceeded | Zu viele Versuche |
| Netzwerk | Verbindungsfehler |
| InvalidParameterException | Eingaben prüfen |
| NotAuthorized (ConfirmSignUp auf bereits bestätigt) | Konto bereits bestätigt |
| Config-Fehler | Authentifizierung nicht korrekt konfiguriert |

Keine Secrets in Fehlermeldungen. `role="alert"` für Barrierefreiheit.

## 7. Sicherheit

- `RIS_API_KEY` bleibt serverseitig (nicht verändert)
- Keine Passwörter, Tokens, Codes in Auditlogs
- Keine `VITE_*` Variablen mit Secrets
- Public Client ohne Secret (PKCE-only)
- Keine AWS-Mutationen durchgeführt

## 8. Tests

| Suite | Ergebnis |
|---|---|
| `npm test` (vitest run) | **806/811 PASS** (5 skipped, 0 failed) |
| `npm run build` (tsc -b && vite build) | **PASS** |
| Neue Tests: RegisterForm (7) — Pflichtfelder, Validierung, SignUp-Aufruf, Fehlerbehandlung | ✓ |
| Neue Tests: EmailConfirmation (7) — Rendern, ConfirmSignUp, Resend, Fehler | ✓ |
| Aktualisiert: AuthRoutes (1) — neue Pflichtfelder statt „ohne Passwortfelder" | ✓ |
| Bestehende Tests: unverändert grün (Jobsuche, ATS, CV, Skill, etc.) | ✓ |

**Browser-E2E (produktiv):** NICHT DURCHGEFÜHRT — erfordert Vercel-Deployment mit echtem Domain + Cognito-E2E-Ablauf. Separater Schritt nach Freigabe.

## 9. Regression

Keine Änderungen an: Jobsuche, ATS-Profile, CV-Upload, CV-Anonymisierung, Skill-Reconciliation, CV Context Intelligence, Job-Lobby, Holographic Workspace. Alle zugehörigen Test-Dateien unverändert grün.

## 10. Governance

- Keine RIS-Repository-Änderungen
- Keine AWS-/Terraform-Mutationen (nur read-only Checks)
- Kein Vercel-Deployment ohne Freigabe
- `docs/AI_AUDITLOG.md` aktualisiert

## 11. Offene Punkte

1. **Browser-E2E produktiv** — Registrierung + Login + Logout mit echtem Cognito (nach Vercel-Deployment)
2. **Google Login** — separat freizugeben, RIS plant Identity Provider
3. **`.env`/Vercel Env-Vars** — `VITE_COGNITO_CLIENT_ID` muss in Vercel gesetzt werden (aktuell nur Default im Code)
4. Uncommittete Nutzer-Dokumente (Datenschutz, Bilder) im Working Tree — nicht Teil dieses Gates

## Git-Commit
Wird nach diesem Report erstellt.
