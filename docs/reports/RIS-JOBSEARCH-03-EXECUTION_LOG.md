# RIS-JOBSEARCH-03

## Status
YELLOW

## Scope
A-Decision Resolution / Target Boundary — Analyse- / Architektur-Entscheidung ONLY

- Datum: 2026-10-03; Branch: main, HEAD: a1ba443
- Source of Truth: RIS-JOBSEARCH-01, RIS-JOBSEARCH-02 (14 A-Fragen), PERSISTENCE-BOUNDARY-01, PROFILE-STATE-01, PROFILE-TAB-STATE-01, aktueller Repository-Zustand.
- Repo-Verifikation: Seit 02 keine Code-/Doku-Änderung außer dem AI_AUDITLOG-Nachtrag (a1ba443); keine IdP-/Auth-/Produktvorgabe gefunden (kein Cognito/Keycloak/Auth0/Magic-Link/OIDC/OAuth/SSO/Login in `src/`, `api/`, `docs/*.md`; ROADMAP/ARCHITECTURE enthalten keine Identity-Entscheidung).
- KEIN Code, KEINE API-Implementierung, KEIN ProfileStore, KEIN Adapter, KEINE Auth, KEINE Migration, KEIN Persistenz-Refactor, KEINE Änderung an `src/`, `api/`, `tests/`, Config, Infrastruktur.
- Entscheidungsregel strikt angewendet: DECIDED nur bei tragfähiger Quellen-Evidenz; sonst OPEN (keine Vorgabe) bzw. BLOCKED (abhängig von offener Vorentscheidung). Keine Präferenz-, Best-Practice- oder Design-Erfindung.

## 1. Executive Decision Summary

Ergebnis: DECIDED 0, OPEN 8, BLOCKED 6. Keine der 14 A-Entscheidungen ist aus den Quellen ableitbar — es existiert keine fachliche Produktvorgabe zu Identität, Auth, Kanon, Consent, Delete, Export oder Migration. Folglich ist das RIS Implementation Gate BLOCKED. Das ist kein Analyseversagen, sondern das regelkonforme Ergebnis (kein künstliches GREEN, keine erfundene Entscheidung).

## 2. A-Decision Matrix

