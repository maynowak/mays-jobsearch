# JM-CV-BUILDER-01C

**Art:** Lebenslauf-Werkstatt / professioneller PDF-Export / Qualitätsprüfung
**Status:** ABGESCHLOSSEN UND LOKAL VERIFIZIERT — kein Push, Merge oder Deployment
**Datum:** 2026-11-03
**Branch:** `feature/jm-cv-builder-01c`
**Baseline:** 01B `16e7080`; 01A `2ae42e4`; lokaler `main` `e098fbd`; `origin/main` `4364eab`

## 1. Ziel

Der vorhandene strukturierte CV-Builder aus 01A/01B erhielt einen echten,
lokalen PDF-Export. Der Export erzeugt eine PDF-Datei mit auswählbarem Text und
unterstützt die drei vorhandenen Vorlagen `classic`, `modern` und `compact`.

Nicht Teil dieses Schritts:

- keine KI-Optimierung,
- keine Persistenz,
- keine ATS-Kopplung,
- keine RIS-/AWS-/Backend-Integration,
- keine Änderung der vorhandenen CV-/ATS-/Suchfunktionen.

## 2. Bibliotheksentscheidung

PDF.js bleibt ausschließlich für die vorhandene PDF-Textextraktion zuständig.
Es ist keine PDF-Erzeugungsbibliothek und wurde nicht für den Export verwendet.

Gewählt:

- `pdf-lib@1.17.1` (MIT) für die PDF-Erzeugung,
- `@pdf-lib/fontkit@1.1.1` (MIT) für eingebettete TrueType-Schriften,
- DejaVu Sans/Serif (Bitstream-Vera-Lizenz, permissiv und AGPL-3.0-kompatibel)
  als lokale Font-Assets.

Begründung:

- echte PDF-Ausgabe mit auswählbarem Text,
- kontrollierte A4-Seitenumbrüche und wiederholbare Seitenzahlen,
- Unicode-/Umlaut-Unterstützung durch eingebettete Schriften,
- keine Server- oder Provider-Abhängigkeit,
- schlanker als eine vollständige Dokument-Renderer-Suite,
- MIT-Lizenz der Bibliotheken und permissive Font-Lizenz.

Der Export wird per dynamischem Import geladen. Dadurch bleibt der normale
CV-Editor-Start unbelastet; der PDF-Chunk wird erst beim Klick auf
„Als PDF herunterladen“ geladen.

## 3. Architektur und Datenfluss

```text
CvBuilderDraftV1 (unveränderte fachliche Quelle)
        |
        +--> Validierung (bestehende Domain-Validierung)
        |
        +--> createCvBuilderPdf(draft, template, language)
                 |
                 +--> A4-Layout / Seitenumbruch / Vorlagenstil
                 +--> eingebettete DejaVu-Schriften
                 +--> Uint8Array
        |
        +--> downloadCvBuilderPdf(bytes, safeFileName)
                 |
                 +--> lokaler Blob + Browser-Download
```

- Der Draft wird nicht mutiert.
- Die Vorlagenauswahl bleibt lokaler UI-State.
- Es werden keine neuen IDs, Dateien, Hashes oder Backend-Objekte erzeugt.
- Es gibt keine neue Sitzung und keinen Auth-Zwang.
- Der Export läuft vollständig im Browser.

## 4. Dokumentformat und Seitenumbruch

- DIN A4: `595.28 × 841.89 pt` (`210 × 297 mm`).
- Feste, vorlagenabhängige Seitenränder:
  - Klassisch: 56 pt,
  - Modern: 48 pt,
  - Kompakt: 38 pt.
- Text wird anhand der tatsächlichen Font-Metrik umbrochen.
- Lange Wörter/URLs werden kontrolliert aufgeteilt.
- Abschnittsüberschriften werden nicht allein am Seitenende abgelegt.
- Eintragsüberschrift, Arbeitgeber und Zeitraum werden mit mindestens zwei
  Beschreibungszeilen zusammen gehalten; lange Stationen dürfen kontrolliert
  über Seiten laufen.
