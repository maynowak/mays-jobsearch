# JM-CV-DESIGN-03 — CV Workspace UI Polish

**Status:** `IMPLEMENTED / VERIFIED LOCAL — READY FOR VISUAL REVIEW`
**Branch:** `feature/jm-cv-design-01`
**Base:** `origin/main` `720f290`
**No Main merge, no production deployment, no RIS/ATS/consent/storage change.**

## 1. Live-Vorschau und Aktionsleiste

Die bestehende Editor-Struktur blieb unverändert. Ergänzt wurden nur
Abstands- und Scrollregeln:

- `.cv-builder-workspace` erhält 22 px unteren Innenabstand
- `.cv-builder-preview-pane` erhält 24 px unteren Innenabstand und
  `scroll-padding-bottom`
- `.cv-preview` verliert den doppelten unteren Rand
- `.cv-builder-footer` erhält etwas mehr oberen Abstand; die mobile
  Safe-Area bleibt berücksichtigt

Gemessener Abstand zwischen Vorschau und Footer bei 1440 px: **48 px**.

## 2. Screenshot-Ansicht

Der Toggle verwendet jetzt sichtbar:

- Deutsch: **„Ansicht wechseln“**
- Englisch: **„Switch view“**

Der bestehende Zustand bleibt über `aria-pressed` zugänglich; der Tooltip
nennt weiterhin kontextabhängig „Screenshot-Ansicht“ bzw. „Screenshot-Ansicht
beenden“. Die Funktion selbst wurde nicht verändert.

## 3. Verifikation

| Prüfung | Ergebnis |
|---|---|
| `npm run build` | **PASS** |
| Full frontend suite | **1965 PASS / 11 skipped** |
| Design E2E mit DESIGN-03-Ausgabe | **PASS** |
| Preview/Footer-Abstand 1440 px | **48 px** |
| 320 / 390 / 768 / 1024 / 1440 / 1920 | **0 px Overflow** |
| Full-Page-CV-Workspace-E2E `03A` | **PASS** |
| Screenshot-Toggle / `aria-pressed` | **PASS** |
| API-Aufrufe im Design-E2E | keine |

## 4. Screenshots

- `docs/reports/assets/JM-CV-DESIGN-03/workspace-start-1440.png`
- `docs/reports/assets/JM-CV-DESIGN-03/workspace-start-390.png`
- `docs/reports/assets/JM-CV-DESIGN-03/workspace-editor-1440.png`
- `docs/reports/assets/JM-CV-DESIGN-03/workspace-editor-390.png`

## 5. Grenzen

Originalbilder, Hintergrundpositionierung, CV-Datenmodell, PDF-Generierung,
RIS, ATS, Consent und Speicherung blieben unverändert. Keine neue Architektur.
Kein Main-Merge oder Deployment.
