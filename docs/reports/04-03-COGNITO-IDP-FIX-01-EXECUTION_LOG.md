# JOBMATCHER-COGNITO-IDP-FIX-01 — Execution Log

## Status
**GREEN** — Lokale Cognito-Anmeldung aktiviert.
`SupportedIdentityProviders` = `["COGNITO"]`. `/login` liefert **HTTP 200** mit
E-Mail- und Passwortfeld. Keine weiteren Felder wurden verändert.

## Datum/Uhrzeit
2026-10-23 16:43–16:48 Europe/Berlin

## Git
- Branch: `main`
- HEAD vor Task: `0b5da5a`
- Working Tree: nur untracked Bestandsdateien (unangetastet)

## Scope / Grenzen
- Account `240571105849`, Region `eu-central-1`, Profile `mayaws`
- User Pool `eu-central-1_ZURSMpD2O`, App Client `5hb3f6dj5ialg77jf4blur9g6g`
- Genau **eine** AWS-Mutation: `update-user-pool-client` (IdP ergänzt)
- Nicht geändert: User Pool, Client-ID, Domains, Branding, Callback-/Logout-URLs,
  OAuth-Flows/Scopes, RIS. Keine neuen Ressourcen, kein Deployment.
- Keine Secrets protokolliert (public client, kein Secret vorhanden).

## 1./2. Vorher: vollständiger App Client (AWS, read-only)

```
UserPoolId                      = eu-central-1_ZURSMpD2O
ClientId                        = 5hb3f6dj5ialg77jf4blur9g6g
ClientName                      = ris-dev-jobsearch-dev-client
CallbackURLs                    = ["http://localhost:5173/auth/callback",
                                   "https://mays-job-matcher.vercel.app/auth/callback",
                                   "https://www.mays-job-matcher.app/auth/callback"]
LogoutURLs                      = ["http://localhost:5173/",
                                   "https://mays-job-matcher.vercel.app/",
                                   "https://www.mays-job-matcher.app",
                                   "https://www.mays-job-matcher.app/"]
AllowedOAuthFlows               = ["code"]
AllowedOAuthScopes              = ["email","openid","profile"]
AllowedOAuthFlowsUserPoolClient = true
EnableTokenRevocation           = true
EnablePropagateAdditionalUserContextData = false
RefreshTokenValidity            = 30
TokenValidityUnits              = {}
AuthSessionValidity             = 3
ClientSecret                    = (keiner — public client)
ExplicitAuthFlows               = (nicht gesetzt)
SupportedIdentityProviders      = (nicht gesetzt / leer)      <-- Befund
LastModifiedDate                = 2026-10-23T16:03:56.440+02:00
```

Snapshots zusätzlich gesichert (vor der Änderung):
`describe-user-pool`, `describe-user-pool-domain` (custom + prefix),
`describe-managed-login-branding 9dd667f7-1952-400c-bd1c-9c00bbb70fe5`.

## 3. Sicherstellung „keine bestehenden IdPs entfernt“
`SupportedIdentityProviders` war vorher leer (Feld im Describe-Output nicht vorhanden).
Es existierten also **keine** Identity Provider, die hätten entfernt werden können.
Bestätigt über `list-identity-providers --user-pool-id eu-central-1_ZURSMpD2O`
→ `{ "Providers": [] }` (keine externen IdPs im Pool).

## 4./5./6. Änderung (eine Mutation, alle bestehenden Werte explizit übernommen)

```bash
aws --profile mayaws cognito-idp update-user-pool-client \
  --user-pool-id eu-central-1_ZURSMpD2O \
  --client-id 5hb3f6dj5ialg77jf4blur9g6g \
  --client-name ris-dev-jobsearch-dev-client \
  --supported-identity-providers COGNITO \
  --callback-urls "http://localhost:5173/auth/callback" \
                  "https://mays-job-matcher.vercel.app/auth/callback" \
                  "https://www.mays-job-matcher.app/auth/callback" \
  --logout-urls "http://localhost:5173/" \
                "https://mays-job-matcher.vercel.app/" \
                "https://www.mays-job-matcher.app/" \
                "https://www.mays-job-matcher.app" \
  --allowed-o-auth-flows code \
  --allowed-o-auth-scopes email openid profile \
  --allowed-o-auth-flows-user-pool-client \
  --enable-token-revocation \
  --no-enable-propagate-additional-user-context-data \
  --refresh-token-validity 30 \
  --auth-session-validity 3
```

