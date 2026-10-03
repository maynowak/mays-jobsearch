# PROFILE-STATE-01

## Status
YELLOW

## Scope
Analysis only — no code changes

- Audit-Datum: 2026-10-03
- Branch: main, HEAD 5920e2f (zum Audit-Zeitpunkt)
- Scope: Ist-Analyse aller Profil-/CV-Zustände (Producer/Consumer/Storage/Lifetime/Delete/Owner je State, Duplikate, Read/Write-Graph, RIS-Grenze)
- KEIN Code geändert (kein Refactor, keine Konsolidierung, keine Umbenennung, keine API-/Persistenz-/Flow-Änderung, kein ProfileStore, keine Teständerung)
- Methode: Schreib-/Lesestellen-Verfolgung in `src/` und `api/` (grep + gezielte Lektüre). Reload-/Persistenz-Aussagen sind aus Code abgeleitet ("Code-inferred"). Keine Annahmen aus Namen; offenen Punkten ist explizit "unklar" zugeordnet.
- Vorbestehende Working-Tree-Änderungen (Screenshots unter `docs/screenshotsfordev/`, nicht von dieser Analyse): nicht angefasst, nicht gestagt, siehe Abschluss.

## Executive Finding

1. Es gibt faktisch ZWEI aktive Profil-Linien plus einen Legacy-Rest: (a) das manuelle App-Suchprofil (`App.profile`-State, `SearchForm`), (b) die CV-Linie (`cvState.cvProfile` = bestätigtes Profil, `cvState.suggestedProfile` = KI-Vorschlag, `Profile`-Typ), (c) `cvState.profile` = verwaister Legacy-State, der im CV-Flow nie befüllt wird (Kommentar `App.tsx:904-908` sagt das explizit) und nur noch als Fallback-Lesestelle sowie im toten Improvement-Pfad vorkommt.
2. `cvProfile` ist das bestätigte Arbeitsprofil des CV-Flows: erzeugt per User-Confirm in `CvProfileResult.onConfirm` (`App.tsx:1607-1624`), gelesen von Suche (`runCvSearch`, `runAiSearchWithProfile`), ATS (`runAtsProcessing`, per-Job-`ATSModal`), ATS-Profil-Saves und Namensvorschlägen. `suggestedProfile` ist der unbestätigte KI-Vorschlag (`SuggestedProfile`-Typ: `skills[]`, `experienceLevel`, `targetRoles[]`, `location`) plus Edit-Arbeitskopie für Skill-Step und Edit-Pfade — kein reines Wegwerf-Objekt, aber ohne Confirm wirkungslos.
3. "Search Profile" und "ATS Profile" sind im Code ZWEI verschiedene Dinge: (a) im 12h-Store gespeicherte benannte Listen-Einträge (`CvSearchProfileEntry { id, name, savedAt, profile: Profile }` vs. `CvAtsProfileEntry { id, name, savedAt, targetRoles, skills }`, Key = CV-Hash), (b) laufzeit-erzeugte API-Übergabeobjekte (`searchProfile` in `handleSkillSelectionConfirm`/`runAiSearchWithProfile`; per-Job-ATS-`profile`-Prop in `App.tsx:2281-2292`). Kein "Terminology mismatch" zwischen Repo und Doku gefunden — aber die Doppelbedeutung (gespeicherter Eintrag vs. Übergabeobjekt) ist eine reale Verwechslungsquelle.
4. Doppelte Repräsentationen (Fakt, keine Wertung): `doc.selected` ↔ `selectedDocumentIds` (zwei synchron gehaltene Auswahl-Abbilder mit gemischten Lesestellen); `cvProfile` ↔ gespeicherter `CvSearchProfileEntry.profile` (Snapshot-Kopie); `suggestedProfile.skills` ↔ `selectedSkills` (Vorschlag vs. bestätigte Auswahl); `atsProfile = cvProfile ?? profile` (Fallback-Kette an 4+ Stellen). `cvState.profile` ist die einzige echte tote Quelle (kein Schreiber im CV-Flow).
5. YELLOW, weil: (a) der Legacy-`profile`-State plus tote Improvement-Pfade (`improvement-selection`-Step unerreichbar, `improvementRecommendations` wird nie befüllt) irreführende Fallback-Ketten bilden; (b) die duale Dokument-Auswahl (`selected` + `selectedDocumentIds`) zwei divergierfähige Wahrheiten pflegt; (c) `saveCvSearchProfile`-Snapshots und `cvProfile`-Live-State ohne Sync-Protokoll auseinanderlaufen können (Edit überschreibt gezielt, sonst nicht).
6. Server-Grenze: Redis `cv-profile:<hash>` ist ein reiner KI-Ergebnis-Cache (Producer/Consumer = `POST /api/profile`, Payload = `SuggestedProfile`, 30 Tage TTL, kein Delete, kein Bezug zum 12h-Store). `analyzeJobForAts` (`api/_lib/ats.mjs:345`) ist eine pure lokale Regelfunktion ohne Storage.

## State Inventory

Typen (`src/types.ts`): `Profile { skills: string, targetRoles: string[], city: string, radiusKm: number|null, workModes, employmentTypes }` (`:42-49`); `SuggestedProfile { skills: string[], experienceLevel: string, targetRoles: string[], location: string }` (`:51-56`); `CvDocument { id, name, size, selected: boolean, file: File, skills?: string[], hash?: string|null }` (`:281-293`).
App-States: `profile: Profile` (manuell, `App.tsx:67-74`); `cvState: CvProcessingState` (`:99-127` mit `profile`, `cvProfile`, `suggestedProfile`, `documents`, `selectedDocumentIds`, `selectedSkills`, `atsResult`, `aiSearchResult`, Improvement-/Reanalysis-/MatchImpact-Felder); `activeAtsEntryId`, `selectedSavedSearchId`, `atsProfileName`, `profilesDocId`, `atsJob` (Auswahl-/UI-States).

