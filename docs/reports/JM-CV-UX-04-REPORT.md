# JM-CV-UX-04 — Digital Career Flow Workspace Background

**Status:** `COMPLETE — LOCAL/UNIT VERIFIED — MODAL SCREENSHOT NOT AVAILABLE`
**Datum:** 2026-11-16
**Repository:** `maynowak/mays-jobsearch`
**Branch:** `feature/jm-cv-ux-04-digital-career-flow`
**Basis:** `feature/jm-cv-ux-03-editor-consolidation` @ `7096351`
**Implementierungs-Commit:** `eb2ad4a`

Kein Main-Merge, kein Production-Deployment, keine RIS-/AWS-/Terraform-/Cognito-
Änderung, keine Änderung an Consent, Matching, Speicher-APIs oder PDF-Export.

---

## 1. Ausgangslage

`JM-CV-UX-03` war nicht in `origin/main` (`464783b`) enthalten. Der Branch wurde
daher auf UX-03 (`7096351`) aufgebaut. Der bisherige einfarbige
`--bg`-Hintergrund des CV-Workspaces wurde ersetzt.

---

## 2. Designentscheidung: Digital Career Flow

Der Hintergrund besteht ausschließlich aus CSS und einer eingebetteten
SVG-Grafik:

- dunkler Petrol-/Blau-Verlauf,
- großflächige Cyan-/Türkis-Radialglows,
- dünne, halbtransparente Netzwerklinien mit Knotenpunkten,
- langsam wandernde Lichtpunkte,
- räumliche Tiefe durch mehrere Verlaufsebenen.

Keine externe Grafikbibliothek, kein WebGL, kein Video, kein JavaScript-
Daueranimation. Die Animation läuft über CSS-Keyframes
(`career-flow-drift`, `career-flow-points`) auf zwei Pseudo-Elementen.

Die weißen Arbeitsflächen bleiben opak:

- `cv-workspace-start`,
- `cv-builder-fullpage__box`,
- `cv-builder-modal__box`,
- `cv-import-workspace__box`.

Damit bleiben Formulare, Validierung, Live-Vorschau und PDF-Ausgabe unberührt.

---

## 3. Integration

### Vollansicht

- `.cv-workspace-page` erhält den neuen Hintergrund.
- Header ist dunkel-transluzent mit Cyan-Akzenten; Brand/Kicker/Sprachschalter
  sind auf dem dunklen Grund lesbar.
- Startkarte, Editor und Import bleiben weiße, opake Flächen.
- UX-03-Sticky-Preview und mobiler Sticky-Footer bleiben erhalten.

### Modal

- `.cv-builder-modal` erhält denselben Hintergrund (CSS-Pseudo-Ebenen).
- Der Modal-Box-Inhalt bleibt weiß und erhält explizit `color: var(--text)`.
- Keine Änderung an Modal-Logik, Fokusfalle oder Schließen-Verhalten.

### Desktop / Tablet / Mobile

- Desktop 1440: Hintergrund sichtbar, Formular/preview weiß, kein Overflow.
- Mobile 390: Startkarte und Editor lesbar, kein horizontaler Overflow,
  Speicheraktionen sticky erreichbar.
- Keine Animation über Formularfeldern: Pseudo-Ebenen liegen hinter den
  opaken Flächen (`z-index: 0`, Inhalte `z-index: 1`).

---

## 4. Performance und Accessibility

- Keine JavaScript-Daueranimation.
- Nur CSS-`background-position`-Animationen; keine Re-Renders durch die
  Hintergrundgestaltung.
- Pseudo-Ebenen `pointer-events: none`; keine Interaktionsblockade.
- `prefers-reduced-motion: reduce`: beide Animationen werden deaktiviert.
- Keine schnellen Blitze, keine hektischen Partikel.
- Textkontraste auf weißen Flächen explizit wiederhergestellt
  (`color: var(--text)`); Header-Texte auf dunklem Grund hell.
- Fokus-/Tastaturverhalten unverändert.

---

## 5. Screenshots

Erstellt mit lokalem Vite-Dev-Server, synthetischem leeren CV:

- `docs/reports/assets/JM-CV-UX-04/desktop-1440-start.png`
- `docs/reports/assets/JM-CV-UX-04/desktop-1440-editor.png`
- `docs/reports/assets/JM-CV-UX-04/mobile-390-start.png`
- `docs/reports/assets/JM-CV-UX-04/mobile-390-editor.png`

Geprüft:

- Desktop/Mobile: kein horizontaler Overflow (`0 px`).
- Startkarte/Editor: weiße Fläche `rgb(255,255,255)`, dunkler Text.
- Keine Console-/Page-Errors.
- Reduced-Motion: `animationName = none` für beide Pseudo-Ebenen,
  `pointer-events: none`.
- Normalbetrieb: `career-flow-drift` aktiv.

**Modal-Screenshot nicht erstellt:** Der CV-Editor-Modal ist im lokalen
Guest-Flow ohne authentifizierte CV-/Dashboard-Ansicht nicht erreichbar. Die
Modal-CSS ist implementiert, aber nicht per Screenshot abgenommen.

---

## 6. Tests und Build

| Prüfung | Ergebnis |
|---|---|
| `npm run build` | **PASS** (1,27 s) |
| Vollsuite `npx vitest run --maxWorkers=2` | **1902 PASS / 11 skipped** |
| `git diff --check` | **PASS** |
| Browser-Smoke Desktop/Mobile | 0 Console-/Page-Errors, 0 Overflow |

Es wurden keine UI-Tests für die rein visuelle Hintergrundschicht ergänzt;
die bestehenden CV-/Editor-/Import-Tests bleiben unverändert und PASS.

---

## 7. Verbleibende Einschränkungen

1. **Modal-Screenshot** nicht möglich ohne authentifizierten CV-Dashboard-
   Zugang; Modal-CSS ist implementiert, aber visuell nicht separat abgenommen.
2. **Animation** wurde über CSS-Keyframes und Reduced-Motion-Computing geprüft,
   nicht per Video-/Frame-Analyse.
3. **Kein Live-RIS-/S3-E2E** und kein Production-Deployment.
4. Hintergrund ist dekorativ; keine Änderung an Daten, PDF, Import oder
   Speicherung.

---

## 8. Git

| Feld | Wert |
|---|---|
| Branch | `feature/jm-cv-ux-04-digital-career-flow` |
| Basis | `7096351` (UX-03, nicht in main) |
| Implementierungs-Commit | `eb2ad4a` |
| Remote-Branch | `origin/feature/jm-cv-ux-04-digital-career-flow` |
| Push | bestätigt |
| Main-Merge | nein |
| Production-Deployment | nein |

Der Report-/Audit-Commit folgt auf demselben Branch.

---

## 9. Ergebnis

**COMPLETE — im autorisierten lokalen Testumfang.**

Der CV-Workspace besitzt jetzt den „Digital Career Flow“-Hintergrund mit
ruhiger CSS-/SVG-Animation, ohne die Lesbarkeit der weißen Arbeitsflächen,
die PDF-Ausgabe, die Speicherung oder die Importprüfung zu verändern.
