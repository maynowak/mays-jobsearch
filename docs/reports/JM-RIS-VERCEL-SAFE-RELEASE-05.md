# JM-RIS-VERCEL-SAFE-RELEASE-05

- Datum: 2026-11-06
- Status: **BLOCKED — PREVIEW RELEASE NOT AUTHORIZED**
- Repository: `/home/dci-student/projects/Mays-Jobsearch`
- Branch: `main`
- Kein Push, kein Deployment, keine Vercel-Env-/Secret-Mutation

## 1. Git- und Vercel-Baseline

| Item | Wert |
|---|---|
| Baseline | `4b74695` |
| Code-Commit DRAFT-Sperre | `d05a953` |
| `origin/main` | `f59aa4b` |
| Preview-Branch lokal | `preview/jm-ris-safe-release-05` @ `d05a953` |
| Worktrees | nur Haupt-Checkout |
| Untracked | 4 bekannte Dokumente unverändert |

Vercel-Projekt:

```text
mays-job-matcher
prj_wdzpRfrGENG82Txi9Sa9QTzKruk9
Team: maymilly
Git: maynowak/mays-jobsearch
Production Branch: main
```

Die aktive Projektverbindung und die offizielle Projekt-API bestätigen `mays-job-matcher`. Die veraltete `.vercel/repo.json`-Zuordnung zu `mays-jobsearch` bleibt unverändert und wurde nicht verwendet.

## 2. Effektive Preview-Secret-Isolation

**Status: BLOCKED.**

`RIS_API_KEY` ist aktuell zugeordnet zu:

```text
Production, Preview, Development
```

Damit ist der Partner-Key global im Preview-Scope und nicht auf den freigegebenen Testbranch begrenzt. Eine branch-spezifische Kopie allein wäre keine Isolation, solange der globale Preview-Eintrag bestehen bleibt.

Es wurden keine Secret-Werte gelesen, heruntergeladen oder protokolliert. Kein `vercel env pull`.

### Einmaliger Umstellungsplan (Betreiberfreigabe erforderlich)

1. Freigabe für die Entfernung des **Preview-Targets** von `RIS_API_KEY` einholen; Production/Development müssen erhalten bleiben.
2. Nach Freigabe:

```bash
vercel env rm RIS_API_KEY preview
```

3. Prüfen, dass Production und Development weiterhin `RIS_API_KEY` enthalten und Preview keinen globalen Eintrag mehr hat.
4. Branch-spezifischen Key ausschließlich über den sicheren Betreiberweg setzen:

```bash
vercel env add RIS_API_KEY preview \
  --git-branch preview/jm-ris-safe-release-05 \
  --sensitive
```

Der Wert darf nicht über Shell-History, Logs oder Reports laufen. Keine Rotation, keine neue Credential-Ausstellung.

5. Prüfen:

```bash
vercel env ls --environment preview
vercel env ls --environment preview --git-branch preview/jm-ris-safe-release-05
```

Erwartung: kein globaler Preview-Key; genau ein branch-spezifischer Key.

### Bestehende Preview-Deployments

Mindestens zwei **Ready**-Preview-Deployments aus der Zeit der globalen Preview-Zuordnung existieren (u. a. Deployment-IDs `rftu7nbo9`, `p9m1g8bnb`). Neuere Preview-Deployments stehen überwiegend auf `Error`. Historische Preview-Deployments mit globalem Key sind als exponiert zu behandeln und dürfen nicht als Testumgebung verwendet werden.

## 3. Deployment Protection

**Status: BLOCKED.**

Die Projekt-API meldet:

```text
protection: null
passwordProtection: null
ssoProtection: null
gitForkProtection: true
```

Preview-Deployments sind damit nicht durch Vercel Authentication geschützt. `gitForkProtection` allein reicht nicht.

Erforderlich nach Betreiberfreigabe:

- Vercel Authentication für **Preview** aktivieren,
- Production öffentlich lassen,
- keine Shareable Links oder Protection-Ausnahmen,
- keine unkontrollierten Bypass-Tokens.

Es wurden keine Protection-Einstellungen verändert.

## 4. Tatsächliche Environment-Konfiguration (nur Namen/Scopes)

Preview enthält derzeit:

```text
RIS_API_KEY  Secret  Production, Preview, Development
```

Folgende Zielvariablen fehlen in Preview:

```text
RIS_CONSENT_SERVICE_ENABLED
RIS_APPLICATION_STORAGE_ENABLED
VITE_RIS_CONSENT_UI_ENABLED
VITE_RIS_APPLICATION_STORAGE_ENABLED
VITE_RIS_APPLICATION_MIGRATION_MOCK
RIS_API_BASE_URL
RIS_COGNITO_ISSUER
RIS_COGNITO_CLIENT_ID
RIS_TEST_USER_ALLOWLIST
RIS_CONSENT_NOTICE_VERSION
```

`RIS_CONSENT_NOTICE_VERSION` darf wegen **DRAFT** nicht gesetzt werden.

`VITE_REDIRECT_URI` und `VITE_POST_LOGOUT_REDIRECT_URI` sind global für Production, Preview und Development konfiguriert. Die Werte wurden nicht gelesen; Preview erbt damit voraussichtlich die produktiven Redirect-Ziele.

## 5. Veröffentlichter Preview-Commit

Lokaler Release-Commit:

```text
preview/jm-ris-safe-release-05
d05a953 feat(ris): gate consent grant on server approval
```

Der Branch ist **nicht gepusht**. Er enthält exakt den Code-Commit der DRAFT-Sperre.

## 6. Deployment-ID und Preview-URL

```text
Deployment ID: NONE
Preview URL: NONE
```

Es wurde kein Deployment erstellt.

## 7. Tatsächliche Function-Anzahl

Lokaler Vercel-Build erfolgreich:

```text
12 Functions
```

Enthalten:

```text
api/ris/router.func
```

Keine zusätzliche Function durch die DRAFT-Sperre. `vercel.json` und Router bleiben unverändert.

## 8. Routing-Tests

Lokal:

- Applications-Route → Applications-Handler,
- Consent-Route → Consent-Handler,
- Query-/Method-/Body-/Header-Erhalt,
- unbekannte und verschachtelte Pfade → 404,
- direkter Router-Aufruf → 307 auf `/404`,
- widersprüchliche Dispatch-Flags → 404.

**Status: PASS lokal.** Ein echter Vercel-Runtime-Test ist ohne Preview-Deployment **NOT TESTED**.

## 9. Consent-Statusabfrage

Lokale Tests bestätigen:

- GET `/api/ris/consents` mit gültigem Testbenutzer und aktiver Konfiguration liefert den RIS-Status,
- ohne Token → 401,
- nicht erlaubter Testbenutzer → 403,
- fehlende Konfiguration → 503,
- Applications-ON/Consent-OFF → Consent 503 `consent_disabled`.

**Live-Preview: NOT TESTED** (kein Deployment).

## 10. Consent-Historie

Der BFF-Pfad `GET /api/ris/consents?action=history` ist lokal getestet und unverändert.

**Live-Preview: NOT TESTED** (kein Deployment).

## 11. DRAFT-/Grant-Sperre

Die UI wurde minimal abgesichert:

- BFF-GET liefert jetzt `grantAllowed` nur bei serverseitig gesetzter Notice-Version,
- `StorageConsentLive` aktiviert „Speicherung zustimmen“ nur bei `grantAllowed === true`,
- ohne Notice-Version bleibt der Button deaktiviert und ein Hinweis wird angezeigt,
- der Server blockiert Grant unabhängig davon weiterhin mit `503 notice_version_not_mapped`.

`RIS_CONSENT_NOTICE_VERSION` ist nicht gesetzt. Es wurde kein Grant ausgeführt. Keine produktive Zustimmung, keine DRAFT-Zustimmung.

## 12. ApplicationV1-Speichersperre

- `RIS_APPLICATION_STORAGE_ENABLED` ist in Preview nicht gesetzt → Default OFF.
- Applications-BFF bleibt bei deaktivierter Speicherung gesperrt.
- Keine ApplicationV1-Live-Writes.
- Keine dauerhafte Bewerbungsspeicherung.
- Kein Consent-Enforcement für Applications aktiviert.

## 13. Cognito-Callback-Kompatibilität

**Status: BLOCKED.**

`VITE_REDIRECT_URI` und `VITE_POST_LOGOUT_REDIRECT_URI` sind global für Preview konfiguriert und zeigen nicht auf eine bestätigte Preview-Domain. Ohne Betreiberbestätigung, dass die Preview-URL im Cognito-OAuth-Client als Redirect-URI freigegeben ist, kann der authentifizierte Browser-E2E nicht durchgeführt werden.

Es wurden keine Cognito-, Hosted-UI-, DNS- oder CloudFront-Änderungen vorgenommen.

## 14. Tests und Build

| Prüfung | Ergebnis |
|---|---|
| Applications | **29 / 29 PASS** |
| Consents | **10 / 10 PASS** |
| Routing | **11 / 11 PASS** |
| Config-Separation | **6 / 6 PASS** |
| StorageConsentLive | **2 / 2 PASS** |
| Gesamtsuite | **1531 passed / 5 skipped** |
| Build | **PASS** |
| API-Syntax | **PASS** |
| `git diff --check` | **PASS** |
| Vercel-Build | **12 Functions** |

## 15. Offene Blocker und nächste konkrete Aktion

### P0 — vor jedem Preview-Deployment

1. **Secret-Isolation:** Betreiberfreigabe für `vercel env rm RIS_API_KEY preview` und branch-spezifische NeuZuordnung über sicheren Betreiberweg.
2. **Preview Protection:** Vercel Authentication für Preview aktivieren; Production öffentlich lassen.
3. **Preview-Env:** freigegebene Werte für Basis-URL, Issuer, Client, Allowlist und die Ziel-Flags setzen; `RIS_CONSENT_NOTICE_VERSION` bleibt ungesetzt.
4. **Cognito:** Preview-Redirect-URI im OAuth-Client bestätigen und Preview-Redirect-Env sicher setzen.

### Danach

5. `preview/jm-ris-safe-release-05` (`d05a953`) pushen — nur mit separater Freigabe.
6. Preview-Deployment erstellen; Deployment-ID/URL dokumentieren.
7. Runtime-Smoke: beide öffentlichen Routen, Router-Redirect, 401/503, Consent-Status/History, Grant-Sperre, Applications-Sperre.
8. Keine Production-Promotion.

**Nächste Aktion:** Betreiberfreigabe für P0-Punkte 1–4; ohne diese bleibt der Preview-Release blockiert.
