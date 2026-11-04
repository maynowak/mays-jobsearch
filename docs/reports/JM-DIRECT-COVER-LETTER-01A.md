# JM-DIRECT-COVER-LETTER-01A

**Art:** Read-only Bestandsanalyse / Integrationsplanung
**Status:** **DISCOVERY COMPLETE — STOP**; keine Implementierung
**Datum:** 2026-11-04
**Repository:** `maynowak/mays-jobsearch`
**Branch:** `feature/jm-direct-cover-letter-01`
**Baseline:** lokaler `main` `7a4a64e`; `origin/main` unverändert

> Phase A beantwortet ausschließlich, wie eine manuell eingefügte
> Stellenausschreibung über die **bestehende** Anschreiben-Pipeline in den
> bestehenden Bewerbungsworkflow gelangen kann. Es wurde kein Produktcode
> geändert, kein Modell-/Provider-/AWS-/RIS-Aufruf ausgelöst und nichts
> gepusht, gemerged oder deployt.

## 1. Git- und Arbeitsgrundlage

- Aktueller Arbeitsbaum:
  `/home/dci-student/projects/mays-jobsearch-consolidation`
- Branch: `main`; HEAD `7a4a64e`.
- `origin/main`: `4364eab` (lokal nicht gepusht).
- Arbeitsbaum vor Phase A: clean.
- Ein zweiter Worktree desselben Repositories existiert unter
  `/home/dci-student/projects/Mays-Jobsearch` auf
  `fix/cover-letter-model-fallback`; dieser ist nicht die integrierte
  Baseline und wurde nicht verändert.
- `docs/AI_AUDITLOG.md`, `docs/DEVELOPMENT_WORKFLOW.md` und
  `docs/ARCHITECTURE.md` wurden gelesen.
- Für Phase A wurde der Branch `feature/jm-direct-cover-letter-01` von
  `main` angelegt. Es gibt noch keinen Implementierungs-Commit.

## 2. Leitplanken

Der neue Ablauf muss die vorhandene Architektur wiederverwenden:

```text
Meine Bewerbungen
  → manuelle Stellenbeschreibung
  → bestehender LetterModal-/Cover-Letter-Flow
  → bestehender Editor / bestehende Regeneration
  → bestehender Adoptions-Callback
  → bestehende SessionApplicationV1-Repository-Semantik
```

Nicht vorgesehen:

- zweite KI-Engine,
- zweite Modellkonfiguration,
- neue Backend-Route oder neue Backend-Orchestrierung,
- neue Persistenz,
- automatische RIS-/AWS-/Cognito-Schreibzugriffe,
- automatischer Modellaufruf beim Einfügen oder Speichern,
- automatischer Abruf fremder URLs.

## 3. Bestandsaufnahme der Anschreiben-Pipeline

### 3.1 Frontend

| Datei | Vorhandene Funktion | Wiederverwendbar |
|---|---|---|
| `src/components/LetterModal.tsx` | Vollständiger Assistent: Vorbereitung, deterministischer Description-Review, CV-Auswahl, manuelle Bewerberfelder, Modellwahl, Generate/Revise, Editor, Copy/Download, Adoptionsstatus | Ja, vollständig |
| `src/lib/coverLetterRequest.ts` | `buildJobContext`, `buildTargetRoles`, `cvIsUsable`, Request-/Response-Typen, Längenlimits | Ja |
| `src/lib/jobDescriptionReview.ts` | `normalizeDescriptionText`, `evaluateDescription`, `checkPlausibility`, `buildDescriptionReview`; keine KI, kein Netzwerk | Ja |
| `src/api.ts` | `generateCoverLetter`, `withModelFallback`, `isModelUnavailable`, `isFreeQuotaExceeded` | Ja |
| `src/components/ApplicationLetterComparison.tsx` | Bestehende Verbesserung eines vorhandenen Entwurfs; **keine** Neu-Generierung aus einer Stellenbeschreibung | Nur eingeschränkt |
| `src/components/ApplicationsSection.tsx` | Bewerbungsliste, Cockpit, Tabs, Editieren, Versionen, Adoption eines vorhandenen Entwurfs | Ja, aber ohne Einstieg in `LetterModal` |

