# Live Production Browser E2E — Runbook

**Ziel:** Reproduzierbarer, read-only Browser-Test der Production-Seite
`https://www.mays-job-matcher.app` mit manuellem Login. Der Agent erhält
niemals das Passwort und speichert keine Zugangsdaten.

## Voraussetzungen

- Desktop-Session mit sichtbarem Chrome (`DISPLAY` bzw. Wayland vorhanden).
- Ein **freigegebenes synthetisches Testkonto** in Cognito.
- Dasselbe Konto muss für RIS-/Consent-Schreibpfade freigegeben sein, wenn
  diese geprüft werden sollen (`RIS_TEST_USER_ALLOWLIST`,
  `CONSENT_PILOT_ALLOWLIST`).
- Keine echten Nutzerdaten, keine produktiven Änderungen. Der Standardlauf
  ist read-only und erstellt/ändert/löscht keine Daten.

## Ablauf

### 1. Browserfenster öffnen

```bash
npm run test:e2e:live-browser -- open
```

Das öffnet ein separates Chrome-Profil unter
`/tmp/opencode/mays-live-e2e-profile` und die Login-Seite. Das Profil ist
bewusst vom persönlichen Chrome-Profil getrennt.

### 2. Manuell anmelden

Im geöffneten Fenster mit dem freigegebenen Testkonto anmelden. Zugangsdaten
nur im Browser eingeben, niemals in den Chat oder ein Terminal kopieren.

Nach erfolgreicher Anmeldung muss `/profil` sichtbar sein.

### 3. Read-only-Prüfung ausführen

```bash
npm run test:e2e:live-browser -- run
```

Geprüft werden:

- Dashboard-Ansichten `overview`, `profile`, `cv`, `applications`,
  `preferences`, `settings`
- Viewportbreiten 320 / 390 / 430 / 768 / 1024 / 1440 px
- horizontaler Overflow
- sichtbare Überschriften und Touch-Zielgrößen
- Footer-Build-SHA
- Screenshots und Metriken

Ergebnisse:

```text
/tmp/opencode/live-production-browser-e2e/<timestamp>/
  overview-320.png
  ...
  settings-1440.png
  live-results.json
```

Die Screenshots bleiben bewusst außerhalb des Repositories, weil angemeldete
Ansichten Kontodaten enthalten können. Nur aggregierte, PII-freie Ergebnisse
gehören in Bericht und Auditlog. Mit `LIVE_EVIDENCE_DIR=...` kann ein anderer
geschützter Pfad gesetzt werden.

### 4. Optional: kontrollierte RIS-/Consent-Schreibprüfung

Nur nach separater Freigabe und nur mit synthetischen Daten:

1. Testkonto muss auf beiden Allowlists stehen.
2. Nur synthetische CV-/Such-/ATS-Profile anlegen.
3. Kinddaten zuerst löschen (ATS → CV-Suchprofil → manuelles Profil).
4. Consent-Zustand dokumentieren (`NOT_GRANTED → GRANTED → WITHDRAWN`).
5. Keine echten Bewerbungen, CVs oder Kontodaten verwenden.

Der Standardbefehl `run` führt **keine** Schreiboperation aus.

## Grenzen

- Production läuft auf dem zuletzt deployten `main`-Commit. Ein noch nicht
  gemergter Feature-Branch wird durch diesen Lauf nicht geprüft.
- Für Branch-Änderungen zuerst den lokalen Mock-E2E
  (`npm run test:e2e:mobile-visual`) und danach eine Preview-/Production-
  Freigabe verwenden.
- Keine Änderung an Cognito, RIS, AWS, Terraform oder Consent-Verträgen.
- Keine Passwörter, Tokens oder Cookies in Reports oder Commits.

## Cleanup

- Browserfenster schließen.
- Optional das temporäre Profil entfernen:
  `rm -rf /tmp/opencode/mays-live-e2e-profile`
- Synthetische Daten nur nach dokumentierter Freigabe löschen.
- Screenshots und `live-results.json` als Evidenz behalten.

## Statuswerte

- `PASS` — alle Checks erfolgreich; keine Schreiboperation.
- `BLOCKED` — kein sichtbarer Browser, kein freigegebenes Testkonto oder
  Login nicht abgeschlossen.
- `FAIL` — Overflow, fehlende Ansicht, unerwarteter Fehler oder
  Consent-/Speicherstatus weicht ab.
