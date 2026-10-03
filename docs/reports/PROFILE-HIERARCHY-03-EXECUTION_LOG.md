# PROFILE-HIERARCHY-03 — Search & ATS Selection Flow Audit

## 1. Scope

AUDIT / IST-ANALYSE des funktionierenden Auswahl-/Suchflusses (main, HEAD `2e5cd41`).
KEINE Codeänderung, KEINE Migration, KEINE neue Persistence, KEINE RIS-Implementierung,
KEINE Datenveränderung. Der funktionierende UX-Flow wurde erhalten und verifiziert
(gelesen + per Test + per Live-Browser); nichts umgebaut.

## 2. Existing Functional Flow (tatsächlich implementiert)

- CV wählen (Dokumentenliste, `selected` oder erstes Dokument) → gespeicherte
  Suchprofile dieses CV-Hash-Buckets erscheinen als Dropdown in der Box
  `.cv-saved-profiles` unter dem Upload-Bereich (`App.tsx:1261-1294`).
- Suchprofil per Entry-ID wählen → Start-Button aktiv → **Suche läuft ausschließlich
  mit dem gespeicherten `entry.profile`** (`startSearchWithSavedProfile`, `:598-609`).
- ATS-Dropdown (gleiche Box, Geschwister) wählt EIN ATS-Profil → wirkt **nicht** auf die
  Jobsuche, sondern hat Vorrang als Profil für die **per-Job-ATS-Analyse**
  (`ATSModal`, `:2295-2311`).
- Editieren beider Listentypen vorhanden (Vorbefüllen der Workflow-Steps, Speichern
  überschreibt namensgleich, `editSavedSearchProfile` `:541-567`,
  `editSavedAtsProfile` `:571-594`).

## 3. CV → SearchProfile

- Auswahl: Quelldokument = erstes `selected`-Dokument, Fallback erstes Dokument
  (`listSourceDoc`, `:1263`); Listen via `readCvProfileLists(doc.hash)` (`:1264`) —
  Zuordnung über Inhalts-Hash (vgl. 01/02), keine Dokument-ID-Kante.
- Anzeige: `CvProfilesOverlay` (Titel = CV-Name, zwei Tabellen) bzw. Dropdown
  `#cv-saved-search-profile` mit `entry.id` als Value (`:1300-1312`).
- Referenz beim Auswählen: Entry-ID (`selectedSavedSearchId`, `:87,1303`);
  Start löst Entry → `entry.profile` auf (`findSavedSearchProfile`, `:601`).
- Wechsel auf anderes SearchProfile: nur ID-State-Wechsel; kein Reload, kein
  Seiteneffekt auf andere Einträge.
- Wechsel des **Dokuments**: BEIDE Auswahlen werden zurückgesetzt
  (`useEffect` auf `listSourceDocId`, `:1268-1273`, ATS-PROFILE-INVESTIGATION-01) —
  fremde Listen können nicht aktiv bleiben. ATS des vorherigen Dokuments wird
  korrekt entfernt (Reset, kein Filter nötig — Bucket-Wechsel).

## 4. SearchProfile → ATS SearchProfile

Vollständige Verbraucher-Suche von `activeAtsEntryId`/`activeAtsEntry`
(`:87,501,575,1265,1272,1330,1344,2295-2311`): einziger Konsument ist das
ATS-Analyse-Modal (`:2295-2311`). Befund je Prüfpunkt:

- Bestimmende Daten der ATS-Box: **der CV-Hash-Bucket** (`listSourceLists.atsProfiles`,
  `:1324-1351`) — ALLE ATS-Einträge des CV, **nicht** die des gewählten Suchprofils.
  Keine Filterung per Entry-ID/Hash/Map/Index/State/API-Parameter gefunden
  (funktionale Beziehung via IDs/Maps/Indexe/Objektbeziehungen: negativ verifiziert —
  der 02-Befund wurde NICHT ungeprüft übernommen, sondern der Datenfluss vollständig
  verfolgt).
- SearchProfile B nach A: ATS-Liste unverändert (gleicher Bucket); „ATS-Liste A"
  existiert als Konzept nicht — es gibt keine A-/B-Listen, nur die CV-Liste.
- Die Prämisse „ATS-Box lädt zu DIESEM Suchprofil gehörende ATS-Profile" ist im Code
  **nicht implementiert**: Boxen sind Geschwister, kein Parent-Filter.

## 5. Search Semantics

- **CASE A (nur SearchProfile): BESTÄTIGT.** `startSearchWithSavedProfile` →
  `handleProfileChange(entry.profile)` + `handleSubmit(entry.profile)` (`:607-608`) →
  `runSearch`/`runAiSearchWithProfile` → `fetchJobs(searchProfile)` (`:860`) +
  `fetchMatches(searchProfile, jobs, …)` (`:877`). Testbeleg
  `App.test.tsx:1526-1552` assertet exakt die Entry-Felder am `fetchJobs`-Call.
