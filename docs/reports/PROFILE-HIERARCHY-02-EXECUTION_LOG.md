# PROFILE-HIERARCHY-02 — Data Model & Migration Gap (Analyse)

## 1. Scope

ANALYSE / AUDIT ONLY auf Basis von PROFILE-HIERARCHY-01 (STATUS: RED).
KEINE Codeänderung, KEINE Migration, KEINE RIS-Implementierung, KEINE neuen Strukturen,
KEINE Datenlöschung/-änderung, KEINE Limit-Änderung. Einzige neue Datei: dieser Report.

Stand: main, HEAD `be173fe`. Alle Aussagen code-verifiziert (Referenzen unten);
nicht Belegbares ist als OPEN/UNKNOWN markiert, nicht geraten.

## 2. Input: PROFILE-HIERARCHY-01

Ist-Zustand (übernommen, erneut gegen HEAD verifiziert — unverändert):
10 CV-Dokumente/Session (State-Slice + UI-Hide) → pro CV-Inhalts-Hash ≤50 Search- +
≤50 ATS-Einträge (flache Geschwister-Listen, Snapshots, 12h-Session-Map). Kein User,
keine Parent-Kette, keine 10er-Profil-Limits. Zielstruktur 10×10×10 weder implementiert
noch dokumentiert.

## 3. Current Data Model

| Objekt | aktueller Identifier | Parent | Storage | Lifetime | Ownership | Status |
|---|---|---|---|---|---|---|
| File (PDF-Blob) | — (Teil von CvDocument) | CvDocument | Browser-Heap (`CvDocument.file`) | Session (Reload = weg) | Browser/Session, keine User-Zuordnung | transient, nie an Server gesendet |
| CvDocument | `cv-<ts>-<rand>` (`App.tsx:379`), sitzungslokal | — (flaches Array `cvState.documents`) | React-State (`App.tsx:105`) | Session | keine | ≤10, still geslict (`:414,440`) |
| cvProfile (bestätigtes Arbeitsprofil) | — (State-Feld, kein ID) | — | React-State | Session | keine | Snapshot-Quelle für Saves |
| suggestedProfile (KI-Vorschlag) | — | — | React-State | flüchtig (bis Confirm) | keine | Rohvorschlag, nie gespeichert |
| CvSearchProfileEntry | `entry-<ts>-<rand>` (`cvProfileStore.ts:49-51`) | **kein Parent-Feld** (nur Bucket-Key = CV-Hash) | Session-`Map` (`:43`) | 12h ab Verarbeitung, Lazy-Purge, keine Verlängerung (`:53-70`) | keine | ≤50/Bucket, Snapshot (`profile`-Objekt) |
| CvAtsProfileEntry | `entry-<ts>-<rand>` | **kein Parent-Feld** (Geschwister im selben Bucket) | Session-`Map` | 12h (wie oben) | keine | ≤50/Bucket, Teilmenge (skills+roles) |
| CV-Hash | SHA-256 (anonymisierter Text) | — | abgeleitet, nicht gespeichert als Objekt | an Text gebunden | kein User-Key | **Cache-/Bucket-Schlüssel, keine Identität** (Hash-Verbot aus 02) |
| selectedDocumentIds / selectedSavedSearchId | Dokument-/Entry-IDs | — | React-State (`App.tsx:106,90`) | Session | keine | reine UI-Auswahl, keine Persistenz |
| Server-Cache `cv-profile:<hash>` | Inhalts-Hash | — | Redis, 30d (`api/profile.mjs:6-9`) | 30 Tage TTL | Jobsearch/Upstash (Kosten-Cache) | **Cache, kein Benutzerobjekt** |
| Alerts (`email → sub`) | E-Mail (ungeprüft) | — | Redis-Hash, ohne TTL | persistent | faktisch Schlüssel, kein Nachweis | einziger persistenter User-Bezug, ohne Verify |

## 4. Current Relationships (Beweis/Widerlegung)

