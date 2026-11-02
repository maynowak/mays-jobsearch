# JM-APPLICATION-DRAFT-REUSE-01

**Art:** Bewerbungsverwaltung / vorhandener Bewerbungsentwurf / Anschreiben erneut übernehmen
**Status:** IMPLEMENTIERT UND LOKAL VERIFIZIERT — kein Deployment
**Datum:** 2026-11-02
**Branch:** `main` (lokal)
**Grenzen:** Keine Persistenz, keine RIS-/AWS-/Cognito-Änderung, keine KI-/Apify-Aufrufe, kein Deployment.

## 1. Befund

Existierte für eine Stelle bereits ein Bewerbungsentwurf, war die Aktion im
Anschreiben-Assistenten deaktiviert und zeigte nur:

> Für diese Stelle existiert bereits ein Bewerbungsentwurf.

Das war für den gewünschten Ablauf zu restriktiv: Ein neues oder überarbeitetes
Anschreiben soll für dieselbe Stelle erneut gespeichert werden können, ohne
einen zweiten Entwurf anzulegen.

## 2. Änderung

### UI

`src/components/LetterModal.tsx`

- Der Button bleibt bei vorhandenem Entwurf aktiv.
- Bei vorhandenem Entwurf erscheint eine deutlich umrandete Statusbox mit
  grünem Haken:
  - „Für diese Stelle ist bereits ein Anschreiben gespeichert.“
- Der Button heißt dann:
  - „Anschreiben im Bewerbungsentwurf aktualisieren“
- Ohne vorhandenen Entwurf bleibt die bisherige Aktion:
  - „Als Bewerbungsentwurf übernehmen“

`src/styles.css`

- Neuer Status-/Aktionsbereich mit sichtbarer Umrandung und Haken-Icon.

`src/i18n.tsx`

- DE/EN-Texte für den bestehenden Entwurf, die Aktualisierung und die
  Erfolgsmeldung.

### App-/Repository-Verhalten

`src/App.tsx`

- Existiert bereits ein Entwurf für dieselbe Stelle, wird dieser per
  `applicationRepository.update()` aktualisiert:
  - aktueller Anschreiben-Entwurf
  - Dokumentenstatus
  - optionale aktuelle CV-Referenz
- Es wird **kein zweiter Entwurf** angelegt.
- Status, Verlauf, Version und übrige Bewerbungsdaten bleiben erhalten.
- Die Version wird über `expectedVersion` geschützt.

`src/lib/applications/repositoryTypes.ts` und
`src/lib/applications/sessionApplications.ts`

- `SessionUpdateInput`/`updateSessionApplication` unterstützen optional die
  Aktualisierung der CV-Referenz.

## 3. Tests

| Prüfung | Ergebnis |
|---|---|
| LetterModal | **46 passed** |
| Session-Repository | **12 passed** |
| Gesamtsuite | **1190 passed, 5 skipped** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| E2E Applications Desktop 1440 | PASS |
| E2E Applications Mobil 390 | PASS |
| E2E Cover Letter Desktop 1440 | PASS |
| E2E Cover Letter Mobil 390 | PASS |
| E2E Console-Errors | keine |
| Live-Provider-/Apify-/AI-Aufrufe | keine |

Hinweis: Der erste parallele Gesamtlauf zeigte die bereits bekannte
Zeitüberschreitung in `ManualSearchProfiles.integration.test.tsx`. Die
betroffenen Tests bestanden einzeln; der Gesamtlauf bestand mit
`--maxWorkers=2` vollständig (1190/5). Keine Tests wurden deaktiviert oder
entfernt.

## 4. Sicherheit und Datenschutz

- Kein zusätzlicher Entwurf bei wiederholtem Speichern.
- Keine Änderung an Status-/Submit-Regeln.
- Kein automatisches Versenden.
- Keine neue Persistenz.
- Keine KI-/Apify-/Provider-Aufrufe.
- CV-Referenz bleibt eine Referenz; es wird keine CV-Datei kopiert.

## 5. Status

**IMPLEMENTED:** vorhandener Entwurf sichtbar, Haken/Umrandung, erneutes
Speichern als Update.

**VERIFIED:** Targeted Tests, Gesamtsuite, TypeScript, Build, E2E.

**OPEN:** Live-Verifikation nach Deployment.

**NOT DEPLOYED:** kein Deployment.
