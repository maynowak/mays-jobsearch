# JM-CV-BUILDER-01B

**Art:** Lebenslauf-Werkstatt / Live-Vorschau / Designvorlagen / responsive Darstellung
**Status:** ABGESCHLOSSEN UND LOKAL VERIFIZIERT — kein Push, Merge oder Deployment
**Datum:** 2026-11-03
**Branch:** `feature/jm-cv-builder-01b`
**Baseline:** 01A `2ae42e4`; lokaler `main` `e098fbd`; `origin/main` `4364eab`

## 1. Ziel

Der strukturierte Lebenslauf-Editor aus 01A erhielt eine Live-Vorschau und drei
auswählbare Designvorlagen:

- Klassisch (`classic`)
- Modern (`modern`)
- Kompakt (`compact`)

Weiterhin gilt:

- keine PDF-Erzeugung,
- keine KI-Optimierung,
- keine Persistenz,
- keine RIS-/AWS-Integration,
- keine Änderung bestehender CV-/ATS-Funktionen.

## 2. Architektur

```text
CvBuilderDraftV1 (einzige fachliche Quelle)
        |
        +--> CvBuilderEditor (Eingabe, Session-State)
        |
        +--> CvBuilderPreview (reine Darstellung)
                 |
                 +--> classic
                 +--> modern
                 +--> compact
```

- Die Vorschau erhält ausschließlich den vorhandenen Draft.
- Beim Vorlagenwechsel werden keine Daten migriert, kopiert oder neu erzeugt.
- Die Vorlagenauswahl ist lokaler UI-State im Editor.
- `CvBuilderDraftV1` wurde nicht um Designfelder erweitert.
- Es entstehen keine neuen IDs, Dateien, CV-Hashes oder Backend-Objekte.

## 3. Live-Vorschau

Neue Komponente:

`src/components/CvBuilderPreview.tsx`

Dargestellt werden, sofern vorhanden:

- Name und Berufsbezeichnung,
- E-Mail, Telefon und Standort,
- Kurzprofil,
- Berufserfahrung mit Stationen, Zeitraum und Beschreibung,
- Ausbildung,
- Fähigkeiten,
- Projekte inklusive Technologien,
- Zertifikate,
- Sprachen mit Kenntnisstand,
- berufliche Links.

Leere Abschnitte werden nicht als leere Überschriften gerendert. Blanke
dynamische Einträge werden nicht dargestellt. Ungültige Monate und unsichere
URLs werden nicht in erfundene Angaben oder ausführbare Links umgewandelt.

## 4. Vorlagen

### Klassisch

- einspaltig,
- zurückhaltende Serif-Typografie,
- schwarz-/graue Hierarchie,
- klare Trennlinien,
- keine dekorativen Skill-Balken.

### Modern

- moderne Systemtypografie,
- dezente teal Akzentfarbe,
- Akzentlinien an Abschnittsüberschriften,
- klare Hierarchie und großzügige Abstände.

### Kompakt

- reduzierte Abstände und Schriftgrößen,
- effiziente Darstellung mehrerer Stationen,
- keine dekorativen Flächen,
- vollständige Inhalte.

Alle drei Vorlagen verwenden dieselbe Vorschau-DOM-Struktur und zeigen dieselben
fachlichen Informationen.

## 5. Werkstatt-Layout

### Desktop

- Editor links,
- Live-Vorschau rechts,
- zwei Spalten bei ausreichender Breite; 1024 px bleibt zweispaltig.

### Tablet/Mobil

- ab 900 px: Umschaltung **[Bearbeiten] [Vorschau]**,
- dieselbe Draft-Instanz in beiden Ansichten,
- kein Datenverlust beim Wechsel,
- einspaltige Formulare und Vorschau.

### Lange Lebensläufe

- keine feste Höhe für Vorschau oder Dokument,
- keine Textkürzung,
- vollständiges Scrollen,
- Vorschau bleibt innerhalb des bestehenden Editor-Dialogs,
- keine falsche Seitenzahl-/PDF-Garantie.