- **CV → SearchProfile: SCHWACH (Hash, nicht Dokument).** Einzige Verknüpfung ist der
  Bucket-Key = Inhalts-Hash (`getBucket(hash)`, `:53`). Beleg: zwei Dokumente mit
  identischem Text teilen Listen; Dokument ohne Hash hat keine Listen
  (`CvDocument.hash?`, `types.ts:288-292`; `readCvProfileLists(doc.hash ?? null)` in
  `App.tsx:491,544,574,600,1264,1621`). Kein `cvId`, kein Dokument-FK.
- **SearchProfile → ATSSearchProfile: EXISTIERT NICHT (widerlegt).** Technisch erkennbar an:
  (a) Interfaces ohne Relationsfeld (`CvSearchProfileEntry:17-22`, `CvAtsProfileEntry:24-30`
  — kein `parentId`/`searchProfileId`/`profileId` in beiden Richtungen);
  (b) `grep parentId|searchProfileId|cvId|profileId` über Store + Overlay = leer;
  (c) Container `CvProfileLists{searchProfiles[], atsProfiles[]}` (`:32-35`) = Geschwister;
  (d) Overlay rendert beide Tabellen ohne Zuordnung (`CvProfilesOverlay.tsx:94-180`).
- **SearchProfile ↔ CV: nur rückwärts über Hash lesbar** (Bucket → Einträge), kein
  Eintrag → Dokument-Verweis. Nach Re-Anonymisierung (neuer Hash) sind alte Einträge
  für das Dokument unsichtbar (verwaist, verfallen nach 12h).
- **ATSSearchProfile ↔ SearchProfile: keine Beziehung in beiden Richtungen** (s. oben).
- **Fazit:** Von vier geprüften Relationen ist eine schwach (Hash), drei fehlen.

## 5. Identifier Gap

| Ziel-Feld | existiert? | Ersatz heute | reload-stabil? |
|---|---|---|---|
| `cvId` | NEIN | `cv-<ts>-<rand>` (Session) bzw. Inhalts-Hash (Bucket) | nein (neu pro Upload/Session) |
| `searchProfileId` | NEIN | `entry-<ts>-<rand>` (Session-Map) | nein |
| `cvId` am SearchProfile (FK) | NEIN | Bucket-Key = Hash (Inhalt, kein Dokument) | inhaltlich stabil, aber kein Dokument-/User-Bezug |
| `atsSearchProfileId` | NEIN | `entry-<ts>-<rand>` (Session-Map) | nein |
| `searchProfileId` am ATS-Profil (FK) | NEIN | nichts (Geschwister) | — |

Hash-Missbrauchs-Prüfung: Der Hash wird heute **korrekt nur als Cache-/Bucket-Schlüssel**
verwendet (Redis-Key, Map-Key), nie als User-/Owner-Identität — kein Missbrauch im Code,
aber er ist der einzige „stabile" Schlüssel überhaupt und damit Migrations-Kandidat
mit allen Hash-Risiken (Duplikat-Uploads teilen Buckets; Textänderung = neuer Bucket;
kein Personenbezug → keine Ownership ableitbar). Alle `cv-*`/`entry-*`-IDs sind
`Date.now()+Math.random` — Kollisionen unwahrscheinlich, aber weder global eindeutig
garantiert noch reload-stabil noch serverseitig bekannt.

## 6. Ownership Gap

Current: Browser → Session → CV-Hash. Target: User → CV → SearchProfile → ATSSearchProfile.

- `userId`: **nicht vorhanden** (grep über Store/Types/Identity leer; vgl. 04).
- `tenantId`: **nicht vorhanden** (nur ATS-Board-Technik, kein User-Bezug).
- Ownership-Checks: **keine** — kein Auth, keine Abfrage „gehört zu", keine Sperre.
- Profil→Benutzer-Zuordnung: **unmöglich** (kein Benutzerbegriff; E-Mail nur ungeprüfter
  Alert-Schlüssel ohne Verify).
- Benutzer A vs. Profil von B: **technisch nicht prüfbar** — und praktisch gegenstandslos:
  alles liegt im lokalen Session-Speicher des jeweiligen Browsers (kein Sharing, kein Server).