| # | Entscheidung | Status | Entscheidung | Begründung | Konsequenz | Voraussetzung |
|---|---|---|---|---|---|---|
| 1 | User Identity (IdP-/Kontomodell) | OPEN | Keine Festlegung möglich | Weder Repo noch Reports noch ROADMAP/ARCHITECTURE nennen einen Provider oder ein Kontomodell; E-Mail existiert nur als ungeprüfter Alert-Schlüssel. `mj_session` und CV-Hash sind per Befund KEINE Identitäten | Identitätsfrage zurück an Produkt/Org; bis dahin keine Ownership-, Tenant- oder Migration-Entscheidung | Produktentscheidung IdP |
| 2 | Authentication (Login-Modell, Token, Lifetime, Refresh, Logout, API-Auth) | OPEN | Keine Festlegung möglich | Kein Login-Modell vorgegeben; einzige Tokens im Repo sind Operator-Maschinen-Secrets (`USAGE_DIAGNOSTICS_TOKEN`, `CRON_SECRET`), kein Benutzer-Kontext | Kein Auth-Code, keine Lifetime-Annahmen; API-Auth erst mit Q1-Entscheidung | Q1-Entscheidung |
| 3 | Kanonische RIS-Profilform | OPEN | Keine Festlegung möglich | Drei Formen + zwei Eintragstypen ohne Kanon-Aussage in den Quellen; automatische Vereinigung per Regel 9 (02) untersagt | Kein RIS-Schema, kein Adapter-Interface; Q4/Q13-Ergebnisse speisen später ein | Produktentscheidung Kanon |
| 4 | `experienceLevel` (übernehmen/verwerfen/neu) | OPEN | Keine Festlegung möglich | Verlust beim Confirm ist belegt, kanonische Quelle existiert nicht; Übernahme wie Verwerfung wären Erfindung (Regel 8 aus 02) | Level bleibt bis zur Entscheidung außerhalb jeder RIS-Form; Datenherkunft (KI-Extrakt vs. Nutzerangabe) mitentscheiden | Produktentscheidung (speist Q3) |
| 5 | Search- vs. CV-Profil (trennen/vereinen/Projizieren) | OPEN | Keine Festlegung möglich | TAB-STATE-01 hält beide Flows getrennt; Zusammenführung, gemeinsamer Kanon und Projektionsmodell sind Produkt-/UX-Entscheidungen ohne Vorgabe | Linien bleiben getrennt; kein gemeinsamer Store, kein verschmolzenes Formular vorab | Produktentscheidung Linien |
| 6 | ATS-Profil (Vollprofil/Teilprofil/Projektion/Konfiguration) | OPEN | Keine Festlegung möglich | Typisierung aus Code nicht ableitbar (reduzierte Teilmenge + Overlay-Defaults); Aufwertung zum RIS-Profil per Regel untersagt | ATS-Ausführung bleibt Jobsearch; Typisierung wartet auf Produktentscheidung (speist Q3) | Produktentscheidung ATS-Typ |
| 7 | Ownership (RIS vs. Jobsearch vs. Browser vs. Cache vs. Shared) | BLOCKED | Keine Zuweisung möglich | Setzt Identität (Q1) und Kanon (Q3) voraus — beide OPEN; Kandidaten ≠ Owner (Regel 1 aus 02) | Nichts wird verschoben; 02-Kandidatenliste bleibt Kandidatenliste | Q1 + Q3 DECIDED |
| 8 | Storage Consent (Scope, Dauer, Widerruf, Nachweis; Trennung vom KI-Consent) | OPEN | Keine Festlegung möglich | Speicher-Consent existiert nicht; Scope/Dauer/Widerruf sind fachlich-rechtliche Vorgaben ohne Quelle; KI-Flow (PII→Anonymisierung→Consent→Modell-Call) bleibt unberührt | Keine dauerhafte RIS-Speicherung vor Consent-Modell; Trennung Verarbeitung/Speicherung mitentscheiden | Produkt-/Privacy-Entscheidung |
| 9 | Delete (Bedeutung, Umfang, Kaskade, Nachweis) | BLOCKED | Keine Semantik festlegbar | Umfang setzt Ownership (Q7) und Consent/Widerruf (Q8) voraus — beide nicht entschieden; Kaskaden (Caches, Abos, Provider) ohne Owner nicht definierbar | Kein persistenter RIS-Store ohne Delete-Semantik; 30d-Cache-Frage (TTL vs. Endpoint) wartet mit | Q7 + Q8 DECIDED |
| 10 | Export (Formate, Objekte, Metadaten; Analysen/Jobs ausgenommen) | BLOCKED | Kein Umfang festlegbar | Objektumfang setzt Kanon (Q3), Linien (Q5) und Ownership (Q7) voraus — alle OPEN/BLOCKED; Format folgt dem Umfang | Kein Export-Bau; `experienceLevel`-Lücke (nur via Vorschlag rekonstruierbar) als Umfangsrisiko vermerkt | Q3 + Q5 + Q7 DECIDED |
| 11 | Gast→User (A verfallen / B übernehmen / C Import / D anderes) | BLOCKED | Keine Option wählbar | Alle Optionen brauchen Identität (Q1); automatische Hash-Zuordnung per Regel verboten; keine Produktvorgabe vorhanden | 12h-Snapshots verfallen faktisch weiter; keine Migration, kein Claim vor Q1 | Q1 DECIDED (+ Produkt выбор A–D) |
| 12 | Alert Ownership (Double-Opt-in, Login, Claim, Bestandsmigration) | BLOCKED | Kein Verfahren festlegbar | Inhaberschaft/Claim setzt Identität (Q1) voraus; Bestands-Abos sind ohne Nachweis nicht zuordenbar | Keine Abo-Migration; isoliertes Double-Opt-in wäre erst mit Produktentscheidung möglich | Q1 DECIDED (+ Produktentscheidung Verify) |
| 13 | `radiusKm`/`workModes`/`employmentTypes` (Profil vs. Suchkontext) | OPEN | Keine Festlegung möglich | Implementierung (ATS-Einträge kennen sie nicht) trägt keine fachliche Bedeutung (Regel aus 02-Aufgabe); Modellierung ist Produktentscheidung | Fließt in Q3 ein; keine Vorab-Festlegung, keine Schema-Annahme | Produktentscheidung (speist Q3) |
| 14 | Abhängige Vertragsentscheidungen (Profil-ID, userId-Key, Naming, CRUD, Versionierung, Pagination, Errors) | BLOCKED | Nichts festlegbar | Jede Position setzt Kanon/Identität/Ownership (Q3/Q1/Q7) voraus — alle nicht entschieden; vollständiger Contract war schon in 02 Non-Goal | Kein Contract-Draft als verbindlich behandeln; ID-Schema wartet mit (heutige `entry-*`-IDs nicht übernehmen) | Q3 + Q1 + Q7 DECIDED |

