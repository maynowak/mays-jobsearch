# JM-THIRD-PARTY-LICENSE-INVENTORY-01

**Art:** Drittsoftware-Inventur / Lizenzmetadaten / Compliance-Vorbereitung
**Datum:** 2026-11-05
**Modus:** Analyse, Dokumentation, Metadatenkorrektur, Regression
**Status:** **PARTIAL COMPLETE** — npm und DejaVu verifiziert; Assets teilweise offen

---

## 1. Git-Baseline

| Referenz | Wert |
|---|---|
| Repository | `maynowak/mays-jobsearch` |
| Arbeits-Worktree | `/home/dci-student/projects/mays-jobsearch-license-inventory` |
| Branch | `feature/jm-third-party-license-inventory-01` |
| Basis | lokaler `main` `005a372` |
| `main` unverändert | `005a372` |
| `origin/main` | `0fa799e` (bereits integriert; 98 ahead / 0 behind zum Start) |
| Fremder Checkout | `Mays-Jobsearch` (`7eb779a`) unverändert |
| Working Tree | clean |

---

## 2. Untersuchte Dateien

`LICENSE.md`, `LICENSING.md`, `LICENSE-HISTORY.md`, `COMMERCIAL-LICENSING.md`,
`PREMIUM-SERVICES.md`, `THIRD-PARTY-NOTICES.md`, `package.json`,
`package-lock.json`, `src/assets/**`, `public/**`, `docs/**` (stichprobenartig).

---

## 3. Direkte Dependencies

### Laufzeit (8)

| Paket | Version | Lizenz | Status |
|---|---|---|---|
| `@pdf-lib/fontkit` | 1.1.1 | MIT | VERIFIED (Metadaten) |
| `dompurify` | 3.4.14 | MPL-2.0 OR Apache-2.0 | VERIFIED (Apache-Option wählbar) |
| `oidc-client-ts` | 3.5.0 | Apache-2.0 | VERIFIED |
| `pdf-lib` | 1.17.1 | MIT | VERIFIED |
| `pdfjs-dist` | 6.2.108 | Apache-2.0 | VERIFIED |
| `react` | 19.2.8 | MIT | VERIFIED |
| `react-dom` | 19.2.8 | MIT | VERIFIED |
| `react-oidc-context` | 3.3.1 | MIT | VERIFIED |

### Entwicklung (14)

`@playwright/test` (Apache-2.0), `@testing-library/*` (MIT), `@types/*` (MIT),
`@vitejs/plugin-react` (MIT), `jsdom` (MIT), `sharp` (Apache-2.0),
`typescript` 5.9.3 (Apache-2.0), `vite` (MIT), `vitest` (MIT).
Alle **VERIFIED (Metadaten)**; nicht Teil des Browser-Bundles.

---

## 4. Transitive Dependencies

- Lockfile v3: **197 Paket-Einträge** (plus Root = 198).
- Fehlende Lizenzmetadaten: **0**.
- Verteilung: MIT 132, Apache-2.0 23, MPL-2.0 12, LGPL-3.0-or-later 10,
  ISC 4, Apache+LGPL 3, MIT-0 2, BSD-2 2, 0BSD 2, BSD-3 2,
  Apache+LGPL+MIT 1, (MPL OR Apache) 1, BlueOak 1, CC0 1, (MIT AND Zlib) 1.

**Auffällig, aber Dev/Build oder optional:**

- `lightningcss` + Plattform-Pakete — MPL-2.0 (`dev: true`, Vite-Build).
- `@img/sharp-libvips-*` — LGPL-3.0-or-later (`dev: true`, `optional: true`).
- `@img/sharp-wasm32` — Apache+LGPL+MIT (`dev: true`, optional).
- `dompurify` — MPL-2.0 OR Apache-2.0 (Laufzeit, Apache wählbar).

Der Laufzeitgraph enthält damit **keine Copyleft-Lizenz ohne permissive
Alternative**. Die vollständigen Texte der Transitivpakete wurden nicht einzeln
geprüft.

---

## 5. Lizenzmetadaten und Nachweisgrenzen