Exit-Code `0`. Antwort: `SupportedIdentityProviders = ["COGNITO"]`,
`LastModifiedDate = 2026-10-23T16:43:08.928+02:00`, **kein** `ClientSecret` erzeugt.

Bewusst **nicht** gesetzt: `ExplicitAuthFlows` (vorher nicht gesetzt, wird vom
Browser-Flow nicht benötigt; hätte eine zusätzliche Verhaltensänderung bedeutet).

## 7./8./9. Nachher: vollständiger App Client + Before/After-Vergleich

Automatischer Feld-für-Feld-Vergleich der beiden `describe-user-pool-client`-Outputs:

| Feld | Before | After | Bewertung |
| --- | --- | --- | --- |
| `SupportedIdentityProviders` | `null` (leer) | `["COGNITO"]` | **gewollte Änderung** |
| `LastModifiedDate` | `16:03:56` | `16:43:08` | technisch erwartbar |
| alle übrigen Felder | — | identisch | **keine Änderung** |

Übrige Snapshots:

| Objekt | Vergleich |
| --- | --- |
| `UserPool` (`describe-user-pool`) | **identisch** (0 Diff-Felder) |
| Custom Domain `auth.mays-job-matcher.app` | **identisch** (ACTIVE, ManagedLoginVersion 2) |
| Prefix Domain `ris-dev-jobsearch-dev` | **identisch** (ACTIVE, ManagedLoginVersion 1) |
| Branding `9dd667f7-…` | **identisch** (UseCognitoProvidedValues=true, Assets=0) |

→ Keine unbeabsichtigten Änderungen. Insbesondere Callback-/Logout-URLs,
OAuth-Flows/-Scopes, Client-Name, Token- und Session-Gültigkeiten unverändert.

## 10. LIVE-TEST — OAuth `/authorize` mit Production-Callback

```
GET https://auth.mays-job-matcher.app/oauth2/authorize
    ?client_id=5hb3f6dj5ialg77jf4blur9g6g
    &response_type=code
    &scope=openid+email+profile
    &redirect_uri=https%3A%2F%2Fwww.mays-job-matcher.app%2Fauth%2Fcallback
    &code_challenge=<S256>&code_challenge_method=S256&state=fix01
-> HTTP/2 302
   Location: https://auth.mays-job-matcher.app/login?...  (Parameter vollständig übernommen)
```

Kein `redirect_mismatch`. Negativkontrolle mit `redirect_uri=https://evil.example.com/cb`
liefert weiterhin `302 → /error?error=redirect_mismatch` (Validierung aktiv).

## 11. LIVE-TEST — `/login` HTTP-Status

```
GET https://auth.mays-job-matcher.app/login?...
-> HTTP/2 200   content-type: text/html; charset=utf-8
```

Prefix Domain (Classic Hosted UI) ebenfalls wieder funktionsfähig:
`GET /oauth2/authorize… -L` → **200** auf `/login` mit Anmeldeformular
(vorher: 2984-Byte-Fehlerseite „An error was encountered with the requested page.“).

## 12. LIVE-TEST — Felder auf der Anmeldeseite (Headless Chromium, read-only)

| Prüfung | Ergebnis |
| --- | --- |
| Finaler HTTP-Status | **200** |
| Seitentitel | `Sign-in` |
| Formulare | 1 |
| E-Mail-Feld (`input[name="username"]`) | vorhanden, `type="email"`, sichtbar, aktiviert |
| Passwort-Feld (`input[name="password"]`) | vorhanden, `type="password"`, sichtbar, aktiviert, Wert leer |
| Submit-Button | 1 (`button[type="submit"]`) |
| Sichtbarer Text | „Sign in … Email address … Password … Forgot your password? … Sign in … New user? Create an account“ |
| Fehler-Boundary (`invalidRequestError` / `internalServerError`) | **keine** |
| Netzwerkfehler 4xx/5xx beim Laden | **keine** |

