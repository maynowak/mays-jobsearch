# JM-CV-DESIGN-01 — Future Career Workspace

**Status:** `IMPLEMENTED / VERIFIED LOCAL — ASSET SUBSTITUTION NOTE`
**Branch:** `feature/jm-cv-design-01`
**Base:** `origin/main` `720f290`
**No Main merge, no production deployment, no RIS/ATS/consent/storage change.**

## 1. Implementierung

Die bestehende CV-Builder-Workspace-Architektur bleibt unverändert. Das neue
Design liegt ausschließlich im CV-Workspace:

- linke Atmosphäre: futuristische Stadt
- rechte Atmosphäre: digitaler Mensch als lokales SVG
- zentrale Panels: helles, leicht transparentes Glass-Panel
- statische Layer; keine neuen Animationen
- darunter `display: none` für die Seitenbilder ab 1200 px Breite
- zentrale Formulare behalten ihre bestehenden Felder, Validierung und
  Datenflüsse

Die zentralen Selektoren sind auf `.cv-workspace-page` begrenzt. Die
CV-Builder-Komponenten und das Datenmodell wurden nicht verändert.

## 2. Asset-Hinweis

Die beiden im Chat angehängten Bilder waren im Workspace nicht als Dateien
materialisiert und konnten daher nicht bytegenau übernommen werden. Verwendet
wurden:

- vorhandene lokale Stadt-Asset:
  `src/assets/images/Futuristische_Stadt_im_blauen_Abendlicht2.png`
- neue lokale SVG-Atmosphäre:
  `src/assets/images/cv-workspace-digital-human.svg`

Die CSS-Variablen `--cv-design-city` und `--cv-design-human` erlauben einen
späteren Austausch gegen die Originaldateien ohne Layoutänderung. Es wurden
keine externen URLs oder Laufzeit-Downloads verwendet.

## 3. Verifikation

- `npm run build`: **PASS**
- Full frontend suite: **1965 PASS / 11 skipped**
- Design E2E `node tests/e2e/jm-cv-design-01.mjs`: **PASS**
  - Desktop 1440 px: Stadt links und digitaler Mensch rechts sichtbar
  - Mobile 390 px: Seitenbilder ausgeblendet
  - Glasfläche: `rgba(247, 252, 255, 0.86)` Desktop,
    `rgba(247, 252, 255, 0.95)` Mobile
  - Animationen: `none` auf beiden Atmosphärenlayern
- Bestehender Full-Page-Workspace-E2E (`03A`): **PASS**
- Viewports 320 / 390 / 768 / 1024 / 1440 / 1920: **0 px horizontaler
  Overflow**

## 4. Screenshots

- `docs/reports/assets/JM-CV-DESIGN-01/workspace-start-1440.png`
- `docs/reports/assets/JM-CV-DESIGN-01/workspace-start-390.png`
- `docs/reports/assets/JM-CV-DESIGN-01/workspace-editor-1440.png`
- `docs/reports/assets/JM-CV-DESIGN-01/workspace-editor-390.png`

## 5. Grenzen

Keine Änderungen an CV-Datenmodell, RIS, ATS, Consent oder Speicherung.
Keine Produkt-/API-/Terraform-/AWS-Änderung. Kein Main-Merge oder Deployment.
