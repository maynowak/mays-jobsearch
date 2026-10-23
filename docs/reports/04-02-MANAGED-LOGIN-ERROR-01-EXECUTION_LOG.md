# JOBMATCHER-MANAGED-LOGIN-ERROR-01 — Execution Log (READ-ONLY)

## Status
**RED** — Login nicht möglich. Ursache im App Client lokalisiert:
`SupportedIdentityProviders` fehlt (kein Identity Provider am Client).
**Es wurden keine Änderungen durchgeführt** (read-only Diagnose).

## Datum/Uhrzeit
2026-10-23 16:40 Europe/Berlin

## Git
- Branch: `main`
- HEAD: `f3c2383`
- Working Tree: nur untracked Bestandsdateien (unangetastet)

## Scope / Grenzen
- Read-only. Keine AWS-Mutation, keine Domainänderung, keine neuen Ressourcen,
  keine RIS-Berührung, kein Deployment, keine Secrets in diesem Log.
- Geprüft: User Pool `eu-central-1_ZURSMpD2O`, App Client `5hb3f6dj5ialg77jf4blur9g6g`,
  Custom Domain `auth.mays-job-matcher.app`, Prefix Domain `ris-dev-jobsearch-dev`.
- Account `240571105849`, Region `eu-central-1` (`--profile mayaws`).

## 1. Tatsächliche OAuth-Authorize-URL des fehlgeschlagenen Versuchs

Aus dem Frontend (`src/lib/oidcConfig.ts` + OIDC-Discovery) ergibt sich exakt:

```
https://auth.mays-job-matcher.app/oauth2/authorize
  ?client_id=5hb3f6dj5ialg77jf4blur9g6g
  &response_type=code
  &scope=openid+email+profile
  &redirect_uri=https%3A%2F%2Fwww.mays-job-matcher.app%2Fauth%2Fcallback
  &code_challenge=<43 Zeichen, S256>
  &code_challenge_method=S256
  &state=<opaque>
```

Herleitung: `authority = https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O`;
die Discovery liefert alle OAuth-Endpunkte auf der Custom Domain:

```
authorization_endpoint = https://auth.mays-job-matcher.app/oauth2/authorize
token_endpoint         = https://auth.mays-job-matcher.app/oauth2/token
end_session_endpoint   = https://auth.mays-job-matcher.app/logout
```

## 2. HTTP-Status und Redirect-Kette (reproduziert)

```
GET /oauth2/authorize?...            -> 302
Location: https://auth.mays-job-matcher.app/login?client_id=5hb3f6dj5ialg77jf4blur9g6g
          &response_type=code&scope=openid+email+profile
          &redirect_uri=https%3A%2F%2Fwww.mays-job-matcher.app%2Fauth%2Fcallback
          &code_challenge=...&code_challenge_method=S256&state=...
GET /login?...                       -> 400   <-- HIER bricht es ab
```

- `/oauth2/authorize` akzeptiert die registrierte Callback-URL (kein `redirect_mismatch`).
- Die Seite `/login` liefert **HTTP 400** mit dem Managed-Login-Fehler
  `invalidRequestError`: „Invalid request / Please check your input and try again.“
- **0** `<form>`-Elemente, **0** `input[type=password]` → es wird kein Anmeldeformular gerendert.

Der vom Nutzer gemeldete Text („Something went wrong“ + „An error was encountered with the
requested page.“) ist im Managed-Login-Bundle die Boundary `internalServerError`
(`"internalServerError":{"title":"Something went wrong","description":"An error was encountered
with the requested page."}`) und entspricht auf der klassischen Hosted UI (Prefix Domain,
Version 1) exakt der 2984-Byte-Fehlerseite. Beides ist Folge desselben Zustands: die
Anmeldeseite kann keinen Sign-in-Weg aufbauen.

## 3. Cognito App Client — vollständige effektive Konfiguration

```
UserPoolId                     = eu-central-1_ZURSMpD2O
ClientId                       = 5hb3f6dj5ialg77jf4blur9g6g
ClientName                     = ris-dev-jobsearch-dev-client
AllowedOAuthFlows              = ["code"]                    OK
AllowedOAuthScopes             = ["email","openid","profile"] OK
AllowedOAuthFlowsUserPoolClient= true                        OK
CallbackURLs                   = localhost, vercel.app, https://www.mays-job-matcher.app/auth/callback  OK
LogoutURLs                     = localhost, vercel.app, https://www.mays-job-matcher.app[/]            OK
EnableTokenRevocation          = true                        OK
AuthSessionValidity            = 3                           OK
RefreshTokenValidity           = 30                          OK
ClientSecret                   = (keiner, public client)      OK
ExplicitAuthFlows              = (nicht gesetzt)
SupportedIdentityProviders     = (nicht gesetzt / leer)      <-- ABWEICHUNG
```

Managed Login Branding:

