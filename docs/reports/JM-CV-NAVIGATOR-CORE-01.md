# JM-CV-NAVIGATOR-CORE-01

**Status:** `READY FOR INTEGRATION REVIEW`

**Branch:** `feature/jm-cv-navigator-core-01`

**Basis:** `origin/main` `c8268ff`

**Implementation commits:** `06a7f72`, `3fe9663`

## 1. Ziel und Abgrenzung

Der Match Radar und die späteren CV-Import-/Editor-Radare sollen dieselbe
Navigationslogik nutzen. CORE-01 extrahiert dafür einen datenquellenunabhängigen
Kern und bindet den bestehenden Match Radar über einen dünnen Adapter an.

Nicht Bestandteil dieses Arbeitspakets:

- keine Radar-Integration in `CvBuilderImportDialog`, `CvBuilderImportReview`
  oder `CvBuilderEditor`;
- keine Änderung an CV-Formulardaten, Parser, Validierung, PDF-Erzeugung,
  RIS-Persistenz, Workspace-Handoff oder Turbo-Händen;
- keine RIS-, AWS-, Terraform-, Cognito-, Consent- oder Storage-Änderung;
- keine Main-Integration und kein Production-Deployment.

## 2. Architektur des gemeinsamen Kerns

### 2.1 Reine Kernlogik

`src/lib/navigation/radarNavigator.ts` enthält keine Job-, CV- oder
RIS-Abhängigkeit und stellt bereit:

- `NavigatorTarget` mit stabiler `id`, `title`, optionalem `kind`/`status`,
  optionalem DOM-Element und optionalem `getElement`/`activate`;
- `NavigatorAdapter` als gemeinsamen Vertrag;
- `layoutRadarLabels()` für kollisionsfreie Hover-Titel;
- `measureNavigatorTargets()`: Messung der tatsächlichen DOM-Positionen,
  relative Position auf der Schiene, Filterung unsichtbarer/entfernter Elemente
  und stabile Sortierung;
- `activeNavigatorTargetId()`: Ermittlung des aktuell sichtbaren Abschnitts;
- `scrollNavigatorTarget()` und `activateAndScrollNavigatorTarget()` für
  Fenster- und Container-Scrollen mit konfigurierbarem Offset, Reduced Motion
  und einem optionalen `onBeforeScroll`-Haken;
- `waitForNavigatorElement()` für Ziele, die erst nach Filter-/Pagination- oder
  Aufklapp-Aktivierung gerendert werden;
- `navigatorTargetSignature()` als stabile Messsignatur über ID, Titel, Status
  und Elementidentität.

Die Kernfunktionen lesen und schreiben keine CV-/Jobdaten. `activate()` gehört
immer zum jeweiligen Adapter und darf dort eine Ansicht öffnen oder aktivieren;
der Kern wartet anschließend auf das tatsächliche Zielelement.

### 2.2 Wiederverwendbare Darstellung

`src/components/RadarNavigator.tsx` ist die gemeinsame, generische
Navigationskomponente. Sie erhält Ziel-Labels, einen Klassenpräfix und
optional:

- `regionSelector` für den Messbereich;
- `scrollContainer` für eigenständig scrollende Container;
- `offset` für unterschiedliche Header;
- `onActivate` für die bestehende Match-Radar-Erweiterung;
- `onBeforeNavigate` für die spätere Koordination mit den Turbo-Händen;
- `enabled` zum Ausblenden in der späteren Screenshot-Ansicht;
- `maxLabels`, `panelId` und `classNamePrefix` für die jeweilige Einbindung.

Der Match Radar verwendet `classNamePrefix="match-radar"` und damit unverändert
das bestehende CSS und DOM-Verträge (`data-radar-marker-id`,
`.match-radar__rail`, `.match-radar__labels`, `.match-radar__panel`).

### 2.3 Match-Radar-Adapter