| State | Kurzbefund |
|---|---|
| `cvState.profile` | Legacy/Orphan — kein Schreiber im CV-Flow, nur Fallback-Leser + toter Improvement-Pfad |
| `cvState.cvProfile` | Bestätigtes CV-Arbeitsprofil (`Profile`-Typ), zentrale Quelle für Search/ATS |
| `cvState.suggestedProfile` | Unbestätigter KI-Vorschlag (`SuggestedProfile`-Typ) + Edit-Arbeitskopie |
| `cvState.documents` / `selectedDocumentIds` | Dokumentenliste (mit `File`, `selected`-Flag, `hash`) + paralleles Auswahl-Array |
| Search Profile (gespeichert) | `CvSearchProfileEntry` im 12h-Store (Snapshot von `cvProfile` + Name) |
| Search Profile (Übergabe) | Laufzeit-`Profile`-Objekte an `fetchJobs`/`fetchMatches` |
| ATS Profile (gespeichert) | `CvAtsProfileEntry` im 12h-Store (`{ name, targetRoles, skills }`, KEIN volles `Profile`) |
| ATS Profile (Übergabe) | Per-Job-`profile`-Prop an `AtsOverlay` (aus aktivem Eintrag ODERmanuellem Profil) |
| 12h-Store | Modul-`Map<hash, bucket>` (`src/lib/cvProfileStore.ts`), 12h-Fenster, In-Memory |
| Redis `cv-profile:<hash>` | Server-KI-Cache (`SuggestedProfile`, 30 Tage), kein Delete |
| `ats.mjs`-Regelwerk | Stateless-Funktionen, kein Zustand |
| Improvement-/Reanalysis-/MatchImpact-Felder | Ergebnis-States; `improvement-selection`-Pfad tot (s.u.) |

## Source-of-Truth Analysis

```
CV-PDF (File, documents[].file)
 ↓ handleCvUploadStart / handleAddCvFiles
CvDocument { id, name, size, selected, file } (+ hash spaeter)
 ↓ Consent → createProfileFromPdf(): extractPdfText → anonymizeText → normalizeText → sha256Hex
POST /api/profile { text, hash?, model? } ──→ Redis-Read cv-profile:<hash> (Treffer? antworten : KI-Call → Redis-Write, 30d)
 ↓ SuggestedProfile { skills[], experienceLevel, targetRoles[], location }
cvState.suggestedProfile (Vorschlag, unbestätigt)
 ↓ CvProfileResult: User editiert (Skills/Rollen/Ort/Radius/Name) → onConfirm(profile: Profile, name)
 ├─→ cvState.cvProfile = profile            (BESTÄTIGTES Arbeitsprofil, Profile-Typ)
 └─→ saveCvSearchProfile(hash, name, profile) → 12h-Store-Snapshot (CvSearchProfileEntry)
       ↓ goal-selection → skill-selection (selectedSkills = Confirm der suggested-Skills)
       ├─ ATS-Ziel:  saveCvAtsProfile(hash, name, selectedSkills, targetRoles) → 12h-Store (CvAtsProfileEntry)
       │              danach Workflow-Schluss; Analyse spaeter pro Job (AtsOverlay)
       └─ KI-Suche:  searchProfile = { ...baseProfile(cvProfile ?? profile), skills: JSON(selectedSkills) }
                      → fetchJobs → fetchMatches → aiSearchResult / matches
```

Manuelle Linie (unabhängig): `SearchForm ↔ App.profile ↔ runSearch/fetchJobs/fetchMatches/dataset` (`App.tsx:244-291,1215-1224`), `LetterModal`-Profil (`:2268`), `AlertCard`-Profil. Einzige Brücke CV→manuell: `startSearchWithSavedProfile` (`:579-590`: gespeicherter Eintrag → `handleProfileChange` + `handleSubmit`) und `setProfile(improvedProfile)` im toten Improvement-Pfad (`:1044`).

## cvProfile

- Erzeugt/bestätigt: ausschließlich User-Confirm in `CvProfileResult.onConfirm` (`App.tsx:1607-1624`: `cvProfile: profile, step: "goal-selection"`; parallel `saveCvSearchProfile` + `setSelectedSavedSearchId`). Kein anderer Schreiber außer Merge-Pfad (`handleSearchWithSelectedCvs`, `:626-637`: `cvProfile ?? profile` + Skill-Merge aus `doc.skills`) und Edit-Pfad (`editSavedSearchProfile`, `:522-548`: Eintrag → `suggestedProfile`-Rebuild + `cvProfile: entry.profile`).
- Gelesen: `runCvSearch` (`:298`: `submittedOverride ?? cvState.cvProfile`), `runAtsProcessing` (`:909`), `handleGoalExecute`-Namensvorschlag (`:767`), `handleSkillSelectionConfirm` (`:803`, `:819`), `handleSearchWithSelectedCvs`/`handleCvProcess`-Kette (`:626`), ATS-Render-Gates (`:1925-1936`), `CvProfilesOverlay`-Lesestellen indirekt via Store.
- Verändert: nur durch neues Confirm / Edit-Sprung / Merge / Reset (`handleCvRemoveData`, `:479-518`: `cvProfile: null`).
- Consumer-Features: Jobsuche JA, ATS JA (Workflow + per-Job-Overlay via Fallback-Kette), CV-Improvement NEIN (nutzt `cvState.profile`, s.u.), Reanalysis NEIN, Match-Impact NEIN (beide `cvState.profile`-basiert), ATS-Profil-Save JA (TargetRoles-Quelle), Search-Profil-Save JA (Snapshot-Ursprung).
- Befund: `cvProfile` ist faktisch das "confirmed CV profile" des aktiven Workflows — aber NICHT Quelle für die Legacy-Improvement-Pfade.

