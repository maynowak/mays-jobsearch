# 03-01 — JOBMATCHER-REGISTRATION-AWS-PREFLIGHT-01 — EXECUTION LOG

- **Current Status:** COMPLETE — read-only Preflight abgeschlossen, keine AWS-Änderung, keine Benutzerregistrierung.
- **Audit Date/Time:** 2026-10-23T09:56:03+02:00 (Europe/Berlin)
- **Git Branch + HEAD at audit start:** `feature/registration-email-only`, `b38f27f7ddab76d2791ec7bacb449c485bebb157`
- **Relevant commits:**
  - `f752789d810ac68024a2ef9b6bb8cd4252bdc693` — `feat(auth): use email as username in two-field registration`
  - `b38f27f7ddab76d2791ec7bacb449c485bebb157` — `docs: record email-only registration and mark old report superseded`
- **Audit Scope:** Repository-/Branch-/Commit-Prüfung; Ermittlung von AWS-Account, Region, Cognito-Pool-ID und App-Client aus der Projektkonfiguration; read-only `DescribeUserPool` und `DescribeUserPoolClient`; Bewertung der Kompatibilität der E-Mail-als-Username-Registrierung.
- **Mode:** READ-ONLY. Kein Merge, kein Rebase, kein Reset, kein Force-Push, kein Deployment, keine AWS-Mutation.

## Completed Audit Sections

1. Repository, Branch und Commit-SHAs verifiziert.
2. AWS-CLI und Credentials geprüft.
3. AWS-Account, Region und Cognito-Pool-ID aus Projektkonfiguration ermittelt.
4. `describe-user-pool` read-only ausgeführt.
5. `UsernameAttributes` und `AliasAttributes` geprüft.
6. `describe-user-pool-client` read-only ausgeführt und sicherheitsrelevant gefiltert.
7. Frontend-Kompatibilität mit der Pool-Konfiguration bewertet.
8. Keine Benutzerregistrierung und keine AWS-Mutation durchgeführt.
9. Ergebnis dokumentiert.

## Actual Findings

### Repository / Git

- Branch: `feature/registration-email-only`
- HEAD: `b38f27f7ddab76d2791ec7bacb449c485bebb157`
- `f752789` und `b38f27f` existieren mit den erwarteten Commit-Messages.
- Keine tracked Änderungen im Working Tree.
- Die bestehenden 9 untracked Dateien aus dem vorherigen Audit wurden nicht verändert.
- Kein Push, kein Merge, kein Rebase, kein Deployment.

### AWS-Zugriff

- AWS CLI: `aws-cli/2.34.44`
- Erfolgreicher Profilaufruf: `--profile mayaws`
- Aufruf ohne `--profile mayaws` (Default-Profil) wurde bei `DescribeUserPool` mit `AccessDeniedException` abgelehnt und nicht weiterverwendet.
- AWS Account: `240571105849`
- IAM User: `Mayaws` (nur zur Identitätsbestätigung; keine Credentials ausgegeben)
- Region: `eu-central-1`

### Projektkonfiguration

Quelle: `src/lib/oidcConfig.ts`

- Region-Fallback: `eu-central-1`
- User-Pool-ID-Fallback: `eu-central-1_ojbmoiYGM`
- Client-ID-Fallback: `7ldhihlpdgsgcl3puvu4oi7ksv`
- Keine `VITE_AWS_REGION`, `VITE_COGNITO_USER_POOL_ID` oder `VITE_COGNITO_CLIENT_ID` in den geprüften lokalen `.env`-Dateien gefunden; die Fallbacks der Projektkonfiguration sind maßgeblich.

### Cognito User Pool

Read-only via `aws cognito-idp describe-user-pool --profile mayaws --region eu-central-1 --user-pool-id eu-central-1_ojbmoiYGM`.

| Feld | Ergebnis |
|---|---|
| Pool-ID | `eu-central-1_ojbmoiYGM` |
| Name | `ris-dev-dev-users` |
| `UsernameAttributes` | **nicht gesetzt** (`[]`) |
| `AliasAttributes` | **nicht gesetzt** (`[]`) |
| `UsernameConfiguration` | **nicht gesetzt** (AWS-Default; keine explizite Case-Sensitivity-Konfiguration) |
| `AutoVerifiedAttributes` | `["email"]` |
| `email`-Schema-Attribut | vorhanden, `Required: false` |
| `AllowAdminCreateUserOnly` | `false` (Self-Signup erlaubt) |
| `EstimatedNumberOfUsers` | `2` |
| `MfaConfiguration` | `OFF` |
| `UserPoolTier` | `ESSENTIALS` |