- Aus RIS-Architektur wird nichts abgeleitet: RIS besitzt laut 03-Gate keine Owner
  (BLOCKED, 0/10); keine Vorab-Zuweisung.

## 7. Limit Gap

| Ebene | Current Limit | Target Limit | Enforcement Current | Enforcement Target | Gap |
|---|---|---|---|---|---|
| CV | 10 / Session | 10 / User | State-Slice (still) + UI-Hide; ungetesteter Slice; kein Server | keins (kein User, kein Server-State) | Bezugsgröße (Session≠User) + stilles Slicen + fehlende Server-Seite |
| SearchProfile | 50 / CV-Hash | 10 / CV | Store-Slice (still), kein UI, kein Test | keins | Zahl (50≠10) + Bezug (Hash≠Dokument) + fehlender Parent-Cap |
| ATSSearchProfile | 50 / Hash-Bucket, kein eigener Parent-Cap | 10 / SearchProfile | Store-Slice (still), kein UI, kein Test | keins | Parent-Beziehung fehlt vollständig; Zahl + Bezug offen |

## 8. Persistence Gap

- **CV (File + Dokument):** nur React-State. Überlebt weder Reload noch
  Browser-Schließen noch Session. Für RIS/User-Ownership wäre dauerhafte,
  user-gebundene Ablage erforderlich (heute: nicht vorhanden).
- **Search-/ATS-Einträge:** nur Session-`Map` (12h). Überleben nichts davon.
  Legacy-`localStorage` (`mj-cv-lists:*`) wird nur noch **gelöscht** (`:144-157`).
  **Doc-Drift:** `ARCHITECTURE.md:151` beschreibt einen Browser-L1-Cache
  (`mj-cv-profile:<hash>`, 30 Tage) — im Produktions-Code existiert kein
  `localStorage.setItem` für Profile mehr (nur Test-Cleanup + Sprach-Keys
  `mj-lang`/`lp2-lang`); L1 ist faktisch entfernt, Doku veraltet (Nebenbefund,
  kein Gate-Gegenstand).
- **Redis:** `cv-profile:<hash>` (30d, KI-Kosten-Cache), Job-/Detail-/Geo-Caches,
  Usage-Zähler, `alerts`-Hash (einzig persistent, E-Mail-Schlüssel ohne Verify).
  **Cache ≠ Benutzerobjekt:** kein Redis-Inhalt ist einem User zuordenbar oder als
  Profil-Store geeignet (Hash-Keys, TTLs, kein Owner, kein CRUD).
- **Fazit:** Keine Ebene überlebt Reload; für RIS wäre jede Ebene neu persistent +
  user-gebunden zu bauen. Übernahmewürdig aus Bestand: nur Inhalte (Namen, Felder),
  nicht Hüllen (IDs, Keys, Buckets).

## 9. Migration/Data-Loss Analysis (theoretisch, nichts ausgeführt)

Ausgang: `Hash-Bucket { Search A, Search B, ATS X, ATS Y }` → Ziel:
`CV { Search A { ATS X }, Search B { ATS Y } }`.

- **Zuordnung NICHT rekonstruierbar.** Fehlende Information: die
  Search→ATS-Parent-Kante wurde nie gespeichert (s. §4) — aus dem Bucket ist nicht
  ableitbar, ob X zu A oder B gehört (oder zu keinem). **Kein Raten:** jede Zuordnung
  wäre Erfindung.
- **Erhaltbar ohne Zuordnung:** alle Feldinhalte (Namen, `savedAt`, Profile, Skills,
  Rollen) — als verwaiste Datensätze, nicht als Baum.
- **Zusätzliche Verlustpfade (Ist-Natur):** 12h-Verfall, Reload-Verlust, Hash-Wechsel
  durch Re-Anonymisierung (Bucket unsichtbar), Duplikat-Uploads (fremde Einträge im
  selben Bucket — bei Migration fälschlich mitübernommen), ID-Instabilität
  (`cv-*`/`entry-*` nach Reload bedeutungslos).
- **Eindeutig migrierbar:** nichts als Baum — nur flache Inhalte mit
  Attributionslücke bei allen ATS-Einträgen.

