# RIS-JOBSEARCH-02

## Status
GREEN

## Scope
Decision Matrix / Target Boundary — analysis only

- Datum: 2026-10-03; Branch: main, HEAD: 78baf57
- Source of Truth: `docs/reports/RIS-JOBSEARCH-01-EXECUTION_LOG.md` (20 Open Questions vollständig übernommen, keine umformuliert), PERSISTENCE-BOUNDARY-01, PROFILE-STATE-01, PROFILE-TAB-STATE-01, aktueller Repository-Zustand (seit 78baf57 keine Codeänderung — nur vorbestehende `docs/screenshotsfordev/`-Diffs, nicht angefasst).
- KEIN Code, KEINE API-Implementierung, KEIN ProfileStore, KEIN Adapter, KEINE Auth, KEINE Migration, KEIN Persistenz-Refactor, KEINE Änderung an `src/`, `api/`, `tests/`, Config.
- Regeltreue: Aus "RIS Candidate" wurde NICHT "RIS Owner" (Regel 1); keine Architekturentscheidung erfunden — ohne Evidenz → OPEN (Regel 2); alle KEEP-Positionen aus 01 bestätigt (Regel 3); Cache/Vorschlag/Blobs/Ergebnisse nicht verschoben (Regeln 5–7); `experienceLevel`, Linien-Trennung, ATS-Typisierung, Gast-Migration, Hash-Verbot, Provider-Nichtspekulation beachtet (Regeln 8–13).

## 1. Executive Decision Boundary

- Weiterhin zu Jobsearch: Workflow/UI, Jobsuche + externe Job Sources, Search-/Matching-Ausführung, ATS-Regelwerk und ATS-Analyse-Ausführung, KI-Ausführung/Provider-Routing, transiente Ergebnisse, technische Caches (einschließlich Redis `cv-profile:<hash>`, 30d, Kosten-Cache), Quota/Usage, anonyme Session-Mechanik, lokale Anonymisierung.
- RIS-Kandidat (NICHT Owner — Ownership erst nach Entscheidung): bestätigtes `cvProfile`, benannte Search-/ATS-Einträge (inkl. Namen/Metadaten), Alert-Abos (mit Inhaberschafts-Vorbehalt).
- Darf erst nach Identitäts-/Consent-Entscheidung verschoben werden: alles Personenbezogene/Dauerhafte — Profile, Einträge, Abos, Delete-/Export-Verantwortung (Gate Q5–Q10, Q12, Q15, Q16).
- Bleibt ausdrücklich offen: Kanon inkl. `experienceLevel`, Linien-Frage (Search vs. CV), ATS-Typisierung, Ownership-Zuordnung, Delete-/Export-Semantik, Migration der 12h-Snapshots, Tenant-Isolation, RIS-Vertrag, ID-Neuregelung, Cache-Delete-Handhabung, Provider-Retention.

## 2. Decision Matrix