**Kernbefund:** Der Pool ist **nicht** mit `UsernameAttributes: ["email"]` und **nicht** mit `AliasAttributes: ["email"]` konfiguriert. Er verwendet das Standard-Username-Modell mit einem separaten `username`-String. Die E-Mail ist ein separates, optionales `email`-Attribut.

### App Client

Read-only via `aws cognito-idp describe-user-pool-client ... --client-id 7ldhihlpdgsgcl3puvu4oi7ksv`, gefiltert mit `jq` (kein `ClientSecret` ausgegeben).

| Feld | Ergebnis |
|---|---|
| Client-ID | `7ldhihlpdgsgcl3puvu4oi7ksv` |
| Client-Name | `ris-dev-dev-client` |
| User-Pool-ID | `eu-central-1_ojbmoiYGM` (matcht) |
| Client-Secret vorhanden | **nein** (`GenerateSecret: false`) |
| `ExplicitAuthFlows` | `ALLOW_REFRESH_TOKEN_AUTH`, `ALLOW_USER_PASSWORD_AUTH` |
| `AllowedOAuthFlows` | `code` |
| `AllowedOAuthScopes` | `email`, `openid`, `profile` |
| Callback-URLs | `http://localhost:5173/auth/callback`, `https://mays-job-matcher.vercel.app/auth/callback`, `https://www.mays-job-matcher.app/auth/callback` |
| Logout-URLs | `http://localhost:5173/`, `https://mays-job-matcher.vercel.app/`, `https://www.mays-job-matcher.app/` |
| Identity Provider | `COGNITO` |
| Token Revocation | aktiviert |
| Auth Session Validity | 3 Minuten |
| Refresh Token Validity | 30 (Default-Einheit) |

### Frontend-Kompatibilität

Aktueller Code:

- `src/lib/cognitoAuthApi.ts` — `cognitoSignUp({ email, password })` sendet:
  - `Username: email`
  - `UserAttributes: [{ Name: "email", Value: email }]`
- `src/components/RegisterForm.tsx` — zwei Felder: E-Mail und Passwort.
- `src/components/EmailConfirmation.tsx` — liest `email` (Fallback `username`) und sendet `Username: email` an `ConfirmSignUp`/`ResendConfirmationCode`.

Bewertung:

- Der Pool akzeptiert `Username` als String. E-Mail-Adressen bestehen aus zulässigen Zeichen (u. a. `@`, `.`, `+`, `-`, `_`) und können daher als Username-String verwendet werden.
- Self-Signup ist erlaubt (`AllowAdminCreateUserOnly: false`).
- E-Mail-Verifikation ist aktiv (`AutoVerifiedAttributes: ["email"]`).
- Der App-Client ist ein Public Client ohne Secret und unterstützt den Authorization-Code-Flow mit den benötigten Scopes.
- Die Registrierung ist mit der **aktuellen** Pool-Konfiguration statisch kompatibel.

**Wichtige Einschränkung:** Es handelt sich nicht um Cognitos natives „E-Mail als Username“-Modell. Dafür müsste `UsernameAttributes` auf `["email"]` gesetzt sein. Das ist bei diesem Pool nicht der Fall und wäre eine AWS-Änderung, die außerhalb dieses read-only Auftrags liegt. Die aktuelle Lösung funktioniert, weil die E-Mail als String im `Username`-Feld transportiert wird.

**Weitere Einschränkung:** `UsernameConfiguration` ist nicht gesetzt. Ohne explizite Konfiguration ist von der AWS-Default-Case-Sensitivity auszugehen. Groß-/Kleinschreibung der E-Mail sollte im Integrationstest berücksichtigt werden; eine Frontend-Normalisierung (z. B. `trim().toLowerCase()`) ist eine mögliche Folgeentscheidung, wurde hier nicht umgesetzt.

### Sicherheit / Read-Only-Nachweis

- Ausgeführte AWS-Operationen: `sts:GetCallerIdentity`, `cognito-idp:DescribeUserPool`, `cognito-idp:DescribeUserPoolClient`, `configure get region`.
- Keine `SignUp`, `ConfirmSignUp`, `AdminCreateUser`, `CreateUserPool`, `UpdateUserPool`, `DeleteUserPool` oder andere mutierende AWS-Operationen.
- Keine echten Benutzer registriert, bestätigt oder gelöscht.
- Keine Access Keys, Secrets, Tokens oder `ClientSecret` ausgegeben.
- Keine AWS-Ressourcen verändert.

## Evidence / File References