## profile

- Zwei verschiedene `profile`-Begriffe, strikt trennen: (1) App-Level `profile`-State (`App.tsx:67-74`, manuelles Suchformular; Schreiber `runSearch` `:247`, `handleProfileChange` `:360-361`, `setProfile(improvedProfile)` `:1044`; Leser `SearchForm`, `dataset`-Vergleiche, `LetterModal :2268`, per-Job-ATS-Fallback `:2291`). (2) `cvState.profile` (`types.ts:347`).
- `cvState.profile`: KEINE Schreibstelle im CV-Flow gefunden (Initial `null` `:107`, Reset `null` `:497`; kein `cvState.profile = <Wert>` in irgendeinem `setCvState`-Aufruf außer Reset). Nur Lesestellen: Fallbacks `cvState.cvProfile ?? cvState.profile` (`:626, :819, :909, :1925-1936`) — wegen stets-`null` faktisch wirkungslos — sowie der Improvement-Komplex (`:999, :1009, :1020, :1068, :1080-1081, :1095, :1102, :1174-1175`: `originalProfile`-Kopie, `applyCvImprovement({ profile: cvState.profile! ... })`, Reanalysis- und MatchImpact-Jobs aus `cvState.profile`).
- Fachliche Bedeutung heute: Legacy-State ohne Producer. Der Code kommentiert das selbst: "cvState.profile ist ein verwaister Legacy-State, der im CV-Flow nie befüllt wird" (`App.tsx:904-908`), "Legacy-Fallback cvState.profile" (`:818`).
- Wird es benötigt? Im CV-Flow nein (Fallbacks greifen nie). Der Improvement-/Reanalysis-/MatchImpact-Komplex hängt an ihm und ist dadurch ohne vorgeschalteten Befüller wirkungslos (zusätzlich ist `improvement-selection` unerreichbar, s.u.). KEINE Löschungsempfehlung (Analysis only) — nur Befund.

## suggestedProfile

- Entstehung: `createProfileFromPdf` (`App.tsx:702-716`: `POST /api/profile` via `createProfile(normalized, model, hash)` → `setCvState({ suggestedProfile, step: "profile-ready" })`). Input = normalisierter (ggf. anonymisierter) CV-Text; Hash dient Server-Cache-Key.
- Transformation: `CvProfileResult` baut daraus per User-Edit ein `Profile` (`confirm()`, `CvProfileResult.tsx:50-63`: `skills: formatSkills(parsedSkills)`, `targetRoles: parseTargetRoles(...)`, `city`, `radiusKm`, Defaults `workModes: []`, `employmentTypes: ["full_time"]`; `experienceLevel` wird NICHT übernommen — stiller Feldverlust, dokumentiert als Befund).
- Confirm-Verhältnis: `suggestedProfile` (Vorschlag, `SuggestedProfile`-Typ) → `cvProfile` (Bestätigung, `Profile`-Typ). Unterschiedliche Typen, unterschiedliche Semantik: NICHT redundant. `suggestedProfile` bleibt nach Confirm erhalten (Kommentar `:1620-1621`: Skill-Step braucht die extrahierten Skills; `selectedSkills`-Init `:778` liest daraus).
- Verhältnis Search-Profil: `cvProfile` (nicht `suggestedProfile`) wird als `CvSearchProfileEntry.profile` gespeichert; `suggestedProfile.targetRoles/skills` dienen nur als Fallback-Leser (`:767, :803, :912, :918, :1080-1081`).
- Verhältnis ATS-Profil: `suggestedProfile` liefert Fallback-Rollen/Skills für ATS-Namensvorschlag, ATS-Job-Tags und Reanalysis-Job (`:767, :912, :918, :1080-1081`).
- Löschpfad: `onBack` (`:1625-1633`: `suggestedProfile: null`), `handleCvRemoveData` (`:498`), Doc-Wechsel implizit NICHT (bleibt bis Back/Remove — Befund, keine Wertung).

## Documents / Selection

- Hinzufügen: `handleCvUploadStart` (`App.tsx:399-418`: einzelnes File, `selected: true`, `selectedDocumentIds + id`, max 10) und `handleAddCvFiles` (`:420-446`: `selected: false`, max 10). Produzenten-UI: `CvDocumentList` (`onAddFiles(files)` ohne Skills — `:50`; Prop-Typ `:9` ohne Skills-Parameter).
- Entfernen: einzeln `handleRemoveCvDocument` (`:461-474`) oder alles via `handleCvRemoveData` (`:479-518`: `documents: []`).
- Auswahl = DOPPELT repräsentiert: `doc.selected` (Boolean je Dokument; gelesen `:523, :553, :580, :593, :615, :1244`, UI-Checkboxen `CvDocumentList.tsx:110-116`) UND `selectedDocumentIds: string[]` (gelesen `:643` Consent-Accept, `:765, :795` Skill/ATS-Pfade, `:1603, :1610` Confirm/Save). Schreiber halten beide synchron (`:411, :454-456, :468-470`), aber Leser sind gemischt — zwei divergierfähige Wahrheiten ohne Sync-Garantie über alle Pfade (Befund, keine Wertung).
- `CvDocument`-Felder: `id` (generiert), `name`, `size`, `selected`, `file` (Original-Blob, nie serialisiert), `skills?` (optional — real nie befüllt, da einziger Aufrufer keine übergibt; Merge in `:619-621` läuft damit faktisch leer), `hash?` (SHA-256 des normalisierten Texts, gesetzt `:694-697`; Schlüssel für 12h-Store + Server-Cache).
- Mehrere CVs: max 10; Profil-Erstellung nutzt NUR das erste gewählte Dokument (`createProfileFromPdf(doc)`); Skill-Merge über `doc.skills` ist wirkungslos (s.o.); Listen sind pro Hash (= pro CV-Inhalt) getrennt; `listSourceDoc` = erstes `selected` Dokument (`:1244`) mit Reset der Auswahl-IDs bei Quellwechsel (`:1251-1254`).
- Verbindung Dokument→Profil: nur via `hash` (Listen-Key) und via einmaliger Text→KI-Transformation; danach keine lebende Verknüpfung (Profil textunabhängig editierbar).