- Keine erzwungene Ein-Seiten-Begrenzung.
- Seitenzahlen im Format `1 / 4`.

## 5. Vorlagen

Alle drei Vorlagen exportieren dieselbe validierte Datenbasis und dieselben
fachlichen Abschnitte.

### Klassisch

- einspaltig,
- DejaVu Serif,
- schwarz-/graue Hierarchie,
- Abschnittslinien,
- zurückhaltende, druckbare Darstellung.

### Modern

- DejaVu Sans,
- dezenter Teal-Akzent,
- Akzentbalken an Abschnittsüberschriften,
- klare Hierarchie,
- auch in Graustufen lesbar.

### Kompakt

- DejaVu Sans mit kleineren Größen und engeren Abständen,
- vollständige Inhalte,
- geeignet für umfangreiche Berufserfahrung.

Ein Vorlagenwechsel verändert keine Inhalte, IDs, Reihenfolge oder
Validierungsergebnisse.

## 6. Export-UI und Validierung

In der Fußleiste der Lebenslauf-Werkstatt steht für Gast und angemeldete
Benutzer:

**„Als PDF herunterladen“** / **“Download as PDF”**

Ablauf:

1. aktueller Draft wird mit der vorhandenen Domain-Validierung geprüft,
2. bei Fehlern oder leerem Draft bleibt der Export deaktiviert,
3. PDF wird lokal erzeugt,
4. Browser bietet die Datei zum Download an,
5. der Editor bleibt geöffnet und unverändert.

Dateiname:

- Standard: `Lebenslauf.pdf`
- mit geeignetem Namen: sicher bereinigter Name, z. B.
  `Lebenslauf-Zoe-Beispiel-Curic.pdf`
- Dateisystem-/Pfadzeichen und Punkte werden entfernt bzw. ersetzt,
- keine Übernahme von Dateinamen aus externen Stellenanzeigen.

Statusmeldungen:

- „PDF wird erstellt…“
- „PDF wurde erstellt.“
- „Das PDF konnte nicht erstellt werden.“

## 7. ATS- und Textqualität

Der Export enthält:

- echten, auswählbaren Text (kein Bild-Scan),
- keine Tabellen-/Spaltenfallen,
- eine logische Textreihenfolge von Name/Kontakt zu Abschnitten und Einträgen,
- eingebettete Schriften für Umlaute und erweiterte Unicode-Zeichen,
- keine absichtlich versteckten oder abgeschnittenen Inhalte.

Verifiziert mit `pdfinfo` und `pdftotext` an den tatsächlich heruntergeladenen
PDFs, nicht nur anhand von CSS-Annahmen.

## 8. Datenschutz, Session und Auth

Unverändert:

- Draft ausschließlich in App-Memory,
- keine localStorage-/sessionStorage-/IndexedDB-Speicherung des CV,
- Gast- und Auth-Modus ohne neuen Login-Zwang,
- Auth-Isolation und Session-Invalidierung bleiben bestehen,
- Reload verwirft den Entwurf,
- keine Backend-, KI-, Provider-, RIS-, AWS- oder Apify-Anfrage beim Export,
- keine CV-Datenübertragung an einen Server.

Der Export erzeugt einen lokalen Blob und einen Browser-Download. Die
PDF-Erzeugung lädt ausschließlich lokale Font-Assets und den lokalen
PDF-Chunk.

## 9. Tests und Nachweise

| Prüfung | Ergebnis |
|---|---|
| Gesamtsuite `npm test -- --run --maxWorkers=2` | **1300 passed, 5 skipped** |
| PDF-Domain/Editor gezielt | **18 passed** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| API-Syntax (`node --check`) | PASS |
| CV-Builder-E2E Gast + Auth (bestehend) | PASS |
| PDF-E2E Gast: Klassisch/Modern/Kompakt | PASS |
| PDF-E2E mobile 390 px, Button ≥ 44 px | PASS |
| PDF-E2E englische UI | PASS |
| PDF-E2E authentifizierter Export | PASS |
| PDF-E2E Console-Errors | keine |
| PDF-E2E unerwartete API-Aufrufe | keine (nur bestehendes `/api/models`) |
| Echte KI-/Provider-/AWS-/RIS-/Apify-Aufrufe | keine |

