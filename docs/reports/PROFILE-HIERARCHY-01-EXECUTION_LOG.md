# PROFILE-HIERARCHY-01 — CV → SearchProfile → ATSSearchProfile (Ist-Audit)

## 1. Scope

AUDIT / IST-ANALYSE des aktuellen Mays-Jobsearch-Stands (main, HEAD `28f0043`).
KEINE Codeänderung, KEINE Migration, KEINE RIS-Implementierung, KEINE erfundene Architektur.

Erwartung (zu prüfen, NICHT zu übernehmen): User → ≤10 CVs → je ≤10 Suchprofile →
je ≤10 ATS-Suchprofile (theoretisch 10 / 100 / 1.000 pro User).

Geprüft: `src/App.tsx`, `src/types.ts`, `src/lib/cvProfileStore.ts`,
`src/components/CvDocumentList.tsx`, `CvProfilesOverlay.tsx`, `CvUpload.tsx`,
`src/lib/cvProfileStore.test.ts`, `src/components/CvDocumentList.test.tsx`,
`src/App.test.tsx`, `api/` (kein Profil-Endpoint mit Persistenz), `docs/reports/`
(RIS-JOBSEARCH-01–04, CV-PROFILE-LISTS-*, CV-UPLOAD-UX-*).

## 2. Executive Result

Die erwartete **10 × 10 × 10-Hierarchie existiert im Code NICHT**.
Tatsächlicher Ist-Zustand pro Browser-Session:

- **CV-Ebene: Limit 10 — GREEN** (State-Slice `App.tsx:414,440` + UI-Hide
  `CvDocumentList.tsx:161`; UI per Test belegt, Data-Slice ungetestet → Enforcement YELLOW).
- **Suchprofile pro CV: Limit 10 — RED.** Tatsächlich **50 pro CV-Hash-Bucket**
  (`MAX_ENTRIES_PER_LIST = 50`, `cvProfileStore.ts:15,109`), ohne UI-Limit, ohne Cap-Test.
- **ATS-Profile pro Suchprofil: Limit 10 — RED.** Doppelt falsch: (a) kein 10er-Limit
  (ebenfalls Cap 50 pro CV-Bucket), (b) **keine Parent-Beziehung** — ATS- und
  Suchprofil-Listen sind **Geschwister** im selben Hash-Bucket, kein `parentId`/
  `searchProfileId` in beiden Richtungen (grep-leer verifiziert).
- **User-Ebene: UNKNOWN** — kein Benutzerbegriff im System (vgl. RIS-JOBSEARCH-04);
  alle „pro User"-Maxima sind nicht anwendbar. Faktisch gilt alles **pro Browser-Session**
  bzw. **pro CV-Inhalts-Hash** (nicht pro Dokument, nicht pro User).

Faktische Maxima pro Session: **10 CV-Dokumente; pro CV-Hash ≤50 Such- + ≤50 ATS-Einträge.**

## 3. CV hierarchy

- **Verwaltung/Speicherung:** ausschließlich React-Session-State
  `cvState.documents: CvDocument[]` (`App.tsx:105`, Typ `types.ts:336-339`).
  Kein localStorage, kein Server, kein API-Endpoint. Reload = Listen + Dokumente weg
  (File-Blobs leben nur im Heap).
