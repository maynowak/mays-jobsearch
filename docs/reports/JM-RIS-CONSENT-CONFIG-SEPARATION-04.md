# JM-RIS-CONSENT-CONFIG-SEPARATION-04

- Datum: 2026-11-06
- Status: **COMPLETE — LOCAL VERIFIED**
- Repository: `/home/dci-student/projects/Mays-Jobsearch`
- Branch: `main`
- Baseline: `40356e6`
- Kein Push, kein Deployment, keine Vercel-Env-Änderung

## 1. Ausgangsstand

| Item | Wert |
|---|---|
| HEAD vor der Änderung | `40356e6` |
| `origin/main` | `f59aa4b` |
| Divergenz | 1 ahead / 0 behind |
| Worktrees | nur der Haupt-Checkout |
| Untracked Dokumente | 4 bekannte Dateien unverändert |

Der Consent-BFF hing bisher am Applications-Schalter `RIS_APPLICATION_STORAGE_ENABLED`. Dadurch konnte der Consent-Service nicht unabhängig getestet oder aktiviert werden.

## 2. Umsetzung

### Gemeinsame Verbindungsdaten

`api/_lib/ris/config.mjs` verwendet jetzt einen gemeinsamen Helper `sharedRisConfig()` für:

- `RIS_API_BASE_URL`
- `RIS_PARTNER_CREDENTIAL` / `RIS_API_KEY` / `RIS_API_CREDENTIAL`
- `RIS_COGNITO_ISSUER`
- `RIS_COGNITO_CLIENT_ID`
- `RIS_TEST_USER_ALLOWLIST`
- `RIS_API_TIMEOUT_MS`

### Getrennte Aktivierung

| Dienst | Schalter | Default |
|---|---|---|
| Applications | `RIS_APPLICATION_STORAGE_ENABLED` | OFF |
| Consent | `RIS_CONSENT_SERVICE_ENABLED` | OFF |

`risConsentConfig()` prüft ausschließlich `RIS_CONSENT_SERVICE_ENABLED`. Es besteht keine Abhängigkeit von `RIS_APPLICATION_STORAGE_ENABLED`.

`risConfig()` für Applications bleibt unverändert an `RIS_APPLICATION_STORAGE_ENABLED` gebunden.

### Consent-Handler

`api/_lib/ris/consentsHandler.mjs` verwendet jetzt `risConsentConfig()` statt `risConfig()`:

- deaktiviert → `503 consent_disabled`,
- aktiviert, aber gemeinsame Verbindungsdaten fehlen → `503 missing_config`,
- Authentifizierung, Allowlist, Zweckvalidierung und `RIS_CONSENT_NOTICE_VERSION` bleiben unverändert,
- der Browser kann weiterhin keine Erklärungsversion vorgeben,
- ohne freigegebene Notice-Version bleibt Grant bei `503 notice_version_not_mapped`.

### Unverändert

- Applications-Handler und Applications-Verhalten,
- öffentliche Routen `/api/ris/applications` und `/api/ris/consents`,
- Router-Konsolidierung und `vercel.json`,
- Function-Anzahl,
- Feature-Flags für produktive Speicherung,
- keine neue Consent-Architektur.

## 3. Verhaltensmatrix

| Consent-Service | Application-Storage | Ergebnis |
|---|---|---|
| OFF | OFF | Beide Dienste deaktiviert |
| ON | OFF | Consent erlaubt; Applications `503 ris_disabled` |
| OFF | ON | Consent `503 consent_disabled`; Applications unverändert |
| ON | ON | Beide technisch erreichbar, jeweils mit eigener Auth-/Allowlist-Prüfung |

Zusätzlich verifiziert:

- fehlender Token → `401`,
- ungültiger Token → `401`,
- nicht erlaubter Testbenutzer → `403`,
- fehlende gemeinsame Konfiguration → `503 missing_config`,
- fehlende Notice-Version → kein Grant (`503 notice_version_not_mapped`).

## 4. Tests

| Prüfung | Ergebnis |
|---|---|
| Applications | **29 / 29 PASS** |
| Consents | **9 / 9 PASS** |
| Routing | **11 / 11 PASS** |
| Config-Separation | **6 / 6 PASS** |
| Gesamtsuite | **1528 passed / 5 skipped** |
| Build | **PASS** |
| API-Syntax | **PASS** |
| `git diff --check` | **PASS** |

Die Consent-Tests laufen mit `RIS_APPLICATION_STORAGE_ENABLED=false`, um die Unabhängigkeit explizit nachzuweisen. Die Applications-Tests prüfen zusätzlich, dass `RIS_CONSENT_SERVICE_ENABLED=true` die Applications-Sperre nicht aufhebt.

## 5. Vercel-Function-Anzahl

Lokaler Vercel-Build:

```text
vercel build --non-interactive
```

Erzeugte Functions: **12** — unverändert.

```text
api/ris/router.func
```

Es wurde **keine zusätzliche Function** erzeugt. `vercel.json` und die Router-Konsolidierung bleiben unverändert.

## 6. Sicherheit und Datenschutz

- Keine Änderung an RIS, AWS, Cognito, CloudFront, DNS oder Terraform.
- Keine Vercel-Env-Variablen gesetzt oder verändert.
- Keine echten Bewerberdaten, keine echten RIS-Requests, keine Live-Writes.
- Keine Aktivierung des ApplicationV1-Consent-Enforcements.
- Keine produktive Speicherung.
- Preview-Secret-Isolation bleibt ein separater Blocker vor externem Deployment.
- `RIS_CONSENT_NOTICE_VERSION` bleibt serverseitig und unverändert; Consent-Version `1.0` bleibt **DRAFT**.

## 7. Git

Vorgesehene Commits:

1. Code, Tests und Konfigurationsdokumentation:
   `feat(ris): separate consent service activation`
2. Dieser Report und Auditlog:
   `docs: record RIS consent config separation`

Kein Push.

## 8. Empfehlung

Der Consent-Service kann künftig unabhängig aktiviert werden:

```text
RIS_CONSENT_SERVICE_ENABLED=true
RIS_APPLICATION_STORAGE_ENABLED=false
```

Voraussetzungen bleiben:

1. gemeinsame RIS-Verbindungsdaten und gültige Partnerberechtigung,
2. serverseitige Testbenutzer-Allowlist,
3. rechtlich/betrieblich freigegebene `RIS_CONSENT_NOTICE_VERSION`,
4. geklärte Preview-Secret-Isolation,
5. separater Preview-/E2E-Auftrag.

Bis dahin bleiben beide Dienste standardmäßig deaktiviert und es erfolgt keine dauerhafte Bewerbungsspeicherung.