- **CASE B (Search + ATS → ausschließlich ATS): NICHT IMPLEMENTIERT.**
  Kein Pfad führt ein ATS-Entry an `/api/jobs` oder `/api/match` (Typen: beide nehmen
  `Profile`, kein ATS-Typ; `activeAtsEntry` fließt nirgends in Search-State/Handler).
  Das SearchProfile wird daher auch nie „ausgeschlossen" — die Frage läuft ins Leere.
  Was stattdessen existiert (nicht verwechseln): ATS-Vorrang **in der per-Job-Analyse**
  (`:2298-2310`, Skills/Rollen-Override, Rest Defaults) — Analyse, keine Suche.
- **CASE C (mehrere ATS): NICHT UNTERSTÜTZT.** Single-Select
  (`activeAtsEntryId: string | null`, `:87`; ein Dropdown `:1328-1340`).
  Keine Parameter-Kombinatorik vorhanden.

## 6. API/Data Flow

- UI-Selection (Entry-ID) → `entry.profile` (Snapshot-Objekt) → `fetchJobs(profile)`:
  Query skills/targetRole/city/radiusKm/workMode/employmentType (`src/api.ts:222-233`) →
  `GET /api/jobs` → Pool → `fetchMatches(profile, jobs)` → `POST /api/match`
  (max 10 Kandidaten, AI-Scoring). Nur UI-State: Dropdown-IDs, Overlay-Selection,
  `atsProfileName`-Eingabe, Upload-/Consent-/Step-States.
- ATS-Pfad: `activeAtsEntry` → synthetisches Profil (nur skills/targetRoles, Rest leer/
  Defaults `:2301-2309`) → `ATSModal` → `POST /api/ats-analysis`. SearchProfile und
  ATS-Profil werden unterschiedlich behandelt (Suche vs. Analyse); ein ATS-Eintrag
  erreicht die Suche auf keinem Pfad — „Ausschluss des SearchProfils" findet nicht
  statt, weil keine Konkurrenz besteht.
- Suchbeeinflussend: ausschließlich das übergebene `Profile`-Objekt (+ Modell);
  ATS-Auswahl beeinflusst die Suche **gar nicht**.

## 7. Edit Flow

- Mehrere SearchProfiles/ATS-Profile: erstell- und editierbar (je ein Save pro
  Durchlauf, Cap 50/Bucket; gleiche Namen überschreiben — CV-UPLOAD-UX-08).
- Zuordnung bleibt erhalten, weil es keine zu brechende Zuordnung gibt
  (Geschwister-Modell); Edit lädt Entry → Workflow-State (`:548-567`, `:578-594`),
  Save schreibt denselben Namen zurück (`saveCvSearchProfile`/`saveCvAtsProfile`).
- Kein versehentliches Verändern anderer Profile: Save adressiert pro Name/Bucket;
  Profilwechsel ändert nur Auswahl-IDs.
- Erneutes Öffnen: Einträge aus Session-Map gelesen (solange 12h-Fenster + kein
  Reload); Test `App.test.tsx:1383` (Box + Edit-Sprung + Überschreiben) belegt den
  Flow. Kein neues UI gebaut.

## 8. Browser E2E (echtes Chromium, Playwright 1.63 + Chrome, `vite dev`)

Live verifiziert (Skript/Artefakte in `/tmp`, Repo unberührt, Server danach gestoppt):
Matcher rendert fehlerfrei (kein JS-Error); vor Upload keine Saved-Box (erwartet);
PDF-Upload legt Dokument client-seitig an (Name sichtbar, Consent-Step, **kein
Netzwerk-/AI-Call**); Saved-Box/Dropdowns erscheinen ohne gespeicherte Profile nicht
(erwartet); **Reload leert Dokumente + Box** (Session-Only live bewiesen).
E2E-Fälle B–F (Profil wählen, Suchen, Netzwerk-Assert) live NICHT ausführbar:
Profil-Erstellung braucht `/api/profile` (Serverless + AI-Keys; unter `vite dev`
nicht vorhanden; AI-Calls wären kostenpflichtig) — stattdessen lückenlos statisch
verfolgt (jede Verzweigung bis zumAPI-Call) plus jsdom-Belege
(`CvDocumentList.test.tsx`, `App.test.tsx:1383,1526`). Keine Testdaten verändert
(Session-only, Reload = Ausgangszustand).

## 9. Functional Relationship

Funktional vorhanden: **CV-Bucket → beide Listen (Co-Anzeige)** + **ATS-Auswahl →
Analyse-Profil-Override**. Funktional NICHT vorhanden: Search→ATS-Filterung,
ATS→Suche-Einspeisung, Mehrfach-ATS. Die funktionale Beziehung ist schwächer als die
Auftragsprämisse (§2-Punkte 4–6) — kein Fehler im implementierten Verhalten, sondern
Abweichung der Prämisse vom Code.

## 10. Persistence Relationship

Unverändert wie 01/02: keine Parent-Kante persistiert (kein `parentId`/`searchProfileId`/
FK; Geschwister-Arrays pro Hash). **Gap zwischen funktional und persistiert: NEIN** —
es gibt keine versteckte funktionale Kante, die persistiert fehlt; Co-Anzeige braucht
keine Kante. 02 bleibt wörtlich gültig.

## 11. Comparison with PROFILE-HIERARCHY-01

