# JM-CV-EDITOR-NAVIGATOR-03

**Status:** `READY FOR VISUAL REVIEW`

**Branch:** `feature/jm-cv-editor-navigator-03`

**Basis:** `origin/main` `fbefde3`

**Implementation commit:** `b6cf43d`

## 1. Ziel und Abgrenzung

Der gemeinsame `RadarNavigator` wurde in den vollständigen Fullpage-CV-Editor
integriert. Desktop nutzt eine Glass-Schiene am linken Rand, damit sie klar von
den Turbo-Händen und der Vorschau auf der rechten Seite getrennt bleibt.
Mobile erhält der Editor einen kompakten Trigger oberhalb der Editor-Karte.

Nicht geändert:

- Validierungsregeln
- CV-Datenmodell, Parser, PDF-Export oder RIS-Storage
- bestehende Abschnittsnavigation, Breitenmaximierung oder Workspace-Handoff
- `CvBuilderScrollHands`-Geschwindigkeit, Hover-/Manual-Unterbrechung
- Match-Radar- und Import-Radar-Design

Kein Main-Merge und kein Production-Deployment.

## 2. Navigationsziele

- Persönliche Angaben
- Kurzprofil
- Berufserfahrung
- Ausbildung
- Fähigkeiten
- Projekte
- Zertifikate
- Sprachen und Links
- Validierungsübersicht, sofern Fehler vorhanden sind
- Speichern-und-Export-Aktionen

Jeder Abschnitt nutzt die vorhandene DOM-ID `cv-builder-<section>`. Beim
Navigieren wird ein eingeklapptes `<details>` geöffnet; anschließend scrollt
der CORE-Kern zum tatsächlichen sichtbaren Ziel.

## 3. Validierungsfehler

- Abschnitte mit Fehlern werden als roter Fehlerstatus markiert und tragen
  Fehleranzahl sowie Status zusätzlich in Hover-, Panel- und ARIA-Text.
- Die Validierungsübersicht ist ein eigener Fehlerzielpunkt.
- Beim Öffnen eines Fehlerabschnitts:
  1. mobiler Editor wechselt in die Bearbeitungsansicht,
  2. `<details>` wird geöffnet,
  3. das erste tatsächliche Fehlerfeld wird fokussiert,
  4. das Feld wird rot hervorgehoben,
  5. der CORE-Kern scrollt zum tatsächlichen Feld.
- `goToFirstError()` bleibt unverändert erhalten.
- Nach Korrektur verschwinden Validierungsziel und Fehlerstatus; der
  Aktionszielpunkt wechselt auf „Bereit“.

Statusfarben: Cyan = regulärer Abschnitt, Amber = blockiert/Prüfung, Rot =
Validierungsfehler, Türkis = bereite Aktionen. Status ist nie nur Farbe.

## 4. Turbo-Hände-Koordination

`CvBuilderScrollHands` behält sein gesamtes bisheriges Verhalten. Es erhielt
lediglich einen imperativen `stop()`-Handle. Der Editor reicht diesen über
`onBeforeNavigate` an den Radar weiter:

```text
Radar-Navigation
  → onBeforeNavigate
  → CvBuilderScrollHands.stop()
  → Radar aktiviert Ziel / scrollt
```

Damit können Radar und Turbo-Hände gleichzeitig vorhanden sein, ohne
konkurrierende Scrollanimationen. Der E2E-Test zählt während einer laufenden
Turbo-Abwärtsbewegung die `scrollBy`-Aufrufe nach einer Radar-Tastatur-
Navigation: **0**.

## 5. Darstellung und Accessibility

- Desktop: Glass-Radar links, echte Abschnittspositionen, maximal fünf
  kollisionsfreie Hover-Titel, aktive Markierung.
- Mobile: Trigger oberhalb der Karte, Panel im Fluss; keine Überdeckung von
  Formularfeldern, sticky Speicherleiste oder Turbo-Händen.
- Echte Buttons, Fokusindikatoren, Tastaturbedienung.
- Escape im mobilen Panel mit Fokus-Rückkehr.
- Deutsche und englische Beschriftungen und Status.
- Keine fokussierbaren Elemente in `aria-hidden`.
- Reduced Motion wird unterstützt.
- Native non-passive Wheel-Steuerung aus CORE bleibt erhalten.
- Kein automatischer Scrollsprung beim Laden.
- Keine CV-Datenänderung durch Navigation.
- Ziel-Liste wird über eine Validierungssignatur memoisiert und nicht bei
  jedem Texteingabe-Event neu aufgebaut.