Bilanz: DECIDED 0 — OPEN 8 (Q1, Q2, Q3, Q4, Q5, Q6, Q8, Q13) — BLOCKED 6 (Q7, Q9, Q10, Q11, Q12, Q14).

## 3. Detailed Decisions

- Q1/Q2 (Identität/Auth): Vollständig OPEN. Feststellbar war nur Negatives: kein IdP, kein Login-Modell, keine Lifetimes, keine Logout-Pfade; einzige Tokens sind Betriebs-Secrets. Jede Verfahrenswahl (E-Mail-Link, OIDC, Fremd-IdP) läge außerhalb der Quellen. Abhängige: Q7, Q11, Q12, Q14.
- Q3/Q5/Q13 (Kanon/Linien/Suchkontext): Vollständig OPEN. Der gemeinsame Kern (`skills`, `targetRoles`, Ort) ist Evidenz, aber kein Kanon — Kanon erfordert Pflichtfeld-, Typ- (String vs. Liste) und Scope-Entscheidung. Linien-Trennung ist Ist-Zustand mit Fix-Garantie (TAB-STATE-01), keine Zukunftsentscheidung.
- Q4/Q6 (Level/ATS-Typ): Vollständig OPEN. Level: drei logische Optionen (übernehmen/verwerfen/neu), keine bevorzugt. ATS: drei logische Typisierungen (Vollprofil/Projektion/Konfiguration), keine bevorzugt; einzige feste Aussage: Ausführung bleibt Jobsearch (Regel 3 aus 02).
- Q8 (Consent): Vollständig OPEN. Einzige feste Aussagen: KI-Consent existiert (Sitzung + ATS-separat), Speicher-Consent existiert nicht, KI-Flow unverändert. Alles Weitere (Scope, Dauer, Nachweis, Trennung) braucht Vorgabe.
- Q7/Q9/Q10/Q11/Q12/Q14 (Ownership/Delete/Export/Migration/Alerts/Contract): BLOCKED mit benannten Voraussetzungen (s. Matrix). Keine Teilentscheidung vorweggenommen (z.B. kein Format ohne Umfang, keine IDs ohne Owner).
- Design-Entscheidungen aus 02 (B-Status: Cache-Delete, Tenant, Contract-Autorenschaft, Hash-Hygiene, ID-Schema) bleiben im RIS-Design entscheidbar und sind hier nicht erneut geöffnet — sie warten auf das Gate, blockieren es aber nicht als Produktfragen.

## 4. Target Ownership Boundary

## DECIDED TARGET BOUNDARY

### RIS OWNS
(leer — keine Ownership-Entscheidung getroffen; per Regel keine Kandidaten-Aufwertung)