Damit ist die Anmeldeseite vollständig nutzbar; ein echter Credential-Login
(SignUp → Confirm → Login → `/auth/callback` → `/profil`) wurde nicht ausgeführt,
weil dafür ein reales Testkonto/Passwort nötig wäre (nicht Teil des Auftrags,
keine Testdaten vorhanden).

Hinweis (Kontext Passwort-Incident): Die Managed-Login-Seite bietet ein eigenes
„Show password“-Element. Die Sichtbarkeit eines Passworts beim Einfügen stammt
also aus der Cognito-Oberfläche, nicht aus dem React-Registrierungsformular.

## IST / SOLL / EVIDENCE / ABWEICHUNG

| IST-WERT (nach Fix) | SOLL-WERT | EVIDENCE | ABWEICHUNG |
| --- | --- | --- | --- |
| `SupportedIdentityProviders = ["COGNITO"]` | `["COGNITO"]` | `describe-user-pool-client` after | keine |
| `/login` = **200**, Formular mit E-Mail + Passwort | 200 + Felder | curl + Headless-Chromium-Test | keine |
| `/authorize` → 302 auf `/login` | 302 | curl-Header | keine |
| Callback-/Logout-URLs unverändert | unverändert | Before/After-Diff | keine |
| OAuth-Flows/-Scopes unverändert (`code` / `email openid profile`) | unverändert | Before/After-Diff | keine |
| Client-Secret | keiner (public) | `describe-user-pool-client` after | keine |
| Pool/Domains/Branding | unverändert | Snapshot-Vergleich | keine |
| Prefix Domain Anmeldeseite | funktionsfähig | `-L` Flow → 200 + Felder | keine |

## Klassifikation
- Anmeldefunktion (Seitenrendering + Authorize): **GREEN**
- Konfigurationsintegrität (Before/After): **GREEN**
- Echter Credential-Login (E2E mit Nutzerkonto): **GRAY** (nicht getestet, kein Testkonto)

## AI-/Privacy-/Data-Flow-Bewertung
- Keine Änderung an Datenflüssen, KI-Providern, Prompts oder Datenspeichern.
- Die Änderung betrifft ausschließlich den Authentifizierungsweg (lokale Anmeldung
  über den Cognito-User-Pool). Keine zusätzlichen personenbezogenen Daten werden
  erhoben oder an Dritte übermittelt; keine neuen AWS-Ressourcen.
- Keine Secrets in diesem Dokument; Client ist public (kein Secret vorhanden).

## Risiken
- E-Mail/Passwort-Anmeldung ist jetzt aktiv; Brute-Force-Schutz hängt an der
  Pool-Konfiguration (Threat Protection), nicht am App Client.
- `ExplicitAuthFlows` bleibt leer — für den Browser-Flow irrelevant, für spätere
  `InitiateAuth`-Nutzung wäre eine Ergänzung nötig.

## Empfohlene nächste Aktionen
1. E2E-Test mit dediziertem Testkonto: Registrieren → E-Mail bestätigen → Login →
   Rückleitung auf `/auth/callback` → `/profil`.
2. Optional: Logout-Env `VITE_POST_LOGOUT_REDIRECT_URI` auf `…/` normalisieren.

## Git-Status / Dateien
- AWS: 1 Mutation (`update-user-pool-client`), nur `SupportedIdentityProviders` geändert.
- Repo: dieser Execution Log + Verweis in `docs/AI_AUDITLOG.md`.
- Untracked Bestandsdateien unverändert.

## Resume Point
- Fix abgeschlossen und live verifiziert (Login-Seite 200 mit Feldern).
- Offen: E2E-Login mit realem Testkonto.
