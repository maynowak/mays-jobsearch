# JM-CV-UX-RELEASE-02 — Controlled Production Release

**Status:** `PRODUCTION VERIFIED`
**Datum:** 2026-11-16
**Repository:** `maynowak/mays-jobsearch`
**PR:** [#22](https://github.com/maynowak/mays-jobsearch/pull/22)
**Feature-HEAD vor Merge:** `d3856ae`
**Main-/Merge-SHA:** `154c698`
**Report-Branch:** `docs/jm-cv-ux-release-02`

Kein zusätzlicher Merge, keine RIS-/AWS-/Terraform-/Cognito-Änderung, keine
Branch-Löschung.

---

## 1. Reconciliation

`origin/main` war von `fbe58e1` auf `17ffec8` weitergelaufen:

- PR #21 — Stellenübersetzung (`feature/jm-job-translation-01`)
- PR #23 — ATS-Description-Handoff
- PR #24 — Translation/ATS-Integration

`origin/main` (`17ffec8`) wurde in den Feature-Branch gemergt. Der einzige
Konflikt lag in `docs/AI_AUDITLOG.md`; ATS-/Translation- und UX-Einträge wurden
beide vollständig erhalten. `src/i18n.tsx` und `src/styles.css` wurden
automatisch gemergt und anschließend durch Build und Tests geprüft.

Merge-Commit: `d3856ae`.

---

## 2. PR-Merge

| Feld | Wert |
|---|---|
| PR | #22 |
| Draft entfernt | ja |
| Merge-Methode | GitHub Merge-Commit |
| Merge-Commit / Main-SHA | `154c698333682afd0b68454666738abc9713f194` |
| Gemergt am | 2026-11-16T13:16:14Z |
| Previous Main | `17ffec8` |
| Branch-Löschung | nein |

Der PR enthielt nach dem Merge alle UX-01–05-Änderungen sowie die aktuellen
Main-Änderungen (Translation/ATS). Keine History-Rewrites, kein Force-Push.

---

## 3. Tests / Build auf Main

Auf lokalem `main` = `origin/main` = `154c698`:

| Prüfung | Ergebnis |
|---|---|
| `npm run build` | **PASS** (1,07 s) |
| Vollsuite `npx vitest run --maxWorkers=2` | **1928 PASS / 11 skipped** (180 Dateien passed, 4 skipped) |
| `git diff --check` | **PASS** |
| Cumulative Diff | UX-Scope + Main-Integration, keine unerwarteten Änderungen |

---

## 4. Production-Deployment

Der PR-Merge löste **genau ein** Production-Deployment aus. Es wurde kein
zusätzliches `vercel --prod` ausgeführt (Vermeidung eines Doppel-Deployments).

| Feld | Wert |
|---|---|
| Deployment-ID | `dpl_CLDVRVSYhqQpY4dSJwD7eHY5uT16` |
| Deployment-URL | https://mays-job-matcher-j13vl6ukw-maymilly.vercel.app |
| Environment | `production` |
| Status | `READY` |
| Source | `main` |
| Git-Commit | `154c698333682afd0b68454666738abc9713f194` |
| Aliases | `www.mays-job-matcher.app`, `mays-job-matcher.app`, `mays-job-matcher.vercel.app`, `mays-job-matcher-maymilly.vercel.app` |
| Footer-Build-Identity | `Version 2.2.0 · production · main · 154c698` |

Deployment-Commit = Main-HEAD = Footer-Build-SHA. **PASS.**

### Vorheriger Production-Stand (Recovery-Referenz)

`dpl_Cw4tSPa95a9e4zb8Js4uSBZUCngB` @ `17ffec8`
(`mays-job-matcher-amgex1iry-maymilly.vercel.app`). Kein Rollback ausgeführt.

---

## 5. Production-Smoke-Test

Geprüft gegen `https://www.mays-job-matcher.app` mit Playwright.

### Desktop 1440

- Startseite geladen; Footer-Identität
  `Version 2.2.0 · production · main · 154c698`.
- CV-Workspace geladen; Digital Career Flow sichtbar.
- Leerer CV erstellt.
- Ungültige E-Mail → „1 Fehler“.
- „Zum ersten Fehler“ → Fokus auf `cv-builder-field-personal-email`.
- Fehler korrigiert.
- 20 Fähigkeiten → 12 sichtbar, Zähler „20 Fähigkeiten“.
- PDF-Download → `Lebenslauf.pdf`.
- „PDF dauerhaft speichern“ ohne Anmeldung korrekt disabled.
- Kein horizontaler Overflow, 0 Console-/Page-Errors.

### Mobile 390

- Startseite und CV-Workspace geladen.
- Digital Career Flow sichtbar.
- Kein horizontaler Overflow.
- 12 sichtbare Fähigkeiten bei 20, Zähler korrekt.
- Speicherbutton sichtbar; Footer im Bearbeiten-Modus sticky.
- PDF-Download `Lebenslauf.pdf`.
- 0 Console-/Page-Errors.

### Screenshots

- `docs/reports/assets/JM-CV-UX-RELEASE-02/desktop-landing.png`
- `docs/reports/assets/JM-CV-UX-RELEASE-02/desktop-editor.png`
- `docs/reports/assets/JM-CV-UX-RELEASE-02/mobile-landing.png`
- `docs/reports/assets/JM-CV-UX-RELEASE-02/mobile-editor.png`

### Nicht verifiziert

- **Authentifizierter CV-Editor-Modal:** kein zulässiger Testzugang im
  autorisierten Smoke-Test; nicht geprüft.
- **RIS-/S3-Live-E2E:** keine gesondert autorisierte synthetische
  Testidentität; nicht geprüft. Der Speicherbutton war im Gastkontext
  erwartungsgemäß deaktiviert.
- PDF-Download wurde als Browser-Download geprüft; die PDF-Datei selbst wurde
  nicht gegen ein RIS-Dokument verglichen.

---

## 6. Offene Einschränkungen / Risiken

1. Authentifizierter Modal- und RIS-Speicherpfad bleiben Live-unverifiziert.
2. Production-Footer bestätigt `154c698`; der Report-HEAD liegt auf einem
   separaten Docs-Branch und verändert die Production-Build-Identität nicht.
3. Der PR-Merge erzeugte den Production-Deploy automatisch; es gab kein
   separates manuelles `vercel --prod`. Das ist das einzige Production-
   Deployment dieses Releases.
4. Keine Branch-Löschung.

---

## 7. Release-Ergebnis

**`PRODUCTION VERIFIED`**

- UX-01–05 sind auf `main` und Production.
- Deployment-/Build-Identität stimmt mit `154c698` überein.
- Desktop/Mobile-Smoke, PDF-Download, Validierung, Fähigkeiten und
  Digital Career Flow funktionieren.
- Offene Punkte sind ausschließlich authentifizierte Modal-/RIS-Live-Nachweise,
  keine bekannten Produktregressionen.
