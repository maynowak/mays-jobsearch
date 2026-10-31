# JM-AUTH-SAME-DOMAIN-LOGIN-DIAGNOSIS-01

**Art:** Auth-Diagnose / Ursachenanalyse
**Baseline:** `0d5b6ab`
**Status:** DIAGNOSE ABGESCHLOSSEN — keine Codeänderung, kein Deployment
**Ergebnis:** Die Weiterleitung ist kein Routing-Bug, sondern der aktuell konfigurierte OIDC-Authorization-Code-Flow.

## 1. Git-Preflight

| Prüfung | Ergebnis |
|---|---|
| Branch | `main` |
| HEAD | `0d5b6ab` |
| `origin/main` | synchron (`0 0`) |
| Working Tree | nur vorbestehende untracked Dateien |
| Bestehende Änderungen überschrieben | nein |

## 2. Kurzbefund

`/anmelden` rendert `LoginForm`. Der Button ruft:

```text
LoginForm.handleSignIn()
  → signIn(auth)
  → auth.signinRedirect()
  → Cognito /oauth2/authorize
```

`signinRedirect()` ist eine **vollständige Browser-Navigation** zum
Authorization-Endpoint des OIDC-Providers. Dieser Endpoint liegt bei Cognito
auf einer Cognito-Domain (`auth.mays-job-matcher.app` oder der jeweiligen
Cognito-Prefix-Domain), nicht auf `www.mays-job-matcher.app`.

Nach der Anmeldung kehrt Cognito über die registrierte `redirect_uri`

```text
https://www.mays-job-matcher.app/auth/callback
```

auf die Job-Matcher-Domain zurück. Nur dieser Rückweg ist same-origin; der
Anmeldevorgang selbst findet auf der Cognito-Domain statt.

Das ist der erwartete Ablauf von OAuth 2.0/OIDC Authorization Code + PKCE. Ein
Host-Wechsel während der Authorization ist kein Fehler des Routers oder von
Vercel.

## 3. Konkrete Code-Stellen

| Datei | Zeile | Bedeutung |
|---|---|---|
| `src/components/LoginForm.tsx` | 14–20 | Button ruft `signIn(auth)` |
| `src/lib/authFlow.ts` | 17–19 | `signIn` ruft `auth.signinRedirect()` |
| `src/lib/oidcConfig.ts` | 18–24 | Authority, Client-ID, Redirect-URI, `response_type: "code"` |
| `src/main.tsx` | AuthProvider | stellt `react-oidc-context` bereit |
| `src/components/AuthCallback.tsx` | 8–18 | verarbeitet den Rückweg von Cognito |
| `src/components/AuthCallback.tsx` | 15–17 | leitet nach Erfolg auf `/` weiter (nicht `/profil`) |

`react-oidc-context`/`oidc-client-ts` holt die Authorization-URL aus der
OIDC-Discovery des konfigurierten Authority:

```text
https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O
```

Die dort beworbene `authorization_endpoint` ist eine Cognito-Domain. Deshalb
ändert sich die Adresszeile, sobald der Login-Button gedrückt wird.

## 4. Warum das vorher anders aussah

Die Historie zeigt: Es gab **keinen früheren funktionierenden Same-Domain-Login**.
Es gab lediglich eine lokale Login-Maske ohne Backend.

| Commit | Verhalten |
|---|---|
| `e9b60a6` | Lokale Login-Maske mit E-Mail/Passwort, aber **UI-only**: kein Cognito, kein `fetch`, keine Session. Nach Submit nur „prepared“-Hinweis. |
| `dc117c9` | OIDC eingeführt; der lokale Submit rief bereits `auth.signinRedirect()` auf. |
| `cbce3c8` | Lokale Passwortfelder entfernt; der Login-Button ruft jetzt direkt `signinRedirect()` auf. |
| `fb88729` | Nur Login-/Logout-Query-Parameter getrennt; keine Änderung am Redirect-Verhalten. |

Die frühere Maske blieb also auf der Domain, weil sie **nicht wirklich
authentifiziert** hat. Sobald echte Cognito-Authentifizierung verwendet wurde,
musste der Browser zum Authorization-Endpoint navigieren. Die aktuelle
Weiterleitung ist damit eine bewusste Folge der OIDC-Integration, keine
Regression eines zuvor funktionierenden same-origin Logins.

## 5. Konfigurationsbefund

- Produktionsbundle verwendet Pool `eu-central-1_ZURSMpD2O` und Client
  `5hb3f6dj5ialg77jf4blur9g6g`.
