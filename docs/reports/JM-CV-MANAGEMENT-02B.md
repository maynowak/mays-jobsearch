# JM-CV-MANAGEMENT-02B

**Art:** Mehrere Lebensläufe / Session-Profile / Editor-Integration / CV-Verwaltung
**Status:** **IMPLEMENTED LOCAL**; **PRODUCTION: BLOCKED**
**Datum:** 2026-11-04
**Repository:** `maynowak/mays-jobsearch`
**Branch:** `feature/jm-cv-management-02b`
**Baseline:** Discovery `069e6d3`; lokaler `main` `cb10666`; `origin/main` `4364eab`

> Keine LetterModal-/Bewerbungsintegration, keine dauerhafte Speicherung, keine
> RIS-/AWS-/Cognito-Änderung, kein Push, Merge oder Deployment.

## 1. Git-Baseline

- Ausgangspunkt: `feature/jm-cv-management-02a`, HEAD `069e6d3`.
- Neuer Branch: `feature/jm-cv-management-02b`.
- Lokaler `main`: `cb10666`; `origin/main`: `4364eab`.
- Working Tree vor Beginn: clean.
- Worktrees und bestehende CV-Komponenten geprüft.
- Discovery-Bericht `docs/reports/JM-CV-MANAGEMENT-02A.md` und
  `docs/AI_AUDITLOG.md` gelesen.

## 2. Profilvertrag

Neu: `src/lib/cvBuilder/profileTypes.ts`.

```ts
interface CvBuilderProfileV1 {
  schemaVersion: 1;
  cvId: string;              // "cvb-<uuid>"
  name: string;
  cvData: CvBuilderDraftV1;  // bestehende Struktur
  template: CvBuilderTemplate;
  createdAt: string;
  updatedAt: string;
  version: number;
}
```

Eigenschaften:

- `CvBuilderDraftV1` bleibt die einzige CV-Datenstruktur.
- `cvId` ist stabil und unabhängig von Name/PDF-Dateiname.
- `name` ist getrimmt, 1–80 Zeichen, keine Steuerzeichen.
- `template` ist `classic`, `modern` oder `compact`.
- `createdAt` bleibt unverändert; `updatedAt` wird bei bestätigter Änderung
  aktualisiert.
- `version` startet bei 1 und dient der optimistischen Konfliktkontrolle.
- Defensive Deep Copies für alle nach außen gegebenen Profile.

## 3. In-Memory-Repository

Neu: `src/lib/cvBuilder/profileRepository.ts`.

Operationen:

- `list`
- `get`
- `create`
- `update`
- `rename`
- `duplicate`
- `delete`
- `clear`
- `invalidate`

Verhalten:

- ein Profil pro `cvId`,
- `expectedVersion` bei Update/Rename/Duplicate/Delete,
- Versionskonflikt bei stale `expectedVersion`,
- `not_found`, `id_conflict`, `validation_error`, `session_ended`,
- `invalidate()` bei Auth-/Identitätswechsel,
- `beginNewCvBuilderSession()` für Session-Generation,
- keine `localStorage`-/IndexedDB-/Backend-Speicherung.

## 4. Deep-Clone-Duplicate

`duplicate(cvId, expectedVersion, name?)`:

- neue `cvId`,
- Name standardmäßig `<Original> (Kopie)` bzw. lokalisiert in der UI,
- gleiche Anfangsdaten,
- gleiches Template,
- `version=1`,
- eigene Zeitstempel,
- vollständiger Deep Clone von `cvData`, inklusive:
  - Berufserfahrung,
  - Ausbildung,
  - Fähigkeiten,
  - Projekte und Technologien,
  - Zertifikate, Sprachen und Links.

Änderungen am Duplikat verändern das Original nicht; Änderungen am
zurückgegebenen Objekt verändern den Repository-Zustand nicht (defensive Kopien).

## 5. UI „Meine Lebensläufe“

Neu: `src/components/CvBuilderProfileList.tsx`, integriert in
`DashboardV2CvSection`.

Je Profil:

- Name,
- Design,
- letzte Änderung,
- „Bearbeiten“,
- „Duplizieren“,
- „Umbenennen“,
- „PDF herunterladen“,
- „Löschen“ mit Bestätigung.

Hauptaktion:

- „+ Neuen Lebenslauf erstellen“.
- Optional: „Bestehenden Entwurf übernehmen“, wenn ein nicht leerer
  Arbeits-Draft ohne Profile vorhanden ist.

Ein leeres Profil wird als „Leerer Lebenslauf“ markiert; es wird nicht als
vollständiger CV dargestellt.

Hochgeladene `CvDocument`-PDFs bleiben in einem getrennten Bereich und werden
durch Löschen eines Builder-Profils nicht verändert.

## 6. Editor-Integration

`CvBuilderEditor` erhält zusätzlich:

- `initialTemplate`,
- `onTemplateChange`,
- `onSave`,
- `dirty`,
- `saving`,
- `saveError`.

Verhalten:

- Profil wird in den Editor geladen,
- gespeichertes Template wird ausgewählt,
- Änderungen an Draft/Template markieren `dirty`,
- „Lebenslauf speichern“ schreibt über das Repository mit `expectedVersion`,
- Schließen bei ungespeicherten Änderungen zeigt:
  - „Speichern und schließen“,
  - „Verwerfen und schließen“,
  - „Weiter bearbeiten“.
