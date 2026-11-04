# JM-DIRECT-COVER-LETTER-01B

**Art:** Manuelle Stellenanzeige / Datenvertrag / LetterModal-Handoff
**Status:** **IMPLEMENTED LOCAL — PHASE B COMPLETE**; Adoption gesperrt
**Datum:** 2026-11-04
**Repository:** `maynowak/mays-jobsearch`
**Branch:** `feature/jm-direct-cover-letter-01b`
**Basis:** Discovery `bc68866`; lokaler `main` `7a4a64e`; `origin/main` `4364eab`

> Keine neue KI-Engine, keine neue Backend-Route, keine RIS-/AWS-/Cognito-
> Änderung, kein Push, Merge oder Deployment. Die bestehende
> `/api/cover-letter`-Pipeline und die bestehende `LetterModal`-Instanz werden
> verwendet.

## 1. Git-Baseline

- Ausgangspunkt: `feature/jm-direct-cover-letter-01`, HEAD `bc68866`.
- Neuer Branch: `feature/jm-direct-cover-letter-01b` von `bc68866`.
- `main`: `7a4a64e`; `origin/main`: `4364eab`.
- Arbeitsbaum vor Phase B: clean.
- Keine fremden Worktrees überschrieben.
- `docs/AI_AUDITLOG.md` gelesen.

## 2. Vertragsänderungen

### `ApplicationJobReferenceV1`

Minimal erweitert:

```ts
type ApplicationJobOrigin = "source" | "manual";

interface ApplicationJobReferenceV1 {
  jobId: string;
  title: string;
  companyName: string;
  location: string[];
  source: string[];
  originalUrl?: string;
  jobOrigin?: "source" | "manual";
}
```

Regeln:

- `jobOrigin` ist optional; fehlt es, gilt `"source"` für bestehende
  importierte Stellen.
- Importierte Quellen benötigen weiterhin eine gültige http(s)-`originalUrl`.
- Manuelle Stellen dürfen ohne URL existieren.
- Eine vom Benutzer eingegebene manuelle URL ist erlaubt und muss http(s)
  sein.
- Manuelle Herkunft bleibt auch bei vorhandener URL erhalten.
- Keine erfundene externe Job-ID.
- `source: ["manual"]` kennzeichnet die manuelle Quelle.

Aktualisiert:

- `src/lib/applications/contractTypes.ts`
- `src/lib/applications/applicationValidation.ts`
- `docs/contracts/schemas/JOBMATCHER-APPLICATION-V1.schema.json`
- `docs/contracts/JOBMATCHER-APPLICATION-MANAGEMENT-V1.md`
- `docs/contracts/MAYS-RIS-APPLICATION-PERSISTENCE-HANDOFF-V1.md`
- `docs/contracts/fixtures/application-v1/application.manual-job.json`

## 3. Manuelle Job-ID und Session-Kontext

`src/lib/applications/manualJob.ts` erzeugt:

```text
manual:<opaque-id>
```

- Der Schlüssel wird pro manuellem Formular einmal erzeugt und bei
  Bearbeitung, Modal-Handoff und erneutem Öffnen beibehalten.
- Keine Identifikation über Titel, Arbeitgeber oder Beschreibung.
- Keine Ableitung aus eingefügtem Text.
- Keine Kollision mit importierten Quell-IDs.

`src/lib/applications/manualJobSession.ts` hält den Kontext ausschließlich im
Arbeitsspeicher:

- Map `manual:<id>` → Job/Referenz/Beschreibung,
- keine `localStorage`-, `sessionStorage`-, IndexedDB- oder Backend-Speicherung,
- `beginNewManualJobSession()` leert den Kontext bei Auth-/Identitätswechsel,
- Aufruf in `App.tsx` zusammen mit `beginNewApplicationSession()`.

## 4. Formular „Neue Bewerbung“

Neu: `src/components/NewApplicationForm.tsx`.

In `ApplicationsSection`:

- Button **„+ Neue Bewerbung“** im Kopfbereich,
- Formular mit großem Beschreibungstextfeld,
- optionale Felder: Stellenbezeichnung, Unternehmen, Standort, Original-URL,
- Aktion **„Anschreiben generieren“**,
- Aktion **„Abbrechen“** mit Dirty-State-Bestätigung,
- **keine** funktionierende „Als Bewerbung speichern“-Aktion in Phase B.

Validierung:

- leere Beschreibung → Fehler,
- mehr als 20.000 Zeichen → Fehler statt stiller Kürzung,
- HTML/Script wird lokal entfernt; keine Ausführung,
- URL muss http(s) sein oder leer bleiben,
- unvollständige/zu kurze Beschreibung → lokaler Fehler,
- begrenzte Beschreibung → Warnung, aber kein stilles Ersetzen,
- Titel/Unternehmen fehlen → neutrale Fallbacks:
  - „Initiativbewerbung“
  - „Unternehmen nicht angegeben“
- Standort wird optional in eine Liste aufgeteilt.

Es wird beim Einfügen, Prüfen oder Öffnen **kein** Modellaufruf ausgelöst.

## 5. LetterModal-Handoff

- `ApplicationsSection` erhält `onOpenLetter(job)`.
- `App.tsx` setzt den bestehenden `letterJob`-State.
- Die bestehende `LetterModal`-Instanz wird verwendet; keine zweite
  Modal-Instanz und keine zweite Pipeline.
- `letterModalNode` wird jetzt auch in den Profil-/Dashboard-Zweigen
  gerendert. Vorher war das Modal nur im Default-Return vorhanden; dadurch
  konnte der neue Einstieg aus „Meine Bewerbungen“ das Modal nicht öffnen.
- Die vollständige normalisierte Beschreibung wird als
  `job.description`/`descriptionPlain` übergeben.
- Bestehende Modellwahl, CV-Auswahl, manuelle Bewerberangaben, Sprache, Stil,
  Länge, Consent-/Anonymisierungslogik und Fehlerbehandlung bleiben
  unverändert.

### Adoption in Phase B

Die Adoption ist für manuelle Stellen ausdrücklich gesperrt:

- `LetterModal` erhält `adoptionLocked`.
- Statt des Adoptionsbuttons erscheint:
  - „Übernahme noch nicht verfügbar“
  - Hinweis, dass die Übernahme in Phase C freigeschaltet wird.
- Der Text kann weiterhin bearbeitet, kopiert und heruntergeladen werden.
- Keine fehlerhafte oder vorgetäuschte Übernahme.

## 6. Gast- und Auth-Verhalten

- `/profil` zeigt für Gäste weiterhin den Anmeldehinweis.
- Der bestehende `applicationsSection`-Node wird im Gastzustand zusätzlich
  gerendert, damit Gäste die manuelle Stellenanzeige einfügen, lokal prüfen,
  das LetterModal öffnen und ein Anschreiben generieren können.
- Die Übernahme in eine Bewerbung bleibt für manuelle Stellen in Phase B
  gesperrt; es gibt keine automatische Anmeldung und keine Gastdatenmigration.
- Authentifizierte Benutzer sehen denselben Ablauf; auch dort bleibt die
  manuelle Adoption bis Phase C gesperrt.

## 7. Source-Anzeige

`SourceBadge` kennt jetzt:

- `source.manual` → „Manuell hinzugefügt“ / „Manually added“.

Die Bewerbungsdetails zeigen Quellen über `sourceLabels`; manuelle Stellen
ohne URL rendern keinen „Originalanzeige öffnen“-Link. Importierte Quellen
bleiben unverändert.

## 8. Neutraler Arbeitgeber / Titel

`api/cover-letter.mjs` ergänzt die bestehenden Prompt-Regeln:

- fehlender/unbekannter Arbeitgeber → neutrale Anrede, keine erfundene Firma
  oder Adresse,
- generischer Fallback-Titel „Initiativbewerbung“ wird nicht als bestätigte
  Rolle behandelt,
- keine erfundenen Arbeitgeberdaten aus der Stellenbeschreibung.

Es bleibt bei der bestehenden API, dem bestehenden Prompt-Builder und der
bestehenden Modellkonfiguration.

## 9. Tests

### Vollständige Suite

```text
npm test -- --run --maxWorkers=2
```

Ergebnis:

- **1369 passed**
- **5 skipped**
- **131 Testdateien passed, 3 skipped**

### Neue/angepasste Tests

- `src/lib/applications/manualJob.test.ts`
- `src/lib/applications/manualJobSession.test.ts`
- `src/lib/applications/applicationValidation.manual.test.ts`
- `src/components/NewApplicationForm.test.tsx`
- `src/components/ApplicationsSection.manual.test.tsx`
- `src/components/SourceBadge.test.tsx`
- `src/components/LetterModal.test.tsx`
- `src/components/DashboardV2AuthenticatedPreview.test.tsx`
- `tests/api/cover-letter.test.mjs`

Gezielter Lauf: **112 passed** (9 Dateien).

Abgedeckt:

- manuelle Stelle ohne URL,
- manuelle Stelle mit echter URL,
- ungültige URL,
- fehlender Titel/Firma mit neutralen Fallbacks,
- leere/zu lange Beschreibung,
- HTML-Bereinigung,
- Bearbeitung und vollständiger Beschreibungs-Handoff,
- Modal öffnen/schließen/erneut öffnen,
- kein KI-Autostart,
- Gast und Auth,
- Session-Reset,
- SourceBadge und kein ungültiger URL-Link,
- gesperrte manuelle Adoption.

### Build / Syntax

- `npm run build` — PASS
- `node --check api/cover-letter.mjs` — PASS
- JSON-Schema parse — PASS
- `git diff --check` — PASS

### E2E

Neu:

```text
npm run test:e2e:direct-cover-letter
```

Ergebnis: PASS für

- 1440 px Auth,
- 1024 px Gast,
- 768 px Gast,
- 430 px Gast,
- 390 px Gast,
- 320 px Gast.

Geprüft: Formular, lokale Validierung, SourceBadge, vollständiger
Beschreibungs-Handoff, kein AI-Call beim Öffnen/Einfügen, ein AI-Call nach
explizitem Start, Editor, Regeneration, gesperrte Adoption, Dirty-State,
Touch-Ziel ≥ 44 px, kein horizontaler Overflow.

Screenshots:
`docs/reports/assets/JM-DIRECT-COVER-LETTER-01B/`

Bestehende E2E:

- Applications — PASS
- Cover Letter — PASS
- CV Builder — PASS
- Search Results — PASS
- Mobile Navigation — PASS

Hinweis: Die bestehenden E2E-Skripte schreiben in ihre historischen
Screenshot-Verzeichnisse. Die dadurch entstandenen fremden Bildänderungen
wurden vor dem Commit vollständig zurückgesetzt; nur die neuen Phase-B-
Screenshots bleiben erhalten.

## 10. Commits

| Commit | Inhalt |
|---|---|
| `725d9eb` | Manueller Job-Vertrag, Validierung, Schema, Fixture, Session-Helper |
| `fb6f6c6` | Formular, ApplicationsSection, LetterModal-Handoff, SourceBadge, Prompt, Styles |
| `9ff4dd8` | Unit-/Contract-/API-/E2E-Tests |
| Dokumentationscommit | Report, Auditlog, Screenshots |

## 11. Offene Findings für Phase C

1. **Adoption weiterhin gesperrt.** Phase C muss den manuellen
   Bewerbungsentwurf sicher anlegen/aktualisieren und die Sperre entfernen.
2. **Refresh nach Adoption:** `ApplicationsSection` lädt derzeit nur bei
   Repository-Wechsel; nach einer Adoption aus dem zentralen Modal ist ein
   Refresh-Token/Reload erforderlich.
3. **Adoptions-Race:** `handleAdoptLetterAsApplication` sollte den aktuellen
   Stand per `findByJob` lesen, statt nur den App-Snapshot zu verwenden.
4. **Beschreibungspersistenz:** Die manuelle Beschreibung bleibt session-/
   modal-lokal und ist nicht Teil von `ApplicationV1`. Der
   `ApplicationLetterComparison`-Verbesserungspfad verliert dadurch den
   Stellenkontext; Phase C muss das bewusst entscheiden.
5. **CoverLetterVersion:** Die bestehende Adoption legt keine neue Version
   an. Die Semantik für den direkten Flow ist noch festzulegen.
6. **RIS-Handoff:** Das RIS-Backend muss `jobOrigin: "manual"` und optionale
   `originalUrl` akzeptieren; die Jobsearch-Seite ist vorbereitet, die
   Serverpersistenz bleibt offen.
7. **Gastbereich:** Die Gastanzeige der ApplicationsSection ist eine bewusste
   Phase-B-Erweiterung, damit Gäste die Stellenanzeige nutzen können. Die
   Adoption bleibt gesperrt; eine spätere Produktentscheidung kann den
   Gastbereich anders abgrenzen.
8. **Keine echten Provider-/RIS-/AWS-Aufrufe.** Die E2E- und API-Tests
   verwenden ausschließlich Mocks.

## 12. Abschlussentscheidung

**DIRECT-COVER-LETTER-01B: READY für Phase C.**

Die manuelle Stellenanzeige kann lokal eingegeben, geprüft und über die
bestehende Pipeline in das bestehende LetterModal übergeben werden. Die
Adoption in eine Bewerbung ist in Phase B absichtlich gesperrt.

**APPLICATION ADOPTION: Noch nicht freigegeben.**

**PRODUCTION: weiterhin BLOCKED.**

**HARD STOP. Keine automatische Phase C, keine neue KI-Engine, keine
RIS-Persistenz, keine AWS-/Cognito-Mutation, kein Push, Merge oder Deployment.**