## Search Profile

- Gespeicherte Form: `CvSearchProfileEntry { id (entry-<ts>-<rand>), name, savedAt, profile: Profile }` (`cvProfileStore.ts:17-22`); CRUD: `saveCvSearchProfile` (Upsert je Name, max 50, `:91-112`), `readCvProfileLists` / `findSavedSearchProfile` (`:72-89`), `resetCvProfileLists` (`:138-140`). Key = CV-Hash, Fenster = 12h ab erstem Save ohne Verlängerung.
- Übergabe-Form: volles `Profile` (`skills, targetRoles/targetRole, city, radiusKm, workModes, employmentTypes`) an `fetchJobs`/`fetchMatches` (`api.ts:222,238`), an `dataset.profile` (`App.tsx:331`), an `runAiSearchWithProfile(searchProfile)` (`:824-827`: `searchProfile = { ...baseProfile, skills: JSON.stringify(selectedSkills) }` — Skills als JSON-Array-String statt Kommaliste, Befund).
- Consumer: manuelle Suche (`runSearch`), CV-Suche (`runCvSearch` — liest `cvProfile` direkt, NICHT den Store), gespeicherter Start (`startSearchWithSavedProfile` `:579-590` → `handleProfileChange` + `handleSubmit`, d.h. Umweg über manuelles Profil), Edit (`editSavedSearchProfile` `:522-548`).
- Identisch mit `cvProfile`? Nein: gespeicherter Eintrag = benannter SNAPSHOT (Kopie zum Save-Zeitpunkt + Name/ID/`savedAt`); `cvProfile` = lebender Arbeitsstand. Nach dem Speichern laufen beide ohne Sync auseinander (erneutes Confirm mit gleichem Namen überschreibt; sonst nicht). Unterschiedliche Rollen: Arbeitskopie vs. Ablage.

## ATS Profile

- Gemeint ist im Code EINE Benutzerdatenstruktur — nicht Analyse, nicht Quelle: gespeicherter Eintrag `CvAtsProfileEntry { id, name, savedAt, targetRoles: string[], skills: string[] }` (`cvProfileStore.ts:24-30`) — beachte: KEIN volles `Profile` (kein city/radius/workModes/employmentTypes).
- Gespeichert: 12h-Store pro CV-Hash (`saveCvAtsProfile`, `:114-135`, Upsert je Name, max 50).
- Erzeugt: `handleSkillSelectionConfirm` im ATS-Ziel (`App.tsx:794-814`) aus `selectedSkills` + `cvProfile/suggestedProfile`-Rollen + `atsProfileName` (Vorschlag `<Rolle> - ATS<n>`, `:764-768`).
- Gelesen: Auswahl-Dropdown (`:1305-1332`), Edit (`editSavedAtsProfile` `:552-575`: rebuildet `suggestedProfile` + `selectedSkills` aus Eintrag), per-Job-Overlay (`activeAtsEntry`, `:1246-1247` → `profile`-Prop `:2281-2292`: `{ skills: join(", "), targetRoles, city: "", radiusKm: null, workModes: [], employmentTypes: ["full_time"] }`).
- Rolle `ats.mjs`: KEIN State — `analyzeJobForAts(job, profile)` (`api/_lib/ats.mjs:345`, mit `extractRequirementsFromJob :167`, `matchRequirement :311`) ist eine pure deterministische Regelfunktion (Skadden — Befund: keine Persistenz, kein Benutzerzustand). Das "ATS Profile" (Benutzerzustand) vs. "ATS Analysis" (Ergebnis) vs. "ATS Sources" (Jobquellen) sind drei getrennte Begriffe — kein Terminology-Mismatch in Doku vs. Code gefunden, aber die Nähe der Namen ist verwechslungsträchtig (Befund, keine Umbenennung).
- Mehrere Repräsentationen: JA — (1) Store-Eintrag `{targetRoles, skills}`, (2) Übergabe-`Profile` ans Overlay, (3) `selectedSkills`-Arbeitskopie im Step, (4) `atsProfileName`-String-State. (1)→(2) via Join, (1)→(3) via Kopie im Edit.

## 12h Profile Store

- Datei: `src/lib/cvProfileStore.ts` (vollständig verifiziert; Details s. PERSISTENCE-BOUNDARY-01).
- API: `readCvProfileLists(hash, now?)`, `findSavedSearchProfile(lists, id)`, `saveCvSearchProfile(hash, name, profile)`, `saveCvAtsProfile(hash, name, skills, targetRoles)`, `resetCvProfileLists()`, `purgeLegacyCvListsFromLocalStorage()`; Konstante `CV_LISTS_TTL_MS = 12h`; `MAX_ENTRIES_PER_LIST = 50`.
- Key: SHA-256 des anonymisierten/normalisierten CV-Textes (`doc.hash`). Datenstruktur: `Map<hash, { searchProfiles[], atsProfiles[], expiresAt }>` (In-Memory, festes Fenster, Lazy-Purge, keine Verlängerung).
- Beziehungen: React-State → Store (nur Writes: Save/Confirm-Pfade; Reads: Edit-/Start-/Dropdown-Pfade). Store → Redis: KEINE (kein Import, kein Call — zwei unabhängige Systeme mit zufällig gleichem Schlüsselkonzept Hash). Store → Server-Cache: KEINE Beziehung (Server-Cache speichert `SuggestedProfile` aus KI-Antwort; Store speichert user-benannte Snapshots).

