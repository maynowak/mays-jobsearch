# JOBMATCHER-ATS-WORKFLOW-TRACE-01 — ANALYSIS REPORT

Status: READ-ONLY ANALYSE (keine Code-, CSS-, API- oder Datenänderung)
Datum: 2026-10-13
Branch: main
Methode: Statische Code-Analyse (`file:line`) + gezielte Verifikation jedes
Kernbefunds. Kein Deployment. Kein Browser-Lauf für diese Analyse.

**Legende Teil 1:** IMPLEMENTED / REACHABLE / DISCONNECTED / NOT IMPLEMENTED
**Legende Teil 2:** AGREED / IMPLEMENTED / VERIFIED / BROKEN / MISSING

---

# TEIL 1 — ATS-WORKFLOW-TRACE

## 1. Was geschieht nach „Mit ausgewählten Skills fortfahren"?

Button `cv.skillSelectContinue` (`src/App.tsx:1869-1877`, Label `src/i18n.tsx:603`),
deaktiviert bei `selectedSkills.length === 0` (`src/App.tsx:1873`).
Handler: `handleSkillSelectionConfirm` (`src/App.tsx:821-857`).

**Verzweigung nach `cvState.processingGoal`:**

### Ziel `ats` (`src/App.tsx:829-849`) — der Standardfall
1. `saveCvAtsProfile(doc.hash, atsProfileName, cvState.selectedSkills, targetRoles)`
   (`src/App.tsx:833-840`; Helper `src/lib/cvProfileStore.ts:114-135`)
2. `step → "document-selected"` (`src/App.tsx:841-846`) → **Workflow-Dialog schließt**
3. Statusmeldung `cv.atsProfileSaved` (`src/App.tsx:847`)
4. `return` (`src/App.tsx:848`) → **es läuft hier KEINE ATS-Analyse**

Kommentar im Code bestätigt dies ausdrücklich (`src/App.tsx:825-828`):
„keine automatische Analyse mehr an dieser Stelle (ATS-Analyse laeuft pro
Treffer-Job, s. AtsOverlay)". Verifiziert durch Test `src/App.test.tsx:1028,1035`
(`analyzeATS` wird nicht aufgerufen).

### Ziel `ai-search` (`src/App.tsx:850-856`)
→ `runAiSearchWithProfile` (`src/App.tsx:859-936`): `/api/jobs` → `/api/match`
→ `step → "ai-complete"` bzw. `"error"`.

## 2./3. Die 13 Stepper-Stationen: Implementiert vs. erreichbar

Mapping `cvState.step → StepId`: `src/App.tsx:1537-1557`; Step-IDs:
`src/components/CvProcessingSteps.tsx:18-36`.
Alle `step:`-Setter verifiziert per `grep -o 'step: "[a-z-]*"'`:

| StepId | gesetzt durch | Setter (verifiziert) | Status |
|---|---|---|---|
| `document` | `document-selected` + Fallback | u. a. `App.tsx:843` | IMPLEMENTED / REACHABLE |
| `consent` | `consent-required` | `App.tsx:636` | IMPLEMENTED / REACHABLE |
| `anonymization` | `creating-profile` | `App.tsx:644`, `:688` | IMPLEMENTED / REACHABLE |
| `model` | `model-selection` | `App.tsx:1672`, `:2302` | IMPLEMENTED / REACHABLE |
| `profile` | `anonymizing`/`profile-ready` | `App.tsx:700`, `:748` | IMPLEMENTED / REACHABLE |
| `goal` | `goal-selection` (7×) | u. a. `App.tsx:1726`, `:1881` | IMPLEMENTED / REACHABLE |
| `skill` | `skill-selection` | `App.tsx:605`, `:811` | IMPLEMENTED / REACHABLE |
| `target` | `ats-processing` / `ats-model-recovery` | **Zirkulär**: `ats-model-recovery` nur in `runAtsProcessing:988`; `runAtsProcessing:938` wird nur aus dem Recovery-UI `App.tsx:2013` aufgerufen, das selbst nur aus `:988` erreichbar ist | DISCONNECTED |
| `processing` | `ai-searching` / `improving` | `ai-searching`: **nie gesetzt**; `improving` nur in `:1038` (Handler, dessen Button im unerreichbaren Block `:1890` liegt) | DISCONNECTED |
| `complete` | `improved`/`comparison`/`success` | `success`: **nie gesetzt**; die anderen nur in der unerreichbaren Verbesserungskette | DISCONNECTED |
| `improvement` | `improvement-selection` | **nie gesetzt** (grep: kein `step: "improvement-selection"`); Renderblock `:1890` verlangt `cvState.improvementRecommendations`, das nur `null` ist (`:133`) | DISCONNECTED |
| `reanalysis` | `reanalysis` | nur `:1122`; Aufrufer-Button `:1963` im unerreichbaren `improved`-Block | DISCONNECTED |
| `match-impact` | `match-impact-select` | nur `:2167`; Block verlangt `reanalysisResult`, gesetzt nur in `:1156` (unerreichbar) | DISCONNECTED |

