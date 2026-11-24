# JM-CV-IMPORT-NAVIGATOR-02 — MAIN RELEASE

**Status:** `PRODUCTION VERIFIED`

**Repository:** `maynowak/mays-jobsearch`

**Feature branch:** `feature/jm-cv-import-navigator-02`

**Verified feature HEAD:** `cdfcb13`

**Main merge:** `fbefde3` (PR #62)

**Production build:** `fbefde3`

## 1. Release-Gegenstand

Der Fullpage-CV-Import erhielt den gemeinsamen RadarNavigator:

- Importübersicht, erkannte Abschnitte, Prüfgruppe, alle Prüfkandidaten mit
  stabilen IDs und Importentscheidung;
- statusabhängige Marker und Status-Texte, nicht nur Farbe;
- Navigation über mehrere Prüfseiten mit Filter-Reset-Hinweis und Erhalt aller
  Entscheidungen und bearbeiteten Texte;
- keine erfundenen Markerpositionen für nicht gerenderte Kandidaten;
- mobile Übersicht;
- Screenshot-Modus ohne Radar;
- wiederverwendeter CORE-Kern einschließlich native non-passive Wheel-Steuerung.

### Responsive Follow-up

Die visuelle Abnahme zeigte, dass der mobile Trigger „Importübersicht“ bei
768 px Karteninhalt überdeckte. Der Fix `0c06450` verschiebt den Trigger
ausschließlich bei ≤ 900 px in den normalen Fluss oberhalb der Importkarte.
Desktop-Radar und Desktop-Design bleiben unverändert. `cdfcb13` ergänzt eine
E2E-Geometrieprüfung für 390 und 768 px.

## 2. Scope-Prüfung

Der PR #62 enthält ausschließlich:

- CV-Import-Navigation (`CvBuilderImportDialog`, `CvBuilderImportReview`)
- gemeinsame Radar-Erweiterung (`RadarNavigator`, `radarNavigator`,
  `cvNavigatorAdapters`) und Tests
- Import-spezifische Styles und i18n-Texte
- Import-Navigator-E2E und Screenshots
- Implementierungsbericht/Auditlog

Keine Änderungen an:

- CV-Editor oder Workspace-Handoff
- PDF-Parser, Importentscheidungslogik oder Validierung
- RIS-, AWS-, Terraform-, Cognito-, Consent- oder Storage-Code
- Match-Radar-Design oder dessen E2E-Vertrag

## 3. Tests und Checks

| Prüfung | Ergebnis |
|---|---|
| Fokussierte Import-/Radar-/Core-Tests | **55 PASS** |
| Vollständige serielle Vitest-Suite | **2078 PASS / 5 skipped** (201 Dateien) |
| `npm run build` | **PASS** |
| CV-Import-Radar-Browser-E2E | **PASS** |
| Bestehende Match-Radar-Browser-E2E | **PASS** |
| Bestehende `cv-import-ux-07`-E2E | **PASS** |
| PR #62 CodeQL | **PASS** |
| PR #62 Vercel Preview/Deployments | **PASS** |
| `git diff --check` / Secret-Scan | **PASS** |

Die Import-Radar-E2E prüft 5/10/35-Kandidatenpfade in Vitest sowie im Browser
35 synthetische Zeilen (36 Parser-Kandidaten), 14 Desktop-Marker, 5 Labels,
Tastatur, Statuswechsel, Filter-Reset, Screenshot-Modus und die
Trigger-/Karten-Geometrie bei 390/768 px.

## 4. Production-Deployments

| Projekt | Deployment | Status |
|---|---|---|
| `mays-job-matcher` | `dpl_GQRomYabfcZ4U59adhDUhdc6YaND` | Ready |
| `mays-jobsearch` | `dpl_B5FsfhG3QztENvq3bMujuP4HzrVg` | Ready |

Automatische Git/Vercel-Production-Deployments; kein manuelles Deployment.

Beide Domains:

- `https://www.mays-job-matcher.app`
- `https://mays-jobsearch.vercel.app`

liefern `/cv-builder/workspace` mit HTTP 200 und Build `fbefde3`.

## 5. Production-Smoke

Synthetischer Browser-Smoke auf beiden Domains mit lokal erzeugtem PDF; alle
API-Aufrufe wurden im Browser gemockt. Keine echten KI-Anfragen, keine echten
CV- oder personenbezogenen Daten, keine RIS-/Storage-Writes.

| Prüfung | Matcher | Jobsearch |
|---|---|---|
| `/cv-builder/workspace` 200 | PASS | PASS |
| Radar vorhanden | PASS | PASS |
| 14 Desktop-Marker / 10 sichtbare Kandidaten | PASS | PASS |
| 5 kollisionsfreie Hover-Titel mit Status | PASS | PASS |
| Tastatur Fokus + Enter | PASS | PASS |
| Statuswechsel auf „Eingeschlossen“ | PASS | PASS |
| Importentscheidung erreicht und fokussiert | PASS | PASS |
| Mobile 390: Trigger oberhalb der Karte | PASS | PASS |
| Mobile Panel: ≥ 35 Kandidaten | PASS | PASS |
| Kandidat 12 öffnet Prüfseite 2 | PASS | PASS |
| Filter-Reset mit erhaltenen Entscheidungen | PASS | PASS |
| Screenshot-Modus ohne Radar | PASS | PASS |
| Tablet 768: kein Trigger-/Karten-Overlap | PASS | PASS |
| Console-/Page-Errors | 0 | 0 |
| Unerwartete API-Calls | 0 | 0 |

Screenshots:

```text
docs/reports/assets/JM-CV-IMPORT-NAVIGATOR-02-RELEASE/
├── production-radar-1440.png
└── production-radar-390-panel.png
```

## 6. Grenzen

- Kein Main-Docs-Merge; dieser Release-Bericht und der Auditlog liegen auf
  separatem Docs-Branch.
- Keine RIS-/AWS-/Cognito-/Consent-/Storage-/Parser-Änderung.
- Kein Force-Push, keine Branch-Löschung, kein manuelles Deployment.
- Feature-Branch bleibt erhalten.