## Redis

- Key `cv-profile:<hash>`: einziger Fundort `api/profile.mjs:9` (Key-Bildung), `:99-104` (Read: Treffer → Antwort ohne KI-Call), `:140-142` (Write nach erfolgreichem Parse). Hash-Validierung `:12-14` (`/^[a-f0-9]{32,128}$/`); ohne gültigen Hash kein Cache-Zugriff (Bypass, kein Fehler).
- Producer: `POST /api/profile`-Handler nach KI-Erfolg. Consumer: derselbe Handler vor KI-Call. Payload: geparstes `SuggestedProfile`-ähnliches Objekt `{ skills[], experienceLevel, targetRoles[], location }` (`parseProfile`, `:44-70`) — NICHT `Profile`-Typ (kein city/radius/workModes/employmentTypes), NICHT benannt, KEINE IDs.
- TTL: `CV_PROFILE_CACHE_TTL_SEC = 30 Tage` (`:6`). Delete: KEINS (kein `cacheDel`, kein Ablauf-Endpoint). Verhältnis Browser-State: entkoppelt — Browser kennt nur den Hash; nach Reload ist der Cache ohne Hash-Wissen nicht auffindbar. Verhältnis 12h-Store: keines (s.o.).
- Einordnung: reiner Server-KI-Ergebnis-Cache (Kosten-/Latenz-Optimierung bei Re-Upload identischer CVs), KEIN serverseitiges Profil-Store (keine Namen, keine Listen, keine User-Zuordnung, kein Update/Delete-Protokoll).

## Ownership Matrix

| State | Fachliche Bedeutung | Producer | Consumer | Storage | Lifetime | Delete | Current Owner | Redundant? |
|---|---|---|---|---|---|---|---|---|
| App.`profile` (manuell) | Manuelles Suchformular | Nutzer via `SearchForm`; `runSearch` | `fetchJobs`/`fetchMatches`, `dataset`, `LetterModal`, ATS-Fallback | React-State | Sitzung (Code-inferred) | Implizit (Überschreiben) | Nutzer-Sitzung (manuelle Linie) | Nein (eigene Linie) |
| `cvState.profile` | Legacy-Rest, nie befüllt | KEINER (nur Initial/Reset) | Fallback-Leser (wirkungslos) + toter Improvement-Pfad | React-State | Sitzung | `handleCvRemoveData` | Niemand (orphan) | Ja — tot; Fallbacks decken `cvProfile` |
| `cvState.cvProfile` | Bestätigtes CV-Arbeitsprofil | Nutzer-Confirm (`onConfirm`) | Suche, ATS (Workflow + per-Job), Profil-Saves | React-State | Sitzung | `handleCvRemoveData`; Neu-Confirm | Nutzer-Sitzung (CV-Linie) | Nein (Primärquelle der CV-Linie) |
| `cvState.suggestedProfile` | KI-Vorschlag + Edit-Basis | `createProfileFromPdf` via `/api/profile` | `CvProfileResult`, Skill-Step-Init, Fallback-Leser, Edit-Pfade | React-State | Sitzung (bis Back/Remove) | `onBack`; `handleCvRemoveData` | KI-Vorschlag + Nutzer-Edit | Nein (eigener Typ/Semantik; `experienceLevel` geht bei Confirm verloren) |
| `documents` | CV-Ablage (File + Meta) | Upload-Handler | Auswahl-, Hash-, Listen-, Consent-Pfade | React-State | Sitzung | Einzel-Remove; `handleCvRemoveData` | Nutzer-Sitzung | Teilweise (`selected` ↔ `selectedDocumentIds`) |
| `selectedDocumentIds` | Auswahl-Abbild (Array) | Upload/Select/Remove-Handler | Consent-, Skill-, ATS-, Confirm-Pfade | React-State | Sitzung | `handleCvRemoveData`; Deselect | Nutzer-Sitzung | Ja — Parallelabbild zu `doc.selected` |
| `doc.selected` | Auswahl-Abbild (Flag) | dto. | Listen-Quell-Doc, Dropdowns, Zählungen | React-State (je Doc) | Sitzung | dto. | Nutzer-Sitzung | Ja — s.o. (Leser gemischt) |
| `doc.hash` | Inhalts-Identität | `sha256Hex` in `createProfileFromPdf` | Store-Key, Listen-Lookups | React-State (je Doc) | Sitzung | `handleCvRemoveData` | Abgeleitet (deterministisch) | Nein |
| `doc.skills` | (Platz für) Mehrfach-CV-Skills | `handleAddCvFiles(files, skills?)` — real nie mit Skills aufgerufen | `handleSearchWithSelectedCvs`-Merge | React-State (je Doc) | Sitzung | `handleCvRemoveData` | Niemand (ungefüllt) | Leer — Merge wirkungslos |
| `selectedSkills` | Bestätigte Skill-Auswahl | Skill-Step (Init aus `suggestedProfile`) | ATS-Save, KI-Suche (`searchProfile`) | React-State | Sitzung (Step-Dauer+) | Step-Back-Reset; `handleCvRemoveData` | Nutzer-Auswahl | Abgeleitet (Snapshot aus Vorschlag + Edit) |
| Gespeichertes Search-Profil | Benannter Profil-Snapshot | Confirm/Edit-Save | Start-, Edit-, Dropdown-Pfade | 12h-Store (Memory) | 12h-Fenster / Sitzung | Ablauf; `resetCvProfileLists` | Nutzer (benannt) | Snapshot von `cvProfile` (kein Live-Sync) |
| Gespeichertes ATS-Profil | Benannter Skill/Rollen-Satz | Skill-Confirm (ATS-Ziel) | ATS-Dropdown, Edit, per-Job-Overlay | 12h-Store (Memory) | 12h-Fenster / Sitzung | dto. | Nutzer (benannt) | Teilmenge-Ableitung (kein volles `Profile`) |
| `activeAtsEntryId` / `selectedSavedSearchId` | Listen-Auswahl (UI) | Dropdowns; Doc-Wechsel-Reset | Overlay-Profil, Start, Edit | React-State | Sitzung | `handleCvRemoveData`; Quellwechsel-Reset | UI-State | Nein (Zeiger, keine Daten) |
| `atsResult` / `aiSearchResult` / `matches` / `dataset` | Ergebnisse | API-Calls | Render, Re-Use (`dataset`) | React-State | Sitzung | `handleCvRemoveData` (teilw.) | Abgeleitet (Cache des Aufrufs) | Nein |
| Improvement-/Reanalysis-/MatchImpact-Felder | Legacy-Verbesserungsfluss | `applyCvImprovement` etc. (Eingang `cvState.profile`!) | Vergleichs-Render | React-State | Sitzung | `handleCvRemoveData` | Toter Pfad (ohne Befüller) | Unklar — Einstieg `improvement-selection` unerreichbar |
| Redis `cv-profile:<hash>` | KI-Ergebnis-Cache | `/api/profile` nach KI-Erfolg | `/api/profile` vor KI-Call | Upstash Redis | 30 Tage | Nur TTL | Server (inhaltsadressiert) | Cache (kein Store) |
| `ats.mjs`-Funktionen | ATS-Regelwerk | Code (kein Laufzeit-State) | `analyzeATS`-Pfade, Overlay | — (pure Funktionen) | — | — | Code | Nein |