**Weitere tote Schrittwerte** (gerendert, aber nie gesetzt): `consent-given`
(`App.tsx:1539`), `ai-searching` (`:1549`, gerendert `:2048-2053`), `success`
(`:1556`).

**Fazit Teil 1:** Von 13 Stationen sind **7 IMPLEMENTED/REACHABLE**
(document, consent, anonymization, model, profile, goal, skill).
Die Stationen `target`, `processing`, `complete`, `improvement`, `reanalysis`,
`match-impact` sind **DISCONNECTED** — sie existieren als Code, sind aber
nicht erreichbar.

## 4. Wie wird der ATS-Vergleich für einen konkreten Job geöffnet?

1. Button auf der Ergebniskarte: `src/components/MatchCard.tsx:83-92`,
   `onClick={() => onAtsEvaluate(m as Job)}` (`:87`), Label `match.atsEvaluate`.
   Ebenso auf `RemainingCard.tsx:184-193`.
2. Wiring: `Results` (`src/components/Results.tsx:14`) → App
   `onAtsEvaluate={(job) => setAtsJob(job)}` (`src/App.tsx:2454`).
3. Renderbedingung: `{atsJob && (activeAtsEntry || profile) && <ATSModal .../>}`
   (`src/App.tsx:2507`). `ATSModal` = `AtsOverlay` (`src/App.tsx:22`).
4. Profilübergabe (`src/App.tsx:2512-2523`): `activeAtsEntry` → synthetisches
   Profil `{ skills: activeAtsEntry.skills.join(", "), targetRoles, … }`,
   sonst das manuelle Suchprofil `profile`.
5. API-Aufruf (`src/components/AtsOverlay.tsx:53-58`):
   `analyzeATS({title, tags, slug}, { skills: profile.skills }, { enabled: false })`
   → `POST /api/ats-analysis` (`src/api.ts:375-386`, Body `{job, profile, ai}`).
6. Optionale KI-Eskalation nach Einwilligung + Modellwahl
   (`src/components/AtsOverlay.tsx:86-114`).

## 5. Woher stammen die Skills für diesen Vergleich?

**Verifizierte Kette:**
- `activeAtsEntry` = `listSourceLists.atsProfiles.find(e => e.id === activeAtsEntryId)`
  (`src/App.tsx:1285-1286`), Auswahl über `<select id="cv-saved-ats-profile">`
  (`src/App.tsx:1348-1360`).
- Diese ATS-Profile entstanden beim Skill-Step aus `cvState.selectedSkills`
  (`src/App.tsx:833-840`), also aus **bestätigten/eigenen Skills des CV-Workflows**.
- Nur `skills` gelangen an die API; `targetRoles` werden an der API-Grenze
  verworfen (`AtsOverlay.tsx:53`).

**Ergebnis:** Skills stammen entweder aus dem **gespeicherten ATS-Profil**
(durch den Skill-Step bestätigt) oder — wenn keines gewählt ist — aus dem
**manuellen Suchprofil**. Sie stammen *nicht* direkt aus `SuggestedProfile` und
*nicht* aus `cvState.cvProfile` (dort fließt nur `targetRoles` ein, `:838`).

**Speicherort-Warnung (verifiziert):** Die ATS-/Suchprofile liegen in einem
**Modul-Map im Arbeitsspeicher** (`src/lib/cvProfileStore.ts:43`,
`const buckets = new Map<string, CvListsBucket>()`), TTL 12 h (`:12`).
Kein localStorage/sessionStorage-Schreiber in `src/` → **Seiten-Reload verliert
alle gespeicherten Profile.**

## 6. Können fehlende Skills über CV-Markierungen ergänzt werden?

**NOT IMPLEMENTED.** Es existiert keine Markierungs-/Annotierungs-Funktion
(grep nach `cvMark|marking|annotation|extraSkills|manualSkills|customSkills`:
nur statische Erklärtexte in `AtsOverlay.tsx:208/217`).