- **Maximalzahl 10 — vorhanden:** `App.tsx:414` (Single-Upload, stiller Slice),
  `App.tsx:434-443` (Multi-Add, Kommentar „Enforce max 10 CVs limit", stiller Slice),
  UI `CvDocumentList.tsx:160-161` (`documents.length < 10` → Upload-Button).
  Überschuss wird **still verworfen** (kein Hinweis, kein Fehler).
- **Identifier:** `cv-${Date.now()}-${Math.random()…}` (`App.tsx:379`) — clientseitig,
  sitzungslokal, weder global eindeutig noch stabil noch serverseitig bekannt.
- **Gespeichertes CV (`CvDocument`, `types.ts:281-293`):**
  `{ id, name, size, selected, file: File, skills?, hash? }`.
  `hash` = SHA-256 des anonymisierten/normalisierten Texts, wird erst bei der
  Profil-Erstellung gesetzt; ohne Hash keine gespeicherten Listen.
- **Begriffstrennung (verifiziert):**
  hochgeladenes **File** (Blob, `CvDocument.file`, nie an Server gesendet) ≠
  **CvDocument** (Hülle im Session-State) ≠ **cvProfile** (bestätigtes Arbeitsprofil,
  `CvProfileResult.confirm`, `App.tsx:1626-1643`) ≠ **suggestedProfile** (KI-Vorschlag,
  flüchtig) ≠ **CV-Hash** (Inhalts-Schlüssel für Listen-Bucket + 30-Tage-Redis-Profil-Cache).
- **UI-Grenze = Datenmodell-Grenze:** ja, dieselbe Zahl 10 an beiden Stellen —
  aber reine Session-Konvention, kein Persistenzmodell, kein Server-Enforcement.

## 4. SearchProfile hierarchy

- **Struktur:** `CvSearchProfileEntry` (`cvProfileStore.ts:17-22`):
  `{ id: entry-<ts>-<rand>, name, savedAt, profile: Profile }`.
  `Profile` (`types.ts:42-50`): `{ skills: string, targetRoles[], city, radiusKm,
  workModes[], employmentTypes[] }` — alle Erwartungs-Felder enthalten.
- **Beziehung CV → SearchProfile: nur via Inhalts-Hash, nicht via Dokument.**
  Bucket-Schlüssel = SHA-256 des CV-Texts (`buckets: Map<hash, …>`, `:43,53-70`).
  Zwei Dokumente mit identischem Text **teilen** sich die Listen; ein Dokument ohne
  (oder mit neuem) Hash sieht leere Listen. Kein Dokument-`id`-Bezug.
- **Limit 10 pro CV — NICHT vorhanden (RED):** einzige Begrenzung ist
  `.slice(0, MAX_ENTRIES_PER_LIST)` mit `MAX_ENTRIES_PER_LIST = 50` (`:15,106-109`) —
  pro Liste pro Hash-Bucket. Kein UI-Limit (Overlay rendert alle Einträge),
  kein 10er-Limit irgendwo in `src/`/`api/` (Volltextsuche negativ).
- **Snapshot, keine Referenz:** Eintrag hält eigenes `profile`-Objekt zum Save-Zeitpunkt
  (`App.tsx:1631`); gleicher Name überschreibt (CV-UPLOAD-UX-08, `:100-109`);
  keine Live-Verknüpfung zum späteren CV-/Filter-Zustand.
- **Namensvorschlag** „`<Rolle> - Profil<n>`" mit Zähler `searchProfiles.length + 1`
  (`App.tsx:1615-1625`) — reiner Vorschlag, kein Enforcement.

## 5. ATSSearchProfile hierarchy

- **Struktur:** `CvAtsProfileEntry` (`cvProfileStore.ts:24-30`):
  `{ id, name, savedAt, targetRoles[], skills[] }` — **reduzierte Teilmenge**
  (kein city/radiusKm/workModes/employmentTypes, kein experienceLevel, kein Profil-Objekt).
  Gespeichert aus bestätigten Skills + Zielrollen (`App.tsx:813-824`).
- **Beziehung SearchProfile → ATSSearchProfile — EXISTIERT NICHT (RED):**
  `searchProfiles[]` und `atsProfiles[]` sind **Geschwister-Arrays** in `CvProfileLists`
  (`:32-35`) im selben Hash-Bucket. Weder `CvAtsProfileEntry` (kein `searchProfileId`) noch
  `CvSearchProfileEntry` (keine Kinder) tragen eine Verknüpfung — per Interface UND
  per `grep parentId|searchProfileId` (leerer Treffer) belegt. Das Overlay zeigt beide
  Tabellen nebeneinander ohne Zuordnung (`CvProfilesOverlay.tsx:94-180`).
- **Limit 10 pro SearchProfile — NICHT vorhanden (RED):** Cap 50 pro CV-Bucket
  (`:129-132`), kein UI-Limit, kein Test.
- **Nicht zu verwechseln:** gespeichertes ATS-Profil (Eingabedaten: Skills + Rollen) ≠
  `cvProfile` ≠ ATS-Analyse-Ergebnis (`AtsAnalysisResponse`: Score, Coverage, Gaps,
  Requirements, Formulierungen — pro Treffer-Job im `AtsOverlay`, transient).
- **Namensvorschlag** „`<Rolle> - ATS<n>`" mit Zähler `atsProfiles.length + 1`
  (`App.tsx:780-788`) — Vorschlag, kein Enforcement.

## 6. Ownership

Alle vier Objekte sind **JOBSEARCH IST, sitzungslokal, ohne Owner-Identität**
(kein User → kein Owner zuordenbar; vgl. RIS-JOBSEARCH-04 §3):
File/CvDocument (Browser-Heap), cvProfile/suggestedProfile (React-State),
Search-/ATS-Einträge (Session-Map, 12h), CV-Hash-Bucket (Inhalts-Key, kein User-Key).
RIS-Ownership: keine (RIS-JOBSEARCH-03-Gate BLOCKED, 0/10).

## 7. Persistence

| Objekt | Speicher | Lifetime | Key |
|---|---|---|---|
| File + CvDocument | Browser-Heap (`cvState.documents`) | Session (Reload = weg) | `cv-<ts>-<rand>` (sitzunglokal) |
| Search-/ATS-Listen | Session-`Map` (`cvProfileStore.ts:43`) | 12h ab CV-Verarbeitung, Lazy-Purge, kein Verlängern (`:53-70`) | CV-Inhalts-Hash |
| Legacy | localStorage `mj-cv-lists:*` | nur Bereinigung beim Start (`:144-157`) | — |
| Server | **keine** Profil-Persistenz (nur 30-Tage-KI-Kosten-Cache `cv-profile:<hash>`) | — | — |

Kein API-Endpoint persistiert Profile (`/api/profile` = zustandslose Extraktion + Cache).

## 8. API/UI enforcement

- CV-10: Data (`App.tsx:414,440`, still) + UI (`CvDocumentList.tsx:161`, Button-Hide).
  Kein Server-Enforcement (kein Server-State), keine Fehlermeldung bei Slice.
- Search-/ATS-Cap-50: nur Store-Slice (`:109,132`), still, kein UI-Hinweis, kein Server.
- Kein 10er-Limit für Profile auf irgendeiner Schicht (Code-Suche negativ).
- Keine dokumentierte 10er-Vorgabe in `docs/` gefunden (Reports sprechen von 12h/50/unbegrenzt).

## 9. Test coverage

- **CV-10 (UI): GREEN** — `CvDocumentList.test.tsx:41/46`: Button sichtbar bei <10,
  hidden bei genau 10. **Data-Slice (`App.tsx:414,440`): YELLOW** — kein Test
  (`App.test.tsx` enthält keinen Dokument-Limit-Fall; nur Radius-Werte „10"/„100").
- **Cap-50: YELLOW** — `cvProfileStore.test.ts` (11 Tests: Speichern/Lesen je Hash,
  Hash-Trennung, ATS-Default-Namen, Suchprofil-Default-Namen, kein-Save-ohne-Hash,
  Name-Overwrite, 12h-Verfall, Fenster-Nicht-Verlängerung, Legacy-Purge, Reset,
  `findSavedSearchProfile`) — **kein Cap-Test, kein Hierarchie-/Parent-Test**.
- **Erwartete 10er-Hierarchie: RED** — kein Test, weil kein Code; die Erwartung
  widerspricht `MAX_ENTRIES_PER_LIST = 50` und der fehlenden Parent-Verknüpfung.
- Keine Test-Suite gestartet (reine Doku-Änderung, auftragsgemäß); vorhandene Tests
  nur ausgewertet, keine verändert.

## 10. Source-of-truth matrix

| Objekt | Parent | Kardinalität | Identifier | Persistence | UI | API | Enforcement | Status |
|---|---|---|---|---|---|---|---|---|
| User | — | — (kein Begriff) | — | — | — | — | — | UNKNOWN |
| CV (CvDocument) | — (Session-State) | ≤10 / Session | `cv-<ts>-<rand>` (sitzunglokal) | Browser-Heap | Upload-Hide bei 10 | — | State-Slice + UI-Hide | GREEN (Enforcement YELLOW: Slice ungetestet/still) |
| SearchProfile | CV-Hash-Bucket (Inhalt, kein Dokument) | ≤50 / Hash (statt erw. 10) | `entry-<ts>-<rand>` | Session-Map, 12h | Overlay-Tabelle (alle) | — | Store-Slice 50, ungetestet | RED vs. Erwartung |
| ATSSearchProfile | CV-Hash-Bucket (Geschwister, **kein** SearchProfile-Parent) | ≤50 / Hash (statt erw. 10/Parent) | `entry-<ts>-<rand>` | Session-Map, 12h | Overlay-Tabelle (alle) | — | Store-Slice 50, ungetestet | RED vs. Erwartung |

## 11. Jobsearch ↔ RIS comparison

- **JOBSEARCH IST:** 10 CV-Dokumente (Session) → pro CV-Hash ≤50 Search- + ≤50 ATS-Einträge
  (flach, Geschwister, Snapshots, 12h). Kein User, keine Parent-Kette, keine 10er-Profil-Limits.
- **RIS DOKUMENTIERT:** nur Kandidaten-Begriffe ohne Schema/Hierarchie/Limits —
  `cvProfile`, gespeicherte Search-/ATS-Einträge, Alerts (alle „CANDIDATE, ohne Owner",
  02/03); keine `SearchConfiguration`-, `ATSSearchProfile`-, `User Profile`- oder
  `Candidate`-Schemata, keine 10×10×10-Aussage in 01–04, ROADMAP oder ARCHITECTURE.
- **RIS IMPLEMENTIERT:** nichts (kein Code, kein Endpoint, kein Store; 03-Gate BLOCKED).
- **ABWEICHUNG / OFFENE FRAGE:** Die erwartete 10×10×10-Hierarchie ist **weder**
  JobSearch-IST **noch** RIS-dokumentiert — sie darf nicht als Ist oder als
  beschlossene RIS-Architektur behandelt werden. Offene Produktfragen (weiterhin):
  echte User-Ebene, Dokument- vs. Inhalts-Schlüssel, Search↔ATS-Verknüpfung ja/nein,
  kanonische Limits, Kanon/Typisierung (Q1–Q6 aus 02/03).

## 12. Open questions

1. Soll die CV-10-Grenze (inkl. stillen Slices) Produkt-Vertrag bleiben oder UX-explizit werden?
2. Dokument- oder Inhalts-Schlüssel für Profil-Listen (Folge: geteilte Listen bei Duplikat-Uploads)?
3. Braucht es eine Search→ATS-Parent-Beziehung, oder bleibt die Geschwister-Darstellung?
4. Welche Profil-Limits (pro CV / pro Parent / pro User) sollen nach Identitäts-Entscheidung gelten?
5. Gehört `experienceLevel` (stirbt beim Confirm) zum künftigen Kanon?
6. Wohin gehören `radiusKm/workModes/employmentTypes` (Profil vs. Suchkontext; ATS-Einträge kennen sie nicht)?

## 13. Final status

- Audit vollständig, 0 Entscheidungen getroffen, nichts als Ist dokumentiert, was nicht belegt ist.
- **Kein AI-Datenfluss / kein AI-Architekturmodell geändert** (read-only) → keine
  AI_AUDITLOG-Änderung (auftragsgemäß; `docs/AI_AUDITLOG.md`-Template als
  Execution-Log-Pflicht erfüllt durch diesen Report, Template-Datei unverändert).

## Audit-Nachweis (AI_AUDITLOG-pflichtig)

- Status: RED (Erwartung 10×10×10 in 2/3 Ebenen widerlegt; CV-10 GREEN, Cap-50/YELLOW-Anteile vermerkt)
- Zeitpunkt: 2026-10-03; Branch: main; HEAD: `28f0043` (Audit-Stand; Commit folgt)
- Terraform-Checks: nicht anwendbar (keine Infra; keine ausgeführt)
- Tests/Build/tsc: nicht gestartet (Doku-only, auftragsgemäß); vorhandene Tests nur ausgewertet
- Git-Status: vor Audit nur vorbestehende `docs/screenshotsfordev/`-Diffs (2 deleted, 2 untracked)
- Geänderte Dateien: ausschließlich `docs/reports/PROFILE-HIERARCHY-01-EXECUTION_LOG.md` (neu)
- Risiken: keine (read-only; keine Vorab-Festlegung)
- Nächste Schritte: keine (Report + Commit; kein Folge-Gate ohne Beauftragung)
- Resume-Punkt: abgeschlossen, bereit zum Commit

---

## AI-Audit-Prüfung (taskseitig gefordert)

Geprüft, ob dieser Task eine relevante AI-/Privacy-/Data-Flow-Entscheidung dokumentiert:
NEIN — reines Ist-Audit ohne Datenfluss-/Modelländerung. Keine AI-Audit-Ergänzung erzeugt.