## Duplication Matrix

| Beziehung | Einordnung |
|---|---|
| `cvProfile` ↔ `profile` (`cvState`) | `profile` tot — kein Duplikat, sondern Orphan; Fallbacks `cvProfile ?? profile` wirkungslos |
| `cvProfile` ↔ `suggestedProfile` | Abgeleitet + bestätigt: Vorschlag (`SuggestedProfile`) vs. Bestätigung (`Profile`); Typ- und Semantikwechsel beim Confirm; `experienceLevel` fällt weg (Befund) |
| `cvProfile` ↔ Search-Profil (gespeichert) | Snapshot: Eintrag = Kopie zum Save-Zeitpunkt + Name/ID/`savedAt`; danach kein Sync |
| Search-Profil ↔ ATS-Profil (gespeichert) | Unabhängig: volles `Profile` vs. `{targetRoles, skills}`-Teilmenge; getrennte Listen, getrennte Entstehung (Confirm vs. Skill-Confirm) |
| `documents` ↔ Profile | Abgeleitet-einmalig: Dokument → (Text→KI→Confirm) → Profil; danach entkoppelt |
| `doc.selected` ↔ `selectedDocumentIds` | Doppelt: zwei synchron gehaltene Auswahl-Abbilder, gemischte Leser — echte doppelte Source |
| `suggestedProfile.skills` ↔ `selectedSkills` | Vorschlag vs. bestätigte Auswahl (Init-Kopie + Nutzer-Edit); fachlich getrennt, kein Duplikat |
| 12h-Store ↔ React-State | Ablage vs. Arbeitskopie: Store = benannte Snapshots, State = Live-Arbeit; nur punktuelle Syncs (Save/Edit/Start) |
| 12h-Store ↔ Redis | Unabhängig: gleiche Schlüsselidee (Hash), disjunkte Inhalte/Produzenten/Leser/TTL — kein Spiegel, kein Sync |
| App-`profile` ↔ `cvProfile` | Unabhängig: zwei Linien (manuell vs. CV); einzige Brücken: `startSearchWithSavedProfile`, toter `setProfile(improvedProfile)` |
| `doc.skills`-Merge ↔ `cvProfile.skills` | Leer: Merge-Quelle nie befüllt — faktisch keine Zusammenführung mehrerer CVs |

## Read/Write Graph

```
[Manuell] SearchForm.value ── onChange ──▶ App.profile ── handleSubmit ──▶ runSearch ──▶ fetchJobs/fetchMatches
      ▲                                                                              dataset ──▶ Rematch-Vergleich
      │ startSearchWithSavedProfile (einzige Brücke CV→manuell)
      │
[CV] Upload ──▶ documents[] ── Consent ──▶ createProfileFromPdf ──▶ /api/profile ──▶ suggestedProfile
      │                                        (Redis-Cache davor/dahinter)                │
      │                                                                                   │ Confirm (CvProfileResult)
      │                                                                                   ▼
      │                                                              cvProfile ◀══ Edit-Sprung (Eintrag → cvProfile)
      │                                                                  │
      │                                              ┌───────────────────┼───────────────────┐
      │                                              ▼                   ▼                   ▼
      │                                        runCvSearch     skill-selection        ATS-Namensvorschlag
      │                                        (direkt)       (selectedSkills)              │
      │                                                             │                       │
      │                                              ┌──────────────┴──────────────┐        │
      │                                              ▼                             ▼        │
      │                                   saveCvAtsProfile              searchProfile ──▶ runAiSearchWithProfile
      │                                   (ATS-Ziel)                    (JSON-skills)
      │                                              │
      │                                              ▼
      │                                   12h-Store (Search-/ATS-Listen, pro Hash)
      │                                              │
      │                        ┌─────────────────────┼─────────────────────┐
      │                        ▼                     ▼                     ▼
      │                 Dropdown-Auswahl      Edit-Pfade            per-Job ATSModal
      │                 (IDs = UI-State)      (Eintrag → State)     (activeAtsEntry ?? App.profile)
      │
[TOT] cvState.profile ──▶ (kein Producer) ──▶ Improvement/Reanalysis/MatchImpact (Einstieg unerreichbar)
```

## Historical Rework Findings

