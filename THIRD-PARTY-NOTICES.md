# Fremdsoftware, Abhängigkeiten und Schnittstellen – Mays Jobsearch / May’s Job Matcher

**Stand: 05.11.2026 · Überprüfbare Inventur, kein vollständiges rechtliches SBOM**

## 1. Zweck und Geltungsbereich

Dieses Dokument beschreibt die im Repository nachgewiesenen Fremdkomponenten und
ihre Lizenzangaben. Es ändert **keine** Lizenzbedingungen und begründet keine
zusätzlichen Rechte oder Pflichten.

Nachweisbasis:

- `package.json` und `package-lock.json` (Lockfile v3, 197 Paket-Einträge)
- installierte Paketmetadaten (`node_modules/*/package.json`)
- vendorte Dateien und ihre Original-Lizenztexte
- Repository-Assets, soweit eine Herkunft nachweisbar ist

Grenze: Paketmetadaten sind **kein** vollständiger Lizenztext und ersetzen keine
rechtliche Prüfung. Wo nur Metadaten vorliegen, ist das ausdrücklich vermerkt.

## 2. Eigene Software und Fremdkomponenten

- **Eigene Software:** `AGPL-3.0-only`, Copyright (C) 2026 Maymilly Nowak
  (`LICENSE.md`, `LICENSING.md`, `LICENSE-HISTORY.md`).
- **Fremdsoftware** behält ihre jeweiligen Lizenzen. Die Verwendung im Projekt
  lizenziert Fremdsoftware **nicht** unter der Projekt-AGPL und macht sie nicht
  zu ausschließlichem Eigentum des Projekts.
- **Externe Dienste** (Abschnitt 8) sind keine Bestandteile des Repository-Codes.

## 3. Direkt eingebundene Laufzeitbibliotheken

Quelle: `package.json` (`dependencies`) und aufgelöste Versionen aus dem
Lockfile. Status bezieht sich auf die Lizenzangabe, nicht auf eine vollständige
Textprüfung.

| Paket | Version | Lizenz | Status |
|---|---|---|---|
| `@pdf-lib/fontkit` | 1.1.1 | MIT | VERIFIED (Metadaten) |
| `dompurify` | 3.4.14 | MPL-2.0 OR Apache-2.0 | VERIFIED (Metadaten; Apache-Option wählbar) |
| `oidc-client-ts` | 3.5.0 | Apache-2.0 | VERIFIED (Metadaten) |
| `pdf-lib` | 1.17.1 | MIT | VERIFIED (Metadaten) |
| `pdfjs-dist` | 6.2.108 | Apache-2.0 | VERIFIED (Metadaten) |
| `react` | 19.2.8 | MIT | VERIFIED (Metadaten) |
| `react-dom` | 19.2.8 | MIT | VERIFIED (Metadaten) |
| `react-oidc-context` | 3.3.1 | MIT | VERIFIED (Metadaten) |

`dompurify` ist dual lizenziert. Bei Wahl der Apache-2.0-Option entstehen keine
MPL-2.0-Pflichten; die Wahl sollte bei einer Distribution dokumentiert werden.

## 4. Direkte Entwicklungswerkzeuge

Quelle: `package.json` (`devDependencies`). Diese Pakete werden für Build, Tests
und lokale Entwicklung verwendet und sind **nicht** Teil des ausgelieferten
Browser-Bundles.

| Paket | Version | Lizenz | Status |
|---|---|---|---|
| `@playwright/test` | 1.63.0 | Apache-2.0 | VERIFIED (Metadaten) |
| `@testing-library/dom` | 10.4.1 | MIT | VERIFIED (Metadaten) |
| `@testing-library/jest-dom` | 7.0.1 | MIT | VERIFIED (Metadaten) |
| `@testing-library/react` | 16.3.2 | MIT | VERIFIED (Metadaten) |
| `@types/dompurify` | 3.0.5 | MIT | VERIFIED (Metadaten) |
| `@types/node` | 26.2.0 | MIT | VERIFIED (Metadaten) |
| `@types/react` | 19.2.18 | MIT | VERIFIED (Metadaten) |
| `@types/react-dom` | 19.2.4 | MIT | VERIFIED (Metadaten) |
| `@vitejs/plugin-react` | 6.0.5 | MIT | VERIFIED (Metadaten) |
| `jsdom` | 30.0.1 | MIT | VERIFIED (Metadaten) |
| `sharp` | 0.35.4 | Apache-2.0 | VERIFIED (Metadaten) |
| `typescript` | 5.9.3 | Apache-2.0 | VERIFIED (Metadaten) |
| `vite` | 8.2.1 | MIT | VERIFIED (Metadaten) |
| `vitest` | 4.1.10 | MIT | VERIFIED (Metadaten) |