`src/components/MatchRadar.tsx` ist jetzt ein dünner Adapter:

- liest die vorhandenen `[data-radar-job-id]`-Karten aus `#matches`;
- aktualisiert die Ziel-Liste bei Mutationen und neuen Suchergebnissen;
- übergibt die bestehenden i18n-Texte, `radarKey` und `onActivate`;
- enthält keine eigene Mess-, Scroll-, Wheel- oder Hover-Titel-Logik mehr.

Die bestehende Erweiterung eingeklappter Ergebnislisten bleibt über
`onActivate` erhalten. Die Radar-Positionen werden aus den tatsächlichen
Kartenpositionen berechnet, nicht aus gleichmäßigen Indexabständen.

## 3. Dynamische Ziele und Adapterverträge

`src/lib/navigation/cvNavigatorAdapters.ts` definiert die Verträge für die
nächsten Pakete, ohne sie produktiv anzubinden:

- `CvImportNavigatorAdapter`: Importabschnitte, Prüfkandidaten,
  ausstehende Entscheidungen, Fehler und Aktionen; die spätere
  `activate()`-Implementierung kann Filter oder Pagination umschalten;
- `CvEditorNavigatorAdapter`: persönliche Angaben, Kurzprofil,
  Berufserfahrung, Ausbildung, Fähigkeiten, Projekte, Zertifikate, Sprachen,
  Validierung und Aktionen; die spätere `activate()`-Implementierung kann ein
  eingeklapptes `<details>` öffnen;
- `createCvSectionTarget()` und `createCvImportTarget()` als synthetische
  Target-Fabriken für Tests und die nächsten Adapter.

Der Ablauf für ein noch nicht gerendertes Ziel ist damit vorbereitet:
Target auswählen → `activate()` des Adapters → auf `getElement()` warten →
tatsächliches Element finden → mit Offset scrollen. Der Kern verändert dabei
keine Formulardaten.

## 4. Scroll- und Beobachterverhalten

- Messung relativ zum konfigurierten Bereich und zur tatsächlichen
  Dokumentposition.
- Unterstützung für `window` und eigenständig scrollende Container.
- Konfigurierbarer Offset; der bestehende Match Radar nutzt weiterhin den
  Navbar-Abstand.
- `ResizeObserver` auf Bereich, Schiene und Scroll-Container,
  `MutationObserver` auf dem Messbereich sowie Fenster-`resize`.
- Beobachtete Messungen werden per `requestAnimationFrame` gebündelt; die
  Initialisierung verändert die Scrollposition nicht.
- Alle Observer, Scroll-Listener, Resize-Listener und ausstehenden Frames
  werden beim Unmount entfernt.
- Aktive Zielermittlung wird per `requestAnimationFrame` beim Scrollen
  aktualisiert. Während einer bewussten Radar-Navigation bleibt die gewählte
  Markierung aktiv, bis das Ziel erreicht ist (kurzes Navigationsfenster),
  statt durch die erste Zwischenposition überschrieben zu werden.
- Reduced Motion verwendet `behavior: "auto"`; es gibt keine dauerhaften
  Animationen.
- `onBeforeNavigate` kann vor jeder Radar-Navigation z. B. die Turbo-Hände
  stoppen. Die tatsächliche Verdrahtung bleibt bewusst dem späteren
  CV-Integrationspaket vorbehalten.

## 5. Accessibility

- Marker sind echte `<button>`-Elemente mit `aria-label`, `aria-current` und
  sichtbarem Fokus.
- Hover-Titel bleiben dekorative, nicht fokussierbare `<span>`-Elemente in
  einer `aria-hidden`-Schicht.
- Kein automatischer Fokus bei Hover.
- Mobile Trefferübersicht ist ein Dialog mit `aria-label`; Escape schließt und
  setzt den Fokus auf den Auslöser zurück.
- Tastaturbedienung über native Buttons; Screenreader erhalten die
  Navigationsstruktur und die Ziel-Labels.