- `cvProfile` vs. Legacy-`profile`: ECHTE tote Zweitquelle. Beleg: kein Schreiber (`App.tsx`-Volltextsuche: nur Initial `:107` + Reset `:497`), Code kommentiert Orphan-Status selbst (`:904-908`, `:818`). Fallback-Ketten (`?? cvState.profile`) an `:626, :819, :909, :1925-1936` sind damit leere Hüllen. Unterschiedliche fachliche Zustände scheiden aus — `profile` hat gar keinen Zustand.
- `documents` vs. erwartete `documents`: Befund aus ATS-PROFILE-INVESTIGATION-01 (Auswahl-IDs zeigten nach Doc-Wechsel auf fremde Listen) ist per `listSourceDocId`-Effekt (`App.tsx:1249-1254`: Reset beider Auswahl-IDs bei Quellwechsel) adressiert — verifiziert im Code, keine neue Wertung.
- `selectedDocumentIds`: ECHTE Doppelquelle neben `doc.selected` (s. Duplication Matrix). Beleg: parallele Pflege (`:411, :454-456, :468-470`) bei geteilten Lesern (`selectedDocumentIds`-Leser `:643, :765, :795, :1603, :1610` vs. `d.selected`-Leser `:523, :553, :580, :593, :615, :1244`).
- `suggestedProfile`: KEIN Duplikat, sondern eigener fachlicher Zustand (Vorschlag vs. Bestätigung, eigener Typ). Beleg: Typwechsel beim Confirm (`SuggestedProfile` → `Profile`, `CvProfileResult.tsx:50-63`), fortgesetzte Leser nach Confirm (`:778`, Edit-Pfade).
- Improvement-Komplex: `improvementRecommendations` wird NIE befüllt (nur Initial/Reset/Null-Leser `:113, :503, :988, :1011, :1060`); Step `improvement-selection` hat KEINEN Einstiegs-Schreiber (Suche nach `step: "improvement-selection"`-Setzern: null Treffer; nur Render-Gate `:1783` + Typ `:276`). `handleImprovementExecute`/`handleReanalysisExecute`/`handleMatchImpactExecute` hängen an `cvState.profile`/`originalProfile` (ohne Befüller). Einordnung: toter Pfad, kein paralleler Live-State — Befund, keine Löschungsempfehlung.

## RIS-Relevant Boundary

Keine Architektur, keine Entscheidung — nur Eignungsgruppen (IST-Fakten):

- RIS-relevant (fachliche Kandidaten-Profile, bestätigt/benannt): `cvProfile` (bestätigtes Arbeitsprofil), gespeicherte Search-Einträge (`{ name, profile: Profile }`), gespeicherte ATS-Einträge (`{ name, targetRoles, skills }`), ggf. `selectedSkills` + `atsProfileName` als Auswahl-Kontext. Hinweis: `experienceLevel` existiert nur in `suggestedProfile` und geht beim Confirm verloren — ein späterer Store müsste klären, woher Level kommt (offen, keine Empfehlung).
- NICHT übernehmen (UI-/Workflow-/Cache): `documents[].file` (Blob), `selectedDocumentIds`/`doc.selected`, `activeAtsEntryId`/`selectedSavedSearchId`/`editingSearchName`/`profilesDocId`/`atsJob`, `consentGiven`-Flags (Sitzungs-Flags, kein Profilinhalt), `suggestedProfile` als Roh-Vorschlag (ggf. als Provenienz, nicht als Wahrheit), `atsResult`/`aiSearchResult`/`matches`/`dataset`/Improvement-/Reanalysis-/MatchImpact-Felder (Ergebnis-Caches), `improvement-selection`-Pfad (tot), Redis `cv-profile:<hash>` (reiner Kosten-Cache, keine Namen/Listen/User-Bindung), `App.profile` (manuelle Einmal-Suche, kein gespeichertes Profil), `doc.skills` (leer).

## Open Questions

1. Ist `cvState.profile` bewusst als künftiger Andockpunkt aufgehoben (z.B. Improvement-Revival), oder kann der tote Pfad als Legacy gelten? Keine Schreiber, keine Doku-Aussage gefunden.
2. Soll die duale Dokument-Auswahl (`doc.selected` + `selectedDocumentIds`) auf eine Quelle reduziert werden? Leser sind gemischt; Divergenzrisiko bei künftigem Edit unklar.
3. Ist der stille `experienceLevel`-Verlust beim Confirm (`SuggestedProfile.experienceLevel` → nirgends in `Profile`) beabsichtigt? `Profile`-Typ hat kein Level-Feld.
4. Ist `skills: JSON.stringify(selectedSkills)` im KI-Suchprofil (`:820`) gegenüber Kommaliste beabsichtigt (Downstream-Parsing in `fetchJobs`/API nicht verifiziert)?
5. Ist der `improvement-selection`-Fluss (inkl. `originalProfile`, Reanalysis, MatchImpact) bewusst stillgelegt oder unfertig verdrahtet? Kein Einstieg, keine Befüllung gefunden.
6. Gehört `doc.skills`/Mehrfach-CV-Merge der Vergangenheit an (`handleAddCvFiles`-Signatur trägt `skills?`, einziger Aufrufer übergibt keine)? Stilllegung vs. unfertig — unklar.
7. Welche bestätigte Profilform (`Profile` vs. `{targetRoles, skills}`-Teilmenge vs. inkl. Level) soll ein späterer RIS-Adapter als kanonisch betrachten? Heute drei Formen ohne Kanon-Aussage.

