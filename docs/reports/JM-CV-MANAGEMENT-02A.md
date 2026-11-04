# JM-CV-MANAGEMENT-02A

**Art:** Read-only Discovery / CV-Datenvertrag / Integrationsplanung
**Status:** **DISCOVERY COMPLETE**; keine Produktimplementierung
**Datum:** 2026-11-04
**Repository:** `maynowak/mays-jobsearch`
**Branch:** `feature/jm-cv-management-02a`
**Baseline:** lokaler `main` `cb10666`; `origin/main` `4364eab`

> Keine Produktimplementierung, keine neue Persistenz, kein Push, Merge oder
> Deployment. Keine RIS-/AWS-/Cognito-/CloudFront-Änderung. Keine echten
> KI-/Provider-/Apify-Aufrufe.

## 1. Git-Baseline

- Ausgangspunkt: lokaler `main` `cb10666`.
- `origin/main`: `4364eab`.
- Neuer Branch: `feature/jm-cv-management-02a`.
- Working Tree vor Beginn: clean.
- Worktrees geprüft; keine fremden Änderungen überschrieben.
- `docs/AI_AUDITLOG.md` gelesen.
- Bestehende Reports `JM-CV-BUILDER-01A/01B/01C` gelesen und gegen Code
  verifiziert.

## 2. Tatsächliche CV-Architektur

Es existieren zwei getrennte CV-Konzepte:

### 2.1 Hochgeladene CV-Datei: `CvDocument`

`src/types.ts`:

```ts
interface CvDocument {
  id: string;
  name: string;
  size: number;
  selected: boolean;
  file: File;
  skills?: string[];
  hash?: string | null;
  processedAt?: number | null;
  letterText?: string;
}
```

Eigenschaften:

- repräsentiert eine PDF-Datei im Browser-Session-State,
- `file` ist ein Browser-`File`, keine Serverressource,
- `hash`/`processedAt` sind Session-Metadaten,
- `letterText` ist der bereits anonymisierte Text für den Anschreiben-Flow,
- kein strukturierter Lebenslauf.

Verwaltet durch:

- `src/components/CvDocumentList.tsx`,
- `src/components/DashboardV2CvSection.tsx`,
- `CvProcessingState` in `src/App.tsx`.

`CvDocumentList` unterstützt mehrere Uploads, Einzelauswahl, Verarbeitung,
Profil-Overlay, Löschen und „CV-Daten entfernen“. Es ist **keine**
Verwaltung mehrerer strukturierter Lebensläufe.

### 2.2 Strukturierter CV: `CvBuilderDraftV1`

`src/lib/cvBuilder/contractTypes.ts`:

```ts
interface CvBuilderDraftV1 {
  schemaVersion: 1;
  personal: CvBuilderPersonalV1;
  profile: CvBuilderProfileV1;
  experience: CvBuilderExperienceV1[];
  education: CvBuilderEducationV1[];
  skills: string[];
  projects: CvBuilderProjectV1[];
  certificates: CvBuilderCertificateV1[];
  languages: CvBuilderLanguageV1[];
  links: CvBuilderLinkV1[];
}
```

Eigenschaften:

- strukturierte, editierbare Daten,
- stabile Entry-IDs,
- Monats-/Jahresangaben,
- keine Datei-, Hash-, RIS- oder React-Abhängigkeit,
- keine `name`-, `template`-, `updatedAt`- oder `version`-Felder auf Root-Ebene.

In `App.tsx` existiert genau **ein** `cvBuilderDraft`:

```ts
const [cvBuilderDraft, setCvBuilderDraft] =
  useState<CvBuilderDraftV1>(createEmptyCvBuilderDraft);
```

Bei Identitätswechsel wird dieser Draft mit `createEmptyCvBuilderDraft()`
zurückgesetzt.

### 2.3 Editor, Vorschau, Templates, PDF