| # | Open Question | Kategorie | Warum | Konsequenz für Grenze | Status |
|---|---|---|---|---|---|
| 1 | Kanonische RIS-Profilform (`Profile` vs. Teilmenge vs. erweitert)? Wer entscheidet? | A) MUST CLARIFY BEFORE RIS | Schema-Entscheidung mit Produktwirkung (Feldumfang, Pflichtfelder); RIS kann Vertrag erst danach bauen | Kein RIS-Schema, kein Adapter-Interface vor Kanon-Entscheidung; Q2/Q4/Q17 speisen Q1 zu | OPEN |
| 2 | `experienceLevel`: übernehmen, verwerfen, neu modellieren? | A) MUST CLARIFY BEFORE RIS | Geht heute beim Confirm verloren (`CvProfileResult.confirm`, kein Zielfeld); kanonische Quelle existiert nicht — Produkt-/Modellierungsentscheidung, keine ableitbare Default-Option | Level bleibt bis zur Entscheidung draußen (weder still übernehmen noch still verwerfen) | OPEN |
| 3 | Search- vs. CV-Profil: zwei Linien behalten oder vereinen? | A) MUST CLARIFY BEFORE RIS | TAB-STATE-01 hält Manual/CV getrennt (eigene States, eigene Flows, nur expliziter Transfer); Vereinigung wäre Produkt-/UX-Entscheidung mit Lösch-/Migrationsfolgen | Linien bleiben getrennt, bis explizit anders entschieden; kein gemeinsamer Store vorab | OPEN |
| 4 | ATS-Profil: RIS-Profiltyp, Projektion oder Jobsearch-Konfiguration? | A) MUST CLARIFY BEFORE RIS | Typisierung (volles `Profile` vs. Teilmenge vs. abgeleitete Sicht) bestimmt Owner und Speicherort; aus Code nicht ableitbar | Keine ATS-Typisierung in RIS vor Klärung; Ausführung bleibt in jedem Fall Jobsearch | OPEN |
| 5 | User Identity: welches IdP-/Kontomodell? | A) MUST CLARIFY BEFORE RIS | Fundament für Ownership/Isolation/Delete; Org-/Produkt-Entscheidung, kein Architekturdetail | Keine Identität → kein RIS-Code (Gate) | OPEN |
| 6 | Authentication: Verfahren, Lifetime, Refresh, Logout? | A) MUST CLARIFY BEFORE RIS | Sicherheits-/UX-Entscheidung vor jeder Implementierung; `mj_session` ist kein Ersatz | Kein Auth-Code vor Verfahren-Entscheidung | OPEN |
| 7 | Ownership: welche Objekte gehören RIS vs. Jobsearch vs. Browser (verbindlich)? | A) MUST CLARIFY BEFORE RIS | Genau diese Matrix bereitet die Entscheidung vor; Kandidaten ≠ Owner (Regel 1) | Keine Verschiebung vor Ownership-Entscheidung | OPEN |
| 8 | Delete: Kaskaden, Fremd-Delete-Schutz, Nachweis? | A) MUST CLARIFY BEFORE RIS | Fachlich + rechtlich relevant (Widerruf → Kette); betrifft RIS, Caches, Abos, Provider-Schnittstellen | Kein persistenter RIS-Store ohne Delete-Semantik | OPEN |
| 9 | Export: Format/Umfang (inkl. Analysen?), maschinell + menschenlesbar? | A) MUST CLARIFY BEFORE RIS | Umfang (welche Kategorien, inkl. Momentaufnahmen?) ist Produkt-Scope; Format folgt danach | Kein Export-Bau vor Umfangs-Entscheidung | OPEN |
| 10 | Storage Consent: Scope, Granularität, Widerrufspfad, Nachweis? | A) MUST CLARIFY BEFORE RIS | Speicher-Consent existiert nicht (nur KI-Consent, technisch ungetrennt); dauerhafte Speicherung braucht erstmals Umfang/Dauer/Zweck + Widerruf→Delete | Keine RIS-Speicherung vor Consent-Modell | OPEN |
| 11 | Redis-Cache-Delete: Endpoint + Auth oder TTL als ausreichend? | B) RIS DECISION | Beide Optionen sind im Zielarchitekturdesign entscheidbar (Delete-Semantik im Contract vs. dokumentierte TTL-Begründung); keine Jobsearch-Fachhoheit nötig | Cache bleibt Jobsearch-Cache (Regel 5); Handhabung im Design festlegen, Privacy-Sign-off begleitend | OPEN |
| 12 | Session Binding: anonyme Quota-Welt mit Auth-Welt verbinden oder trennen (Gast→User)? | A) MUST CLARIFY BEFORE RIS | Migrations-/UX-Entscheidung mit Datenfolgen (Regel 11: explizit entscheiden); keine implizite Hash-Zuordnung | Keine Verknüpfung von `mj_session`-Zählern mit User-Identität vor Entscheidung | OPEN |
| 13 | Tenant Isolation: Mandantenmodell, Isolationstests, Cross-Tenant-Schlüssel? | B) RIS DECISION | Rein RIS-interne Architektur (Jobsearch liefert keine Tenant-Hinweise — nur anonyme Session); im RIS-Design entscheidbar | Isolation im RIS-Design nachweisen, sobald Identität (Q5) steht | OPEN |
| 14 | RIS API Contract: Base-URL, Versionierung, Schema, CRUD-/Fehler-Semantik, Pagination, Limits? | B) RIS DECISION | Vertragsarbeit des RIS-Designs; setzt entschiedene A-Punkte (Kanon, Ownership, Delete/Export) voraus, ersetzt sie nicht | Kein Contract-Draft mit Lücken als verbindlich behandeln; erst nach A-Entscheidungen | OPEN |
| 15 | Migration 12h-Snapshots: verfallen lassen, übernehmen, neu speichern? | A) MUST CLARIFY BEFORE RIS | Identitätslose Snapshots sind ohne User-Kontext nicht zuordenbar (Regel 11); Verfallen vs. Übernehmen ist Produktentscheidung | Keine Migration vor Identitäts- + Ownership-Entscheidung | OPEN |
| 16 | Alert-Inhaberschaft: Double-Opt-in/Verify vor Übernahme? | A) MUST CLARIFY BEFORE RIS | E-Mail-Schlüssel heute ohne Nachweis (POST/DELETE frei); Übernahme in RIS braucht Inhaberschafts-Verfahren (Produkt-/Privacy-Entscheidung) | Keine Abo-Migration ohne Verify-Verfahren | OPEN |
| 17 | `radiusKm`/`workModes`/`employmentTypes`: Profil- oder Suchkontext? | A) MUST CLARIFY BEFORE RIS | Modellierungsentscheidung schränkt Kanon (Q1) ein; aus Code nicht ableitbar (ATS-Einträge kennen sie nicht) | Fließt in Q1-Entscheidung ein; keine Vorab-Festlegung | OPEN |
| 18 | Hash-Kollisionen (nutzerübergreifende Cache-Treffer) akzeptabel? | B) RIS DECISION | Betrifft Jobsearch-internen Kosten-Cache (Regel 5/12: nie Ownership-Schlüssel); Key-Hygiene (Namespace/Salting/Trennung) im Design entscheidbar | Hash bleibt Cache-Key, wird nie Identität; Handhabung im Design | OPEN |
| 19 | Provider-Aufbewahrung (Modell-/Mail-/Hosting-Lösch- und Logging-Politik)? | D) UNKNOWN / EXTERNAL | Information liegt außerhalb des Repos; keine Evidenz, keine Spekulation (Regel 13) | Als externe Zulieferinfo anfordern; bis dahin UNKNOWN — blockiert kein Design, markiert Restrisiko | OPEN |
| 20 | Saved-IDs (`entry-<ts>-<rand>`) als RIS-IDs ungeeignet — Neuregelung? | B) RIS DECISION | ID-Schema (serverseitig, global eindeutig, exportstabil) ist reine Contract-/Design-Arbeit ohne Jobsearch-Fachhoheit | Neues ID-Schema im RIS-Design (Teil von Q14); heutige IDs nicht übernehmen | OPEN |

