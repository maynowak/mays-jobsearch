# JM-CV-EDITOR-NAVIGATOR-03 — MAIN RELEASE

**Status:** `PRODUCTION VERIFIED`

**Repository:** `maynowak/mays-jobsearch`

**Feature branch:** `feature/jm-cv-editor-navigator-03`

**Verified feature HEAD:** `a349e1c`

**Main merge:** `431f938` (PR #63)

**Production build:** `431f938`

## 1. Release-Gegenstand

Der Fullpage-CV-Editor erhielt die gemeinsame Radar-Navigation:

- Glass-Radar links, mit Abstand zu den Turbo-Händen und der Vorschau rechts;
- Ziele für alle acht Editorabschnitte, Validierungsübersicht und
  Speicher-/Exportaktionen;
- Öffnen eingeklappter Abschnitte vor dem Scrollen;
- Fehlerstatus mit Fehleranzahl in Hover-, Panel- und ARIA-Text;
- Fokus und Highlight auf dem tatsächlichen Fehlerfeld;
- Mobile Trigger oberhalb der Editor-Karte, Panel im normalen Fluss;
- Screenshot-Modus ohne Radar und ohne Turbo-Hände;
- Turbo-Hände bleiben vollständig erhalten und werden vor Radar-Navigation
  gezielt gestoppt.

Keine neue Navigations- oder Scroll-Engine.

## 2. Scope-Prüfung

PR #63 enthält ausschließlich:

- Editor-Radar in `CvBuilderEditor`
- imperativen `stop()`-Handle in `CvBuilderScrollHands`
- Panel-Kind-Attribut in `RadarNavigator`
- Editor-spezifische Styles und i18n-Texte
- Editor-Navigator-Tests und Screenshots
- Implementierungsbericht/Auditlog

Keine Änderungen an Validierungsregeln, CV-Parser, PDF-Export, RIS, AWS,
Cognito, Consent oder Storage.

## 3. Tests und Checks

| Prüfung | Ergebnis |
|---|---|
| Fokussierte Editor-/Import-/Radar-/CORE-Tests | **108 PASS** |
| Vollständige serielle Vitest-Suite | **2086 PASS / 5 skipped** (202 Dateien) |
| `npm run build` | **PASS** |
| Editor-Radar-Browser-E2E | **PASS** |
| `cv-builder-full-page-workspace-03a` | **PASS** |
| `cv-builder-ux-06-navigation-drafts` | **PASS** |
| Import-Radar-E2E | **PASS** |
| Match-Radar-E2E | **PASS** |
| PR #63 CodeQL | **PASS** |
| PR #63 Vercel Preview/Deployments | **PASS** |
| `git diff --check` / Secret-Scan | **PASS** |

Der unveränderte Legacy-Test `cv-builder-workflow-02a` erwartet weiterhin den
alten Button-Text „Lebenslauf speichern“, während `cvBuilder.save` bereits auf
`origin/main` „Entwurf übernehmen“ heißt. Der Test ist damit vorbestehend
veraltet und wurde in diesem Release bewusst nicht geändert.

## 4. Production-Deployments

| Projekt | Deployment | Status |
|---|---|---|
| `mays-job-matcher` | `dpl_HA9WH179eNFEQAFaxZmL7SzzBt8o` | Ready |
| `mays-jobsearch` | `dpl_6igxwwzjZrQMkn7UqWPgDvy4ocxr` | Ready |

Automatische Git/Vercel-Production-Deployments; kein manuelles Deployment.

Beide Domains liefern `/cv-builder/workspace` mit HTTP 200 und Bundle/Footer
`431f938`:

- `https://www.mays-job-matcher.app`
- `https://mays-jobsearch.vercel.app`

## 5. Production-Smoke

Synthetischer Smoke auf beiden Domains mit einer leeren Editor-Sitzung. Keine
echten KI-Anfragen, keine RIS-/Storage-Writes und keine personenbezogenen Daten.

| Prüfung | Matcher | Jobsearch |
|---|---|---|
| `/cv-builder/workspace` 200 | PASS | PASS |
| Radar und Turbo-Hände vorhanden | PASS | PASS |
| 9+ Desktop-Marker / 5 Hover-Titel | PASS | PASS |
| Radar/Hände und Radar/Vorschau ohne Overlap | PASS | PASS |
| Tastatur stoppt Turbo-Hände (`scrollBy` = 0) | PASS | PASS |
| Validierungsfehler: roter Status + ARIA-Fehleranzahl | PASS | PASS |
| Fehlerfeld-Fokus und Highlight | PASS | PASS |
| Fehler verschwindet nach Korrektur; Aktionen bereit | PASS | PASS |
| Mobile 390/768: Trigger oberhalb der Karte | PASS | PASS |
| Mobile Panel ohne Hände-/Formular-Overlap | PASS | PASS |
| 8 Abschnitte in mobiler Übersicht | PASS | PASS |
| Vorschau → Bearbeitungsansicht | PASS | PASS |
| Breitenmaximierung | PASS | PASS |
| Screenshot-Modus ohne Radar/Hände | PASS | PASS |
| Escape + Fokus-Rückkehr | PASS | PASS |
| Console-/Page-Errors | 0 | 0 |
| Unerwartete API-Calls | 0 | 0 |

Screenshots:

```text
docs/reports/assets/JM-CV-EDITOR-NAVIGATOR-03-RELEASE/
├── production-radar-1440.png
├── production-radar-error-focus-1440.png
├── production-radar-768-panel.png
└── production-radar-390-panel.png
```

## 6. Grenzen

- Release-Bericht und Auditlog liegen auf einem separaten Docs-Branch und
  werden nicht nach `main` gemerged.
- Keine RIS-/AWS-/Cognito-/Consent-/Storage-/Parser-/PDF-Export-Änderung.
- Kein Force-Push, keine Branch-Löschung, kein manuelles Deployment.
- Feature-Branch bleibt erhalten.
