# PROFILE-HIERARCHY-01 — Current State / Factual Data Model Audit

## 1. Scope

IST-Audit des aktuellen Mays-Jobsearch-Stands (main, HEAD `54d3c53`; Code-Stand
identisch zu den Audits 01–03 — `git log be173fe..HEAD -- src/ api/ tests/` ist leer,
Kernfakten am HEAD re-verifiziert).
KEINE Codeänderung, KEINE Migration, KEINE neue Persistence, KEINE RIS-Implementierung.
Target 10 / 2 / 5 (05) ist TARGET REQUIREMENT und wird NICHT als Code-Beweis verwendet —
Vergleich erst in §14. Vorgänger-Fassung dieses Reports (198 Zeilen, Stand `28f0043`)
wird durch diese strukturierte Neuauflage ersetzt; kein Befund wurde entwertet.

## 2. Current CV Model

- Haltevolumen: **max. 10 CV-Dokumente pro Browser-Session** — `App.tsx:414`
  (Single-Upload, stiller Slice), `App.tsx:434-443` (Multi-Add, Kommentar
  „Enforce max 10 CVs limit", stiller Slice), UI `CvDocumentList.tsx:160-161`
  (`documents.length < 10` → Upload-Button). Überschuss wird still verworfen.
- Echtes Datenmodell-Limit: **nein** — reines Session-/UI-Limit (React-State
  `cvState.documents`, kein Server, keine DB, kein API-Enforcement).
- ID: `cv-<Date.now>-<rand>` (`App.tsx:379`), sitzungslokal. **`cvId`: nicht vorhanden.**
  Nur Dokument-/Entry-IDs (`cv-*`, `entry-*`), keine stabilen Objekt-IDs.
- CV-Inhalts-Hash (SHA-256 des anonymisierten Texts, `types.ts:288-292`): Schlüssel für
  Profil-Listen-Bucket + 30-Tage-Redis-Kosten-Cache — Cache-/Bucket-Key, **keine Identität**.
- Reload / Browser-Schließen: Dokumente, Listen, Auswahl weg (Heap + Session-Map).
  Persistent bleibt nichts Benutzerbezogenes (nur Sprach-Keys, Legacy-Purge, Redis-Caches).

## 3. Current SearchProfile Model

- Haltung: Session-`Map` pro CV-Hash (`cvProfileStore.ts:43`, `buckets`),
  12h ab Verarbeitung, Lazy-Purge ohne Verlängerung (`:53-70`).
- Struktur: `CvSearchProfileEntry { id, name, savedAt, profile: Profile }` (`:17-22`);
  `Profile { skills: string, targetRoles[], city, radiusKm, workModes[], employmentTypes[] }`
  (`types.ts:42-50`). Snapshot (eigenes Objekt, namensweises Überschreiben UX-08).
- Zuordnung zum CV: **nur Bucket-Key = Inhalts-Hash** — kein `cvId`/`parentId`/FK
  (Interfaces + `grep parentId|searchProfileId|cvId` über Store/Types = 0 Treffer).
  Duplikat-Uploads teilen Buckets; hash-lose Dokumente sehen leere Listen.
- ID: `entry-<ts>-<rand>` (`:49-51`) — **nicht reload-stabil**, serverseitig unbekannt.
- Limit: **kein 10er/2er-Limit** — einzige Grenze `.slice(0, 50)` (`MAX_ENTRIES_PER_LIST`,
  `:15,109`), pro Liste pro Hash-Bucket. Kein UI-Limit, kein Cap-Test.
  Bezugsgröße: **pro Hash**, nicht pro CV-Dokument/Session/User.

## 4. Current ATS Model

- IST-Bezeichnung/Funktion: `CvAtsProfileEntry` = **benanntes ATS-Analyse-Ausgangsprofil**
  (Eingabedaten für per-Job-ATS-Analyse), KEIN „ATSSearchProfile" im Zielsinn.
- Struktur: `{ id, name, savedAt, targetRoles[], skills[] }` (`:24-30`) — reduzierte
  Teilmenge (kein city/radius/workModes/employmentTypes, kein experienceLevel).
- Beziehung zu SearchProfile: **keine** — kein `searchProfileId`/`parentId`/Referenz in
  beiden Richtungen; Geschwister-Array im selben Hash-Bucket (`CvProfileLists`, `:32-35`).
  Nur gemeinsame Hash-/Bucket-Zuordnung.
- ID: `entry-<ts>-<rand>` (wie Search, nicht reload-stabil). Limit: Cap 50/Bucket
  (`:129-132`), still, ungetestet, kein UI-Limit.

## 5. Current Relationships

A) Persistiert: `SearchProfile ↓ ATSSearchProfile` **existiert nicht** — Einträge liegen
als unabhängige Geschwister nebeneinander (§3/§4-Belege).
B) Funktional: Beim Wählen eines SearchProfils wird **kein** ATS-Eintrag diesem
zugeordnet — die ATS-Box zeigt alle Bucket-Einträge ungefiltert
(`App.tsx:1324-1351`); einziger Konsument der ATS-Auswahl ist das Analyse-Modal
(`:2295-2311`). Voller UI→State→API-Fluss in 03 verfolgt (kein Filter via ID/Map/Index).
Fazit: weder persistierte noch funktionale Parent-Kante — aus vollständigem
Flussnachweis, nicht aus bloßem Fehlen von `parentId`.