- Reduced Motion wird respektiert.

## 6. Tests

### 6.1 Fokussierte Tests

| Datei | Inhalt | Ergebnis |
|---|---|---|
| `src/lib/navigation/radarNavigator.test.ts` | 20 Ziele mit unterschiedlichen Höhen, echte Positionen, Neuberechnung, Container, aktive Auswahl, Klickziel, nicht gerenderte/asynchrone Ziele, eingeklappte Testsektion, entfernte Elemente, Reduced Motion | **11 PASS** |
| `src/components/RadarNavigator.test.tsx` | Button-/Label-A11y, kein Scroll bei Initialisierung, Fokus/Tastatur, Klick mit einem koordinierten Scroll, Wheel vor/zurück, asynchron gerendertes Ziel, deaktivierter Modus, Listener-Cleanup | **9 PASS** |
| `src/lib/navigation/cvNavigatorAdapters.test.ts` | Editor-Sektionen, Status/Kind, Import-Targets und Provider-Vertrag | **3 PASS** |
| `src/components/MatchRadar.test.tsx` | bestehende Label-Layout- und Escape-/Fokusregression | **4 PASS** |
| **Summe** | | **27 PASS** |

### 6.2 Bestehende Match-Radar-Browser-E2E

`npm run test:e2e:match-radar-01` wurde vollständig erneut ausgeführt:

- 20 Karten und 20 Marker; Reihenfolge und echte relative Positionen PASS;
- Hover 1–5 Labels ohne Überlappung, Marker als Buttons PASS;
- Klick scrollt zum Ziel und markiert es PASS;
- Wheel vorwärts/rückwärts PASS;
- eingeklappte Liste über Radar-Aktivierung wiederhergestellt PASS;
- neue Suche ersetzt alle 20 Einträge PASS;
- normales Scrollen außerhalb der Radar-Schiene unverändert PASS;
- mobile Panels 390/768: 20 Einträge, Escape, Fokus-Rückkehr PASS;
- 0 Overflow, 0 AI-/ATS-/Profil-Aufrufe, `/api/jobs` genau 2.

### 6.3 Vollsuite, Build und Audits

- Serielle Vollsuite: **2071 PASS / 5 skipped** (200 Testdateien: 197 PASS,
  3 skipped).
- `npx tsc -b --pretty false`: PASS.
- `npm run build`: PASS.
- `git diff --check`: PASS.
- Secret-Scan der neuen/geänderten Dateien: keine Treffer.
- Der bestehende `MatchRadar`-E2E-Output wurde nicht als Produktänderung
  gewertet; Screenshot-Dateien wurden nach dem Lauf auf den getrackten
  Ausgangsstand zurückgesetzt.

## 7. Vorbereitete nächste Pakete

Für das Import-Paket:

- Targets für erkannte Abschnitte, Prüfkandidaten, ausstehende Entscheidungen
  und Fehler;
- `activate()` für Filter/Pagination;
- `getElement()` erst nach dem Rendern;
- optionaler `onBeforeNavigate`-Aufruf zum Stoppen der Turbo-Hände.

Für das Editor-Paket:

- Targets für alle vorhandenen Editorsektionen;
- `activate()` zum Öffnen eingeklappter `<details>`;
- Statuswerte für ausstehende/abgeschlossene/warnende Abschnitte;
- keine Änderung an Formulardaten durch den Kern.

Offene Integrationsentscheidungen (bewusst nicht in CORE-01):

- konkrete visuelle Klasse für die späteren CV-Radare;
- Verdrahtung von `enabled` mit dem Screenshot-Modus;
- Verdrahtung von `onBeforeNavigate` mit `CvBuilderScrollHands`;
- Festlegung, ob Import-Radar und Editor-Radar gleichzeitig sichtbar sind oder
  jeweils nur im aktiven Workspace-Modus.