```
describe-managed-login-branding-by-client
  -> ManagedLoginBrandingId = 9dd667f7-1952-400c-bd1c-9c00bbb70fe5
     UserPoolId = eu-central-1_ZURSMpD2O
     UseCognitoProvidedValues = true
     Assets = []
```
→ Branding existiert **und ist dem Client zugeordnet**. Der frühere Fehler
„Login pages unavailable“ ist damit weg (verifiziert: er tritt nur noch bei einem
*fremden/unbekannten* `client_id` auf, siehe Negativkontrolle).

Pool- und Domain-Kontext (unverändert, unauffällig):

```
UserPoolTier        = ESSENTIALS
SignInPolicy        = {"AllowedFirstAuthFactors":["PASSWORD"]}
UsernameAttributes  = ["email"]  (E-Mail als Username)
Domain (custom)     = auth.mays-job-matcher.app   ACTIVE  ManagedLoginVersion 2
Domain (prefix)     = ris-dev-jobsearch-dev       ACTIVE  ManagedLoginVersion 1
IdentityProviders   = []   (keine externen IdPs — "COGNITO" ist kein External-IdP-Eintrag)
```

Vergleich mit dem einzigen anderen App Client im Account
(`eu-central-1_ojbmoiYGM` / `7ldhihlpdgsgcl3puvu4oi7ksv`):

| Feld | Jobsearch-Client | Referenz-Client |
| --- | --- | --- |
| `AllowedOAuthFlows/Scopes` | identisch | identisch |
| `CallbackURLs/LogoutURLs` | identisch | identisch |
| `AuthSessionValidity` | 3 | 3 |
| `SupportedIdentityProviders` | **fehlt** | `["COGNITO"]` |
| `ExplicitAuthFlows` | **fehlt** | `["ALLOW_REFRESH_TOKEN_AUTH","ALLOW_USER_PASSWORD_AUTH"]` |

## 4. Die konkret fehlschlagende Anfrage

```
GET https://auth.mays-job-matcher.app/login
    ?client_id=5hb3f6dj5ialg77jf4blur9g6g
    &response_type=code&scope=openid&redirect_uri=https%3A%2F%2Fwww.mays-job-matcher.app%2Fauth%2Fcallback
-> HTTP/2 400
   x-amz-cognito-request-id: 3078dd87-cdde-4e8f-9f3b-b9d7c0278d0a
   Remix-Route-Fehler: {"status":400,"data":{"title":"Invalid request",
                        "description":"Please check your input and try again."}}
```

## 5. Reproduzierbarer HTTP-Test (read-only) + Negativkontrollen

Alle Varianten gegen die Custom Domain, jeweils mit Cookie-Jar und Browser-UA:

| Test | HTTP | Ergebnis |
| --- | --- | --- |
| `/oauth2/authorize` mit PKCE, registrierter Callback | 302 | → `/login` (kein `redirect_mismatch`) |
| `/login` ohne PKCE | 400 | Invalid request |
| `/login` `scope=openid` bzw. `openid+phone` | 400 | Invalid request |
| `/login` `redirect_uri` = localhost bzw. vercel.app | 400 | Invalid request |
| `/login` `identity_provider=COGNITO` | 400 | Invalid request |
| `/login` `identity_provider=Bogus` | 400 | Invalid request (kein IdP-Fehler → IdP-Liste ist leer) |
| `/login` nur `client_id` (ohne `response_type`) | 400 | Invalid request (kein „missing parameter“) |
| `/login` mit gesetzten `csrf-state`/`XSRF-TOKEN`-Cookies | 400 | Invalid request |
| **Negativkontrolle** `/oauth2/authorize` mit `redirect_uri=https://evil.example.com/cb` | 302 | → `/error?error=redirect_mismatch` (Validierung aktiv) |
| **Negativkontrolle** `/login` mit unbekanntem `client_id` | 403 | „Login pages unavailable“ (Branding-Lookup greift) |
| Prefix Domain (Classic Hosted UI) kompletter Authorize-Flow | 400 | 2984-Byte-Fehlerseite, Text **identisch** zur Nutzermeldung |

Interpretation der Kontrollen:
- Der Fehler ist **parameterunabhängig** (jede Scope-/Redirect-/PKCE-/IdP-Kombination → 400).
- Der Fehler ist **client-spezifisch**: nur dieser `client_id` erreicht die Branding-Stufe.
- Ein „missing parameter“-Fehler wird nicht erzeugt; der `client_id` wird also erkannt,
  die Anmeldeseite kann aber keinen Sign-in-Weg rendern.

## Fehlerursache (mit Evidence)

Der App Client hat **keinen Identity Provider** (`SupportedIdentityProviders` leer).
Amazon Cognito verlangt laut Dokumentation mindestens einen zugewiesenen IdP
(„You can assign multiple IdPs, but you must assign at least one“,
*Application-specific settings with app clients*). Lokale Anmeldung läuft dabei über
den Eintrag `COGNITO`. Ohne diesen Eintrag kann Managed Login (v2, Custom Domain) und
die klassische Hosted UI (v1, Prefix Domain) keinen Anmeldeweg aufbauen:

- Custom Domain → `400 invalid_request` (Remix-Boundary `invalidRequestError`, ggf. `internalServerError`)
- Prefix Domain → klassische Fehlerseite „An error was encountered with the requested page.“

Alles andere ist verifiziert in Ordnung: Branding vorhanden/zugeordnet, Domain ACTIVE,
Callback- und Logout-URLs korrekt, Code-Flow + Scopes korrekt, PKCE akzeptiert,
Pool-Tier ESSENTIALS, `SignInPolicy` = `PASSWORD`, E-Mail als Username.

## Betroffene Einstellung

`UserPoolClient.SupportedIdentityProviders` von
`eu-central-1_ZURSMpD2O` / `5hb3f6dj5ialg77jf4blur9g6g` — aktuell leer,
soll `["COGNITO"]` (lokale Anmeldung) sein.

## Genau eine minimale Reparaturempfehlung

Eine einzige Änderung am bestehenden App Client — alle übrigen Werte unverändert:

```bash
aws cognito-idp update-user-pool-client \
  --user-pool-id eu-central-1_ZURSMpD2O \
  --client-id 5hb3f6dj5ialg77jf4blur9g6g \
  --supported-identity-providers COGNITO \
  --callback-urls "http://localhost:5173/auth/callback" "https://mays-job-matcher.vercel.app/auth/callback" "https://www.mays-job-matcher.app/auth/callback" \
  --logout-urls "http://localhost:5173/" "https://mays-job-matcher.vercel.app/" "https://www.mays-job-matcher.app/" "https://www.mays-job-matcher.app" \
  --allowed-o-auth-flows code \
  --allowed-o-auth-scopes email openid profile \
  --allowed-o-auth-flows-user-pool-client
```

Nicht erforderlich (und deshalb **nicht** Teil der Empfehlung):
`ExplicitAuthFlows`. Das Frontend nutzt `SignUp`, `ConfirmSignUp`,
`ResendConfirmationCode` (unauthentifizierte API-Operationen) und für den Login
ausschließlich den Browser-Flow; `InitiateAuth`/`USER_PASSWORD_AUTH` wird im Repo
nirgends verwendet.

## IST / SOLL / EVIDENCE / ABWEICHUNG

| IST-WERT | SOLL-WERT | EVIDENCE | ABWEICHUNG |
| --- | --- | --- | --- |
| `SupportedIdentityProviders` leer | `["COGNITO"]` | `describe-user-pool-client` (Feld fehlt) vs. Referenz-Client | **URSACHE** |
| `GET /login` → 400 `invalid_request`, kein Formular | Login-Formular rendert | 5 Parameter-Varianten + Cookie-Varianten, jeweils 400, 0 `input[type=password]` | **RED** |
| Prefix Domain Hosted UI → Fehlerseite (Nutzertext) | Sign-in-Formular | 2984-Byte-Seite, Text identisch zur Meldung | **RED** |
| Branding `9dd667f7-…` vorhanden und client-zugeordnet | vorhanden | `describe-managed-login-branding-by-client` | keine |
| Callback-/Logout-URLs | wie registriert | `describe-user-pool-client` | keine |
| Code-Flow, Scopes, PKCE | `code`, `openid email profile`, S256 | authorize → 302 `/login`, Negativkontrolle → `redirect_mismatch` | keine |
| Domain-Status custom/prefix | ACTIVE (v2 / v1) | `describe-user-pool-domain` | keine |
| Pool-Tier / SignInPolicy / Username | ESSENTIALS / `PASSWORD` / `email` | `describe-user-pool` | keine |
| App-Client-Secret | keiner (public) | `describe-user-pool-client` | keine |
| RIS-Pool, Domains, Ressourcen | unverändert | keine Schreiboperation ausgeführt | keine |

## Klassifikation
- Ursache: **identifiziert** (Client ohne Identity Provider)
- Login-Funktion: **RED**
- AWS-Änderungen in diesem Task: **keine**
- Code/Frontend: **unauffällig** (korrekte Authority, korrekte Scopes/Redirects)

## Risiken
- Solange `SupportedIdentityProviders` leer ist, schlägt jede Anmeldung fehl — unabhängig
  von Branding, Callback-URLs oder PKCE.
- Ohne `ExplicitAuthFlows` sind später direkte SDK-Logins (`InitiateAuth`) nicht möglich;
  aktuell nicht benötigt.

## Empfohlene nächste Aktionen
1. Freigabe für die eine Änderung oben (`--supported-identity-providers COGNITO`).
2. Danach read-only Verifikation: `GET /login` muss `200` mit Passwortfeld liefern;
   anschließend echter E2E-Test (SignUp → Confirm → Login → `/auth/callback` → `/profil`).

## Git-Status / Dateien
- **Keine** AWS-Änderung, **keine** Quellcode-Änderung.
- Neu: dieser Execution Log.
- Untracked Bestandsdateien unverändert.

## Resume Point
- Diagnose abgeschlossen; warten auf Freigabe für genau eine Client-Änderung
  (`SupportedIdentityProviders=COGNITO`), dann Verifikation.
