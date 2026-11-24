# JM-CV-IMPORT-NAVIGATOR-02

**Status:** `READY FOR VISUAL REVIEW`

**Branch:** `feature/jm-cv-import-navigator-02`

**Basis:** `origin/main` `53c9926`

**Implementation commits:** `4c4a4d4`, Responsive-Fix `0c06450`

## 1. Ziel und Abgrenzung

Der gemeinsame `RadarNavigator` aus CORE-01 wurde in die Fullpage-Import-
Vorschau integriert. Der Radar navigiert durch die Importübersicht, erkannte
CV-Abschnitte, Prüfkandidaten und die Importentscheidung.

Nicht geändert:

- PDF-Import/Parsing und bestehende Importentscheidungen
- CV-Editor, Workspace-Handoff oder Session-Daten
- RIS-, AWS-, Cognito-, Consent-, Storage- oder Parser-Code
- regulärer Import-Modal (kein Radar)
- Match-Radar-Design oder Match-Radar-E2E-Vertrag

Keine neue Radar-Engine und kein Main-Merge/Production-Deployment.

## 2. Radar-Integration

Der Radar wird ausschließlich gerendert, wenn alle Bedingungen gelten:

```text
layoutMode === "fullpage"
step === "preview"
!screenshotMode
```

Der bestehende `RadarNavigator` wird mit `classNamePrefix="match-radar"`
verwendet; eine zusätzliche Klasse `cv-import-radar` liefert die
Import-spezifischen Statusfarben. Auf Viewports ≤ 900 px sitzt der
Übersichts-Trigger im normalen Fluss oberhalb der Importkarte (kein Überdecken
von Karteninhalt); auf Desktop bleibt die feste Glass-Schiene unverändert. Der native, non-passive Wheel-Listener aus
CORE-Release PR #61 bleibt erhalten.

### Navigationsziele

- CV-Übersicht
- jeder erkannte CV-Abschnitt
- Prüfungen/Gruppe mit Anzahl offener oder unsicherer Einträge
- jeder Prüfkandidat mit stabiler ID `cv-import-candidate-<index>`
- Importentscheidung am Seitenende

### Status

| Status | Farbe | Text/ARIA |
|---|---|---|
| erkannt | Cyan | „Erkannt“ |
| offen/unsicher | Amber/Orange | „Offen“ bzw. „Prüfen“ |
| abgeschlossen | Türkis/Grün | „Geprüft“, „Eingeschlossen“ oder „Ignoriert“ |
| Fehler | Rot | für tatsächliche Fehler reserviert |

Status wird nicht nur über Farbe vermittelt: Hover-Titel, mobile
Panel-Beschriftungen und `aria-label` enthalten den Statustext.

## 3. Pagination und Filter

`CvBuilderImportReview` stellt dem Dialog über einen Forward-Ref-Handle
`revealCandidate(index)` bereit.

- Kandidaten werden über ihren stabilen Parser-Index identifiziert.
- Ist der Kandidat auf der aktuellen Seite sichtbar, wird nur die passende
  Seite geöffnet.
- Ist er durch Seite/Filter verborgen, werden Status-/Ziel-/Grundfilter
  zurückgesetzt und die passende Prüfseite geöffnet.
- Die Filteränderung wird sichtbar als `role="status"`-Hinweis angezeigt:
  „Die Navigation hat die Prüffilter zurückgesetzt …“.
- Das tatsächliche DOM-Element wird mit `getElement()` erst nach dem Rendern
  gesucht; der CORE-01-Wait-Mechanismus übernimmt anschließend Scrollen und
  Fokus.
- Der Treffer erhält kurz `is-radar-highlight` und den Fokus
  (`tabIndex={-1}`, `preventScroll`).
- Entscheidungen, bearbeitete Texte und Auswahlzustände bleiben im bestehenden
  State erhalten.

Auf dem Desktop werden nur tatsächlich gerenderte Kandidaten als Marker
gemessen. Nicht gerenderte Kandidaten sind über die mobile Übersicht
adressierbar; es werden keine erfundenen Markerpositionen erzeugt.

## 4. Accessibility und Performance