## 10. Migration Strategy Comparison (konzeptionell, keine Entscheidung)

| Strategie | Voraussetzung | Vorteil | Risiko | Datenverlust | Rollback | Eignung |
|---|---|---|---|---|---|---|
| A) In-place | Parent-Links + User-Keys vorhanden | kein Doppelbetrieb | Voraussetzung fehlt → Zwangs-Erfindung von Zuordnungen | **hoch** (Fehlattribution X/Y) | schwer (überschrieben) | derzeit **ungeeignet** |
| B) Dual-Write | neues Modell + Identität entschieden | Fallback aufs Alte; Vergleichbarkeit | Divergenz Alt/Neu; doppelter Aufwand | niedrig (Alt bleibt) | leicht (Umschalten) | geeignet **nach** Identitäts-Entscheidung |
| C) Lazy (bei Zugriff) | Zugriffspfade definiert | kein Big-Bang | 12h/Session-Daten meist schon weg; Waisen bleiben | mittel (Verfall = Verlust) | entfällt (nichts ersetzt) | passt zur Ephemer-Natur, löst Attribution nicht |
| D) Neuer Store + kontrollierte Übernahme (z. B. user-bestätigter Export/Import) | Export-Format + Identität | **Nutzer löst Attribution** (wählt X→A selbst); Alt unberührt | UX-Aufwand; unvollständige Übernahmen | niedrig (nur Bestätigtes wandert) | leicht (Alt lesbar bis Verfall) | **einzige mit Attribution ohne Raten** |
| E) Verfallen lassen | keine | null Risiko, privacy-freundlich, kein Code | benannte Listen gehen verloren | total, aber **erwartbar** (12h/Session-Semantik) | nicht nötig | realistischer Default given Ist-Semantik |

## 11. RIS Boundary Comparison

- **JOBSEARCH CURRENT:** flache Session-Listen (Search + ATS als Geschwister pro
  CV-Hash, 12h), kein User, keine IDs, keine API-Persistenz (§3–§8).