Hinweis zu Kategorie C: Keine der 20 Fragen fällt in C — alle bewussten KEEP-Positionen (Jobsearch-Fachlogik, Caches, Quota, Workflow) sind bereits in 01 entschieden und in Abschnitt 3 bestätigt.

## 3. Target Ownership Boundary

JOBSEARCH (bestätigt, unverändert):
- Workflow/UI (Manual Tab, CV Tab, Confirm/Edit/Dropdowns, Consent-UX, Remove-Pfade)
- Job Search-Ausführung, externe Job Sources, Search-/Matching-Ausführung
- ATS-Regelwerk (`ats.mjs`) und ATS-Analyse-Ausführung (inkl. KI-Formulierungen mit Consent)
- KI-Ausführung/Provider-Routing (`/api/profile`, `/api/match`, Modelle)
- Transiente Ergebnisse (ATS-/Match-/Such-Resultate, `dataset`)
- Technische Caches (Redis `cv-profile:<hash>` 30d als Kosten-Cache, Job-Caches 600s, Details 7d, Geo/Usage-Zähler)
- Quota/Usage-Durchsetzung, anonyme Session-Mechanik (`mj_session`), lokale Anonymisierung

RIS (durch diese Matrix festgelegte Verantwortung):
- (noch keine — Ownership wird erst durch die A-Entscheidungen vergeben; Kandidaten s. OPEN, keine Vorab-Zuweisung per Regel 1)

SHARED / CONTRACT (erst nach A-Entscheidungen definierbar, daher noch kein Inhalt):
- Profil-Transfer-Schema Jobsearch→RIS (nach Kanon Q1)
- Auth-Kontext-Propagation (nach Q5/Q6)
- Delete-/Export-Semantik über die Grenze (nach Q8/Q9)