## Evidence
- Typen: `src/types.ts:42-56` (`Profile`/`SuggestedProfile`), `:281-293` (`CvDocument`), `:336-371` (`CvProcessingState`), `:275-276` (Improvement-Steps).
- `cvProfile`: Producer `:1607-1624` (Confirm), `:626-637` (Merge), `:522-548` (Edit-Save); Consumer `:298` (runCvSearch), `:626/:819/:909` (Fallback-Ketten), `:767` (ATS-Name), `:803` (ATS-Save-Rollen), `:1925-1936` (ATS-Render), `:2276-2294` nicht (per-Job nutzt Eintrag/man. Profil).
- `profile` (Legacy): Initial `:107`, Reset `:497`, Leser `:626/:819/:909/:999/:1009/:1020/:1068/:1080-1081/:1095/:1102/:1174-1175/:1925-1936`; Orphan-Kommentare `:818`, `:904-908`; App-Level-Profil `:67-74`, `:247`, `:360-361`, `:1044`, `:1215-1224`, `:2268`, `:2291`.
- `suggestedProfile`: Producer `:702-716`; Confirm-Transform `src/components/CvProfileResult.tsx:50-63`; Beibehalt `:1616-1623`; Back-Delete `:1625-1633`; Leser `:767/:778/:803/:912/:918/:1080-1081/:1590-1673/:1705/:1720`.
- Dokumente/Auswahl: `:399-446` (Add), `:448-474` (Select/Remove), `:479-518` (RemoveData), `:643` (Consent-Lookup via IDs), `:1242-1254` (ListSource + ID-Reset), `src/components/CvDocumentList.tsx:9/:43-50/:110-116` (Auswahl-UI ohne Skills-Übergabe).
- Suche/ATS-Übergaben: `:579-590` (Saved-Start), `:614-640` (Multi-Merge), `:786-822` (Skill-Confirm → ATS-Save/KI-Suche), `:824-884` (AI-Suche), `:903-970` (ATS-Verarbeitung), `:2276-2294` (per-Job-Overlay), `:1240-1344` (Listen-Dropdowns).
- Improvement-Totpfad: `:976-1065` (Execute/Back), `:1067-1141` (Reanalysis), `:1153-1202` (MatchImpact), `:1783/:1839` (Render-Gates ohne Einstieg); `src/api.ts:481` (`applyCvImprovement`), `src/lib/cv-improvement.js:50/73/127/269` (Lib ohne App-Verdrahtung des Einstiegs).
- Store: `src/lib/cvProfileStore.ts:1-157` vollständig; `src/App.tsx:31` (Import), `:1245-1247` (Listen-Lookup), `:766/:797-805/:1612/:1602-1604` (Save/Read-Aufrufe).
- Redis: `api/profile.mjs:1-155` (vollständig; Read `:99-104`, Write `:140-142`, TTL `:6`, Key `:8-10`, Validierung `:12-14`); `api/_lib/ats.mjs:98` (`extractCertifications`), `:167` (`extractRequirementsFromJob`), `:311` (`matchRequirement`), `:345` (`analyzeJobForAts`), `:541` (`generateCVRecommendations`).
- Tests (nur referenziert, nicht geändert/ausgeführt): `src/App.test.tsx:1053` (Confirm legt `cvProfile` an), `:1794-1799` (Overlay-Confirm-Flow), `src/lib/cvProfileStore.test.ts`, `src/components/AtsOverlay.test.tsx`.
- Negativsuchen: `step: "improvement-selection"`-Setzer (kein Treffer); `improvementRecommendations: <non-null>`-Setzer (kein Treffer); `cvState.profile =`-Schreiber außer Reset (kein Treffer); `cv-profile:` außerhalb `api/profile.mjs` (kein Treffer); `saveCvSearchProfile`-/`saveCvAtsProfile`-Aufrufer (nur `App.tsx`).

## Conclusion

- Faktischer Owner je Linie: manuelle Suche = `App.profile` (Nutzer-Eingabe); CV-Linie = `cvProfile` (Nutzer-Confirm) mit `suggestedProfile` als Vorschlag/Bearbeitungsbasis; benannte Ablage = 12h-Store (nutzerbenannte Snapshots pro CV-Hash); Server = reiner `SuggestedProfile`-Cache ohne Owner-Anspruch auf Wahrheit.
- Einzige doppelte Source of Truth im engeren Sinn: `doc.selected` ↔ `selectedDocumentIds`. Alle anderen Mehrfach-Repräsentationen sind unterschiedliche fachliche Zustände (Vorschlag/Bestätigung/Snapshot/Übergabe/Ergebnis) oder tote Pfade (`cvState.profile`, Improvement-Komplex).
- Für einen späteren RIS-Adapter relevant: `cvProfile` + benannte Store-Einträge; alles andere ist UI-/Workflow-State, Ergebnis-Cache oder toter Code.
- Code geändert: NEIN. Tests ausgeführt/geändert: NEIN (nur referenziert).

---

## Audit-Nachweis (AI_AUDITLOG-pflichtig)

- Status: YELLOW (tote Pfade + duale Auswahl + Snapshot-Divergenz; keine Datengefährdung festgestellt)
- Audit-Zeitpunkt: 2026-10-03; Branch: main; HEAD vor Report: 5920e2f
- Terraform-Checks: nicht anwendbar (keine Infra-Änderung, reines Frontend-/Serverless-Repo; keine Checks ausgeführt)
- Git-Status vor Commit: vorbestehende Screenshots-Diffs (2 deleted, 2 untracked, s. Abschluss) — nicht angefasst
- Geänderte Dateien durch diese Analyse: ausschließlich `docs/reports/PROFILE-STATE-01-EXECUTION_LOG.md` (neu)
- Risiken: keine Produktrisiken durch die Analyse (read-only); inhaltliche Risiken s. Open Questions
- Nächste Schritte (Vorschlag, keine Entscheidung): Fachklärung der Open Questions 1–7 vor jeder Konsolidierung
- Resume-Punkt: Analyse abgeschlossen, Report committed (s. Abschlussmeldung)