`LetterModal` besitzt bereits:

- `phase: "intro" | "loading" | "done" | "error"`,
- `requestSeqRef` und `inFlightRef` gegen Doppelklicks und verspätete Antworten,
- `handleDescriptionChange`, `handleReviewDescription`, `handleConfirmReview`,
- CV-Auswahl und lokale Anonymisierung,
- `handleLetterChange`, `handleRegenerate`, `handleImprove`,
- `handleAdoptAsApplication`,
- Schutz vor Überschreiben eines bearbeiteten Entwurfs,
- Fehlerzustand mit erhaltenem Entwurf und erneutem Versuch.

### 3.2 Backend

`api/cover-letter.mjs` ist die einzige Anschreiben-Orchestrierung:

- validiert `job`, `candidate`, `options`, `operation` und `revision`,
- begrenzt Beschreibung auf 20.000 Zeichen,
- akzeptiert CV-Text nur mit `cv_anonymized: true`,
- akzeptiert Revisionsdraft nur mit `draft_anonymized: true`,
- entfernt HTML/Script aus untrusted Text,
- führt den Prompt als „untrusted data“ mit expliziten Regeln gegen
  Prompt-Injection und Fakten-Erfindung,
- nutzt die bestehende Provider-/Modellwahl über `chat(...)`,
- liefert nur den bereinigten Anschreibentext zurück,
- speichert nichts serverseitig.

Es gibt **keine** zweite Anschreiben-Route und keinen zweiten Prompt-Builder.

### 3.3 Bestehende Bewerbungsübernahme

`src/App.tsx` hält den `letterJob`-State und rendert `LetterModal` zentral.
`handleAdoptLetterAsApplication` kann bereits:

- einen vorhandenen Session-Entwurf über `expectedVersion` aktualisieren,
- sonst einen neuen Session-Entwurf mit `idempotencyKey: adopt:<slug>` anlegen,
- `coverLetterDraft`, `documentStatus` und optionale CV-Referenz setzen,
- Session-Epoch und verspätete Antworten berücksichtigen.

`sessionApplicationForJob(...)` findet einen Entwurf über `job.jobId`.
`LetterModal` bietet bereits „Als Bewerbungsentwurf übernehmen“ bzw. bei
vorhandenem Entwurf „Anschreiben im Bewerbungsentwurf aktualisieren“.

## 4. Bestandsaufnahme Bewerbungen / Session

| Datei | Befund |
|---|---|
| `src/lib/applications/contractTypes.ts` | `ApplicationJobReferenceV1` verlangt `jobId`, `title`, `companyName`, `location`, `source`, `originalUrl`; `originalUrl` ist http(s)-validiert |
| `src/lib/applications/applicationValidation.ts` | Laufzeitvalidierung: Titel/Firma nicht leer, `source` mindestens ein Eintrag, `originalUrl` gültige http(s)-URL, keine zusätzlichen Job-Felder |
| `src/lib/applications/sessionApplications.ts` | `SessionApplicationV1` ist in-memory, ohne `ownerId`/`applicationId`; `job.jobId` ist der stabile Session-Schlüssel |
| `src/lib/applications/sessionRepository.ts` | In-Memory-Repository, `expectedVersion`, Idempotenz, `invalidate()` bei Session-/Identitätswechsel; Duplikat pro `jobId` wird abgelehnt |
| `src/lib/applications/repositoryTypes.ts` | Persistenzneutraler `ApplicationRepository`; RIS-Port nur als Typvertrag |
| `src/App.tsx` | `applicationRepository` wird bei Auth-/Sessionwechsel invalidiert und neu erzeugt; `sessionApplications` wird geleert |
| `src/components/ApplicationsSection.tsx` | Lädt die Liste einmalig über `repository.list()`; besitzt keinen `onOpenLetter`-Prop und keinen Refresh nach externer Adoption |