OPEN (ungeklärt — deckungsgleich mit A-Status):
- Kanon inkl. `experienceLevel` (Q1/Q2), Linien-Frage (Q3), ATS-Typisierung (Q4), Identität/Auth (Q5/Q6), Ownership (Q7), Delete/Export (Q8/Q9), Consent-Modell (Q10), Session-Binding + Snapshot-Migration (Q12/Q15), Alert-Verify (Q16), Suchkontext-Felder (Q17); Design-offen: Cache-Delete (Q11), Tenant (Q13), Contract (Q14), Hash-Hygiene (Q18), ID-Schema (Q20); extern: Provider-Retention (Q19)

## 4. Data Classification

| Daten | Klassifikation | Begründung |
|---|---|---|
| `cvProfile` | RIS CANDIDATE | Bestätigt, vollwertig — aber Owner erst nach Q1/Q7 |
| `suggestedProfile` | TRANSIENT | Unbestätigter Vorschlag (Regel 6) |
| Search Profile (gespeichert) | RIS CANDIDATE | Benannte Snapshots — Owner erst nach Q1/Q3/Q7 |
| ATS Profile (gespeichert) | RIS CANDIDATE | Typisierung offen (Q4); Ausführung bleibt Jobsearch |
| `App.profile` | JOBSEARCH DATA | Manuelle Sitzungslinie; Aufwertung zu RIS unentschieden |
| `experienceLevel` | UNKNOWN | Quelle/Zukunft offen (Q2); Evidenz reicht nicht |
| `File` (CV-Blob) | TRANSIENT | Nie serialisiert, Sitzungs-Heap (Regel 7) |
| Roh-/Anonym-Text | TRANSIENT | Lokale Variablen, kein Store (Regel 7) |
| `selectedSkills` | TRANSIENT | Step-Arbeitskopie, kein Eigenprofil (Regel 7) |
| ATS-/Match-/Such-Ergebnisse, Jobs | TRANSIENT | Reproduzierbar/fremd (Regel 7; Job-Caches separat CACHE) |
| Redis `cv-profile:<hash>` | CACHE | Kosten-Cache 30d, kein CRUD (Regel 5) |
| Alerts (E-Mail + Profil) | RIS CANDIDATE | Mit Inhaberschafts-Vorbehalt (Q16) |
| Document-/Entry-/Auswahl-IDs | TRANSIENT | Technisch, Sitzung/12h-Fenster |
| CV-Hash | TRANSIENT (+ Cache-Key) | Sitzungs-State; KEINE Identität (Regel 12) |
| `mj_session` + Quota-Zähler | JOBSEARCH DATA | Anonyme Missbrauchsabwehr, bleibt (Q12 trennt/verbindet erst) |
| `ats.mjs`/Prompts/Anonymisierung | JOBSEARCH DATA | Fachlogik/Code, keine Daten (Regel 3) |
| `cvState.profile`, Improvement-Pfad, `doc.skills` | TRANSIENT (tot) | Kein Live-Inhalt; kein Migrationsziel |
| Provider-seitige Daten | UNKNOWN | Evidenz fehlt (Q19) |

## 5. RIS Implementation Gate

Vor der ersten Zeile RIS-Code müssen entschieden sein (Referenz = Q-Nummern aus Abschnitt 2):

1. [Q5/Q6] Identitäts- und Auth-Verfahren (IdP, Token-Lifetime, Logout)
2. [Q1/Q2/Q17] Kanonische Profilform (Felder, Level, Suchkontext-Abgrenzung)
3. [Q3] Linien-Entscheidung (Search vs. CV getrennt oder vereint)
4. [Q4] ATS-Typisierung (Profiltyp vs. Projektion vs. Konfiguration)
5. [Q7] Verbindliche Ownership-Zuordnung (RIS vs. Jobsearch vs. Browser)
6. [Q10] Speicher-Consent (Scope, Granularität, Widerruf, Nachweis) — getrennt vom KI-Consent
7. [Q8] Delete-Semantik (Kaskaden, Fremdschutz, Nachweis)
8. [Q9] Export-Umfang (Kategorien inkl./exkl. Analysen)
9. [Q12/Q15] Gast→User-Regime (Binding oder Trennung; Snapshot-Verfall oder -Migration)
10. [Q16] Alert-Verify-Verfahren vor Abo-Übernahme

