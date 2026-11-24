# JM-CV-NAVIGATOR-CORE-RELEASE-01

**Status:** `PRODUCTION VERIFIED`

**Repository:** `maynowak/mays-jobsearch`

**Release branch:** `feature/jm-cv-navigator-core-01` (PR #60)

**Verified feature HEAD:** `0ff75eb`

**Main after core merge:** `d524911`

**Main after production hotfix:** `53c9926`

**Production build:** `53c9926` on both domains

## 1. Release-Gegenstand

Der gemeinsame Navigator-Kern aus `JM-CV-NAVIGATOR-CORE-01` wurde kontrolliert
nach `main` integriert:

- `src/lib/navigation/radarNavigator.ts`
- `src/components/RadarNavigator.tsx`
- `MatchRadar.tsx` als dünner Adapter
- vorbereitete Import-/Editor-Adapterverträge
- Kern-, Komponenten- und Adaptertests

Nicht enthalten: CV-Import-/Editor-Integration, RIS-, AWS-, Terraform-,
Cognito-, Consent-, Storage- oder Parser-Änderungen.

## 2. PRs und Merges

| PR | Inhalt | Head | Merge |
|---|---|---|---|
| [#60](https://github.com/maynowak/mays-jobsearch/pull/60) | Shared Radar Navigator Core | `0ff75eb` | `d524911` |
| [#61](https://github.com/maynowak/mays-jobsearch/pull/61) | Native non-passive wheel listener | `de94a46` | `53c9926` |

Beide PRs waren `MERGEABLE`/`CLEAN`; es gab keinen Force-Push und keine
Branch-Löschung.

### 2.1 Production-Fix aus dem ersten Smoke

Der erste Production-Smoke auf `d524911` deckte einen bereits im bisherigen
Radar vorhandenen Fehler auf: Der React-delegierte Wheel-Handler ist passiv,
sodass `preventDefault()` die Meldung
`Unable to preventDefault inside passive event listener invocation`
erzeugte. Der Hotfix in PR #61 ersetzt ihn durch einen nativen,
non-passiven Wheel-Listener auf dem Navigator-Root. Keine CV-Datei wurde
verändert.

## 3. Diff-/Scope-Prüfung

Der PR-#60-Diff enthielt ausschließlich die erwarteten neun Dateien:

```text
docs/AI_AUDITLOG.md
docs/reports/JM-CV-NAVIGATOR-CORE-01.md
src/components/MatchRadar.tsx
src/components/RadarNavigator.test.tsx
src/components/RadarNavigator.tsx
src/lib/navigation/cvNavigatorAdapters.test.ts
src/lib/navigation/cvNavigatorAdapters.ts
src/lib/navigation/radarNavigator.test.ts
src/lib/navigation/radarNavigator.ts
```

Der Hotfix #61 änderte ausschließlich:

```text
src/components/RadarNavigator.tsx
src/components/RadarNavigator.test.tsx
```

Es gab keine `api/**`-, RIS-, AWS-, Terraform-, Cognito-, Consent-, Storage-,
Parser-, CV-Formular-, `package.json`- oder Deployment-Konfigurationsänderung.

## 4. Kontrollprüfung des Kerns

- Targets, IDs, Titel, Status und DOM-/Adapter-Aktivierung sind
  datenquellenunabhängig.
- Messung erfolgt aus tatsächlichen DOM-Positionen; Sortierung, Clamping und
  Bereichsbezug sind vorhanden.
- Fenster- und Container-Scrollen, Offset, Reduced Motion und
  `activate → wait for render → scroll` wurden geprüft.
- `ResizeObserver`, `MutationObserver`, Window-Resize, Scroll- und
  User-Input-Listener sowie ausstehende Mess-Frames werden beim Unmount
  entfernt.
- Der Match-Radar-DOM-/CSS-Vertrag (`data-radar-marker-id`,
  `.match-radar__*`) blieb erhalten.
- Escape, Fokus-Rückkehr, native Buttons, dekorative Labels in
  `aria-hidden`, sichtbare Fokuszustände und Reduced Motion wurden erneut
  geprüft.
- **Gefundener Wheel-Fehler wurde behoben und mit
  `defaultPrevented`-Assertion abgesichert.**

Nicht blockierende Review-Notizen für die späteren CV-Adapter:

- `aria-controls` verweist bei geschlossenem Panel auf ein noch nicht
  gerendertes Ziel.
- Das mobile Panel nutzt `role="dialog"`, ohne den Fokus in den Dialog zu
  setzen; das aktuelle Disclosure-Verhalten ist für den bestehenden Radar
  akzeptabel.
- Nach reinem Tastatur-Fokus kann die dekorative Hover-Ebene sichtbar bleiben.
- Asynchrone `activate()`-Fehler und ein laufender Wait-Loop beim Unmount sind
  für den späteren CV-Adapter explizit zu behandeln.

Diese Punkte sind keine Regressionen dieses Releases und keine Blocker für die
Production-Verifikation.

## 5. Tests und Checks

| Prüfung | Ergebnis |
|---|---|
| Fokussierte Navigator-/Radar-Tests | **27 PASS** |
| Vollständige serielle Vitest-Suite | **2071 PASS / 5 skipped** (200 Dateien) |
| `npm run build` | **PASS** |
| `npm run test:e2e:match-radar-01` | **PASS** |
| `git diff --check` | **PASS** |
| Secret-Scan des Diffs | **keine Treffer** |
| PR #60 CodeQL | **PASS** |
| PR #60 Vercel Preview/Deployments | **PASS** |
| PR #61 CodeQL | **PASS** |
| PR #61 Vercel Preview/Deployments | **PASS** |

Bestehende Match-Radar-E2E: 20 Marker/Karten, echte relative Positionen,
Hover 1–5 Labels ohne Überlappung, Klick, Wheel vor/zurück, Collapse-Aktivierung,
neue Suche, Mobile 390/768, Escape/Fokus, 0 Overflow, 0 AI-/ATS-/Profil-Aufrufe.

## 6. Vercel-Deployments

### Erster Core-Release (`d524911`)

| Projekt | Deployment | Status |
|---|---|---|
| `mays-job-matcher` | `dpl_6BwL1Xgggsh2TK5Tcsbd4M7M5jBL` | Ready |
| `mays-jobsearch` | `dpl_9xfLk3ea72hFHZqs1jbRAgHPhws3` | Ready |

### Finaler Stand (`53c9926`)

| Projekt | Deployment | Status |
|---|---|---|
| `mays-job-matcher` | `dpl_23oQSXWHsLnrPfk6yT1aFhimFAzk` | Ready |
| `mays-jobsearch` | `dpl_Byn2Ts5yRwQttmASpY8cvN4tWrKH` | Ready |

Automatische Git/Vercel-Production-Deployments; kein manuelles Deployment.

## 7. Production-Smoke

Beide Domains liefern `/search` mit HTTP 200 und Build `53c9926`:

- `https://www.mays-job-matcher.app`
- `https://mays-jobsearch.vercel.app`

Synthetischer Browser-Smoke auf `https://www.mays-job-matcher.app/search`
(API-Routen im Browser gemockt, keine echten Stellen-/KI-/RIS-Daten):

| Prüfung | Ergebnis |
|---|---|
| 20 Karten / 20 Marker | PASS |
| Markerreihenfolge = Kartenreihenfolge | PASS |
| Markerposition = tatsächliche relative Kartenposition | PASS |
| Hover: 5 kollisionsfreie Labels | PASS |
| Labels `aria-hidden`, keine fokussierbaren Kinder | PASS |
| Marker sind echte Buttons mit Fokus | PASS |
| Tastatur: Fokus + Enter scrollt zum Ziel | PASS |
| Wheel vorwärts/rückwärts | PASS |
| Kein passiver `preventDefault`-Console-Fehler | PASS |
| Collapse + Radar-Aktivierung | PASS, 20 wiederhergestellt |
| Desktop-Overflow | 0 |
| Mobile 390: Panel mit 20 Einträgen | PASS |
| Mobile Escape + Fokus-Rückkehr | PASS |
| Mobile Overflow | 0 |
| API-Aufrufe | 1× `/api/jobs`, 0× match/profile/ATS, keine unerwarteten Calls |
| Console-/Page-Errors | 0 |

Screenshots:

```text
docs/reports/assets/JM-CV-NAVIGATOR-CORE-RELEASE-01/
├── production-radar-1440.png
└── production-radar-390.png
```

## 8. Grenzen

- Keine CV-Import-/Editor-Integration.
- Keine RIS-/AWS-/Terraform-/Cognito-/Consent-/Storage-/Parser-Änderung.
- Kein Force-Push, keine Branch-Löschung, kein manuelles Deployment.
- Feature- und Hotfix-Branches bleiben erhalten.
- Der Release-Bericht und Auditlog liegen auf einem separaten Docs-Branch und
  werden nicht nach `main` gemerged.