### 4.1 Kritischer Contract-Befund

`ApplicationJobReferenceV1` erlaubt derzeit **keine** manuelle Stelle ohne
externe URL, Titel oder Firma:

- `title` und `companyName` sind auf TS-, JSON-Schema- und Laufzeit-Ebene
  nicht leer erlaubt.
- `source` muss mindestens einen Eintrag haben.
- `originalUrl` ist Pflicht und muss mit `http://` oder `https://` beginnen.
- Zusätzliche Felder wie `jobOrigin` oder `description` werden durch
  `additionalProperties: false` bzw. `assertKeys` abgelehnt.

Damit ist die gewünschte manuelle Ausschreibung **nicht** direkt in
`ApplicationV1`/`SessionApplicationV1` abbildbar. Eine erfundene externe URL
wäre keine akzeptable Lösung.

`jobId` und `source` sind dagegen strukturell frei: Ein synthetischer
`manual:<opaque>`-Key und `source: ["manual"]` würden die Laufzeitvalidierung
bestehen. Sie sind aber noch nicht als manueller Namensraum dokumentiert.

## 5. Integrationsübersicht

| Baustein | Ist-Zustand | Erforderliche minimale Änderung |
|---|---|---|
| Einstieg in „Meine Bewerbungen“ | Nur Liste/Cockpit; kein „+ Neue Bewerbung“ | Neues Formular im `ApplicationsSection`-Header, bestehende Styles/Components |
| Manuelle Stellenreferenz | Contract verlangt URL/Titel/Firma | `jobOrigin: "manual"`, `originalUrl` optional für manuelle Quelle, `source: ["manual"]`, stabiler `manual:<id>`-Key |
| Titel/Firma optional | API verlangt nicht-leere Werte | Neutrale Anzeige-/Prompt-Fallbacks („Manuelle Stellenausschreibung“ / „Unternehmen nicht angegeben“) oder bewusste Contract-Lockerung; keine erfundene externe ID |
| Beschreibung | `LetterModal` kann Originalbeschreibung und manuellen Enrichment-Text verarbeiten | Eingefügten Text normalisiert in `job.description`/`descriptionPlain` setzen; dadurch nutzt der bestehende Review-Pfad ihn als Original |
| CV | `LetterModal` unterstützt „kein CV“ und vorhandene CVs | Unverändert übernehmen; CV bleibt optional |
| Modell | `LetterModal`/`withModelFallback` vorhanden | Unverändert übernehmen; kein neuer Modellpfad |
| Generieren | `LetterModal` ruft `/api/cover-letter` erst nach explizitem Start | Unverändert übernehmen; kein Aufruf beim Einfügen |
| Bearbeiten/Regenerieren | `LetterModal` vorhanden | Unverändert übernehmen |
| Adoption | `handleAdoptLetterAsApplication` vorhanden | `LetterModal`-Adoption von `!job.url` entkoppeln; manuellen `jobId` stabil halten |
| Session-Liste nach Adoption | `ApplicationsSection` lädt nur einmal | Refresh-Token/Reload nach Adoption, sonst bleibt die Liste stale |
| Bestehende Jobsuche | eigener `Results`-Flow | Nicht verändern |
| RIS/AWS/Cognito | nicht beteiligt | Keine Änderung |

## 6. Empfohlener minimaler Integrationsweg

### 6.1 Manuelle Stellenreferenz

Empfohlen wird ein expliziter manueller Ursprung statt einer Fake-URL:

```ts
interface ApplicationJobReferenceV1 {
  jobId: string;              // "manual:<session-opaque-id>"
  title: string;              // Fallback: "Manuelle Stellenausschreibung"
  companyName: string;        // Fallback: "Unternehmen nicht angegeben"
  location: string[];         // darf leer sein
  source: string[];           // ["manual"]
  originalUrl?: string;       // bei manual nicht gesetzt
  jobOrigin?: "source" | "manual";
}
```

