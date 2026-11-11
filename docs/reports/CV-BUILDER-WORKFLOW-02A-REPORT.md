# CV-BUILDER-WORKFLOW-02A — SAVE, CLOSE & DEVELOPMENT UX

**Status:** `CV-BUILDER-WORKFLOW-02A — VERIFIED / FEATURE BRANCH PUSHED / READY FOR REVIEW`
**Base:** `origin/feature/cv-builder-import-01b-r1` (`eaed775`)
**Branch:** `feature/cv-builder-workflow-02a`
**Initial feature commit:** `7c32187`
**Verification commit:** `a90904d`

## 1. Ausgangspunkt und R1-Berücksichtigung

`02A` wurde bewusst auf dem gepushten R1-Branch `eaed775` aufgesetzt,
nicht auf `main` (`baac910`). Damit bleiben die R1-Parser-/Vorschau-
Verbesserungen erhalten. R1 wurde nicht überschrieben.

## 2. STEP A — Speicherstatus

Der Builder zeigt jetzt sichtbar:

- **Noch nicht gespeichert**
- **Ungespeicherte Änderungen**
- **Speichern läuft …**
- **In dieser Sitzung gespeichert**
- **Speichern fehlgeschlagen**

Die Statusanzeige ist `role="status"`/`aria-live="polite"`. Es wird
ausschließlich sitzungsbezogene Speicherung kommuniziert; keine dauerhafte
RIS-Speicherung, kein Upload und kein automatischer PDF-Export.

## 3. STEP B — Speichern und Schließen

Nach erfolgreicher Speicherung erscheint:

**„Dein Lebenslauf wurde in dieser Sitzung gespeichert.“**

Aktionen:

- **Zur Lebenslaufübersicht** — schließt den Editor
- **Weiter bearbeiten** — bleibt im Editor
- **Als PDF herunterladen** — nutzt den bestehenden PDF-Export

Bei ungespeicherten Änderungen bleiben die vorhandenen Optionen erhalten:

- **Speichern und schließen**
- **Verwerfen und schließen**
- **Weiter bearbeiten**

Speicherfehler bleiben sichtbar; Eingaben bleiben erhalten. Ein lokaler
`save in flight`-Guard verhindert doppelte Speicherstarts. ESC, Schließen-Button
und Fokusführung bleiben erhalten.

## 4. STEP C — Entwicklungsinformation

Im Bereich **Mein Profil** gibt es eine Aurora-Karte:

**Mays Job Matcher wird weiterentwickelt**

mit dem freundlichen Hinweis auf aktive Entwicklung, mögliche Veränderungen
und die Prüfung wichtiger Ergebnisse. Die Karte ist nicht global, kein Popup
und verändert weder Kontostatus noch Datenschutzhinweise. Deutsch/Englisch und
Mobile/Desktop sind abgedeckt.

## 5. STEP D — Hilfe-Button

Der geschlossene Button heißt jetzt nur noch **„Hilfe“** / **„Help“**,
ohne Selbstvorstellung und ohne Emoji.

Im geöffneten Zustand beginnt die Hilfe konkret mit **„Hilfe zu diesem
Bereich“** und dem Kontext des aktiven Dashboard-Bereichs. Ein-/Ausklappen,
`aria-expanded`, Fokusführung und die bestehende UI-Präferenz
`mj-may-help-open` bleiben erhalten. Keine Chatbot-Funktion.

## 6. STEP E — Gesamtprüfung

Geprüft:

- Speicherstatus und Erfolgsmeldung
- Speicherfehler-Anzeige
- Schließen mit ungespeicherten Änderungen
- Speichern und schließen
- Rückkehr zur Lebenslaufübersicht
- Erneutes Öffnen des Session-Entwurfs
- PDF-Export
- Entwicklungsinformation
- Hilfe-Button
- DE/EN
- 320 / 390 / 430 / 768 / 1024 / 1440 px

| Prüfung | Ergebnis |
|---|---|
| Fokussierte Editor-/Dashboard-/App-Tests | **130 PASS** |
| Serielle Gesamtsuite | **1719 PASS / 5 skipped** |
| Production-Build | **PASS** |
| Workflow-E2E | **PASS** |
| Responsive Overflow | **0** |

## 7. Screenshots

`docs/reports/assets/CV-BUILDER-WORKFLOW-02A/`

- `builder-saved-{320,390,430,768,1024,1440}.png`
- `builder-unsaved-390.png`
- `profile-development-{320,390,430,768,1024,1440}.png`
- `profile-help-{320,390,430,768,1024,1440}.png`
- `results.json`

## 8. Commits

- `7c32187` — Speicherstatus, Abschlussaktionen, Entwicklungsinfo, Hilfe
- `a90904d` — Responsive-/Workflow-E2E und Screenshots
- Dokumentations-Commit (HEAD) — Bericht und Auditlog

**Gepusht:** `origin/feature/cv-builder-workflow-02a`

## 9. Offene Punkte

- Kein Merge nach `main`.
- Kein Production-Deployment.
- R1 ist im 02A-Branch enthalten, aber noch nicht nach `main` gemergt.
- Keine authentifizierten RIS-Schreibzugriffe.
- Keine echten Benutzerdaten in Tests.
- Keine Änderung an Consent-Verträgen, RIS, AWS, Cognito oder Terraform.

## 10. Empfehlung

**GO für Review und kontrollierten Merge.**
**NO-GO für Production-Deployment ohne gesonderte Freigabe.**