PDF-E2E-Ergebnisse:

| Variante | Seiten | Datei |
|---|---:|---|
| Klassisch | 4 | `Lebenslauf-Zoe-Beispiel-Curic.pdf` |
| Modern | 4 | `Lebenslauf-Zoe-Beispiel-Curic.pdf` |
| Kompakt | 3 | `Lebenslauf-Zoe-Beispiel-Curic.pdf` |
| Mobil/Kompakt | 3 | `Lebenslauf-Zoe-Beispiel-Curic.pdf` |
| Englisch/Modern | 4 | `Lebenslauf-Zoe-Beispiel-Curic.pdf` |
| Authentifiziert/Klassisch | 1 | `Lebenslauf-Auth-Nutzer.pdf` |

Zusätzlich geprüft:

- Ein-Seiten-, Zwei-Seiten- und Drei-Seiten-Fälle über die PDF-API,
- Seitenzahlen und A4-Seitenformat,
- Umlaute/Unicode in Name und Abschnitten,
- Vorlagenwechsel ohne Draft-Mutation,
- keine leeren Pflichtabschnitte,
- ungültige/leere Drafts werden abgelehnt,
- sichere Dateinamen.

## 10. Evidenz

Unter `docs/reports/assets/JM-CV-BUILDER-01C/`:

- `JM-CV-BUILDER-01C-classic.pdf`
- `JM-CV-BUILDER-01C-modern.pdf`
- `JM-CV-BUILDER-01C-compact.pdf`
- `JM-CV-BUILDER-01C-mobile.pdf`
- `JM-CV-BUILDER-01C-en.pdf`
- `JM-CV-BUILDER-01C-authenticated.pdf`
- `classic-page-1.png`, `classic-page-4.png`
- `modern-page-1.png`, `modern-page-4.png`
- `compact-page-1.png`, `compact-page-3.png`
- `authenticated-page-1.png`
- `desktop-1440-export-ready.png`
- `mobile-390-export-ready.png`

Die PDFs enthalten synthetische Daten; es wurden keine echten Bewerberdaten
oder externen Stellenanzeigen verwendet.

## 11. Offene Punkte

- Keine klickbaren Link-Annotationen im PDF; URLs werden als Text ausgegeben.
- Keine PDF/A-Zertifizierung, Signatur oder Barrierefreiheitszertifizierung.
- Keine dauerhafte Designpräferenz; die Vorlagenauswahl bleibt Session-State.
- DejaVu deckt viele Latin-/Greek-/Cyrillic-Zeichen ab, aber keine vollständige
  CJK-/Emoji-Abdeckung.
- Keine KI-Optimierung, ATS-Auswertung, RIS-Persistenz oder Server-Speicherung.
- **PRODUCTION: weiterhin BLOCKED.**

## 12. Git

- Implementierung: `ef24e3a` — `feat: add local CV PDF export with A4 templates`
- Dokumentation/Evidenz: dieser Commit
- Branch: `feature/jm-cv-builder-01c`
- Kein Push, Merge, Rebase, Stash, Reset oder Deployment

## 13. Abschlussentscheidung

**CV-BUILDER-01C: READY für die nächste lokale CV-Builder-Phase.**

Der Export erzeugt echte, mehrseitige A4-PDFs mit auswählbarem Text,
eingebetteten Unicode-Schriften, drei konsistenten Vorlagen, sicheren
Seitenumbrüchen und lokalem Browser-Download. Gast- und Auth-Modus sind
verifiziert; es gibt keine neue Backend-, KI- oder Persistenzabhängigkeit.

**HARD STOP nach 01C. Kein Push, kein Merge, kein Deployment.**