## 5. Transitive Abhängigkeiten

Das Lockfile enthält **197 Paket-Einträge** (inklusive optionaler
plattformspezifischer Binaries). Verteilung der Lizenzangaben:

| Lizenz | Anzahl |
|---|---|
| MIT | 132 |
| Apache-2.0 | 23 |
| MPL-2.0 | 12 |
| LGPL-3.0-or-later | 10 |
| ISC | 4 |
| Apache-2.0 AND LGPL-3.0-or-later | 3 |
| MIT-0 | 2 |
| BSD-2-Clause | 2 |
| 0BSD | 2 |
| BSD-3-Clause | 2 |
| Apache-2.0 AND LGPL-3.0-or-later AND MIT | 1 |
| (MPL-2.0 OR Apache-2.0) | 1 |
| BlueOak-1.0.0 | 1 |
| CC0-1.0 | 1 |
| (MIT AND Zlib) | 1 |

**Fehlende Lizenzmetadaten:** 0.

**Auffällige Lizenzen – ausschließlich Entwicklung/Build oder optionale
Plattform-Binaries:**

- `lightningcss` und Plattform-Pakete — MPL-2.0 (Build-Tooling von Vite,
  `dev: true`, nicht im Browser-Bundle).
- `@img/sharp-libvips-*` — LGPL-3.0-or-later (optionale Binaries von `sharp`,
  `dev: true`/`optional: true`).
- `@img/sharp-wasm32` — Apache-2.0 AND LGPL-3.0-or-later AND MIT (optional,
  `dev: true`; nicht ausgeliefert).
- `dompurify` — MPL-2.0 OR Apache-2.0 (Laufzeit, Apache-Option wählbar).

Damit enthält der **Laufzeitgraph keine Copyleft-Lizenz ohne permissive
Alternative**. Die vollständigen Lizenztexte der Transitivpakete wurden nicht
einzeln geprüft; das bleibt REVIEW REQUIRED.

Reproduktion (read-only):

```bash
# Laufzeitgraph (ohne Dev-Abhängigkeiten)
npm ls --omit=dev --all --json

# Lizenzverteilung aus dem Lockfile
node -e "const l=require('./package-lock.json');const c={};for(const[k,v]of Object.entries(l.packages)){if(!k)continue;const x=v.license||'(none)';c[x]=(c[x]||0)+1;}console.log(c)"
```

## 6. Vendorte Schriftarten – DejaVu

| Datei | Verwendung |
|---|---|
| `src/assets/fonts/DejaVuSans.ttf` | PDF-Export (regulär) |
| `src/assets/fonts/DejaVuSans-Bold.ttf` | PDF-Export (fett) |
| `src/assets/fonts/DejaVuSerif.ttf` | PDF-Export (Serif) |
| `src/assets/fonts/DejaVuSerif-Bold.ttf` | PDF-Export (Serif fett) |
| `src/assets/fonts/DejaVu.LICENSE.txt` | Original-Lizenztext |

Einbindung: `src/lib/cvBuilder/pdfExport.ts` importiert die vier TTFs über
`?url`; die Dateien werden unverändert ausgeliefert.

**Lizenz:** Bitstream Vera License für `Files: *` (Copyright (c) 2003 Bitstream,
Inc.; DejaVu-Änderungen gemeinfrei). Der `debian/*`-Abschnitt der Lizenzdatei
betrifft nur Debian-Verpackungsdateien (GPL-2+) und **nicht** die Schriftarten.

**Bedingungen:** Copyright-, Marken- und Erlaubnishinweis müssen in allen
Kopien enthalten bleiben; modifizierte Fonts dürfen die Namen „Bitstream“ oder
„Vera“ nicht führen; die Fonts dürfen nicht allein, nur als Teil eines größeren
Pakets verkauft werden.

**Status: VERIFIED.** Lizenzdatei vorhanden, Fonts unverändert, Hinweis wird
mitgeliefert.

## 7. Bilder und sonstige Assets

