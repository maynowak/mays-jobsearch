# JM-CV-DESIGN-02 — Original Assets & Visual Polish

**Status:** `IMPLEMENTED / VERIFIED LOCAL — READY FOR VISUAL REVIEW`
**Branch:** `feature/jm-cv-design-01`
**Asset commit:** `9036b24`
**Base:** `origin/main` `720f290`
**No Main merge, no production deployment, no RIS/ATS/consent/storage change.**

## 1. Original-Assets

Die beiden Originale wurden unverändert als Referenz übernommen:

- `docs/reports/assets/JM-CV-DESIGN-02/originals/jm-cv-city-original.jpg` — 2048 × 1535, 965 KB
- `docs/reports/assets/JM-CV-DESIGN-02/originals/jm-cv-human-original.jpg` — 2048 × 1365, 773 KB

Für die Web-Auslieferung wurden daraus optimierte WebP-Dateien erzeugt:

- `src/assets/images/jm-cv-city.webp` — 1600 × 1199, 205 KB
- `src/assets/images/jm-cv-human.webp` — 1600 × 1066, 176 KB

Gesamtersparnis gegenüber den Originalen: ca. **78 %**.
Die CSS-Variablen `--cv-design-city` und `--cv-design-human` referenzieren die
optimierten Dateien. Die Originale bleiben als Referenz erhalten.

## 2. Visuelle Anpassung

- linke Seite: Original-Stadtbild
- rechte Seite: Originalbild des digitalen Menschen
- sanfte Aufhellung über `brightness`/`saturate`
- dezente Cyan-/Dark-Overlays für Lesbarkeit
- Glassmorphism-Panel unverändert hell und leicht transparent
- keine neuen Animationen
- seitliche Bilder ab 1200 px Breite ausgeblendet; Mobile bleibt unverändert lesbar

Es wurden keine CV-Komponenten, Formularfelder, Validierungen, RIS-, ATS-,
Consent- oder Speicherpfade angefasst.

## 3. Verifikation

| Prüfung | Ergebnis |
|---|---|
| `npm run build` | **PASS** |
| Full frontend suite | **1965 PASS / 11 skipped** |
| Design E2E `node tests/e2e/jm-cv-design-02.mjs` | **PASS** |
| Bestehender Full-Page-CV-Workspace-E2E `03A` | **PASS** |
| Viewports 320 / 390 / 768 / 1024 / 1440 / 1920 | **0 px horizontaler Overflow** |
| Seitenbilder Desktop 1440 px | sichtbar |
| Seitenbilder Mobile 390 px | ausgeblendet |
| Animationen | keine |
| API-Aufrufe im Design-E2E | keine |

## 4. Screenshots

- `docs/reports/assets/JM-CV-DESIGN-02/workspace-start-1440.png`
- `docs/reports/assets/JM-CV-DESIGN-02/workspace-start-390.png`
- `docs/reports/assets/JM-CV-DESIGN-02/workspace-editor-1440.png`
- `docs/reports/assets/JM-CV-DESIGN-02/workspace-editor-390.png`

## 5. Grenzen

Keine Änderungen an CV-Datenmodell, RIS, ATS, Consent oder Speicherung.
Keine Produkt-/API-/Terraform-/AWS-Änderung. Kein Main-Merge oder Deployment.
