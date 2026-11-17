# JM-RIS-CONSENT-UX-03

**Status:** `IMPLEMENTED / VERIFIED LOCAL / AUTHENTICATED LIVE E2E BLOCKED`  
**Branch:** `feature/jm-ris-consent-ux-03`  
**Basis:** `origin/main` `68aca2a1e6007974343ff6515675c4122d6f9420`

No Main merge, Production deployment, RIS change, AWS/Terraform mutation or
real applicant data.

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