Regeln:

- `jobOrigin === "manual"` ⇒ `originalUrl` fehlt/ist leer.
- `jobOrigin !== "manual"` ⇒ `originalUrl` bleibt die bestehende
  http(s)-Pflicht.
- `jobId` wird zufällig pro manuellem Entwurf erzeugt und im Session-Draft
  gehalten; keine Ableitung aus dem eingefügten Text (keine zusätzlichen
  personenbezogenen Daten im Schlüssel).
- Keine externe Job-ID wird erfunden.
- `source: ["manual"]` wird in `SourceBadge`/Anzeige als „Manuell“ gelabelt.

Alternativ wäre `source: ["manual"]` als alleiniger Diskriminator möglich,
aber `jobOrigin` ist expliziter und verhindert versehentliche Fake-URLs.

### 6.2 Titel/Firma

Die Eingabefelder bleiben optional. Für Anzeige und Cover-Letter-Request
werden neutrale Fallbacks verwendet, damit `api/cover-letter.mjs` weiterhin
seine bestehende Pflichtvalidierung behalten kann. Eine Lockerung der
API-Pflichtfelder ist nicht erforderlich und wäre eine größere
Vertragsänderung.

### 6.3 Beschreibung

Der eingefügte Text wird im Formular:

1. auf die bestehende `MAX_DESCRIPTION_INPUT_LENGTH` (20.000) begrenzt,
2. mit `normalizeDescriptionText` HTML-/Script-bereinigt,
3. als `description`/`descriptionPlain` des manuellen `Job`-Objekts gesetzt.

Damit nutzt `LetterModal` den vorhandenen `buildDescriptionReview`-Pfad als
Originalbeschreibung. Es ist kein zweiter Prompt- oder Review-Pfad nötig.

Wichtig: Der Nutzer muss vor dem Start weiterhin die Datenübertragung sehen.
`LetterModal` zeigt bereits „No AI request is sent until you start“ und die
Generierungszusammenfassung. Der eingefügte Text ist untrusted data und wird
serverseitig weiterhin bereinigt und als Daten, nicht als Anweisung behandelt.

### 6.4 Einstieg und Modal

`ApplicationsSection` erhält einen optionalen Callback:

```ts
onOpenLetter?: (job: Job) => void;
```

`App.tsx` setzt daraus `letterJob`:

```ts
setLetterJob({ job, prepare: "" });
```

`LetterModal` bleibt zentral in `App.tsx`; keine zweite Modal-Instanz und
keine zweite Pipeline. Der bestehende `onAdoptAsApplication`-Callback wird
weiterverwendet.

### 6.5 Refresh nach Adoption

`ApplicationsSection` lädt aktuell nur bei `repository`-Wechsel. Nach einer
Adoption aus dem zentralen `LetterModal` muss die Liste neu geladen werden.
Minimal:

- `refreshToken?: number` an `ApplicationsSection`,
- App erhöht den Token nach erfolgreicher Adoption,
- `useEffect` ruft `repository.list()` erneut auf.

Alternativ kann `sessionApplications` als Prop gereicht werden; ein
Refresh-Token ist die kleinste Änderung und erhält die bestehende
Repository-Semantik.

### 6.6 Adoptionskonflikt

`handleAdoptLetterAsApplication` verwendet derzeit den App-Snapshot
`sessionApplications` für `existing.version`. Bei parallelen Änderungen in
`ApplicationsSection` kann ein `version_conflict` entstehen. Empfohlen:

- vor der Adoption `await applicationRepository.findByJob(payload.job.slug)`,
- bei Konflikt den vorhandenen Fehlerpfad anzeigen,
- den Anschreibentext nicht verlieren.

Eine neue Lock-Bibliothek ist nicht erforderlich.

## 7. Zustandsmodell

Die gewünschten Zustände lassen sich mit den vorhandenen Mechanismen
abbilden; eine neue State-Machine-Bibliothek ist nicht nötig.