### JOBSEARCH OWNS (bestätigt, unverändert)
- Workflow/UI (Manual Tab, CV Tab, Confirm/Edit/Dropdowns, Consent-UX, Remove-Pfade inkl. TAB-STATE-01-Fix)
- Job Search-Ausführung, externe Job Sources, Search-/Matching-Ausführung
- ATS-Regelwerk und ATS-Analyse-Ausführung (inkl. KI-Formulierungen mit Consent)
- KI-Ausführung/Provider-Routing (inkl. `/api/profile`-Extraktion)
- Transiente Ergebnisse (ATS-/Match-/Such-Resultate, `dataset`)
- Technische Caches (Redis `cv-profile:<hash>` 30d als Kosten-Cache, Job-Caches 600s, Details 7d, Geo/Usage)
- Quota/Usage-Durchsetzung, anonyme Session-Mechanik, lokale Anonymisierung

### SHARED VIA CONTRACT
(leer — kein Schnittstelleninhalt ohne Kanon/Identität/Ownership definierbar; Platzhalter erst nach Gate-Öffnung)

### TRANSIENT (Browser-/Workflow-Zustand, bleibt)
- `App.profile`, `cvProfile`, `suggestedProfile`, `documents`/`File`, Roh-/Anonym-Texte, `selectedSkills`, Auswahl-IDs, Consent-Flags, Ergebnisse, tote Pfade (`cvState.profile`, Improvement, `doc.skills`)

### CACHE (technisch, bleibt)
- Redis `cv-profile:<hash>`, Job-/Detail-/Geo-Caches, Usage-Zähler (alle per TTL, kein RIS-Store)

### STILL OPEN (alle nicht entschiedenen Punkte)
- Q1–Q6, Q8, Q13 (OPEN, Produktentscheidungen ausstehend) sowie daraus folgend Q7, Q9–Q12, Q14 (BLOCKED); Kandidaten (`cvProfile`, Search-/ATS-Einträge, Alerts) ohne Owner; B-Designpunkte und Q19 (extern) warten hinter dem Gate

## 5. Data Boundary

Gegenüber 02 unverändert (keine neue Evidenz, keine Entscheidung): `cvProfile` / Search- / ATS-Einträge / Alerts = RIS CANDIDATE (ohne Owner); `App.profile` = JOBSEARCH DATA; `experienceLevel` = UNKNOWN; `suggestedProfile` / Files / Texte / `selectedSkills` / IDs (außer Session/E-Mail) / Ergebnisse / tote Pfade = TRANSIENT; Redis-Cache = CACHE; Session-Mechanik/Regelwerke = JOBSEARCH DATA; Provider-Daten = UNKNOWN. RIS DATA — ONLY AFTER DECISION ist leer (nichts entschieden).

## 6. RIS Implementation Gate

RIS CODE MAY START ONLY IF (alle erforderlich):

- Identity = DECIDED (Q1) — IST: OPEN
- Authentication = DECIDED (Q2) — IST: OPEN
- Canonical Profile = DECIDED (Q3 inkl. Q4-Level und Q13-Suchkontext) — IST: OPEN
- Ownership = DECIDED (Q7) — IST: BLOCKED
- Storage Consent = DECIDED (Q8) — IST: OPEN
- Delete = DECIDED (Q9) — IST: BLOCKED
- Export = DECIDED (Q10) — IST: BLOCKED
- Guest → User = DECIDED (Q11) — IST: BLOCKED
- Alert Ownership = DECIDED (Q12) — IST: BLOCKED
- Profile/Search/ATS boundary = DECIDED (Q5/Q6) — IST: OPEN

RIS IMPLEMENTATION GATE = BLOCKED (alle 10 Bedingungen unerfüllt; 4 OPEN-Produktentscheidungen + 6 davon abhängige BLOCKED).

## 7. Remaining Open Decisions

Produkt (OPEN, Gate-relevant): Q1 Identität, Q2 Auth, Q3 Kanon, Q4 Level, Q5 Linien, Q6 ATS-Typ, Q8 Consent, Q13 Suchkontext. Folgend BLOCKED: Q7 Ownership, Q9 Delete, Q10 Export, Q11 Gast-Migration, Q12 Alert-Claim, Q14 Vertrag. Design-offen hinter dem Gate (02-B-Status, unverändert): Cache-Delete-Handhabung, Tenant-Modell, Contract-Autorenschaft, Hash-Hygiene, ID-Schema. Extern: Q19 Provider-Retention (UNKNOWN).