- Quelle: `package-lock.json` und installierte `package.json`-Metadaten.
- Metadaten sind **kein** vollständiger Lizenztext.
- Keine Online-Lizenzdatenbank, kein externer Scan, keine Rechtsberatung.
- Versionen wurden nicht verändert; es gab kein `npm install/update/audit fix`.

---

## 6. DejaVu-Prüfung

| Prüfung | Ergebnis |
|---|---|
| Dateien | 4 TTFs (`DejaVuSans`, `-Bold`, `DejaVuSerif`, `-Bold`) + Lizenzdatei |
| Einbindung | `src/lib/cvBuilder/pdfExport.ts` via `?url` |
| Lizenz | Bitstream Vera für `Files: *`; DejaVu-Änderungen gemeinfrei |
| `debian/*`-Abschnitt | GPL-2+ nur für Debian-Verpackung, **nicht** für die Fonts |
| Pflichten | Copyright-/Marken-/Erlaubnishinweis in allen Kopien; keine Umbenennung als „Bitstream/Vera“ bei Modifikation; kein Einzelverkauf der Fonts |
| Status | **VERIFIED** |

Die Fonts und die Original-Lizenzdatei wurden nicht verändert.

---

## 7. Asset-Inventur

| Asset | Einordnung | Status |
|---|---|---|
| `src/assets/images/job-matcher-next-step*.png/.webp` | eigene App-Screenshots | VERIFIED |
| `public/job-matcher-next-step*.webp` | Web-Derivate | VERIFIED |
| `src/assets/images/Futuristische_Stadt_*.png` | dekorativ, Herkunft unbekannt | REVIEW REQUIRED |
| `src/assets/images/Futuristische_Lobby_*.png` | dekorativ, Herkunft unbekannt | REVIEW REQUIRED |
| `public/futuristische-lobby-*.webp` | Web-Derivat | REVIEW REQUIRED |
| `public/images/auth-neural-gateway.png` | Auth-Motiv, Herkunft unbekannt | REVIEW REQUIRED |
| `public/datenschutzvielfalt.svg` | Datenschutz-Illustration, Herkunft unbekannt | REVIEW REQUIRED |
| `docs/reports/assets/**` | generierte E2E-Screenshots | VERIFIED |
| `docs/screenshotsfordev/…May's Job Matcher.png` | eigener App-Screenshot | VERIFIED |
| `docs/screenshotsfordev/Animierter KI-Jobstream….png` | Herkunft unbekannt | REVIEW REQUIRED |

Keine Assets wurden entfernt oder umbenannt; fehlende Nachweise wurden nicht
erfunden.

---

## 8. Änderungen an `THIRD-PARTY-NOTICES.md`

Die Datei wurde von 19 auf 214 Zeilen erweitert und gegliedert in:

1. Zweck/Geltungsbereich
2. Eigene Software vs. Fremdkomponenten
3. Laufzeitbibliotheken (8)
4. Entwicklungswerkzeuge (14)
5. Transitive Abhängigkeiten (197, Verteilung, Auffälligkeiten, Reproduktion)
6. DejaVu-Fonts
7. Assets
8. Externe Dienste
9. Original-Lizenzdateien
10. Offene Nachweise
11. Statuslegende/Grenzen

Die AGPL-Aussagen und die bestehende Struktur der übrigen Lizenzdokumente
bleiben unverändert.

---

## 9. `package.json`-Lizenzfeld

- Vorher: kein `license`-Feld.
- Nachher: `"license": "AGPL-3.0-only"`.
- Begründung: `LICENSE.md` (SPDX `AGPL-3.0-only`, Copyright Maymilly Nowak),
  `LICENSING.md`, `LICENSE-HISTORY.md` und `COMMERCIAL-LICENSING.md` weisen die
  bestehende Projektlizenz einheitlich aus; das Root-Package ist `private`.
- Keine Felder entfernt, keine Version/Dependencies/Scripts geändert.
- Fremdsoftware wird dadurch **nicht** mitlizenziert.

---

## 10. Lockfile-Konsistenz

- `package-lock.json` → `packages[""]` enthält nun ebenfalls
  `"license": "AGPL-3.0-only"`.
- Keine Dependency-Reauflösung, keine Versionsänderung, keine Neuformatierung.
- Diff: genau **1 Zeile** in `package.json`, **1 Zeile** in `package-lock.json`.
- JSON-Validierung: PASS.
- Dependency-Keys und Versionsangaben: identisch zu `main`.