- **RIS DOCUMENTED TARGET:** kein Schema im Repo. Die Gate-Begriffe
  `Saved JobSearch`, `SearchConfiguration`, `ATSSearchProfile`, `User Profile`,
  `Candidate`, `userId = Cognito sub`, `tenantId` kommen in 01–04, ARCHITECTURE,
  API_CONTRACT, ROADMAP **nicht als Spezifikation** vor (nur Kandidaten-Wording:
  „Saved Search-Einträge", „ATS-Einträge", „Alerts"). Der Auftragssatz
  „userId = Cognito sub" ist im Repository **nicht belegt** → OPEN, kein Fakt.
- **GAP:** alles — Identität, IDs, Parent-Kanten, Limits, Persistenz, API, Consent/
  Delete/Export (vgl. 03-Gate 0/10, 04-Gap-Report).
- **`Saved JobSearch` ≈ SearchProfile?** Konzeptionell ja, feldvergleichsbasiert:
  `Profile` trägt die vollständigen Such-Eingaben (skills, targetRoles, city, radiusKm,
  workModes, employmentTypes) = alles, was eine gespeicherte Suche zum Wiederholen
  braucht; ATS-Einträge (nur skills+targetRoles) gehören als **abgeleitete Sicht
  darunter**, nicht daneben. CV-Daten außerhalb: File-Blob, Roh-/Anonym-Texte
  (nie gespeichert), Hash (Cache-Key), `suggestedProfile` (Rohvorschlag),
  `experienceLevel` (nur Vorschlag, stirbt beim Confirm — Kanon-Entscheidung Q4 offen).
  Dies ist eine **Feldnähe-Feststellung, keine Typentscheidung**.

## 12. Target Model (rein dokumentarisch)

```
User [1] (userId: Mechanismus OPEN — „Cognito sub" im Repo unbelegt)
└── CV [1..10] (cvId: NEU; sourceHash?: OPEN; uploadedAt: OPEN)
    ├── SearchProfile [1..10] (searchProfileId: NEU; cvId FK: NEU;
    │   Snapshot-Semantik: IST-verhalten, als Entscheidung zu bestätigen;
    │   Felder aus IST: name, savedAt, profile{skills,targetRoles,city,radiusKm,
    │   workModes,employmentTypes}; Kanon Q1/Q3/Q13 OPEN)
    │   └── ATSSearchProfile [1..10] (atsSearchProfileId: NEU; searchProfileId FK: NEU;
    │       Felder aus IST: name, savedAt, targetRoles, skills; Typisierung Q6 OPEN)
    └── ...
```

Jede ID, jeder FK, jedes Limit ist NEU/OPEN; IST-Felder sind übernommen markiert.
Kein erfundenes Feld (keine Versionen, keine Timestamps außer belegtem `savedAt`).

## 13. Open Questions

Auftragsliste geprüft — alle bleiben offen, keine beantwortbar aus IST:
Erzeuger von `cvId`/`searchProfileId`/`atsSearchProfileId` (Client vs. Server);
CV = dauerhaftes User-Objekt oder Dokumentreferenz; CV-Version pro SearchProfile
(Hash-Wechsel!); Snapshot-Semantik bestätigen; Verschieben zwischen CVs;
Delete-Kaskaden (CV→Search→ATS, Fremd-Delete-Schutz, Nachweis); Hash-Bestand-Migration
(Attribution!); Export-Umfang/-Format. Ergänzt: Umgang mit Duplikat-Bucket-Einträgen;
Gültigkeit der 10er-Zahlen als Produktentscheidung (nicht aus Code ableitbar).

## 14. Recommendation for Next Gate (verfahrensweise, keine Architekturentscheidung)

1. Produktentscheidungen in 03-Reihenfolge (Q1 Identität → Q2 Auth → Q3 Kanon/Q4/Q6/Q13),
   sonst bleibt jede Migration Raterei (§9). 2. `ARCHITECTURE.md:151`-Drift (L1-Cache)
   redaktionell berichtigen. 3. Falls D gewünscht: Export-Format + Delete/Export-Semantik
   (Q9/Q10) vorziehen, da D sie voraussetzt. 4. Kein Migrationscode vor Gate-Öffnung
   (03-Gate: BLOCKED).

## 15. Final status

Ist-Zustand und Gaps sind vollständig nachweisbar (alle Tabellen code-belegt);
die Migration ist derzeit **nicht sicher durchführbar** (fehlende Parent-Kanten +
fehlende Ownership = Relations-/Ownership-Bruch) → **RED** nach Statusregel.
Kein AI-Datenfluss/Modell geändert → keine AI_AUDITLOG-Änderung
(`docs/AI_AUDITLOG.md`-Template als Execution-Log-Pflicht durch diesen Report erfüllt,
Template-Datei unverändert).

## Audit-Nachweis (AI_AUDITLOG-pflichtig)

- Status: RED (sichere Migration blockiert: §4-Relationsbruch + §6-Ownership-Gap; alles belegt)
- Zeitpunkt: 2026-10-03; Branch: main; HEAD: `be173fe` (Audit-Stand; Commit folgt)
- Terraform-Checks: nicht anwendbar (keine Infra; keine ausgeführt)
- Tests/Build/tsc: nicht gestartet (Doku-only, auftragsgemäß); vorhandene Tests aus 01 übernommen
- Git-Status: vor Audit nur vorbestehende `docs/screenshotsfordev/`-Diffs (2 deleted, 2 untracked)
- Geänderte Dateien: ausschließlich `docs/reports/PROFILE-HIERARCHY-02-EXECUTION_LOG.md` (neu)
- Risiken: keine (read-only; keine Strategie als Entscheidung ausgegeben)
- Nächste Schritte: keine (Report + Commit; §14-Empfehlung nur verfahrensweise)
- Resume-Punkt: abgeschlossen, bereit zum Commit

---

## AI-Audit-Prüfung (taskseitig gefordert)

Geprüft, ob dieser Task eine relevante AI-/Privacy-/Data-Flow-Entscheidung dokumentiert:
NEIN — Ist-Analyse ohne Datenfluss-/Modelländerung. Keine AI-Audit-Ergänzung erzeugt.
