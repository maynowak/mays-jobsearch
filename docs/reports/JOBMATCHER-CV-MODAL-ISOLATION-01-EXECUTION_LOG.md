# JOBMATCHER-CV-MODAL-ISOLATION-01 — EXECUTION LOG

Status: GREEN
Datum: 2026-10-13
Branch: main

## Mission
CV-Verarbeitungsdialog auf /search vollstaendig von Navbar, Hero,
Hintergrund und Deko isolieren.

## 1) ROOT CAUSE (Explorer, im Code verifiziert — nicht "nur z-index")
- Das Overlay `.cv-workflow-overlay` war `position: fixed; inset: 0; z-index: 70`
  — der z-Wert war bereits HOCH.
- Es wurde aber innerhalb von `aside.search-sidebar` →
  `.container.layout-search` → `.search-world__content` (z-index 10) →
  `.search-world` (`isolation: isolate`) gerendert.
- `isolation: isolate` erzeugt einen eigenen Stacking-Context:
  ein Kind kann den Wurzel-Kontext nicht verlassen. Die Navbar
  (z-index 40, Wurzel) und der Hero lagen dadurch oberhalb des Dialogs,
  egal wie hoch dessen z-index war.
- Zusaetzlich: Backdrop nur `rgba(15,23,42,.5)` → Hero/Navbar-Inhalte
  schimmerten durch den Dialog.
- Decorative Ebenen hatten bereits `pointer-events: none` (kein Klickproblem).

## 2) FIX
- `src/App.tsx`: `createPortal(..., document.body)` — der Dialog wird in die
  Wurzelebene gehoben. `z-index: 70 > Navbar 40` greift jetzt.
  (Kein React-Portal war zuvor im Repo vorhanden; `react-dom` ist bereits
  Abhaengigkeit, keine neue Dependency.)
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby="cv-processing-title"`.
- Hintergrundscrollen gesperrt (`document.body.style.overflow = "hidden"`),
  im Cleanup auf den Vorwert zurueckgesetzt.
- Escape schliesst den Dialog (Keydown-Listener, Ref-auf aktuellen Handler).
- Fokus: beim Oeffnen in die Dialogkarte (verzoegert auf den nächsten Tick,
  damit der Portal-Commit abgeschlossen ist); beim Schliessen Rueckgabe auf
  das vorherige Element — mit Fallback auf `#cv-panel` (jetzt `tabIndex={-1}`),
  wenn das urspruengliche Element entfernt wurde oder `body` war.
- `src/styles.css`: Backdrop `rgba(9,17,28,.84)` + `blur(4px)`,
  Dialog `max-height: calc(100dvh - 32px)` mit `overflow-y: auto`,
  opake Kartenflaeche `var(--surface)`, fokusmarkierung `:focus-visible`,
  Desktop-Anpassung `max-height: calc(100dvh - 48px)`.

## 3) CV-Funktionalitaet unveraendert (Security-Grenze geprueft)
PDF-Upload, Einwilligung (ConsentGate), Anonymisierung, Modellwahl,
Profilerstellung, ATS und API-Veraenderungen: unangetastet. Der Fix ist
rein strukturell (Portal) + CSS + Fokus/Scroll-Handling.

## 4) Erhalten
- Job-Lobby-Hintergrund unveraendert (Diff: 0 Zeilen mit url()/image-set).
- Navbar-Optik, Hero, Deko, Auth/Legal unveraendert.
- Keine Aenderung an Cognito/OIDC/PKCE, RIS, AWS, Terraform.

## 5) VALIDATION
- `npm test` → 771 passed, 5 skipped (70 Dateien) OK
- `npm run build` → erfolgreich OK
- Neue Regressionstests in `src/App.test.tsx` (4):
  1. Portal: Overlay ist direktes Kind von `document.body`, nicht in
     `.search-world` / `.search-sidebar` / `header.navbar`
  2. `role=dialog` + `aria-modal=true` + `aria-labelledby` + Card vorhanden
  3. `body.style.overflow === "hidden"` waehrend offener Dialog
  4. Escape schliesst, Scroll-Lock geloest, Fokus zurueck im CV-Bereich
- Bestehende CV-Workflow-Tests (Upload → Consent → Anonymisierung →
  Modellwahl → Profil) weiterhin gruen.

## 6) Responsive
- `100dvh`-basierte Hoehen greifen auf Mobile/Tablet; Dialog scrollt intern
  (`overflow-y: auto` + `overscroll-behavior: contain`), Buttons und
  Einwilligungs-Checkbox bleiben erreichbar; keine horizontalen Scrollbars.

## 7) NICHT VERIFIED
- Browser-Sichtpruefung (Chrome/Safari, Viewports 1920/1440/1024/768/390/360,
  Zoom 125/150 %) wurde in dieser Pipeline NICHT ausgefuehrt.
  Aussage "Navbar verdeckt Dialog nicht" ist ueber die Portal-/z-Index-Logik
  und die Tests belegt, visuell aber NICHT verifiziert.

## 8) Files changed
- src/App.tsx (Portal, A11y, Scroll-Lock, Escape, Fokus)
- src/components/CvUpload.tsx (`tabIndex={-1}` auf #cv-panel)
- src/styles.css (Backdrop, max-height, opake Flaeche)
- src/App.test.tsx (4 Regressionstests)
- docs/reports/JOBMATCHER-CV-MODAL-ISOLATION-01-EXECUTION_LOG.md
