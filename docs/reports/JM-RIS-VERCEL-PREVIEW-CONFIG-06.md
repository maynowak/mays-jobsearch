# JM-RIS-VERCEL-PREVIEW-CONFIG-06

- Datum: 2026-11-06
- Status: **BLOCKED — PREVIEW SECRET ISOLATION BLOCKED**
- Ausführung: Commander / read-only Prüfung; **keine Vercel-Mutation**
- Repository: `/home/dci-student/projects/Mays-Jobsearch`
- Branch: `main`

## 1. Git-Baseline

| Item | Wert |
|---|---|
| HEAD | `53cbcd4` |
| `origin/main` | `7a3d2ea` |
| Divergenz | **1 ahead / 0 behind** |
| Erwartete Baseline | `7a3d2ea` / 0/0 |
| Abweichung | lokaler Commit `53cbcd4` (Vercel-Hobby-Function-Limit-Fix) |
| Untracked | 4 bekannte Dokumente unverändert |

Bewertung: `53cbcd4` entfernt den deprecated `/api/model`-Endpoint und reduziert die Serverless Functions von 13 auf 12. Der Fix ist lokal und **nicht gepusht**. Ein Preview-Deployment von `origin/main` (`7a3d2ea`) würde weiterhin 13 Functions enthalten und am Hobby-Limit scheitern. Push/Deploy sind separat freizugeben.

## 2. Vercel-Projektidentität

| Item | Wert |
|---|---|
| Aktiver Link `.vercel/project.json` | `mays-job-matcher` / `prj_wdzpRfrGENG82Txi9Sa9QTzKruk9` |
| Team | `maymilly` / `team_yrHBsvD4DskH7V5U4ZWYddIj` |
| Git-Link (offizielle Projekt-API) | `maynowak/mays-jobsearch`, Production Branch `main` |
| Node.js | 24.x |
| Root Directory | `.` |

Caveat: `.vercel/repo.json` enthält eine abweichende/veraltete Zuordnung zu Projekt `mays-jobsearch` (`prj_j6Ak...`). Der aktive CLI-Link und die offizielle Projekt-API bestätigen `mays-job-matcher`; `.vercel/repo.json` wurde nicht verändert.

## 3. Preview-Isolationsprüfung

| Prüfung | Ergebnis |
|---|---|
| Git-Branches mit Preview-Zugriff | jeder Preview-Deployment eines internen Branches; aktuell 14 Remote-Branches |
| Branch-scoped Preview-Env | keine (`--git-branch main` → keine Variablen) |
| `RIS_API_KEY` in Preview | vorhanden, **global für alle Preview-Deployments** |
| Preview-Schutz | `protection=null`, `passwordProtection=null`, `ssoProtection=null`; nur `gitForkProtection=true` |
| Key für Preview ausdrücklich zulässig | nicht dokumentiert/nicht bestätigt |
| Production unverändert | ja; keine Mutation in diesem Task |

Bewertung: Die geforderte Isolation ist **nicht** gegeben. Der Partner-Key ist bereits global im Preview-Environment hinterlegt; jede Preview-Deployment eines internen Branches erhält ihn. Eine branch-scoped Zuordnung würde das globale Secret nicht ersetzen. Ein sicheres Kopieren/Scope des vorhandenen Secret-Werts ist über die CLI nicht möglich, ohne den Wert zu lesen (verboten). Daher **STOP — keine Secret-Zuordnung, keine Env-Mutation**.

## 4. Vorhandene Preview-Konfiguration (nur Namen)

| Variable | Preview |
|---|---|
| `RIS_API_KEY` | vorhanden (Secret, global Preview) |
| `RIS_API_BASE_URL` | fehlt |
| `RIS_COGNITO_ISSUER` | fehlt |
| `RIS_COGNITO_CLIENT_ID` | fehlt |
| `RIS_TEST_USER_ALLOWLIST` | fehlt |
| `RIS_APPLICATION_STORAGE_ENABLED` | fehlt → Code-Default OFF |
| `VITE_RIS_APPLICATION_STORAGE_ENABLED` | fehlt → Code-Default OFF |
| `VITE_RIS_APPLICATION_MIGRATION_MOCK` | fehlt → Code-Default OFF |

Production: `RIS_API_KEY` unverändert; keine weiteren RIS-Variablen. Development: `RIS_API_KEY`.

## 5. API-Vertrag

- ApplicationV1-Endpunkte und Fehlermapping sind lokal/mock verifiziert.
- `RIS_API_BASE_URL`: kein offiziell bestätigter HTTPS-Partnerendpunkt vorhanden/verifiziert → **Vertragslücke**.
- `RIS_COGNITO_ISSUER` / `RIS_COGNITO_CLIENT_ID`: nicht durch veröffentlichte Partnerdokumentation bestätigt → **Vertragslücke**.
- `RIS_API_KEY`: nur Existenz geprüft; Berechtigung für Preview und Ziel-RIS-Umgebung nicht verifiziert.
- Keine RIS-Interna als Vertragsbeweis verwendet.

## 6. Testbenutzer und Allowlist

- `RIS_TEST_USER_ALLOWLIST` fehlt in Preview → fail-closed; alle Requests werden verweigert.
- Der zuvor genutzte synthetische RIS-LIVE-E2E-04-Nutzer wurde laut Vorgeschichte gelöscht; die aktuelle Gültigkeit des bestehenden Jobsearch-Testbenutzers wurde nicht verifiziert (kein Live-Request).
- Keine Benutzerkennung, E-Mail, JWT oder Credential-Werte in diesem Report.
- Status: **BLOCKED**.

## 7. Tests

| Prüfung | Ergebnis |
|---|---|
| BFF + Boundary | **35 / 35 PASS** |
| Gesamtsuite (HEAD `53cbcd4`) | **1502 passed / 5 skipped** |
| Build | **PASS** |
| API-Syntax (`node --check`) | **PASS** |
| `git diff --check` | **PASS** |

## 8. Konfigurationsänderungen

**Keine.** Keine Vercel-Env-Mutation, kein Secret gelesen/ausgegeben, kein Deployment, kein Push.

## 9. Erforderliche Freigaben / Betreiberhandlungen

1. **Preview-Key-Isolation:** Entscheidung, ob `RIS_API_KEY` aus Preview entfernt und branch-scoped neu gesetzt wird; der Betreiber muss den Secret-Wert sicher setzen. Ohne diese Entscheidung bleibt Preview blockiert.
2. **API-Vertrag:** offizielle `RIS_API_BASE_URL`, bestätigter Issuer/Client.
3. **Testbenutzer:** Gültigkeit bestätigen und `RIS_TEST_USER_ALLOWLIST` serverseitig setzen (nicht im Repo/Log).
4. **Function-Limit:** `53cbcd4` pushen, sonst scheitert jedes Preview-Deployment von `origin/main` an 13 Functions.
5. **Preview-Schutz:** Password/SSO oder äquivalente Zugriffsbeschränkung für die Test-Preview.
6. **Deployment/E2E:** separater Auftrag; Remote-Flags bleiben OFF bis dahin.

## 10. Nächster Schritt

Keine Konfigurationsänderung in diesem Auftrag. Nach Betreiberfreigabe für Isolation, Vertrag und Testidentität: Preview-Env setzen, neues Preview-Deployment, danach separater E2E.