| Zielzustand | Vorhandener Mechanismus |
|---|---|
| `INPUT` | neues Formular in `ApplicationsSection` |
| `VALIDATING` | lokale Formularvalidierung, `normalizeDescriptionText`, Längenprüfung |
| `READY` | gültige manuelle Job-Referenz + vorhandene Beschreibung |
| `GENERATING` | `LetterModal.phase === "loading"` |
| `GENERATED` | `LetterModal.phase === "done"` + `letter`/`generatedText` |
| `EDITING` | `edited`/`letterDirty` + `handleLetterChange` |
| `SAVED_TO_SESSION` | `adoptionResult === "created" \| "updated"` + Repository-Update |
| `ERROR` | Formularfehler bzw. `LetterModal.phase === "error"`/`generationError` |

Fehlerverhalten:

- Beschreibung und manuelle Formularfelder bleiben bei Fehlern erhalten.
- Ein vorhandener Session-Entwurf wird bei fehlgeschlagener Generierung nicht
  gelöscht.
- `requestSeqRef`/`inFlightRef` verhindern, dass verspätete Antworten den
  aktuellen Entwurf überschreiben.
- Ein Abbruch schließt das Modal bzw. invalidiert die Sequenz; der laufende
  Fetch wird nicht aktiv abgebrochen, weil die bestehende Pipeline keinen
  `AbortController` für `/api/cover-letter` besitzt. Das ist bestehende
  Architektur und bleibt unverändert.

## 8. Sicherheit und Datenschutz

- Der eingefügte Ausschreibungstext ist untrusted content.
- `api/cover-letter.mjs` entfernt HTML/Script und behandelt den Text im Prompt
  ausdrücklich als Daten, nicht als Systemanweisung.
- Keine Ausführung von HTML, kein automatischer externer URL-Abruf.
- Keine Modellübertragung beim Einfügen, Speichern oder Öffnen.
- CV bleibt optional; nur ausdrücklich ausgewählte, verarbeitete und
  anonymisierte CV-Texte werden übertragen.
- Keine neue Persistenz; `SessionApplicationV1` bleibt in-memory.
- Keine RIS-/AWS-/Cognito-Änderung.
- Keine sensiblen Inhalte in Logs; bestehende Fehlerausgaben enthalten keine
  Request-Bodies.
- Der bestehende `application_storage`-Consent-Backend bleibt deaktiviert;
  die Session-Ablage ist keine dauerhafte Speicherung und darf nicht als
  solche dargestellt werden.

## 9. Test-Baseline und geplanter Testumfang

### Baseline vor Phase A

Ausgeführt auf `main` `7a4a64e`:

```text
npx vitest run \
  src/components/ApplicationsSection.test.tsx \
  src/components/LetterModal.test.tsx \
  src/lib/applications/applicationDomain.test.ts \
  src/lib/applications/sessionApplications.test.ts \
  src/lib/applications/sessionRepository.test.ts \
  tests/api/cover-letter.test.mjs --maxWorkers=2
```

Ergebnis: **143 passed**.

Zusätzlich:

- `npm run build` — PASS
- `node --check api/cover-letter.mjs` — PASS
- `git diff --check` — PASS

Es wurden keine echten KI-/Provider-/AWS-/RIS-/Apify-Aufrufe ausgeführt.

### Späterer Testumfang

Funktional:

- manuelle Ausschreibung einfügen,
- Bewerbung ohne KI anlegen,
- Anschreiben generieren,
- optionalen CV auswählen,
- Anschreiben bearbeiten,
- erneut generieren,
- als Bewerbung übernehmen,
- Bewerbung in der Session wiederfinden,
- Refresh der Liste nach Adoption.

Regression:

- bestehende Jobsuche,
- bestehende Anschreiben-Generierung,
- bestehende Bewerbungsverwaltung,
- CV-Verarbeitung,
- Suchprofile,
- Authentifizierung/Sitzungswechsel.

Sicherheit:

- kein Modellaufruf ohne Benutzeraktion,
- keine unberechtigte Persistenz,
- keine Datenübernahme zwischen Benutzern,
- keine Prompt-Injection-Ausführung,
- keine unkontrollierten URL-Abrufe,
- keine sensiblen Daten in Logs.

UI:

- 1440, 1024, 768, 390 und 320 px,
- kein horizontaler Overflow,
- Tastatur/Fokus/Fehlermeldungen.

## 10. Risiken und offene Fragen

1. **Contract-Änderung:** `originalUrl` muss für manuelle Quellen optional
   werden; ohne diese Änderung ist die gewünschte Bewerbung ohne URL nicht
   möglich. Empfohlen: `jobOrigin` + `originalUrl?` + Invariante
   „manual ⇒ keine URL“.
2. **Titel/Firma:** Eingabe optional, aber `api/cover-letter` verlangt
   nicht-leere Werte. Empfohlen: neutrale Fallbacks, keine Lockerung der
   API-Pflichtfelder.
3. **Beschreibungspersistenz:** `ApplicationJobReferenceV1` hat kein
   Beschreibungsfeld. Der eingefügte Text lebt im Session-Modal und geht nur
   an `/api/cover-letter`; nach dem Schließen ist er nicht mehr vorhanden.
   Das ist datenschutzfreundlich, muss aber als Produktentscheidung bestätigt
   werden.
4. **Refresh:** Ohne Refresh-Token bleibt die Bewerbungsliste nach einer
   Adoption stale. `navigateInApp("/profil?tab=applications")` early-returns
   bei identischer URL.
5. **Adoptions-Race:** App-Adoption und Section-Edit können parallel laufen;
   `findByJob` und der bestehende Versionsfehlerpfad sind einzuplanen.
6. **Auth/Gast:** `onAdoptAsApplication` wird nur bei `isAuth` übergeben.
   Der vollständige Adoptionsablauf ist damit authentifiziert; Gastverhalten
   und Session-Entwurf sind vor Phase B zu entscheiden.
7. **CoverLetterVersion:** Die bestehende Adoption legt keine neue
   `CoverLetterVersionV1` an. Für den direkten Flow ist zu entscheiden, ob
   das so bleibt oder ob eine explizite Version erzeugt werden soll.
8. **Manual-ID:** `jobId` muss stabil über Öffnen/Adoption bleiben; ein pro
   Klick neu erzeugter Wert würde Duplikate erzeugen.
9. **Source-Anzeige:** `SourceBadge` kennt derzeit nur `arbeitnow` und
   `arbeitsagentur`; `manual` braucht eine DE/EN-Anzeige.
10. **ApplicationLetterComparison:** Der Verbesserungspfad sendet aktuell
    `description: ""` und `url: ""`; für manuelle Bewerbungen geht der
    Stellenkontext verloren. Das ist kein Blocker für die direkte
    Generierung, aber ein Finding für spätere Verbesserungen.
11. **Kein CI-Schema-Gate:** Die JSON-Schema-Fixtures werden nicht automatisch
    gegen den Contract geprüft; Laufzeittests sind maßgeblich.
12. **Keine Live-Verifikation:** Es wurden keine echten Provider- oder
    Browser-E2E-Läufe in Phase A ausgeführt.

## 11. Entscheidung

**PHASE A: COMPLETE — STOP.**

Der bestehende `LetterModal`-/`/api/cover-letter`-Pfad ist vollständig
wiederverwendbar. Die minimale Integration besteht aus:

1. manuellem Job-Mapping mit `jobOrigin: "manual"`, synthetischer Session-ID
   und optionaler URL,
2. einem neuen Formular/Einstieg in `ApplicationsSection`,
3. einem optionalen `onOpenLetter`-Callback zu `App`,
4. einem Refresh nach Adoption,
5. Contract-/Validierungsanpassungen für die manuelle Stellenreferenz.

**Keine Implementierung vor Commander-Review dieses Berichts.**

**Keine RIS-/AWS-/Cognito-Änderung. Kein Push, Merge oder Deployment.**