- `redirect_uri` ist `https://www.mays-job-matcher.app/auth/callback`.
- `response_type` ist `code`, Scope `openid email profile`.
- Die konkrete Cognito-Domain kommt aus der Discovery. Die committeten Audits
  (`04-01`, `04-03`) belegen für diese Konfiguration
  `authorization_endpoint: https://auth.mays-job-matcher.app/oauth2/authorize`.
  Eine aktuelle Discovery-Stichprobe aus dieser Umgebung lieferte die
  Prefix-Domain `ris-dev-jobsearch-dev.auth.eu-central-1.amazoncognito.com`.
  Beide Varianten sind externe Cognito-Domains; die genaue Domain ist für die
  Ursache nicht entscheidend.
- Eine Live-Browser-Verifikation der aktuell ausgelieferten Domain wurde in
  diesem Task nicht durchgeführt; die Produktionskonfiguration ist insoweit
  **NOT VERIFIED**.

Wichtig: `www.mays-job-matcher.app` und `auth.mays-job-matcher.app` sind
unterschiedliche Origins. Auch eine Cognito-Custom-Domain unter derselben
Registrierungsdomain bleibt ein anderer Host und damit ein anderer Origin.

## 6. Was die Ursache nicht ist

- Kein Vercel-Rewrite und kein fehlender React-Router-Eintrag.
- Kein Fehler in `AuthCallback`; dieser läuft erst nach der Rückkehr.
- Keine fehlende `redirect_uri`-Registrierung; die Rückkehr funktioniert.
- Keine Auswirkung der Gast-Jobsuche, von Apify, Redis, Budgets oder Cookies.
- Kein `mj_session`-Cookie und keine neue Gastkennung.

## 7. Optionen für echten Same-Host-Login

| Option | Same Host | Bewertung |
|---|---|---|
| OIDC Code + PKCE (aktuell) | nein | funktioniert, aber externe Cognito-Domain |
| `USER_SRP_AUTH` direkt | ja | technisch möglich; SRP-Bibliothek, JWT-Validierung und Storage nötig |
| `USER_PASSWORD_AUTH` direkt | ja | nicht Default; sicherheitlich schwächer; AWS-Änderung nötig |
| `USER_AUTH` direkt | ja | nicht Default; nicht nachgewiesen |
| Cognito Managed Login im iframe | optisch ja | externe Login-Seite, Framing-/CSP-Risiko; verworfen |
| Reverse-Proxy für Cognito | optisch ja | Cookie-/CSRF-/Origin-Komplexität; verworfen |
| BFF mit HttpOnly-Session | ja | neue Session-Architektur; außerhalb dieses Diagnose-Scopes |

Für einen echten same-host Login wäre der direkte SRP-Weg der naheliegende. Er
ist aber nicht Teil dieser Diagnose und wurde im vorherigen Bericht
`JM-AUTH-SAME-DOMAIN-LOGIN-01.md` wegen fehlender SRP-/Token-Abhängigkeiten und
fehlender MFA-/Testkonto-Verifikation gestoppt.

## 8. Empfehlung

1. **Wenn der Cognito-Redirect akzeptabel ist:** aktuelles Verhalten beibehalten.
   Die Rückkehr erfolgt same-origin auf `/auth/callback`; ggf. Ziel auf
   `/profil` korrigieren.
2. **Wenn der Host während der Anmeldung zwingend gleich bleiben muss:**
   separaten Implementierungsauftrag für `USER_SRP_AUTH` mit freigegebener
   SRP-Bibliothek, sicherer JWT-Validierung und entschiedener Token-Speicherung
   starten.
3. **Kein iframe/Proxy als kurzfristigen „Fix“** verwenden.

## 9. Testnachweise (Baseline, keine Codeänderung)

| Prüfung | Ergebnis |
|---|---|
| Auth-Tests (`authFlow`, `oidcConfig`, `LoginForm`, `AuthRoutes`, `ProfileRoute`) | PASS — 22 Tests |
| `npm test -- --run` | PASS — 1031 passed, 5 skipped |
| `npx tsc --noEmit -p tsconfig.app.json` | PASS |
| `npm run build` | PASS |
| `git diff --check` | PASS |
| Browser-Login auf Produktion | nicht ausgeführt |
| AWS-/Vercel-Deployment | keines |

## 10. Git

- Keine Codeänderung.
- Dokumentations-Commit: `6673d20`
- Remote-Synchronität: nach Push geprüft.
- Kein AWS-/Vercel-Deployment.

## 11. Offene Freigaben

1. Entscheidung: Cognito-Redirect akzeptieren oder echten same-host Login
   beauftragen.
2. Falls same-host: SRP-Bibliothek und JWT-Validierung freigeben.
3. Token-/Session-Speicherung entscheiden.
4. MFA-/New-Password-/Passwortreset-UX und Testkonto bereitstellen.
5. Zielroute nach Login auf `/profil` korrigieren.
6. Kein Deployment in diesem Task.
