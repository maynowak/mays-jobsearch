# JM-RIS-CONSENT-UX-03

**Status:** `RELEASED / PRODUCTION SMOKE VERIFIED / AUTH E2E BLOCKED`
**Branch:** `feature/jm-ris-consent-ux-03`
**PR:** #33
**Base:** `68aca2a1e6007974343ff6515675c4122d6f9420`
**Merge-SHA:** `92ca1fc690adcb1c6db3b392f710b3456c324e04`

Production deployed; authenticated grant E2E remains blocked. No RIS/AWS/
Terraform mutation or real applicant data.

## 1. Ausgangslage

Der bestehende Consent-Pfad bleibt unverändert:

```text
StorageConsentLive
  -> risConsentApi
  -> /api/ris/consents
  -> Jobsearch BFF
  -> RIS Partner Consent API
```

ApplicationV1- und CV-Speicherfreigabe bleiben getrennte Zwecke. Es wurde
keine neue Consent-Architektur eingeführt.

## 2. UX-Änderungen

### ApplicationV1-Consent

- Lokale Vorprüfung vor dem Grant:
  - Anmeldung vorhanden
  - Status noch nicht `GRANTED`
  - `grantAllowed`
  - Version/Hash und serverseitige Textfreigabe
  - ausdrückliche Art.-9-Bestätigung
- Während des echten Requests:
  - sichtbarer Status „Einwilligung wird geprüft …“
  - Button deaktiviert, `aria-busy`
  - Checkbox deaktiviert, aber nicht zurückgesetzt
- Erfolg:
  - sichtbare Bestätigung erst nach bestätigter POST-Antwort
  - Server-Status und Art.-9-Zustand werden übernommen
- Fehler:
  - konkrete Erklärung mit „Was ist passiert?“, bekannten Gründen und einer
    nächsten Handlung
  - keine falsche Erfolgsmeldung
  - Checkbox bleibt bei fehlgeschlagenem Grant unverändert
- Reload:
  - eine bereits erteilte Art.-9-Einwilligung wird checked + disabled angezeigt
- Widerruf:
  - setzt die Checkbox für eine neue ausdrückliche Einwilligung zurück

### CV-Speicherfreigabe

- Getrennter Hinweis auf ApplicationV1-/CV-Consent.
- Sichtbarer Prüfstatus und Ladezustand beim CV-Grant.
- Bei nicht verfügbarer Freigabe wird der bekannte Grund verständlich
  angezeigt (nicht freigegeben, Konfigurationsmismatch, Konto, unbekannt).
- Direkter Link zu `/profil?tab=settings`.
- CV-404 bleibt ein nicht-destruktiver, handlungsorientierter Fehler; die
  Liste wird aktualisiert, ohne Daten zu löschen oder zu migrieren.
- Keine automatische CV-Einwilligung.

## 3. Diagnose des fehlschlagenden Grants

Der authentifizierte Live-Grant konnte nicht ausgeführt werden, weil keine
gültige autorisierte Limited-Beta-Testidentität bzw. kein Test-Token verfügbar
ist. Nicht umgangen wurden Authentifizierung, Allowlist oder Consent-Gates.

Lokaler/vertraglicher Befund:

- Der BFF erwartet einen gültigen Access-Token, die serverseitige
  Test-Allowlist und eine freigegebene Notice/Textfassung.
- Ein Grant ohne Art.-9-Bestätigung wird nicht gesendet.
- Ein nicht freigegebener Status wird lokal und serverseitig fail-closed
  behandelt.
- Der Production-Smoke aus dem vorherigen Release zeigt für
  `/api/ris/consents` ohne Token `401`, nicht `503`; das ist kein Beleg für
  einen erfolgreichen Grant.
- Die konkrete Live-Fehlerantwort (HTTP-Status, RIS-Code, `grantAllowed`,
  Notice-Status) bleibt bis zu einer autorisierten Session **BLOCKED**.

## 4. Tests

```text
Fokussiert Consent/CV: 32 PASS
RIS Consent API:       40 PASS
npm run build:         PASS
Serielle Gesamtsuite:  1952 PASS / 11 skipped
```

Abgedeckt:

- Prüfstatus/lokale Validierung
- Grant erfolgreich
- Grant fehlgeschlagen
- Anmeldung abgelaufen
- fehlende Berechtigung
- RIS nicht erreichbar
- Checkbox bleibt bei Fehler gesetzt
- Checkbox nach Reload bei GRANTED
- Widerruf und neue ausdrückliche Einwilligung
- getrennte CV-/ApplicationV1-Hinweise
- CV-404 und Listenabgleich

## 5. Dokumentation / Git

- `docs/reports/JM-RIS-CONSENT-UX-03.md`
- `docs/AI_AUDITLOG.md`
- Feature-Branch: `feature/jm-ris-consent-ux-03`
- Kein Main-Merge, kein Deployment, keine RIS-/AWS-/Terraform-Änderung.


## 6. Production Release

```text
PR:        #33
Merge-SHA: 92ca1fc690adcb1c6db3b392f710b3456c324e04
Build-SHA: 92ca1fc
```

Automatic Vercel Production deployments:

```text
mays-job-matcher  dpl_F9wqvv56CutqLxQpQcbMFYFLNVze  READY
mays-jobsearch    dpl_GARYDrYPdJJP1AFPg7UnG22ujTk6  READY
```

Public smoke on both domains:

```text
/                    200
/profil              200
/profil?tab=settings 200
/profil?tab=cv       200
/datenschutz         200
/impressum           200
```

Live bundle contains:

- `Einwilligung wird geprüft`
- `Anmeldung abgelaufen`
- `Bitte setze die Checkbox`
- `CV-Speicherfreigabe wird geprüft`
- `nicht mehr vorhanden`
- Build-SHA `92ca1fc`

Chromium public smoke: no console/page errors on either domain.

API smoke without token:

```text
www.mays-job-matcher.app/api/ris/consents -> 401
mays-jobsearch.vercel.app/api/ris/consents  -> 503 consent_disabled
```

No unexpected 5xx.

Authenticated grant E2E remains **BLOCKED** without a valid authorized
limited-beta test identity/token. No successful live grant or Production
consent restoration is claimed.
