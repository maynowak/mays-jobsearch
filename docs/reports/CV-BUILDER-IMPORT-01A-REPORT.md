# CV-BUILDER-IMPORT-01A — PDF IMPORT & STRUCTURED PREFILL

**Status:** `CV-BUILDER-IMPORT-01A — IMPLEMENTED / VERIFIED LOCAL / PRODUCTION DEPLOYED`  
**Basis:** `origin/main` `f5c4352`  
**Branch:** `feature/cv-builder-import-01a`  
**Code-Commit:** `5d91945`
**Deployment:** `dpl_AypVgHWrwMLTAVwz8zPeFixN8eEe` · Footer `078aba8` · `https://www.mays-job-matcher.app`

## 1. Implementiert

### Drei Einstiege beim neuen Lebenslauf

- **Leeren Lebenslauf erstellen** — bisheriges Verhalten unverändert.
- **PDF vom Gerät importieren** — lokale PDF, ausschließlich im Browser gelesen.
- **Gespeicherten RIS-Lebenslauf verwenden** — vorhandene signierte Download-URL
  über den bestehenden BFF; keine erneute Speicherung.

Für Gäste bleibt der lokale Import nutzbar; die RIS-Option zeigt den
Anmeldehinweis.

### Regelbasierter Parser

Neu: `src/lib/cvBuilder/pdfImport.ts`

Unterstützt deutsche und englische Überschriften für:

- Persönliche Daten
- Profil
- Berufserfahrung
- Ausbildung
- Fähigkeiten
- Projekte
- Zertifikate
- Sprachen
- Links

Der Parser erzeugt direkt einen `CvBuilderDraftV1`. Es gibt keine KI, kein OCR
und keine Backend-Erweiterung.

### Importvorschau

Neu: `src/components/CvBuilderImportDialog.tsx`

- Zusammenfassung pro erkanntem Bereich
- Übernahme-Checkbox pro Bereich
- Kennzeichnung unsicherer Bereiche
- Liste nicht erkannter Bereiche
- Separat gelistete, nicht eindeutig zuordenbare Zeilen
- Option, diese Zeilen in das Kurzprofil zu übernehmen
- Aktionen **Angaben übernehmen**, **Zurück**, **Import abbrechen**
- Lade-, Fehler- und Wiederholungszustände
- May-Hinweis als einklappbarer bestehender `MayHelp`-Kontext

### Builder-Prefill und Speicherung

- Import öffnet den bestehenden `CvBuilderEditor` mit einem neuen Entwurf.
- Bestehende Builder-Profile werden nicht überschrieben.
- Der Import erzeugt noch keinen Repository-Eintrag.
- Erst **Lebenslauf speichern** legt das neue Builder-Profil an.
- Der importierte Entwurf kann bearbeitet, gespeichert und über den bestehenden
  PDF-Export ausgegeben werden.
- Abbrechen verwirft den Import ohne Profilanlage.

### Sicherheit und Datenschutz

- PDF-Text bleibt nur im React-Speicher; kein `localStorage`.
- Keine externe Modell- oder OCR-Anfrage.
- Keine RIS-Schreiboperation beim Import.
- Keine erneute PDF-Speicherung.
- Download und Verarbeitung sind an die aktuelle Session-/Identitätsgeneration
  gebunden; ein Identitätswechsel während des Downloads führt zum Abbruch.
- Importierter Text wird ausschließlich als Daten behandelt.
- Datei-, Größen- und Typvalidierung wird wiederverwendet.

## 2. Parser-Erkennungsgrenzen

Der Parser ist bewusst konservativ:

- Erwartet erkennbare Abschnittsüberschriften; unstrukturierter Text wird als
  „nicht eindeutig zugeordnet“ angeboten.
- Einträge werden bevorzugt über Leerzeilen getrennt.
- Jahres-only-Zeiträume werden nicht auf einen Monat ergänzt; das Feld bleibt
  leer und der Bereich wird als unsicher markiert.
- Sprachen werden nur übernommen, wenn ein bekanntes Niveau erkennbar ist.
- Zertifikatsdaten werden nur übernommen, wenn ein Monat/Jahr erkennbar ist.
- Gescannte PDFs ohne Text werden mit einem verständlichen Hinweis abgelehnt.
- Keine Erfindung von Namen, Qualifikationen, Sprachlevels oder Zeiträumen.
- Unsichere und nicht zugeordnete Angaben bleiben in der Vorschau sichtbar.

## 3. Verwendete bestehende Komponenten

- `extractPdfText()` aus `src/lib/pdf.ts`
- `downloadCvFile()` aus `src/lib/cvStorageApi.ts`
- `CvBuilderDraftV1`, `createEmptyCvBuilderDraft()`
- bestehende `CvBuilderEditor`-Validierung und `pdfExport.ts`
- bestehender `MayHelp`
- bestehende Datei-/Größen-/Typvalidierung
- bestehender RIS-BFF und bestehende signierte Download-URL

## 4. Tests

| Prüfung | Ergebnis |
|---|---|
| Fokussierte Builder-/Import-/App-Tests | **128 PASS** |
| Serielle Gesamtsuite | **1708 PASS / 5 skipped** |
| Production-Build | **PASS** |
| Import-E2E lokal | **PASS** |
| Import-E2E RIS-CV (gemockt) | **PASS** |
| Breiten | 320 / 390 / 430 / 768 / 1024 / 1440 px |
| Prefill, Bearbeitung, PDF-Export | **PASS** |
| Externe Modell-/AI-Calls beim Import | **0** |
| RIS-Schreiboperationen beim Import | **0** |
| Bestehende Builder-/PDF-E2E | **PASS** |
| CV-Management-02b/02c | **PASS** |

Abgedeckt: lokaler Import, RIS-Import, persönliche Daten, Erfahrung/Ausbildung,
Skills/Projekte, fehlende und unsichere Angaben, ungültige/leere/passwortgeschützte
PDFs, PDF ohne Text, RIS-Downloadfehler, Session-Ende, Abbruch, keine
automatische Speicherung, kein Modellaufruf und Export des importierten Entwurfs.

## 5. Screenshots

`docs/reports/assets/CV-BUILDER-IMPORT-01A/`

- `source-{320,390,430,768,1024,1440}.png`
- `preview-{320,390,430,768,1024,1440}.png`
- `editor-{320,390,430,768,1024,1440}.png`
- `results.json`

## 6. Commits

- `5d91945` — PDF-Import, Parser, Vorschau und Builder-Prefill
- Dokumentations-Commit (HEAD) — Bericht und Auditlog

## 7. Verbleibende Einschränkungen

- Kein authentifizierter Live-RIS-E2E; der RIS-Import wurde mit einer
  synthetischen Session und gemockten BFF-Antworten geprüft.
- Kein OCR für gescannte PDFs.
- Keine KI-gestützte Erkennung; der Parser ist regelbasiert und konservativ.
- Production-Deployment `dpl_AypVgHWrwMLTAVwz8zPeFixN8eEe` auf `078aba8`; authentifizierter Live-RIS-Import weiterhin nicht mit echtem Testkonto geprüft.
- Keine Änderung an RIS, AWS, Terraform, Cognito oder Consent-Verträgen.

## 8. Empfehlung

**GO für Review und Merge nach `main`.**  
**NO-GO für Production-Deployment**, bis ein authentifizierter Live-Test mit
freigegebenem Testkonto und ein Deployment-Freigabeschritt erfolgt sind.