---

## 11. AGPL-Integrität

| Prüfung | Ergebnis |
|---|---|
| `LICENSE.md` gegenüber `main` | unverändert |
| SPDX | `AGPL-3.0-only` |
| Copyright | `Copyright (C) 2026 Maymilly Nowak` |
| Nachträgliche Einschränkung | keine |
| Kommerzielle Nutzung unter AGPL | bleibt erlaubt |
| Premium-Angebote | optional, keine Lizenzpflicht |
| Fremdsoftware | behält eigene Lizenzen, nicht als Projekteigentum dargestellt |

---

## 12. Offene Lizenzrisiken

1. Herkunft/Lizenz von sechs dekorativen Assets ungeklärt.
2. Vollständige Transitiv-Lizenztexte nicht einzeln geprüft (nur Metadaten).
3. Apache-2.0-Wahl für `dompurify` sollte bei Distribution dokumentiert werden.
4. MPL/LGPL nur im Dev-/Build-Bereich; bei einer Veröffentlichung von
   Build-Artefakten gesondert prüfen.
5. Rechtliche Gesamtprüfung steht aus.

---

## 13. Regression

| Prüfung | Ergebnis |
|---|---|
| `npm test -- --run --maxWorkers=2` | **1414 passed / 5 skipped** (137 Dateien passed, 3 skipped) |
| `npm run build` | **PASS** |
| `git diff --check` | **PASS** |
| JSON-Validierung `package.json`/`package-lock.json` | **PASS** |
| Dependency-Keys/-Versionen unverändert | **PASS** |
| Änderungspfade | nur `THIRD-PARTY-NOTICES.md`, `package.json`, `package-lock.json` |
| `api/**`, `src/**`, `tests/**`, `scripts/**` | **nicht geändert** |

Der bekannte `ApplicationsSection`-Timeout trat nicht auf; keine Tests
deaktiviert, keine Timeouts erhöht.

---

## 14. Commit-Nachweise

| Commit | Inhalt |
|---|---|
| `484129c` | `chore: declare AGPL license in package metadata` |
| `bb52a3b` | `docs: complete third-party license inventory` |
| `422e906` | `docs: record third-party license inventory` |

Branch: `feature/jm-third-party-license-inventory-01` (Basis `005a372`).
**Kein Push, kein Merge, kein Deployment.**

---

## 15. Empfehlungen vor Veröffentlichung

1. Herkunft der REVIEW-REQUIRED-Assets klären oder durch eigene/genehmigte
   Assets ersetzen.
2. Apache-2.0-Option für `dompurify` dokumentieren.
3. Vollständige Lizenztexte der Transitivpakete bei einer Distribution
   stichprobenartig bzw. automatisiert prüfen.
4. Rechtliche Prüfung der kombinierten Pflichten (AGPL, Apache-2.0,
   Bitstream Vera, MPL/LGPL im Dev-Tooling).
5. `THIRD-PARTY-NOTICES.md` bei Dependency-Änderungen aktualisieren.

---

## 16. Abschlussentscheidung

| Kriterium | Status |
|---|---|
| THIRD-PARTY INVENTORY | **PARTIAL** (npm + DejaVu vollständig; Assets teilweise offen) |
| DEJAVU LICENSE | **VERIFIED** |
| NPM LICENSE METADATA | **VERIFIED** |
| AGPL CORE | **UNCHANGED** |
| DEPENDENCY LICENSE REVIEW | **PARTIAL** (Metadaten verifiziert, Volltexte offen) |
| LEGAL REVIEW | **PENDING** |
| LOCAL MAIN INTEGRATION | **NOT EXECUTED** |
| GITHUB PUSH | **NOT AUTHORIZED** |
| PRODUCTION DEPLOYMENT | **NOT AUTHORIZED** |

**HARD STOP.** Keine Lizenzänderung, keine Neulizenzierung von Drittsoftware,
keine Font-/Dependency-Änderung, keine Produktentwicklung, keine Redis-/AWS-/
Terraform-/RIS-/Cognito-/CloudFront-Änderung, kein Merge, kein Push, kein
Deployment.
