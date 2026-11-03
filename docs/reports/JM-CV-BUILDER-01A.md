# JM-CV-BUILDER-01A

**Art:** Strukturierter Lebenslauf-Editor / Domain Foundation / Session-State / UI
**Status:** ABGESCHLOSSEN UND LOKAL VERIFIZIERT — kein Push, Merge oder Deployment
**Datum:** 2026-11-03
**Branch:** `feature/jm-cv-builder-01a`
**Baseline:** lokaler `main` `e098fbd`; `origin/main` `4364eab`

## 1. Ziel und Grenzen

Implementiert wurde die erste Phase eines strukturierten Lebenslauf-Editors für
Gäste und angemeldete Benutzer.

Nicht implementiert:

- PDF-Erzeugung,
- Layoutvorlagen,
- KI-Optimierung,
- ATS-Analyse des Builder-Entwurfs,
- dauerhafte Backend-/RIS-Persistenz,
- Premium-/Registrierungsbeschränkungen,
- Import aus vorhandenen CV-Dateien.

Der bestehende `CvDocument`-Typ bleibt unverändert. Der Builder erzeugt keine
künstliche PDF-Datei, keinen CV-Hash und keinen `processedAt`-Status.

## 2. Bestehende CV-Architektur

Geprüft wurden insbesondere:

- `src/types.ts` — `CvDocument`, `CvProcessingState`, `Profile`,
- `src/App.tsx` — Auth-/Session-Reset und CV-Navigation,
- `src/components/DashboardV2.tsx`,
- `src/components/DashboardV2CvSection.tsx`,
- `src/components/CvDocumentList.tsx`,
- `src/components/CvUpload.tsx`,
- `src/lib/cvProfileStore.ts`,
- `src/lib/pdf.ts`,
- `src/lib/profiles/`,
- `docs/contracts/JOBMATCHER-PROFILE-DATA-CONTRACT-V1.md`.

Wichtige Abgrenzung:

- `CvDocument` beschreibt eine hochgeladene/verarbeitete Datei.
- `CvBuilderDraftV1` beschreibt editierbare strukturierte Lebenslaufdaten.
- Es gibt keine automatische Übernahme in ATS-Profile, CV-Hash-Buckets oder
  Suchprofile.

## 3. Domain-Modell

Neu unter `src/lib/cvBuilder/`:

```text
CvBuilderDraftV1
├── personal: fullName?, email?, phone?, location?
├── profile: headline?, summary?
├── experience[]
├── education[]
├── skills[]
├── projects[]
├── certificates[]
├── languages[]
└── links[]
```

Eigenschaften:

- `schemaVersion: 1`
- stabile IDs für wiederholbare Einträge
- Monats-/Jahresangaben (`YYYY-MM`)
- laufende Beschäftigung/Ausbildung ohne Enddatum
- keine `File`-, Hash-, RIS- oder React-Abhängigkeit
- keine Pflichtangaben für Geburtsdatum, Geschlecht, Familienstand,
  Nationalität oder Foto

Neue Einträge werden über Domain-Factories erzeugt. Die Daten bleiben
serialisierbar, aber in 01A ausschließlich im React-Session-State.

## 4. Validierung

Eigenständige Domain-Schicht in `src/lib/cvBuilder/validation.ts`.

Geprüft werden:

- Pflichtfelder nur innerhalb tatsächlich befüllter Einträge,
- maximale Textlängen,
- gültige `YYYY-MM`-Monate,
- Enddatum nicht vor Startdatum,
- laufende Einträge ohne Enddatum,
- E-Mail-Format,
- nur `http(s)`-Links,
- doppelte Fähigkeiten case-insensitiv,
- Eintragslimits.

Leere, neu angelegte Einträge werden als „noch leer“ erkannt, aber nicht
automatisch gelöscht oder mit Pflichtfehlern überschwemmt. Sobald ein Eintrag
teilweise befüllt ist, werden seine erforderlichen Felder validiert.

## 5. Editor

Neue Komponente `src/components/CvBuilderEditor.tsx`.

Bereiche:

1. Persönliche Angaben
2. Berufliches Kurzprofil
3. Berufserfahrung
4. Ausbildung
5. Fähigkeiten
6. Projekte
7. Zertifikate
8. Sprachen und Links

Funktionen:

- aufklappbare Abschnitte und Abschnittsnavigation,
- Einträge hinzufügen, bearbeiten, nach oben/unten verschieben, entfernen,
- Entfernen mit Bestätigung,
- Fokus auf Bestätigung und nach Entfernen zurück zur Add-Aktion,
- dynamische Fähigkeiten mit Deduplizierung und Erhalt mehrwortiger Begriffe,
- sichere Textfelder ohne HTML-Injektion,
- URL-Validierung ohne ausführbare Links,
- Live-Validierung und verständliche Feldfehler,
- Session-only-Hinweis und PDF-Phasen-Hinweis.

## 6. Session und Navigation

Der Entwurf lebt in `App.tsx` als In-Memory-State:

- kein localStorage,
- kein sessionStorage,
- kein IndexedDB,
- kein Backend,
- kein Upload,
- keine KI-Anfrage.

Der Editor ist erreichbar:

- im Gast-/Suchbereich über den CV-Bereich (`Lebenslauf erstellen`),
- im angemeldeten Profil über den Lebenslauf-Tab.