Der einzige existierende Weg, einen nicht erkannten Skill zu ergänzen, ist das
Freitextfeld im Skill-Step (`src/App.tsx:1847-1864`, Enter-Handler `:1851-1859`).

## 7. Werden diese Ergänzungen gespeichert und später berücksichtigt?

**Ja — unter einer Bedingung.** Für Ziel `ats` fließen die ergänzten Skills in
`saveCvAtsProfile(...)` (`src/App.tsx:833-840`) und werden beim nächsten
Jobvergleich über `activeAtsEntry.skills` wieder verwendet (`src/App.tsx:2515`).
Voraussetzung: Der Benutzer wählt dieses ATS-Profil im CV-Bereich aus.
Für Ziel `ai-search` landen sie nur in `searchProfile.skills`
(`src/App.tsx:855`) und fließen in `/api/jobs` + `/api/match`, **nicht** in die ATS-Analyse.

## 8. Warum lassen sich Skills im Jobvergleich nicht bearbeiten?

`AtsOverlay` ist **read-only** bzgl. Skills (verifiziert):
- Props (`:12-17`): `job`, `profile`, `onClose`, `onAtsAnalyzed` —
  **kein** `onSkillsChange`, kein Setter.
- State (`:36-44`): nur `analysis, loading, error, showAI, consentGiven,
  aiLoading, aiError, models, selectedModel` — **kein Skill-State**.
- `profile` wird nur gelesen (`:47`, `:53`); alle Sektionen (`:532-540`) sind
  reine Anzeige.

Einziger Bearbeitungsweg: CV-Bereich → ATS-Profil → „Bearbeiten"
(`editSavedAtsProfile`, `src/App.tsx:587-610`) → zurück in `step: "skill-selection"`.

## 9. Vorhanden, aber nicht erreichbar / toter Code (verifiziert)

**Handler nur in unerreichbarem JSX:** `runAtsProcessing` (`:938`/`:2013`),
`handleImprovementSelectionChange` (`:1007`), `handleImprovementExecute` (`:1011`),
`handleImprovementBack` (`:1091`), `handleReanalysisExecute` (`:1102`),
`handleReanalysisBack` (`:1178`), `handleMatchImpactExecute` (`:1188`),
`handleMatchImpactBack` (`:1239`).

**`cvState`-Felder ohne Writer:** `profile` (nur `null`, `:127`/`:532`, wird aber
in `:1044/:1055/:1137/:1210` per `!` genutzt), `improvementRecommendations`
(nur `null`), `atsResult` (nur `:979`, unerreichbar), `beforeAtsResult`/`afterAtsResult`.

**API-Funktionen ohne Aufrufer:** `fetchCvImprovement` (`src/api.ts:450`),
`reanalyzeCv` (`:562`) — nicht im Import-Block von `src/App.tsx:5`.

**Prop ohne Aufrufer:** `onAtsAnalyzed` (`AtsOverlay.tsx:16`).

**Routing-Deadlock (verifiziert):** Der Client ruft `/api/v1/cv-improvement*`
(`src/api.ts:455,485,566,621`), deployed existiert aber `api/cv-improvement.mjs`
(→ `/api/cv-improvement`). `ls api/` zeigt **kein** `api/v1/`, `vercel.json`
enthält **keine** Rewrite dafür. Diese Aufrufe würden 404 liefern, falls sie
je erreichbar wären.

**Statusübersicht Teil 1**

| Funktion | Status |
|---|---|
| CV-Upload → Consent → Anonymisierung → Modell → Profil → Ziel → Skills | IMPLEMENTED / REACHABLE |
| Skills inkl. eigenem Zusatzskill (Enter) | IMPLEMENTED / REACHABLE |
| Speichern der bestätigten Skills als ATS-Profil (Speicher, 12 h) | IMPLEMENTED / REACHABLE |
| Pro-Job-ATS-Analyse (`POST /api/ats-analysis`) | IMPLEMENTED / REACHABLE |
| KI-Eskalation im ATS-Overlay (Einwilligung + Modell) | IMPLEMENTED / REACHABLE |
| ATS-Profil bearbeiten → zurück in Skill-Step | IMPLEMENTED / REACHABLE |
| CV-Markierungen zum Ergänzen von Skills | NOT IMPLEMENTED |
| Skill-Bearbeitung im ATS-Overlay | NOT IMPLEMENTED (read-only) |
| In-Workflow-ATS (`target` → `complete` → ATSModal) | DISCONNECTED |
| Verbesserungen (`improvement`, `improving`, `improved`) | DISCONNECTED |
| Re-Analyse (`reanalysis`, `comparison`) | DISCONNECTED |
| Match Impact (`match-impact-select`) | DISCONNECTED |
| `ai-searching`-Spinnerstep | DISCONNECTED (nie gesetzt) |