## 6. Current Search Flow

CV → SearchProfile-Dropdown (`entry.id`) → Start-Button →
`startSearchWithSavedProfile` (`:598-609`) → `handleSubmit(entry.profile)` →
`fetchJobs(profile)` (`GET /api/jobs`, Query aus Profile-Feldern) +
`fetchMatches(profile, jobs)` (`POST /api/match`). **Ja: die Suche verwendet exakt die
gespeicherten Profildaten** — testbelegt (`App.test.tsx:1526-1552`, exakte Params am Call).

## 7. Current ATS Flow (getrennt: Suche / Analyse / Override)

- ATS als Suchkonfiguration: **existiert nicht** — kein ATS-Eintrag erreicht
  `/api/jobs`/`/api/match` (beide nehmen nur `Profile`; kein ATS-Pfad dorthin).
- ATS als Analyseprofil: **das ist die Funktion** — gewählter Eintrag wird zu
  synthetischem Profil (skills/targetRoles, Rest Defaults `:2301-2309`) für
  `ATSModal` → `POST /api/ats-analysis` (per-Job). Ohne Auswahl: manuelles Profil.
- ATS als per-Job-Override: ja, genau das (`:2295-2311`, „hat Vorrang vor dem
  allgemeinen Suchprofil" — vor dem **Analyse**-Profil, nicht vor der Suche).
- Explizit: **ATS steuert aktuell NICHT die Jobsuche.**

## 8. Edit/Save Flow (bis Store verfolgt)

SearchProfile erstellen/bearbeiten/speichern: `editSavedSearchProfile` (`:541-567`,
Entry → Workflow-State `profile-ready`) → Confirm → `saveCvSearchProfile(hash, name,
profile)` (`:1626-1633`) → Store-Slice 50. ATS: `editSavedAtsProfile` (`:571-594`,
→ `skill-selection`) → `saveCvAtsProfile` (`:805-824`). Mehrere je Typ möglich;
gleicher Name überschreibt (UX-08, ID stabil, Eintrag nach vorn). Isolierung: Save
adressiert Name+Bucket; Profilwechsel ändert nur Auswahl-IDs — kein Fremd-Clobbering.
Test: `App.test.tsx:1383` (Box + Edit-Sprung + Überschreiben). Kein Server-Schritt
(Store = Session-Map).

## 9. Current Limits (IST — keine Target-Werte)

| Objekt | aktuelles Limit | Bezugsgröße | Enforcement | Testabdeckung |
|---|---|---|---|---|
| CV | 10 | Browser-Session | State-Slice (still) + UI-Hide; kein Server | UI GREEN (`CvDocumentList.test.tsx:41/46`); Slice YELLOW (ungetestet) |
| SearchProfile | 50 | CV-Inhalts-Hash | Store-Slice (still); kein UI | YELLOW (kein Cap-Test; 11 Store-Tests ohne Cap/Hierarchie) |
| ATS-Eintrag | 50 | Hash-Bucket (kein Parent) | Store-Slice (still); kein UI | YELLOW (wie oben; kein Parent-Test, weil kein Parent) |

## 10. Persistence

| Ebene | React-State | Session-Map | localStorage | Redis | TTL | Reload | Close | User-Bindung |
|---|---|---|---|---|---|---|---|---|
| CV/File/Dokument | ja (Heap) | — | nein | nein | — | weg | weg | keine |
| Search-/ATS-Listen | — | ja (12h, Lazy-Purge) | nein (nur `mj-cv-lists:*`-Purge) | nein | 12h | weg | weg | keine |
| Server-Profil-Cache | — | — | nein (L1 aus `ARCHITECTURE.md:151` im Code nicht mehr vorhanden — Drift) | `cv-profile:<hash>` 30d | 30d | bleibt | bleibt | keine (Kosten-Cache) |
| Alerts | — | — | nein | Hash ohne TTL | — | bleibt | bleibt | E-Mail-Schlüssel ohne Verify |

Cache ≠ Session-State ≠ persistentes Benutzerobjekt: **kein persistentes Benutzerobjekt
existiert** (alle Redis-Inhalte sind Hash-Key-Caches/Zähler ohne Owner/CRUD).

## 11. Identifiers (keine erfunden)

| Objekt | aktueller Identifier | stabil? | Parent-Bezug? | User-Bezug? |
|---|---|---|---|---|
| CV | `cv-<ts>-<rand>` / Inhalts-Hash (Bucket) | nein / inhaltsstabil | nein | nein |
| SearchProfile | `entry-<ts>-<rand>` | nein | nein (nur Bucket-Key) | nein |
| ATS-Eintrag | `entry-<ts>-<rand>` | nein | nein | nein |

## 12. Ownership (nur Jobsearch-IST, nichts aus RIS abgeleitet)

Kein `userId`, kein `tenantId`, kein Auth (nur anonyme Session + Operator-Secrets),
keine Ownership-Checks. Profil→Benutzer-Zuordnung unmöglich (kein Benutzerbegriff);
A-vs-B-Frage technisch nicht prüfbar (alles sitzungslokal im jeweiligen Browser).
Navbar-„Login" ist funktionsloser Prototyp-Platzhalter (`Navbar.tsx:142-144`,
`aria-disabled`) — kein Auth-Beleg.