Der Entwurf bleibt beim normalen Schließen/Öffnen und Ansichtswechsel erhalten.
Ein Reload verwirft ihn; ein `beforeunload`-Hinweis schützt vor versehentlichem
Verlassen.

Bei Änderung der Auth-Identität (`iss + sub`) werden über den bestehenden
Session-Reset:

- der CV-Builder-Entwurf geleert,
- der Editor geschlossen,
- keine Daten in den nächsten Benutzerkontext übernommen.

## 7. Responsive und Accessibility

Geprüft in echten Browserläufen:

| Breite | Ergebnis |
|---|---|
| 1440 px | PASS |
| 1024 px | PASS |
| 768 px | PASS |
| 430 px | PASS |
| 390 px | PASS |
| 320 px | PASS |

- keine horizontalen Überläufe,
- einspaltige Formulare auf Mobil,
- Dialog bleibt innerhalb des Viewports,
- Abschnittsnavigation und alle Aktionen erreichbar,
- 44-px-Aktionen und Fokusführung,
- `role="dialog"`, Fokusfalle, Escape-Schließen, Fokus-Rückgabe,
- Labels via `htmlFor`/`id`, `aria-invalid`, `aria-describedby`,
- dynamische Einträge mit stabilen IDs,
- Entfernen-Bestätigung mit Fokusführung.

## 8. Tests

| Prüfung | Ergebnis |
|---|---|
| `npm test -- --run --maxWorkers=2` | **1281 passed, 5 skipped** |
| Domain- + Editor-Tests | **19 passed** |
| Auth-Session-Isolation | **1 passed** |
| Cover-Letter-API-Vertrag | **23 passed** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| API-Syntax `node --check` | PASS |
| CV-Builder-E2E Gast | PASS |
| CV-Builder-E2E authentifiziert | PASS |
| CV-Builder responsive 1440/1024/768/430/390/320 | PASS |
| Applications-E2E 1440/390 | PASS |
| Cover-Letter-E2E 1440/390 | PASS |
| Mobile-Navigation-E2E | PASS |
| Guest-CV-E2E 1440/390 | PASS |
| Console-Errors | keine |
| Echte KI-/Provider-/AWS-/RIS-/Apify-Aufrufe | keine |

Der CV-Builder-E2E prüft zusätzlich:

- Gast- und Auth-Einstieg,
- persönliche Daten, zwei Berufserfahrungen, Ausbildung und Fähigkeiten,
- dynamische Einträge,
- Schließen/Wiederöffnen mit erhaltenem Entwurf,
- Reload ohne Persistenz,
- responsive Bounding-/Overflow-Grenzen.

## 9. Screenshots

Unter `docs/reports/assets/JM-CV-BUILDER-01A/`:

- `desktop-1440-personal.png`
- `desktop-1440-experience.png`
- `desktop-1440-education-skills.png`
- `mobile-390-editor.png`
- `mobile-390-dynamic-entries.png`
- `mobile-390-session-note.png`

Ausschließlich synthetische Lebenslaufdaten.

## 10. Spätere PDF-/ATS-Grenzen

Geplante, nicht implementierte Architektur:

```text
CvBuilderDraftV1
  → validierte Lebenslaufdaten
  → Layoutvorlage
  → PDF
  → vorhandener CV-Upload/Parser
  → Suchprofile/ATS
```

Der Builder liefert später grundsätzlich Skills, Erfahrung, Ausbildung,
Zertifikate und Tätigkeitsbeschreibungen. In 01A gibt es:

- keine PDF-Bibliothek,
- keine Layoutvorlage,
- keine ATS-Ergebnisse,
- keine Kopplung an den bestehenden CV-Hash,
- keine RIS-Persistenz,
- keinen `CVDocumentV1`-Backendvertrag.

## 11. Git

- Domain Foundation: `8f4ea9c`
- Editor: `739a495`
- Session/Navigation: `85cf61e`
- E2E/Responsive/Accessibility: `14d24d2`
- Dokumentation: dieser Commit
- Kein Push, Merge, Rebase, Stash, Reset oder Deployment

## 12. Offene Punkte

- PDF-Export und Layoutvorlagen fehlen (01B+).
- Kein Import aus vorhandenen CV-Dateien.
- Keine dauerhafte Speicherung oder RIS-Anbindung.
- Keine CV-Builder-Eingabe in ATS/Suchprofile.
- Keine Live-Auth-Matrix; der Auth-Reset ist lokal getestet.
- Native Monatsauswahl (`input[type=month]`) wird verwendet; eine
  Browser-Fallback-UI ist nicht gesondert implementiert.
- Keine Lösch-/Zurücksetzen-Aktion für den gesamten Entwurf; der Entwurf wird
  durch Auth-Reset oder Reload geleert.
- **PRODUCTION: weiterhin BLOCKED.**

## 13. Abschlussentscheidung

**CV-BUILDER-01A: READY für 01B.**

Die Domain Foundation, der strukturierte Editor, Session-State, Gast-/Auth-
Zugang, Validierung, Responsive- und Accessibility-Grundlagen sind lokal
verifiziert. PDF, echte Persistenz, KI-Optimierung und ATS-Integration bleiben
ausdrücklich außerhalb dieses Schritts.

**HARD STOP nach 01A. Kein Push, kein Deployment.**