## 6. Datums- und Textdarstellung

- `YYYY-MM` bleibt die einzige Datumsquelle.
- Darstellung: `03/2019 – 10/2024`.
- Laufend: `03/2019 – heute` bzw. `03/2019 – Present`.
- Keine Tageszeitstempel oder Zeitzonenumrechnung.
- Ungültige Monate erzeugen keinen erfundenen Zeitraum.
- Lange Firmen, Rollen, URLs und Beschreibungen brechen sicher um.
- Inhalte werden als React-Text gerendert; keine HTML-Injektion.

## 7. Session und Datenschutz

Unverändert:

- Draft ausschließlich in App-Memory,
- keine localStorage-/sessionStorage-/IndexedDB-Nutzung,
- Gastmodus und Auth-Modus,
- Auth-Reset über `iss + sub`,
- Reload verwirft den Entwurf,
- `beforeunload`-Schutz,
- keine KI-/Provider-/Backend-Aufrufe,
- keine personenbezogenen Daten in Logs/Telemetrie.

Die vorhandene 01A-Isolation und der Session-only-Hinweis bleiben sichtbar.

## 8. Tests

| Prüfung | Ergebnis |
|---|---|
| `npm test -- --run --maxWorkers=2` | **1291 passed, 5 skipped** |
| Preview/Editor/Domain/Auth gezielt | **30 passed** |
| Cover-Letter-API | **23 passed** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| API-Syntax | PASS |
| CV-Builder-E2E Gast | PASS |
| CV-Builder-E2E authentifiziert | PASS |
| CV-Builder responsive 1440/1024/768/430/390/320 | PASS |
| Template-Wechsel + mobile Umschaltung | PASS |
| Guest-CV-E2E 1440/390 | PASS |
| Applications-E2E 1440/390 | PASS |
| Cover-Letter-E2E 1440/390 | PASS |
| Mobile-Navigation-E2E | PASS |
| Console-Errors | keine |
| Echte KI-/Provider-/AWS-/RIS-/Apify-Aufrufe | keine |

## 9. Screenshots

Unter `docs/reports/assets/JM-CV-BUILDER-01B/`:

- `desktop-1440-classic.png`
- `desktop-1440-modern.png`
- `desktop-1440-compact.png`
- `desktop-1440-editor-live-preview.png`
- `mobile-390-classic.png`
- `mobile-390-modern.png`
- `mobile-390-compact.png`
- `mobile-390-view-toggle.png`

Synthetische Daten mit mehreren Stationen und längeren Beschreibungen.

## 10. Offene Punkte

- PDF-Export und Seitenumbruch bleiben 01C+.
- Kein Import aus vorhandenen CV-Dateien.
- Keine persistente Designpräferenz; die Vorlagenauswahl ist lokaler
  UI-State und wird bei Reload nicht gespeichert.
- Keine KI-Optimierung, ATS-Auswertung oder RIS-Persistenz.
- Native Monatsauswahl; keine gesonderte Browser-Fallback-UI.
- **PRODUCTION: weiterhin BLOCKED.**

## 11. Git

- Preview Foundation: `9dbb737`
- Editor-/Vorlagenintegration: `de6949c`
- E2E/Screenshots: `5a58413`
- Responsive Korrektur: `088166f`
- Dokumentation: dieser Commit
- Branch: `feature/jm-cv-builder-01b`
- Kein Push, Merge, Rebase, Stash, Reset oder Deployment

## 12. Abschlussentscheidung

**CV-BUILDER-01B: READY für 01C.**

Die Live-Vorschau, drei vollständigen Designvorlagen, Vorlagenwechsel ohne
Datenmutation, Desktop-/Tablet-/Mobil-Layout, Datumsdarstellung, sichere
Text-/Linkdarstellung und Session-Isolation sind lokal verifiziert.

**HARD STOP nach 01B. Keine PDF-Erzeugung, keine KI-Optimierung, keine
RIS-Persistenz, kein Push, kein Deployment.**