---

# TEIL 2 — PROFILE-HIERARCHIE & ATS-ZUORDNUNG

**Vorbemerkung:** Ein Report `PROFILE-HIERARCHY-06` existiert im Repository
**nicht** (`ls docs/reports/ | grep PROFILE-HIERARCHY` → 01, 02, 03, 04, 05).
Es wurden die vorhandenen Contracts 01–05 herangezogen; es wurden keine
neuen Zahlen oder Regeln erfunden.

## 1. Wo wird das aktive Suchprofil gewählt?

`<select id="cv-saved-search-profile">` (`src/App.tsx:1316-1332`), gebunden an
`selectedSavedSearchId` (`src/App.tsx:106`). **Rein im Speicher, keine Persistenz**
(kein localStorage-/sessionStorage-/Redis-Schreiber in `src/`).

## 2. Wie werden ATS-Profile einem Suchprofil zugeordnet?

**Sie werden es nicht.** Verifiziert in `src/lib/cvProfileStore.ts:24-35`:
```ts
interface CvAtsProfileEntry { id; name; savedAt; targetRoles: string[]; skills: string[]; }
interface CvProfileLists  { searchProfiles: CvSearchProfileEntry[]; atsProfiles: CvAtsProfileEntry[]; }
```
Kein `searchProfileId`, kein `parentId`, kein Fremdschlüssel — flache
Geschwister-Arrays pro CV-Hash-Bucket (`const buckets = new Map(...)`, `:43`).

Dokumentiert ebenso: `PROFILE-HIERARCHY-02-EXECUTION_LOG.md:28,46` („kein
Parent-Feld", „Geschwister") und `PROFILE-HIERARCHY-03-EXECUTION_LOG.md:126-129`.

## 3. Wo wird die Zuordnung gespeichert? Welche Datenform?

**Gar nicht** — es existiert kein Feld, das die Zuordnung speichern könnte.
Gespeichert werden nur zwei getrennte Listen je CV-Hash, im Arbeitsspeicher
(`src/lib/cvProfileStore.ts:43`, TTL 12 h `:12`). `localStorage`-Schlüssel
`mj-cv-lists:*` sind Altbestand und werden nur **gelöscht** (`:14`, `:144-157`).

## 4. Warum zeigt die ATS-Auswahl sämtliche ATS-Profile?

Verifiziert: Die Optionen entstehen direkt aus dem CV-Bucket, ohne jeden Bezug
zum gewählten Suchprofil:
```tsx
{listSourceLists.atsProfiles.map((entry) => (<option key={entry.id} value={entry.id}>…))}
```
(`src/App.tsx:1355-1359`, Bucket aus `:1284`). `selectedSavedSearchId` wird im
gesamten Block `:1344-1371` **nicht** referenziert. Auch das Suchprofil-Select
(`:1327`) liest denselben ungefilterten Bucket.
Dokumentiert in `PROFILE-HIERARCHY-03-EXECUTION_LOG.md:46-51` und
`PROFILE-HIERARCHY-04-EXECUTION_LOG.md:58-61` („Target fordert Parent-Filter").

## 5. Welche Höchstzahl ATS-Profile je SearchProfile wurde vereinbart?

**AGREED — genau eine dokumentierte Zahl: 1..5.**
`docs/reports/PROFILE-HIERARCHY-05-EXECUTION_LOG.md:17`:
„└── ATSSearchProfile [1..5] pro SearchProfile (geändert: war 1..10)";
`:8`: „ersetzt dort die Werte 10/10 für Search-/ATS-Ebene durch 2/5";
`:27-29`: Kapazität, kein Befüllungsgebot.
Status dort `:76`: „DECIDED". (PROFILE-HIERARCHY-04 nennt noch 1..10 und ist
durch 05 ersetzt.)

## 6. Wird diese Begrenzung technisch durchgesetzt?