## 13. Test Coverage (nichts geändert)

UI-10: GREEN (Button sichtbar/<10, hidden bei 10). Data-Slice, Cap-50, Parent-Beziehungen,
Persistence, Reload: **keine Tests** (Lücken, keine Fehler). Search-nutzt-Entry: GREEN
(`App.test.tsx:1526-1552`). Store-Verhalten: 11 Tests (Speichern/Trennung/Namen/12h/Purge/
Reset/Finder) — kein Cap-/Hierarchie-Test. Keine Suite gestartet (Doku-only).

## 14. IST → TARGET Comparison (Target = Kapazität, kein Gebot)

| Punkt | IST (§§2–12) | TARGET (10 / 2 / 5, 05) | GAP |
|---|---|---|---|
| User | keiner | User mit `userId` | Identität (Q1) fehlt |
| CV | 10/Session, `cv-*`, Hash-Bucket | 10/User, `cvId`+`userId` | Bezug + IDs + Persistenz |
| SearchProfile | 50/Hash, `entry-*`, kein Parent | ≤2/CV, `searchProfileId`+`cvId` | Zahl (50→2), Bezug, FK, IDs |
| ATS | 50/Bucket, Geschwister, Analyse-Eingabe | ≤5/SearchProfile, `atsSearchProfileId`+`searchProfileId`, Sucheingabe | Parent-Kante, Zahl, Funktionswechsel |
| Search | Search-only (Referenz) | erhalten | keiner |
| ATS-Suche | nicht existent | exklusiv ATS-Profil | neues Verhalten |
| Typische Nutzung | — (kein Modell) | oft « 1/1/1, Leere normal | UX-Leitplanke aus 05 |

## 15. Confirmed Facts

10/Session (Slice+UI); 50/Hash-Listen ohne Parent; Snapshot-Semantik; Session-Only
(inkl. live bewiesenem Reload-Verlust, 03-§8); Search-nutzt-Entry (Code+Test);
ATS = Analyse-Override, nie Sucheingabe; Single-ATS-Select; Edit beider Typen
namenbasiert; keine IDs mit FKs; kein User/Auth/Owner; kein persistentes Benutzerobjekt;
L1-Drift in ARCHITECTURE.md; Login-Button ohne Funktion.

## 16. Open Questions

Wer erzeugt stabile IDs (nach Q1)? Dokument- vs. Inhalts-Schlüssel? Parent-Modell
(FK-Pflicht)? Feldkanon Search/ATS (Q1/Q3/Q4/Q6/Q13)? Ein-vs-mehrere ATS aktiv?
Delete-vs-Archive + Kaskaden? ATS-Analyse-Weiternutzung? ProfileStore-Übernahmeumfang?
`experienceLevel`? (Vollständig: 02-§13, 04-§14.)

## 17. Final Status

IST vollständig und belastbar nachgewiesen (jede Aussage code-/test-/browser-belegt,
Kernfakten am HEAD re-verifiziert) — zugleich konkreter Widerspruch zum
Target (keine Parent-Kanten, 50≠2/5, kein User/Persistenz): **RED**.
Kein AI-Datenfluss/Modell geändert → keine AI_AUDITLOG-Änderung
(`docs/AI_AUDITLOG.md`-Template als Execution-Log-Pflicht durch diesen Report erfüllt,
Template-Datei unverändert).

## Audit-Nachweis (AI_AUDITLOG-pflichtig)

- Status: RED (Target-Widerspruch bei vollständig belegtem IST; kein GREEN erfunden)
- Zeitpunkt: 2026-10-03; Branch: main; HEAD: `54d3c53` (Audit-Stand; Commit folgt)
- Terraform-Checks: nicht anwendbar (keine Infra; keine ausgeführt)
- Tests/Build/tsc: nicht gestartet (Doku-only); vorhandene Tests ausgewertet, keine verändert
- Browser: keine neue E2E (03-E2E gültig — Code unverändert seit `be173fe`)
- Git-Status: vor Audit nur vorbestehende `docs/screenshotsfordev/`-Diffs (2 deleted, 2 untracked)
- Geänderte Dateien: ausschließlich `docs/reports/PROFILE-HIERARCHY-01-EXECUTION_LOG.md` (Update)
- Risiken: keine (read-only; Target nicht als Ist dargestellt)
- Nächste Schritte: keine (Report + Commit)
- Resume-Punkt: abgeschlossen, bereit zum Commit

---

## AI-Audit-Prüfung (taskseitig gefordert)

Geprüft, ob dieser Task eine relevante AI-/Privacy-/Data-Flow-Entscheidung dokumentiert:
NEIN — IST-Audit ohne Datenfluss-/Modelländerung. Keine AI-Audit-Ergänzung erzeugt.