Design-begleitend (B, nach Gate-Öffnung im RIS-Design): Q11 (Cache-Delete), Q13 (Tenant), Q14 (Contract), Q18 (Hash-Hygiene), Q20 (ID-Schema). Extern parallel: Q19 (Provider-Retention anfordern).

## 6. Explicit Non-Goals

Diese Aufgabe enthält ausdrücklich NICHT (nichts davon wurde begonnen oder vorbereitet):
- kein ProfileStore (weder Interface noch GuestSession-/RIS-Adapter)
- kein RISAdapter und kein API-Client
- keine Auth (kein IdP, keine Tokens, keine Middleware)
- keine Migration (kein Snapshot-Transfer, kein Backfill)
- kein API-Code (keine neuen Endpoints, keine `/api/v1`)
- kein Persistenz-Refactor (12h-Store, Redis-Keys, TTLs unverändert)

## 7. Open Decisions Remaining

Echte offene Produkt-/Fachentscheidungen (alle A-Status aus Abschnitt 2): Q1 (Kanon), Q2 (Level), Q3 (Linien), Q4 (ATS-Typ), Q5 (Identität), Q6 (Auth), Q7 (Ownership), Q8 (Delete), Q9 (Export-Umfang), Q10 (Consent), Q12 (Session-Binding), Q15 (Snapshot-Migration), Q16 (Alert-Verify), Q17 (Suchkontext-Felder). Design-offen (B): Q11, Q13, Q14, Q18, Q20. Extern (D): Q19.

## 8. Evidence

- 20 Fragen: `docs/reports/RIS-JOBSEARCH-01-EXECUTION_LOG.md:237-256` (vollständig, wörtlich übernommen).
- Klassifikations- und Regelgrundlagen: 01-Kapitel Current Ownership, Profile Model Analysis, Kanon-Matrix, Identity, Authentication, API Boundary, CV Data Flow, Privacy, Delete/Export Boundary, ProfileStore Assessment, RIS-Relevance Matrix, Diagramme (`RIS-JOBSEARCH-01:1-233`); Vorbefunde PERSISTENCE-BOUNDARY-01 (12h/TTL/Remove), PROFILE-STATE-01 (Linien, toter `profile`-State, Snapshot-vs-Arbeitskopie), PROFILE-TAB-STATE-01 (Tab-Trennung, herkunftsbewusster Reset `src/App.tsx:37-50,67,479-518`).
- Repo-Stand: HEAD 78baf57; keine Codeänderung seit 01 (verifiziert via `git log`/`git status` — nur vorbestehende `docs/screenshotsfordev/`-Diffs).
- Regelanker im Task: 1 (Kandidat≠Owner) → RIS-Sektion leer; 5 (Cache) → Q11/Q18 als B; 6 (Vorschlag) → TRANSIENT; 7 (Blobs/Texte/IDs/Ergebnisse) → TRANSIENT; 8–10 (Level/Linien/ATS) → A; 11 (Gast-Migration explizit) → Q12/Q15 als A; 12 (Hash-Verbot) → Hash TRANSIENT + Q18 als B; 13 (keine Spekulation) → Q19 als D.

---

## Audit-Nachweis (AI_AUDITLOG-pflichtig)

- Status: GREEN (alle 20 Fragen kategorisiert, Regeln eingehalten, keine Entscheidung erfunden, keine Codeänderung)
- Zeitpunkt: 2026-10-03; Branch: main; HEAD: 78baf57
- Terraform-Checks: nicht anwendbar (keine Infra; keine ausgeführt)
- Tests/Build/tsc: nicht erforderlich (Analyse-only, keine Codeänderung) — nicht ausgeführt
- Git-Status: nur vorbestehende `docs/screenshotsfordev/`-Diffs (2 deleted, 2 untracked) — nicht angefasst, nicht gestagt
- Geänderte Dateien: ausschließlich `docs/reports/RIS-JOBSEARCH-02-EXECUTION_LOG.md` (neu)
- Risiken: keine (read-only)
- Nächste Schritte: A-Entscheidungen (Gate Abschnitt 5) durch Produkt/Fach — danach erst RIS-Design (B)
- Resume-Punkt: abgeschlossen, bereit zum Commit