- `src/components/CvBuilderEditor.tsx`
  - ein einziger Draft,
  - `template` ist **lokaler Editor-State** (`useState<CvBuilderTemplate>("classic")`),
  - keine Root-`name`-/`version`-Verwaltung,
  - `onChange(draft)` aktualisiert den App-Draft.
- `src/components/CvBuilderPreview.tsx`
  - rendert `draft` + `template`,
  - drei Templates: `classic`, `modern`, `compact`.
- `src/lib/cvBuilder/templates.ts`
  - `CvBuilderTemplate` und `CV_BUILDER_TEMPLATES`.
- `src/lib/cvBuilder/pdfExport.ts`
  - `createCvBuilderPdf(draft, template, { language })`,
  - lokale PDF-Erzeugung, A4, Seitenumbruch, DejaVu-Fonts,
  - keine Server-/KI-Abhängigkeit.
- `src/lib/cvBuilder/validation.ts`
  - validiert den Draft, nicht ein Profil-Envelope.

**Wichtiger Befund:** Das Template ist derzeit nicht Teil des Drafts und geht
beim Schließen/Neuladen verloren. Für mehrere Lebensläufe muss es im
Profil-Envelope gespeichert werden.

### 2.4 CV-Auswahl im LetterModal

`src/components/LetterModal.tsx` verwendet ausschließlich `CvDocument`:

- `LetterCvChoice = "none" | "existing"`,
- `cvDocuments` sind hochgeladene PDF-Dokumente,
- `selectedCv.letterText` oder `extractPdfText(selectedCv.file)` wird
  anonymisiert,
- Request sendet `candidate.mode="cv"`, `cv_text`, `cv_anonymized=true`,
- `cvReference` bei Adoption: `{ cvId: selectedCv.id, label: selectedCv.name }`.

Ein strukturierter `CvBuilderDraftV1` ist dort **nicht** auswählbar. Es gibt
keine Funktion, die einen strukturierten CV in anonymisierten Text umwandelt.

### 2.5 Bewerbungs-CV-Referenz

`src/lib/applications/contractTypes.ts`:

```ts
interface ApplicationCvReferenceV1 {
  cvId: string;
  documentId?: string;
  label?: string;
}
```

- `cvId` ist eine opaque Referenz,
- `documentId` ist optional,
- es gibt kein Feld für die CV-Quelle (`uploaded` vs. `builder`),
- bestehende Adoptionen übergeben `selectedCv.id` (hochgeladene Datei).

## 3. Wiederverwendbare Komponenten

| Komponente | Wiederverwendung |
|---|---|
| `CvBuilderEditor` | Ja; muss Profil-Envelope/Name/Template/Version erhalten |
| `CvBuilderPreview` | Ja; unverändert für Profil-Draft nutzbar |
| `CvBuilderTemplate`/Templates | Ja; Template in Profil speichern |
| `createCvBuilderPdf`/`downloadCvBuilderPdf` | Ja; unverändert |
| `CvBuilderDraftV1` | Ja; als `cvData` im Envelope |
| `CvBuilderValidation` | Ja; Draft-Validierung bleibt |
| `CvBuilderAuthIsolation`-Muster | Ja; auf Profilliste erweitern |
| `CvDocumentList` | Nein für strukturierte Liste; bleibt für Uploads |
| `DashboardV2CvSection` | Ja; um „Meine Lebensläufe“ erweitern |
| `LetterModal` | Ja; um Builder-CV-Auswahl erweitern |
| `ApplicationCvReferenceV1` | Ja; optional um Quelle erweitern |
| `sessionRepository`-Muster | Ja; als Vorlage für CV-Profil-Repository |

## 4. Vorgeschlagenes Datenmodell

Minimaler Envelope um den bestehenden Draft:

```ts
interface CvBuilderProfileV1 {
  schemaVersion: 1;
  cvId: string;              // "cvb-<uuid>"
  name: string;              // Benutzerdefiniert, nicht leer
  cvData: CvBuilderDraftV1;  // bestehende Struktur, keine Kopie des Schemas
  template: CvBuilderTemplate;
  createdAt: string;
  updatedAt: string;
  version: number;
}
```