- Ein bestehender Einzeldraft kann über „Bestehenden Entwurf übernehmen“
  explizit in ein Profil übernommen werden.
- Keine automatische Erstellung mehrerer Profile.

## 7. Template pro CV

Das Design gehört jetzt zum Profil, nicht mehr zum flüchtigen Editor-State.
Ein Template-Wechsel bei Profil A verändert Profil B nicht. Beim Speichern wird
das Template mit `cvData` im Profil aktualisiert.

## 8. PDF-Export

Der Export verwendet unverändert:

```ts
createCvBuilderPdf(profile.cvData, profile.template, { language })
```

- Classic/Modern/Compact,
- A4, mehrseitig, selektierbarer Text,
- bestehende DejaVu-Fonts,
- lokale Browser-Erzeugung,
- keine Profilmutation,
- Dateiname aus dem Profilnamen über
  `cvBuilderProfileFileName()`; sichere Normalisierung.

## 9. Auth- und Session-Isolation

- Repository und Profile ausschließlich im Arbeitsspeicher.
- Auth-Reset:
  - `beginNewCvBuilderSession()`,
  - `invalidate()`,
  - neue Repository-Instanz,
  - Profile/aktiver Draft/Template/Dirty-State werden geleert.
- Keine Gastdatenmigration.
- Keine Fremdprofile nach Identitätswechsel.
- `handleCvRemoveData` leert jetzt auch die Builder-Profile und den aktiven
  Editor; hochgeladene CVs werden im bestehenden Pfad separat behandelt.

## 10. Tests

### Gesamtsuite

```text
npm test -- --run --maxWorkers=2
```

- **1400 passed**
- **5 skipped**
- **136 Testdateien passed, 3 skipped**

### Gezielte CV-Suite

- `profileTypes`
- `profileRepository`
- `CvBuilderProfileList`
- `CvBuilderEditor.profile`
- `CvBuilderAuthIsolation`
- bestehende `CvBuilderEditor`, `CvBuilderEditorPdf`, `CvBuilderPreview`,
  `CvDocumentList`, `DashboardV2CvSection`, `validation`, `pdfExport`

Ergebnis: **71 passed** (12 Dateien).

Abgedeckt:

- Profil-Envelope und Validierung,
- CRUD und Versionierung,
- defensive Kopien,
- Deep-Clone-Duplicate,
- Delete/Clear/Session-Invalidierung,
- Editor-Save und Dirty-Dialog,
- Template pro Profil,
- Liste, Umbenennen, Löschen mit Bestätigung,
- PDF-Dateiname,
- DE/EN-Texte,
- Auth-Reset.

### Build / Syntax

- `npm run build` — PASS
- `node --check tests/e2e/cv-management-02b.mjs` — PASS
- `git diff --check` — PASS

### E2E

- CV-Management 02B: 1440/1024/768/430/390/320 — PASS
  - Neues Profil, Modern, Speichern, Duplizieren, Umbenennen, zweites Profil
    mit Kompakt, PDF-Download, Löschen, genau zwei Profile danach.
- CV-Builder — PASS
- CV-PDF (classic/modern/compact/mobile/english/auth) — PASS
- Applications — PASS
- Cover Letter — PASS
- Direct Cover Letter — PASS
- Manual Application Draft — PASS
- Profile/Storage Consent — PASS
- Mobile Navigation — PASS
- Keine echten Provider-/KI-/AWS-/RIS-/Apify-Aufrufe.

Screenshots: `docs/reports/assets/JM-CV-MANAGEMENT-02B/` — 6 Dateien.

## 11. Commits

| Commit | Inhalt |
|---|---|
| `aa9b7fe` | Profilvertrag und In-Memory-Repository |
| `6fa1361` | Multi-CV-UI, Editor-Integration, Template, PDF-Dateiname |
| `360a5e5` | Unit-/Repository-/E2E-Tests und Testanpassungen |
| Dokumentationscommit | Report, Auditlog, Screenshots |

## 12. Offene Findings

1. Die „Meine Lebensläufe“-Liste ist im authentifizierten Dashboard-CV-Tab
   verfügbar; Gäste können den Builder weiterhin über die Suchseite öffnen,
   aber die Profilliste ist dort nicht eingebunden. Das ist eine
   Produkt-/Navigationsentscheidung für eine Folgephase.
2. LetterModal-Auswahl für Builder-CVs ist nicht implementiert (02C).
3. `cvBuilderToAnonymizedText` fehlt weiterhin (02C).
4. ApplicationCvReference bleibt unverändert (02C).
5. Keine dauerhafte Speicherung/RIS-Persistenz.
6. Exactly-once über mehrere Tabs/Clients bleibt sessionbedingt begrenzt.
7. Bekannter intermittierender `ApplicationsSection.test.tsx`-Timeout bleibt
   dokumentiert; keine Tests deaktiviert.

## 13. Abschlussentscheidung

**CV-MANAGEMENT-02B: READY für Phase 02C.**

**LETTERMODAL-INTEGRATION: NOT STARTED.**

**ACTIVE RIS PERSISTENCE: BLOCKED.**

**PRODUCTION: BLOCKED.**

**HARD STOP. Keine automatische Phase 02C, kein Merge nach `main`, kein Push,
kein Deployment, keine dauerhafte Speicherung, keine RIS-/AWS-/Cognito-/
CloudFront-Änderungen.**