- echte Buttons für Marker
- Status in ARIA und sichtbarem Text
- Escape schließt das mobile Panel und gibt den Fokus an den Auslöser zurück
- beim Kandidatenklick aus dem mobilen Panel erhält der Zielkandidat den Fokus
- keine fokussierbaren Elemente in `aria-hidden`
- Reduced Motion wird unterstützt
- Radar wird im Screenshot-Modus vollständig aus dem DOM entfernt; zusätzlich
  CSS-Schutz
- native non-passive Wheel-Steuerung
- Observer/Listener werden vom bestehenden CORE-Kern entfernt; die neuen
  Navigationstimer werden im Review beim Unmount bereinigt
- initialer Aufruf löst keinen Scrollsprung aus
- Ziel-Liste und gefilterte Review-Einträge werden per `useMemo` begrenzt
- Mobile 768/390: Trigger oberhalb der Karte statt schwebend über Karteninhalt;
  das mobile Panel bleibt im Fluss und erzeugt keinen Karten-Overlap

## 5. Tests

### 5.1 Fokussierte Vitest-Prüfungen

| Bereich | Ergebnis |
|---|---|
| Neue Import-Navigator-Tests (`CvBuilderImportNavigator.test.tsx`) | **7 PASS** |
| Bestehende Import-Dialog-Tests | **21 PASS** |
| Radar-/Match-Radar-/Core-Adapter-Tests | **27 PASS** |
| **Summe fokussiert** | **55 PASS** |

Abgedeckt:

- 5, 10 und 35 Kandidaten
- Kandidatennavigation über mehrere Prüfseiten
- Statusaktualisierung nach einer Entscheidung
- Filter-Reset und Erhalt vorheriger Entscheidungen
- Absenz im Modal und Screenshot-Modus
- deutsche und englische Radar-/Statustexte

### 5.2 Browser-E2E

`npm run test:e2e:cv-import-navigator-02` mit synthetischem PDF:

- 14 gemessene Marker auf Desktop, davon 10 sichtbare Kandidaten
- Markerpositionen = tatsächliche DOM-Positionen
- 5 kollisionsfreie Hover-Titel
- Status „Offen“ in Hover-/ARIA-Text, danach „Eingeschlossen“ nach Entscheidung
- Tastatur: Fokus + Enter navigiert zum Ziel
- Entscheidungsziel erhält Fokus
- Mobiles Panel: 36 Kandidaten (35 synthetische Zeilen plus Parser-Zusatz),
  Kandidat 12 öffnet Prüfseite 2
- Filter-Reset mit sichtbarem Hinweis und erhaltenen Entscheidungen
- Screenshot-Modus entfernt den Radar; Beenden stellt ihn wieder her
- Desktop 1920/1440, Tablet 768, Mobile 390 ohne Overflow
- 0 Console-/Page-Errors, keine AI-/RIS-/Storage-Writes
- initialer `scrollY` = 0

Zusätzlich erneut PASS:

- `npm run test:e2e:match-radar-01`
- `node tests/e2e/cv-import-ux-07.mjs`

### 5.3 Vollsuite und Build

- Vollsuite: **2078 PASS / 5 skipped** (201 Dateien: 198 PASS, 3 skipped)
- `npm run build`: **PASS**
- `git diff --check`: **PASS**
- Secret-Scan: **keine Treffer**

## 6. Screenshots

```text
docs/reports/assets/JM-CV-IMPORT-NAVIGATOR-02/
├── radar-1440.png
├── radar-hover-1440.png
├── radar-1440-status.png
├── radar-1440-screenshot-mode.png
├── radar-1920.png
├── radar-768.png
└── radar-390-panel.png
```

## 7. Grenzen und offene Punkte

- Kein Main-Merge, kein Production-Deployment.
- Keine CV-Editor-Integration.
- Keine RIS-/AWS-/Cognito-/Consent-/Storage-/Parser-Änderung.
- Der echte rote Fehlerzustand ist im Parser-Preview derzeit nicht ausgelöst;
  die rote Statusklasse ist vorbereitet.
- Die bereits in CORE-01 dokumentierten nicht blockierenden A11y-Follow-ups
  (Dialog-Fokus-Semantik, Hover-Ebene nach reinem Tastatur-Fokus, asynchrone
  Aktivierungsfehler) bleiben für das Editor-Paket vorgemerkt.