Regeln:

- `cvId` wird einmalig serverseitig im Client erzeugt und bleibt stabil.
- `name` ist nicht die Identität; `cvId` ist die Identität.
- `cvData` ist die **einzige** fachliche CV-Struktur.
- `template` gehört zum Profil, nicht zum flüchtigen Editor-State.
- `version` dient optimistischer Konfliktkontrolle.
- Kein `File`, kein Hash, kein `processedAt` im Profil.
- Keine E-Mail als Identität; Auth-Kontext bleibt `iss + sub`.

### Duplizieren

Deep Clone des gesamten `cvData` (inkl. Arrays/Objekte), neue `cvId`, neuer
Name (z. B. „Kopie von …“), `version=1`, neues `createdAt`/`updatedAt`.
Keine gemeinsamen veränderbaren Referenzen. Anschließend Validierung.

### Namensregeln

- nicht leer,
- getrimmt,
- maximal 80–100 Zeichen,
- eindeutig innerhalb der Sitzung empfohlen (nicht als Identität),
- Umbenennen ändert `cvId` nicht.

## 5. Session-Repository

Vorschlag: `CvBuilderProfileRepository` (in-memory), analog zu den bestehenden
Session-Repositories:

```text
list()
get(cvId)
create(input)
update(cvId, expectedVersion, changes)
duplicate(cvId, expectedVersion, name?)
delete(cvId, expectedVersion)
invalidate()
```

Anforderungen:

- ein Profil pro `cvId`,
- `expectedVersion` bei Update/Duplicate/Delete,
- keine Duplikate über `cvId`,
- `invalidate()` bei Auth-/Identitätswechsel,
- keine `localStorage`-/IndexedDB-/Backend-Speicherung,
- Session-Generation wie `beginNewApplicationSession`.

Der bestehende `cvBuilderDraft` wird durch die Profilliste + ausgewähltes Profil
ersetzt. `CvBuilderAuthIsolation` muss auf die Liste erweitert werden.

## 6. UI-Integration

Einfachste Integration in `DashboardV2CvSection` (CV-Tab):

- Abschnitt **„Meine Lebensläufe“** oberhalb oder unterhalb der hochgeladenen
  CVs,
- „Neuen Lebenslauf erstellen“,
- Liste mit Name, Template, `updatedAt`,
- Aktionen:
  - Bearbeiten,
  - Duplizieren,
  - Umbenennen,
  - PDF herunterladen,
  - Löschen,
  - Auswählen.
- bestehende `CvBuilderEditor`-Modal-Instanz verwenden,
- bestehende `CvBuilderPreview`/`createCvBuilderPdf` verwenden,
- keine neue Designbibliothek,
- Desktop/Mobil über bestehende responsive Muster.

**Abgrenzung:** Hochgeladene PDFs (`CvDocument`) und strukturierte Lebensläufe
(`CvBuilderProfileV1`) sollten in der UI klar getrennt bleiben. Eine gemeinsame
Liste würde Datei-, Hash- und Prozessierungs-Semantik mit strukturierten Daten
vermischen.

## 7. Anschreiben-Auswahl

Erweiterung von `LetterModal`:

- neue Auswahl `builder` neben `none`/`existing`,
- `selectedBuilderCvId`,
- Builder-Profil aus dem Session-Repository laden,
- deterministischen, sicheren Text aus `cvData` erzeugen,
- Text vor Übertragung anonymisieren,
- Request weiterhin über die bestehende `/api/cover-letter`-Pipeline,
- keine PDF-Datei, kein Hash, keine CV-Dokument-ID im Request,
- bei Adoption `cvReference` mit Builder-`cvId`/Label.

**Offener Architekturpunkt:** Es existiert noch kein
`cvBuilderToAnonymizedText`-Serializer. Er muss in 02B/02C definiert und
getestet werden; ohne ihn ist die Builder-Auswahl im LetterModal nicht sicher.

