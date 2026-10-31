# JM-AUTH-COGNITO-CUSTOM-DOMAIN-REGRESSION-01

**Art:** Auth-Regression / Infrastruktur-Ursache
**Code-Baseline:** `d1e6d4c`
**Aktueller HEAD:** `6f821c3` (nur Dokumentation)
**Status:** URSACHE IDENTIFIZIERT — keine Codeänderung, kein Deployment
**Ergebnis:** Nicht der Login-Code hat sich geändert, sondern die Cognito-Custom-Domain wurde per Terraform vom Jobsearch-Pool entfernt.

## 1. Beobachtung

Beim Klick auf „Anmelden“ verlässt der Browser die Domain
`mays-job-matcher.app` und landet auf einer Cognito-Domain.

Vorher war die sichtbare Login-Domain:

```text
auth.mays-job-matcher.app
```

Das ist eine Subdomain von `mays-job-matcher.app` und wirkte deshalb wie
„dieselbe Domain“. Aktuell wird die Cognito-Prefix-Domain verwendet:

```text
ris-dev-jobsearch-dev.auth.eu-central-1.amazoncognito.com
```

Damit ist die Registrierungsdomain `mays-job-matcher.app` sichtbar verlassen.

## 2. Code ist unverändert

Der Login-Code wurde seit dem 23.10.2026 nicht mehr geändert:

| Datei | Letzte Änderung |
|---|---|
| `src/lib/oidcConfig.ts` | `fb88729` (23.10.2026) |
| `src/lib/authFlow.ts` | `fb88729` (23.10.2026) |
| `src/components/LoginForm.tsx` | älterer Auth-UI-Commit |

Der Ablauf ist weiterhin:

```text
LoginForm
  → signIn(auth)
  → auth.signinRedirect()
  → Cognito-Authorization-Endpoint aus der OIDC-Discovery
```

`oidcConfig.authority` ist unverändert der Pool-Issuer:

```text
https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_ZURSMpD2O
```

Die konkrete Login-Domain wird **nicht im Code hardcodiert**, sondern aus der
OIDC-Discovery dieses Issuers gelesen. Ändert sich die Cognito-Domain, ändert
sich automatisch das Redirect-Ziel — ohne Code-Commit.

## 3. Tatsächliche Änderung: Custom Domain entfernt

### CloudTrail (read-only, Profil `mayaws`, Region `eu-central-1`)

Am **31.10.2026 um 07:41:21 +01:00** wurde ausgeführt:

```text
DeleteUserPoolDomain
domain:      auth.mays-job-matcher.app
userPoolId:  eu-central-1_ZURSMpD2O
user:        Mayaws
userAgent:   Terraform/1.16.1
             terraform-provider-aws/6.67.0
```

Direkt danach, um **07:41:32 +01:00**:

```text
CreateUserPoolDomain
domain:      mays-ris-dev
userPoolId:  eu-central-1_ojbmoiYGM
user:        Mayaws
userAgent:   Terraform/1.16.1
```

Es gab außerdem `UpdateUserPoolClient`-Events um 07:41:27–07:41:33, die
ebenfalls von Terraform stammen. Der entscheidende Vorgang ist die
Domain-Änderung.

### Aktueller AWS-Zustand

`describe-user-pool` für den Jobsearch-Pool:

```text
UserPoolId:   eu-central-1_ZURSMpD2O
Name:         ris-dev-jobsearch-dev-users
Domain:       ris-dev-jobsearch-dev
CustomDomain: null
```

`describe-user-pool-domain --domain auth.mays-job-matcher.app` liefert ein
leeres `DomainDescription`; die Custom Domain ist dem Pool nicht mehr
zugeordnet.

Die OIDC-Discovery liefert deshalb aktuell:

```text
authorization_endpoint:
  https://ris-dev-jobsearch-dev.auth.eu-central-1.amazoncognito.com/oauth2/authorize
```

Vorher — belegt in `04-01-OAUTH-CALLBACK-FIX-01-EXECUTION_LOG.md` und
`04-03-COGNITO-IDP-FIX-01-EXECUTION_LOG.md` — lieferte dieselbe Discovery:

```text
authorization_endpoint:
  https://auth.mays-job-matcher.app/oauth2/authorize
```

Das ist die Ursache des sichtbaren Domainwechsels.

## 4. Warum Terraform das getan hat

Im RIS-Terraform ist die Custom Domain standardmäßig deaktiviert:

```hcl
variable "identity_custom_domain_enabled" {
  default = false
}
```

Das Cognito-Modul ist wechselseitig exklusiv:

```hcl
resource "aws_cognito_user_pool_domain" "domain" {
  count = var.custom_domain_enabled ? 0 : 1
  domain = "${var.project_name}-${var.environment}"
}

resource "aws_cognito_user_pool_domain" "custom" {
  count = var.custom_domain_enabled ? 1 : 0
  domain = var.custom_domain
}
```