## 8. Explicit Non-Goals

Nicht begonnen, nicht vorbereitet, nicht beauftragt: kein ProfileStore, kein RISAdapter, kein API-Client, keine Auth-Implementierung, keine Migration, kein API-Code (keine Endpoints, keine `/api/v1`), kein Persistenz-Refactor (12h-Store, Redis-Keys, TTLs, Remove-Pfade unverändert), keine Consent-UX-Änderung, kein KI-Flow-Eingriff.

## 9. Evidence

- Matrix-Basis: `docs/reports/RIS-JOBSEARCH-02-EXECUTION_LOG.md` Abschnitt 2 (Q1–Q20 wörtlich) + Regeln 1–13 (Abschnitt 8-Evidence verweist auf Kap. 14-Logik: keine Erfindung ohne Quelle).
- Negativ-Evidenz IdP/Auth: Repo-Suche ohne Treffer (Cognito/Keycloak/Auth0/Magic-Link/OIDC/OAuth/SSO/Login/Registrierung) in `src/`, `api/`, `docs/*.md` inkl. ROADMAP/ARCHITECTURE; einzige Tokens = Operator-Secrets (`api/usage.mjs:3-41`, `api/cron/digest.mjs:60-68`); einzige Identität = anonym (`api/_lib/identity.mjs`).
- Kanon-Evidenz: `src/types.ts:42-56`, `src/lib/cvProfileStore.ts:17-30`, `src/components/CvProfileResult.tsx:50-63` (Level-Verlust), `src/App.tsx:2281-2292` (ATS-Defaults), 01-Kanon-Matrix (gemeinsamer Kern ≠ Kanon).
- Linien-Evidenz: PROFILE-TAB-STATE-01 (Fix `src/App.tsx:37-50,67,479-518`; Trennungs-Tests).
- Repo-Stand: HEAD a1ba443; seit 02 nur AI_AUDITLOG-Nachtrag (keine Produktvorgabe).

## 10. Audit-Nachweis (AI_AUDITLOG-pflichtig)

- Status: YELLOW (Gate BLOCKED bei 0/10 erfüllten Bedingungen; keine künstliche GREEN-Anhebung)
- Zeitpunkt: 2026-10-03; Branch: main; HEAD: a1ba443
- Terraform-Checks: nicht anwendbar (keine Infra; keine ausgeführt)
- Tests/Build/tsc: nicht erforderlich (Analyse-only, keine Codeänderung) — nicht ausgeführt
- Git-Status: nur vorbestehende `docs/screenshotsfordev/`-Diffs (2 deleted, 2 untracked) — nicht angefasst, nicht gestagt
- Geänderte Dateien: ausschließlich `docs/reports/RIS-JOBSEARCH-03-EXECUTION_LOG.md` (neu)
- Risiken: keine (read-only); Produktrisiko = keines erzeugt (keine Vorab-Festlegung getroffen)
- Nächste Schritte: Produktentscheidungen Q1–Q6, Q8, Q13 einholen (Gate-Öffner); danach Q7/Q9–Q12/Q14 entscheidbar, dann B-Design
- Resume-Punkt: abgeschlossen, bereit zum Commit

---

## AI-Audit-Prüfung (taskseitig gefordert)

Geprüft, ob dieser Task eine relevante AI-/Privacy-/Data-Flow-Entscheidung dokumentiert: NEIN — es wurde keine Entscheidung getroffen (0 DECIDED), kein Datenfluss verändert, kein Consent-/Privacy-Modell festgelegt. Folglich keine Ergänzung eines AI-Auditlogs; keine künstliche AI-Audit-Änderung erzeugt. (Alle fünf Execution Logs enthalten bereits ihren AI_AUDITLOG-Pflichtblock; PERSISTENCE-BOUNDARY-01 wurde am 2026-10-03 nachgetragen, Commit a1ba443.)