## 8. Bewerbungszuordnung

Bestehende `ApplicationCvReferenceV1` ist grundsätzlich nutzbar:

```ts
{ cvId: "cvb-...", label: "AWS Cloud Engineer" }
```

Empfehlung: optionales Feld

```ts
cvSource?: "uploaded" | "builder";
```

oder eine äquivalente explizite Quellenkennzeichnung. `cvId` allein ist opaque;
eine Prefix-Heuristik ist für Persistenz/API nicht ausreichend.

Verhalten:

- Zuordnung zu mehreren Bewerbungen über dieselbe `cvId` möglich.
- Bearbeiten des CV-Profils ändert nicht die Referenz, aber die referenzierte
  Sitzungsdatenquelle.
- Löschen eines zugeordneten CV-Profils:
  - Anwendung nicht automatisch löschen,
  - Referenz nicht stillschweigend umschreiben,
  - UI markiert „CV nicht mehr verfügbar“,
  - später explizite Neuauswahl/Entfernung.
- Bestehende Uploaded-CV-Referenzen bleiben kompatibel.
- Keine RIS-Persistenz in 02A/02B.

## 9. Datenschutz und Session

- CV-Profile bleiben ausschließlich im Arbeitsspeicher.
- Keine dauerhafte Speicherung, kein RIS, kein `localStorage`/IndexedDB.
- Keine automatische Gastdatenmigration.
- Keine Consent-Aktivierung.
- Keine KI-Anfrage beim Erstellen/Bearbeiten/Duplizieren/PDF-Export.
- Nur bei expliziter Anschreiben-Generierung wird ein ausgewählter,
  anonymisierter CV-Text an die bestehende Pipeline übergeben.
- Auth-Identität bleibt `iss + sub`; `name` ist keine Identität.
- `handleCvRemoveData` muss in 02B entscheiden, ob auch Builder-Profile
  gelöscht werden; derzeit löscht es nur Uploaded-CV-/Profil-Listen.

## 10. RIS-Handoff

Ein Builder-CV existiert derzeit nur im Browser-Session-State. Eine
`ApplicationCvReferenceV1` mit Builder-`cvId` kann von RIS **nicht** verifiziert
werden, solange RIS kein entsprechendes CV-Dokument/-Profil kennt.

Erforderlich für spätere Persistenz:

- RIS-CV-Ressource oder explizite Snapshot-/Ownership-Regel,
- `cvSource`/Typ,
- serverseitige Ownership-Prüfung,
- keine PDF-Bytes/Hashes im Application-Objekt,
- Retention/Erasure für CV-Profile,
- Umgang mit gelöschten referenzierten CVs.

Bis dahin: **ACTIVE RIS PERSISTENCE: BLOCKED**.

## 11. Teststrategie

Bestehende Baseline: **1384 passed / 5 skipped**.

Gezielte CV-Baseline: **55 passed** aus
`CvBuilderEditor`, `CvBuilderEditorPdf`, `CvBuilderPreview`,
`CvBuilderAuthIsolation`, `CvDocumentList`, `DashboardV2CvSection`,
`validation`, `pdfExport`.

Geplante Tests für 02B/02C:

- mehrere Profile mit eindeutigen `cvId`s,
- Anlegen/Bearbeiten/Umbenennen,
- Duplizieren mit Deep Clone (keine geteilten Referenzen),
- Template pro Profil,
- PDF-Export pro Profil/Template,
- Auth-Wechsel/Session-Reset,
- Löschen eines zugeordneten Profils (Orphan-Referenz),
- Application-CV-Referenz uploaded/builder,
- LetterModal-Auswahl builder,
- Anonymisierter Text/keine Datei/Hash im Request,
- mobile E2E 1440/1024/768/430/390/320,
- keine KI-Aufrufe bei Editor-/Listenaktionen.