- Observer/Listener/Highlight-Timer werden aufgeräumt.

## 6. Screenshot-Modus

- Radar und Turbo-Hände werden vollständig aus dem DOM entfernt.
- Bestehende Abschnitts-Öffnung für Screenshots bleibt erhalten.
- Beim Beenden werden die ursprünglichen `<details>`-Zustände wiederhergestellt.
- Keine Änderung an der PDF-Vorschau.

## 7. Tests

### 7.1 Fokussierte Vitest-Prüfungen

**108 PASS** über Editor-, PDF-/RIS-, Import-/Radar- und CORE-Tests, darunter
**8 neue Editor-Navigator-Tests**:

- alle acht Abschnitte und Aktionsziel
- eingeklappter Abschnitt
- Fehlerziel, Fehleranzahl und ARIA-Status
- tatsächlicher Feldfokus und Highlight
- Fehler verschwindet nach Korrektur
- Editor-/Vorschauwechsel
- Screenshot-Modus entfernt Radar und Hände
- deutsche und englische Labels

### 7.2 Browser-E2E

`npm run test:e2e:cv-editor-navigator-03`:

- 9+ Desktop-Marker; alle 8 Abschnitte in der mobilen Übersicht
- 5 kollisionsfreie Hover-Titel
- Klick auf eingeklappte Berufserfahrung öffnet Details und markiert aktiv
- aktive Marker aktualisieren sich beim Scrollen
- Tastatur-Navigation stoppt laufende Turbo-Hände (`scrollBy` = 0)
- Validierungsfehler: roter Status, Fehleranzahl, Feld-Fokus/Highlight
- Fehler verschwindet nach Korrektur; Aktionen wieder bereit
- Editor ↔ Vorschau und mobile Rückkehr in Bearbeitungsansicht
- Radar und Turbo-Hände ohne Overlap; Mobile Panel ohne Hände-/Formular-
  Überdeckung
- Breitenmaximierung funktioniert weiterhin
- Screenshot-Modus entfernt Radar und Hände
- Desktop 1920/1440, Tablet 768, Mobile 390; 0 horizontaler Overflow
- kein initialer Scrollsprung, keine Console-/Page-Errors, keine
  unerwarteten API-Calls

Zusätzlich erneut PASS:

- `npm run test:e2e:cv-builder-full-page-workspace-03a`
- `node tests/e2e/cv-builder-ux-06-navigation-drafts.mjs`
- `npm run test:e2e:cv-import-navigator-02`
- `npm run test:e2e:match-radar-01`

Hinweis: Das ältere `cv-builder-workflow-02a.mjs` erwartet noch den früheren
Button-Text „Lebenslauf speichern“, während `cvBuilder.save` bereits auf
`origin/main` „Entwurf übernehmen“ heißt. Es ist damit ein vorbestehender,
vom Editor-Radar unabhängiger Teststand und wird nicht als Regression dieses
Pakets gewertet.

### 7.3 Vollsuite und Build

- Vollsuite: **2086 PASS / 5 skipped** (202 Dateien: 199 PASS, 3 skipped)
- `npm run build`: **PASS**
- `git diff --check`: **PASS**
- Secret-Scan: **keine Treffer**

## 8. Screenshots

```text
docs/reports/assets/JM-CV-EDITOR-NAVIGATOR-03/
├── radar-1440.png
├── radar-error-1440.png
├── radar-error-focus-1440.png
├── radar-1440-screenshot-mode.png
├── radar-1920.png
├── radar-768.png
├── radar-768-panel.png
└── radar-390-panel.png
```

## 9. Grenzen und offene Punkte

- Kein Main-Merge, kein Production-Deployment.
- Keine RIS-/AWS-/Cognito-/Consent-/Storage-/Parser-/PDF-Export-Änderung.
- Die Radar-Schiene liegt links, um Abstand zu Turbo-Händen und Vorschau zu
  halten; das Import-Radar bleibt unverändert.
- Bekannte CORE-Follow-ups (Dialog-Fokus-Semantik, Hover-Ebene nach reinem
  Tastatur-Fokus, asynchrone Aktivierungsfehler) bleiben für ein späteres
  Hardening vorgemerkt.