**MISSING.** Einzige Grenze im Code: `MAX_ENTRIES_PER_LIST = 50`
(`src/lib/cvProfileStore.ts:15`), angewandt flach je Bucket (`:109`, `:132`),
**ohne Parent-Dimension**. Ein 2/5-Cap ist ohne die fehlende Datenbeziehung
nicht durchsetzbar. Ebenso dokumentiert: `PROFILE-HIERARCHY-05:63`,
`PROFILE-HIERARCHY-04:34-36` („technisch NICHT enforced").

## 7. Was passiert beim Wechsel des Suchprofils, wenn ein fremdes ATS-Profil gewählt ist?

**BROKEN — die Auswahl bleibt still bestehen.** Der einzige Reset-Effekt hängt
am **Dokument**, nicht am Suchprofil (`src/App.tsx:1290-1293`):
```tsx
useEffect(() => { setSelectedSavedSearchId(null); setActiveAtsEntryId(null); }, [listSourceDocId]);
```
`onChange` des Suchprofil-Selects setzt nur die eigene ID (`src/App.tsx:1323`).
Es existiert **kein** Effekt, keine Validierung und kein Guard, der
`activeAtsEntryId` an `selectedSavedSearchId` koppelt (grep bestätigt: keine
Verwendung von `selectedSavedSearchId` außerhalb `:561`, `:617`, Select,
Button-Disabled, Hinweis).

## 8. Nutzt der ATS-Jobvergleich das ausgewählte UND zugeordnete ATS-Profil?

**BROKEN — nur das ausgewählte, nie das zugeordnete.** Verifizierte Kette:
- `src/App.tsx:2507` Gate `atsJob && (activeAtsEntry || profile)`
- `src/App.tsx:2512-2523` `profile` = `activeAtsEntry ? { skills: activeAtsEntry.skills.join(", "), … } : profile`
- `src/components/AtsOverlay.tsx:53-58` nur `{ skills: profile.skills }`
- `src/api.ts:381` `POST /api/ats-analysis`

`selectedSavedSearchId` kommt in dieser Kette **nirgends** vor. Eine Kombination
„Search-Profil + sein ATS-Profil" ist im aktuellen Datenmodell nicht abbildbar.

## Statusübersicht Teil 2

| # | Thema | Status |
|---|---|---|
| 1 | Auswahl des Suchprofils (UI + State) | IMPLEMENTED (nur Speicher, nicht persistent) |
| 2 | Zuordnung SearchProfile → ATS-Profile | MISSING (kein Parent-Feld) |
| 3 | Speicherort/Form der Zuordnung | MISSING (es gibt keine Zuordnung) |
| 4 | ATS-Auswahl zeigt alle ATS-Profile des CV | VERIFIED |
| 5 | Höchstzahl ATS je SearchProfile vereinbart | AGREED (1..5, PROFILE-HIERARCHY-05) |
| 6 | Begrenzung technisch erzwungen | MISSING (nur flach 50/Bucket) |
| 7 | ATS-Auswahl bei Suchprofilwechsel | BROKEN (bleibt still stehen) |
| 8 | ATS-Vergleich nutzt zugeordnetes Profil | BROKEN (nur ausgewähltes ATS-Profil) |

---

## Offene Punkte / nicht verifiziert

- Es wurde **kein** Browserlauf und **kein** API-Request durchgeführt.
  Aussagen zu `/api/v1/cv-improvement*` beruhen auf Datei-/Rewrite-Prüfung
  (statisch verifiziert, nicht durch einen echten Request).
- Ein `PROFILE-HIERARCHY-06-EXECUTION_LOG.md` existiert im Repository nicht.
- Zur Laufzeit nicht verifiziert: Verhalten der ATS-Ansicht bei mehreren
  Dokumenten (die Bucket-Wahl nutzt `documents.find(d => d.selected) ?? documents[0]`,
  `src/App.tsx:1283`).

## Empfohlene nächste Schritte (nicht ausgeführt)

1. Datenmodell um `searchProfileId` in `CvAtsProfileEntry` erweitern und den
   Parent-Filter im Select (`src/App.tsx:1355`) sowie die Auflösung von
   `activeAtsEntry` (`:1285`) darauf ausrichten.
2. `activeAtsEntryId` beim Wechsel von `selectedSavedSearchId` invalidiieren.
3. Cap 2/5 in `cvProfileStore` durchsetzen.
4. `PROFILE-HIERARCHY-06` anlegen, sobald ein Entscheidungsstand vorliegt.
5. Die DISCONNECTED-Kette (Verbesserung → Re-Analyse → Match Impact) entweder
   verdrahten oder als nicht-realisiert kennzeichnen; zusätzlich die
   `/api/v1/cv-improvement`-Pfade an die realen Routen angleichen.

## Geänderte Dateien

Keine. Diese Analyse hat ausschließlich gelesen.