Bekannter Flake: `ApplicationsSection.test.tsx`
„asks explicitly before marking a draft as submitted“ kann unter
`--maxWorkers=2` intermittierend timeouten; isoliert und im zweiten Lauf
bestanden. Nicht durch pauschale Timeout-Erhöhung oder Deaktivierung beheben.

## 12. Implementierungsphasen

### 02B — Session-CV-Profilmodell und Liste

- Envelope `CvBuilderProfileV1`,
- In-Memory-Repository mit Versionierung,
- Deep-Clone-Duplicate,
- Template in Profil,
- Auth-Reset,
- „Meine Lebensläufe“-Liste,
- Tests.

### 02C — LetterModal- und Bewerbungsintegration

- `cvBuilderToAnonymizedText`-Serializer,
- Builder-Auswahl im LetterModal,
- Application-CV-Referenz mit Quelle,
- Orphan-/Delete-Verhalten,
- PDF/Responsive/E2E,
- RIS-Handoff-Dokumentation.

## 13. Offene Findings

1. Nur ein `cvBuilderDraft`; keine Profilliste.
2. Kein Root-`name`, `template`, `updatedAt`, `version`.
3. Template ist flüchtiger Editor-State.
4. Kein Builder-CV-zu-Text-Serializer.
5. `CvDocument` (Upload) und `CvBuilderDraftV1` (strukturiert) sind getrennt.
6. `ApplicationCvReferenceV1` hat keine explizite CV-Quelle.
7. Löschsemantik für zugeordnete CVs ist offen.
8. `handleCvRemoveData` löscht derzeit keine Builder-Profile.
9. RIS kann Builder-CV-Referenzen ohne CV-Ressource nicht verifizieren.
10. Bekannter ApplicationsSection-Testflake.

## 14. Entwicklungstabelle

| Bereich | Befund | Empfehlung | Nachweis |
|---|---|---|---|
| CV-Datenmodell | `CvBuilderDraftV1` ohne Envelope | `CvBuilderProfileV1` mit `cvId`, `name`, `cvData`, `template`, `updatedAt`, `version` | `src/lib/cvBuilder/contractTypes.ts` |
| Editor | ein Draft, Template lokal | Profil-Envelope + Template persistieren | `CvBuilderEditor.tsx` |
| Vorschau | draft+template vorhanden | unverändert wiederverwenden | `CvBuilderPreview.tsx` |
| PDF | draft+template+language | unverändert pro Profil nutzen | `pdfExport.ts` |
| Mehrfach-CVs | nicht vorhanden | Session-Repository + Liste | `App.tsx`, `DashboardV2CvSection.tsx` |
| Duplizieren | nicht vorhanden | Deep Clone + neue ID | neu in 02B |
| LetterModal | nur `CvDocument` | Builder-Auswahl + Serializer | `LetterModal.tsx` |
| Application-Referenz | `cvId`/`documentId`/`label` | optional `cvSource` | `contractTypes.ts` |
| Auth/Session | Draft-Reset vorhanden | Liste invalidieren | `CvBuilderAuthIsolation.test.tsx` |
| RIS | keine Builder-CV-Ressource | Handoff blockiert | `MAYS-RIS-APPLICATION-PERSISTENCE-HANDOFF-V1.md` |

## 15. Abschlussentscheidung

**CV-MANAGEMENT-02A: READY für Implementierung (02B, session-only).**

Die vorhandene CV-Builder-Domain ist erweiterbar, ohne eine zweite
CV-Datenstruktur zu erzeugen. Die LetterModal-/Application-Integration ist erst
nach Serializer- und Quellenentscheidung freizugeben.

**CV-MANAGEMENT-02B: NOT STARTED.**

**ACTIVE RIS PERSISTENCE: BLOCKED.**

**PRODUCTION: BLOCKED.**

**HARD STOP. Keine Produktimplementierung, keine neue Persistenz, kein Push,
kein Merge, kein Deployment, keine RIS-/AWS-/Cognito-/CloudFront-Änderungen.**