| Asset | Einordnung | Status |
|---|---|---|
| `src/assets/images/job-matcher-next-step*.png/.webp` | Projekt-Screenshots der eigenen Anwendung | VERIFIED (eigenes Projekt-Asset; keine separate Copyright-Angabe) |
| `public/job-matcher-next-step*.webp` | gleiche Motive, Web-Derivate | VERIFIED (wie oben) |
| `src/assets/images/Futuristische_Stadt_im_blauen_Abendlicht*.png` | dekoratives Stadtmotiv | REVIEW REQUIRED (Herkunft/Lizenz nicht dokumentiert) |
| `src/assets/images/Futuristische_Lobby_mit_holografischen_Displays.png` | dekoratives Lobby-Motiv | REVIEW REQUIRED (Herkunft/Lizenz nicht dokumentiert) |
| `public/futuristische-lobby-mit-holografischen-displays.webp` | Web-Derivat | REVIEW REQUIRED (wie oben) |
| `public/images/auth-neural-gateway.png` | Auth-/Login-Motiv | REVIEW REQUIRED (Herkunft/Lizenz nicht dokumentiert) |
| `public/datenschutzvielfalt.svg` | Datenschutz-Illustration | REVIEW REQUIRED (Herkunft/Lizenz nicht dokumentiert) |
| `docs/reports/assets/**` | generierte E2E-/Dokumentationsscreenshots | VERIFIED (Projekt-Evidenz) |
| `docs/screenshotsfordev/Screenshot … May's Job Matcher.png` | Screenshot der eigenen Anwendung | VERIFIED (eigenes Projekt-Asset) |
| `docs/screenshotsfordev/Animierter KI-Jobstream im Neon-Design.png` | dekoratives Motiv | REVIEW REQUIRED (Herkunft/Lizenz nicht dokumentiert) |

Für die als REVIEW REQUIRED markierten Assets liegt im Repository **kein**
Lizenz- oder Herkunftsnachweis vor. Sie werden weder als Projekt-AGPL
deklariert noch entfernt; die Klärung bleibt offen.

## 8. Externe Dienste und API-Abgrenzung

Das Projekt nutzt zur Laufzeit optionale externe Dienste, deren Code und
Infrastruktur **nicht** Bestandteil dieses Repositorys sind:

- OpenRouter und optional EdenAI (KI-Modelle)
- Apify (Arbeitsagentur-Job-Feed)
- Upstash Redis (Caches, Quotas, Alerts)
- Resend (E-Mail-Versand)
- Nominatim/OpenPLZ (Geocoding/Autocomplete)
- AWS/Cognito und RIS (Authentifizierung/Profilverwaltung, separat betrieben)

Für diese Dienste gelten die jeweiligen Anbieterbedingungen. Die Nutzung
bedeutet nicht, dass ihre Implementierung, Marken, Infrastruktur oder
Zugangsdaten mitlizenziert werden. Es werden keine Secrets im Repository
gespeichert.

## 9. Original-Lizenzdateien

- `LICENSE.md` — vollständiger AGPL-3.0-only-Text, Copyright (C) 2026 Maymilly Nowak.
- `src/assets/fonts/DejaVu.LICENSE.txt` — Original-Lizenz-/Copyright-Datei der DejaVu-Fonts.
- Installierte Pakete enthalten ihre Lizenzdateien unter `node_modules/<paket>/LICENSE*`;
  diese sind nicht eingecheckt und werden über `package-lock.json` reproduziert.

## 10. Offene Lizenznachweise

1. Herkunft und Lizenz der dekorativen Bilder (`Futuristische_*`,
   `auth-neural-gateway.png`, `datenschutzvielfalt.svg`) sind nicht dokumentiert.
2. Die vollständigen Lizenztexte aller 197 Transitivpakete wurden nicht einzeln
   geprüft; die Angaben stammen aus Paketmetadaten.
3. Die Apache-2.0-Option für `dompurify` sollte bei einer Distribution
   ausdrücklich gewählt und dokumentiert werden.
4. Eine rechtliche Prüfung der kombinierten Pflichten (AGPL, Apache-2.0,
   Bitstream Vera, MPL/LGPL im Dev-Tooling) steht aus.

## 11. Statuslegende und Grenzen

- **VERIFIED** — Lizenz und Zuordnung durch konkrete Nachweise bestätigt.
- **REVIEW REQUIRED** — Lizenzinformation vorhanden, zusätzliche Bewertung nötig.
- **UNKNOWN** — keine ausreichend verlässliche Quelle verfügbar.

Diese Inventur ist **kein vollständiges SBOM** und **keine Rechtsberatung**.
Sie behauptet nicht, dass sämtliche transitiven Lizenzpflichten bereits erfüllt
sind.

Zur Übersicht: [LICENSING.md](./LICENSING.md) · [Lizenz](./LICENSE.md) ·
[Kommerzielle Lizenzierung](./COMMERCIAL-LICENSING.md) ·
[Premium-Services](./PREMIUM-SERVICES.md) · [Lizenzhistorie](./LICENSE-HISTORY.md).