Ein Terraform-Apply ohne `identity_custom_domain_enabled=true` entfernt also
die Custom Domain und legt die Prefix-Domain an. Genau das ist am 31.10.
passiert. Es war **kein Jobsearch-Code-Commit** und keine Änderung an
`LoginForm`, `authFlow` oder `oidcConfig`.

## 5. DNS-Zustand

`auth.mays-job-matcher.app` löst teilweise noch auf einen alten
CloudFront-Endpunkt auf:

```text
d2oa751y8iy3p0.cloudfront.net
```

Die Cognito-Custom-Domain ist aber nicht mehr mit dem Pool verbunden. Der
DNS-Eintrag ist damit stale und darf nicht als Beweis für eine aktive
Custom Domain gewertet werden.

Bei einer Neuanlage der Custom Domain kann Cognito eine neue
CloudFront-Distribution vergeben. Der DNS-CNAME muss dann auf das neue Ziel
zeigen. Das ist separat zu prüfen.

## 6. Was das für den Login bedeutet

- Der Login funktioniert weiterhin über die Prefix-Domain.
- Die Anmeldung ist **nicht kaputt**; nur die sichtbare Domain hat sich
  geändert.
- `signinRedirect()` navigiert weiterhin zum Cognito-Authorization-Endpoint.
- Der Rückweg über `https://www.mays-job-matcher.app/auth/callback` bleibt
  same-origin.
- Kein Token-, Cookie- oder Sessionformat hat sich geändert.
- Keine Gast-Jobsuche, Apify-, Redis-, Budget- oder CV/ATS-Funktion ist
  betroffen.

## 7. Sichere Korrektur

### Empfohlen: Custom Domain wieder aktivieren

Das ist eine **AWS-/Terraform-Änderung**, nicht Teil dieses Diagnose-Tasks:

1. `identity_custom_domain_enabled = true` setzen.
2. `identity_custom_domain = "auth.mays-job-matcher.app"` setzen.
3. Vorhandenes ACM-Zertifikat in `us-east-1` über
   `identity_custom_domain_certificate_arn` referenzieren.
4. Terraform-Apply durch den zuständigen RIS-/Infra-Owner.
5. Read-only prüfen:
   - `describe-user-pool-domain --domain auth.mays-job-matcher.app`
   - `UserPoolId = eu-central-1_ZURSMpD2O`
   - `Status = ACTIVE`
   - OIDC-Discovery liefert wieder `auth.mays-job-matcher.app`.
6. DNS-CNAME auf die dann aktuelle CloudFront-Distribution setzen.
7. Browser-Test: Login-Button → `auth.mays-job-matcher.app` → Rückkehr auf
   `www.mays-job-matcher.app/auth/callback` → `/profil`.

Ein Code-Commit ist dafür voraussichtlich **nicht** erforderlich, weil die
Domain aus der Discovery kommt. Falls die Discovery nach der Wiederherstellung
noch die Prefix-Domain liefert, muss die Authority-/Discovery-Konfiguration
separat geprüft werden.

### Falls die Custom Domain nicht wiederhergestellt werden kann

Dann bleibt nur:

- Prefix-Domain akzeptieren, oder
- einen echten same-host Login über `USER_SRP_AUTH` implementieren.

Der SRP-Weg ist im Bericht `JM-RIS-COGNITO-SAME-HOST-LOGIN-02.md` wegen
fehlender Dependency-Freigabe und offener RIS-Akzeptanz weiterhin blockiert.

## 8. Abgrenzung

Nicht Ursache:

- kein neuer `LoginForm`-Code
- kein `signinRedirect()`-Refactor
- keine Änderung an `oidcConfig`
- kein Vercel-Rewrite
- kein React-Router-Fehler
- kein abgelaufenes oder ungültiges Cognito-Client-Secret

Ursache ist ausschließlich die entfernte Cognito-Custom-Domain.

## 9. Teststatus

| Prüfung | Ergebnis |
|---|---|
| Auth-Baseline | PASS — 22 Tests |
| Gesamtsuite | PASS — 1031 passed, 5 skipped |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| AWS-Read-only-Prüfung | durchgeführt |
| Browser-Login-Test | nicht durchgeführt |
| AWS-/Vercel-Deployment | keines |

## 10. Git

- Keine Codeänderung.
- Dokumentations-Commit: `cdbc632`
- Remote-Synchronität: nach Push geprüft.
- Kein AWS-/Terraform-/Vercel-Deployment in diesem Task.

## 11. Erforderliche Freigabe

1. Wiederherstellung der Custom Domain `auth.mays-job-matcher.app` am Pool
   `eu-central-1_ZURSMpD2O` durch den RIS-/Infra-Owner.
2. DNS-CNAME-Prüfung/Anpassung.
3. Read-only-Verifikation der Discovery.
4. Browser-Login-Test vor Produktionsfreigabe.