- `src/lib/oidcConfig.ts` — Region, Pool-ID, Client-ID.
- `src/lib/cognitoAuthApi.ts` — `Username: email`, `email`-Attribut.
- `src/components/RegisterForm.tsx` — zwei Felder.
- `src/components/EmailConfirmation.tsx` — `Username: email` bei Confirm/Resend.
- `docs/reports/02-01-REGISTRATION-EMAIL-ONLY-EXECUTION_LOG.md` — vorherige Implementierung.
- `docs/reports/JOBMATCHER-RIS-COGNITO-INTEGRATION-04.md` — historischer Drei-Feld-Bericht, als superseded markiert.

## Classification

- **Read-only Preflight:** **GREEN** — alle Prüfungen erfolgreich, keine Blocker, keine Mutation.
- **Registrierungskompatibilität:** **PASS (statisch)** — kompatibel mit der aktuellen Pool-Konfiguration.
- **Production-E2E-Bereitschaft:** **YELLOW** — Live-SignUp/Confirm/Login noch nicht durchgeführt; native E-Mail-als-Username-Semantik nicht aktiviert.

## Terraform Checks

- Keine Terraform-Kommandos ausgeführt.
- Keine Terraform-Dateien gelesen oder geändert.
- Nicht anwendbar für diesen read-only Cognito-Preflight.

## Git Status

- Branch: `feature/registration-email-only`
- HEAD at audit start: `b38f27f7ddab76d2791ec7bacb449c485bebb157`
- Tracked Working Tree: sauber (`git diff --stat` leer).
- Untracked: 9 bestehende Dateien aus dem vorherigen Audit, unverändert.
- Kein Push, kein Merge, kein Rebase, kein Reset, kein Force-Push, kein Deployment.

## Files Changed

- **Neu:** `docs/reports/03-01-REGISTRATION-AWS-PREFLIGHT-01-EXECUTION_LOG.md`
- **Keine Änderungen** an Quellcode, Konfiguration, AWS-Ressourcen oder bestehenden untracked Dateien.

## Explicit No-Change Confirmation

Es wurden **keine** Anwendungsdateien, AWS-Ressourcen, Benutzer, Branches oder bestehenden untracked Dateien verändert. Die einzige Dateiänderung ist dieser neue Execution Log.

## Open Questions

1. Soll Cognitos **natives** E-Mail-als-Username-Modell (`UsernameAttributes: ["email"]`) verwendet werden? Das würde eine AWS-Pool-Änderung bzw. einen neuen Pool erfordern und ist nicht Teil dieses Auftrags.
2. Soll die E-Mail im Frontend vor `SignUp`/`ConfirmSignUp` normalisiert werden (z. B. `trim().toLowerCase()`), um Case-Sensitivity-Risiken zu reduzieren?
3. Soll der Legacy-Fallback `?username=…` dauerhaft bleiben oder nach einer Übergangszeit entfernt werden?

## Risks

- **Case Sensitivity:** Ohne `UsernameConfiguration` kann die E-Mail als Username case-sensitiv sein; unterschiedliche Schreibweisen könnten zu Problemen bei Registrierung/Login führen.
- **Kein natives E-Mail-Username:** Cognito validiert und behandelt die E-Mail nicht als kanonischen Username; die Semantik hängt von der Frontend-Übertragung ab.
- **E2E offen:** Es wurde kein echter SignUp/Confirm/Login durchgeführt; die statische Kompatibilität ist keine Live-Bestätigung.
- **Bestehende Pool-Nutzer:** Der Pool hat bereits 2 Benutzer. Eine spätere Änderung des Username-Modells wäre migrationskritisch.

## Recommended Next Actions

1. **Merge-Empfehlung:** Der Branch ist mit der aktuellen Pool-Konfiguration kompatibel. Vor Merge optional Preview-E2E durchführen; der Merge selbst ändert keine AWS-Ressourcen.
2. **Production-E2E:** Nach expliziter Freigabe mit einer dedizierten Test-E-Mail registrieren, Bestätigungscode eingeben und Login prüfen. Testbenutzer anschließend nur mit separater AWS-Freigabe entfernen.
3. **Wenn natives E-Mail-als-Username gewünscht ist:** Separaten AWS-Change-/Migrationsauftrag planen; `UsernameAttributes` ist nicht nachträglich trivial änderbar und betrifft bestehende Benutzer.
4. **Frontend-Follow-up:** Entscheidung über E-Mail-Normalisierung (`trim().toLowerCase()`) und über die Lebensdauer des `username`-Fallbacks dokumentieren.

## Current Resume Point

Read-only Preflight abgeschlossen. Cognito-Konfiguration ist verifiziert; Registrierung ist statisch kompatibel (PASS), aber nicht live getestet. Nächster Schritt nach Freigabe: Preview-/Production-E2E mit Test-E-Mail, ohne AWS-Mutationen ohne separate Genehmigung.