01 bestätigt in allen Punkten (10/Session, 50/Hash, Geschwister, Snapshot, Session-only,
kein User). Präzisiert: funktionale Rolle der ATS-Einträge = Analyse-Override, nicht
Sucheingabe — stützt 01-§7 („nicht mit ATS-Analyse-Ergebnis verwechseln") und die
02-Regel „ATS-Ausführung bleibt Jobsearch". Kein 01-Befund relativiert.

## 12. Comparison with PROFILE-HIERARCHY-02

02 bestätigt und verstärkt: Die §4-Relationsprüfung (keine FK) wurde hier unabhängig
über den kompletten UI→API-Fluss repliziert — auch funktional existiert keine
Search→ATS-Kante (kein Filter, kein Lookup, keine Map). Migrations-Risiko (§9:
Attribution unmöglich) bleibt unverändert; Strategie-Tabelle unberührt.
Offen bleibt alles aus 02-§13.

## 13. Confirmed Facts (Antworten auf §9-Zielfragen)

1. CV → SearchProfile: JA (Hash-Bucket + Entry-ID, dok-wechsel-sicher). 2. SearchProfile →
   ATS: NEIN (Co-Anzeige, kein Filter). 3. Search-only: JA (Code + Test). 4. ATS-only
   Search: NEIN (existiert nicht; ATS wirkt nur in Analyse). 5. ATS-Priorität vs. Search:
   gegenstandslos für Suche; in Analyse JA (Override). 6./7. Mehrere Search JA / mehrere
   ATS gleichzeitig NEIN (single-select). 8. Editieren JA (beide Typen + Test).
9. Funktionale Zuordnung: CV-Bucket + Analyse-Override. 10. Persistierte Zuordnung:
   keine Kante. 11. Gap funktional/persistiert: keiner.

## 14. Open Questions

- Soll CASE B (ATS als Sucheingabe) je Produktwunsch werden, oder bleibt ATS
  Analyse-Kontext (dann Prämisse als überholt markieren)?
- Soll die ATS-Box je SearchProfile filtern (erfordert erst Parent-Modell aus 02)?
- Ist Single-ATS-Auswahl ausreichend, oder Mehrfach-Konzept gewünscht?
- Navbar-„Login" (`Navbar.tsx:142-144,177-178`, `aria-disabled`, Kommentar
  „noch ohne Funktion (Prototype-Vorbereitung)"): UX-Erwartung ohne Funktion —
  bewusst so lassen oder kennzeichnen? (Nebenbefund, kein Gate-Gegenstand.)
- 02-§13-Fragen bleiben vollständig offen.

## 15. Final Status

Alle existierenden Pfade lückenlos bis API/Test/Browser nachgewiesen und konsistent;
keine falsche Suchausführung gefunden (Suche nutzt immer exakt das gewählte
SearchProfile). Die Auftragsprämisse Punkte 4–6 (per-Search-ATS-Box, ATS-only-Suche,
Mehrfach-ATS) ist im Code nicht vorhanden — kein funktionaler Fehler, sondern
Prämissen-Abweichung → **YELLOW**. Kein AI-Datenfluss/Modell geändert → keine
AI_AUDITLOG-Änderung (`docs/AI_AUDITLOG.md`-Template als Execution-Log-Pflicht durch
diesen Report erfüllt, Template-Datei unverändert).

## Audit-Nachweis (AI_AUDITLOG-pflichtig)

- Status: YELLOW (s. §15; keine Fehlersuche erfunden, kein GREEN für Nichtexistentes)
- Zeitpunkt: 2026-10-03; Branch: main; HEAD: `2e5cd41` (Audit-Stand; Commit folgt)
- Terraform-Checks: nicht anwendbar (keine Infra; keine ausgeführt)
- Tests/Build/tsc: nicht gestartet (Doku-only); vorhandene Tests ausgewertet
  (`CvDocumentList.test.tsx`, `App.test.tsx:1383,1526`, `cvProfileStore.test.ts`)
- Browser E2E: Chromium/Playwright gegen lokales `vite dev` (Matcher-Render,
  Upload-Anlage, Reload-Volatilität, null JS-Errors); Server danach gestoppt,
  `/tmp`-Artefakte entfernt; keine Repo-Dateien berührt, keine Testdaten verändert
- Git-Status: vor Audit nur vorbestehende `docs/screenshotsfordev/`-Diffs
  (2 deleted, 2 untracked)
- Geänderte Dateien: ausschließlich `docs/reports/PROFILE-HIERARCHY-03-EXECUTION_LOG.md` (neu)
- Risiken: keine (read-only; Prämissen-Abweichung sachlich dokumentiert)
- Nächste Schritte: keine (Report + Commit; kein Folge-Gate ohne Beauftragung)
- Resume-Punkt: abgeschlossen, bereit zum Commit

---

## AI-Audit-Prüfung (taskseitig gefordert)

Geprüft, ob dieser Task eine relevante AI-/Privacy-/Data-Flow-Entscheidung dokumentiert:
NEIN — Fluss-Audit ohne Datenfluss-/Modelländerung. Keine AI-Audit-Ergänzung erzeugt.
