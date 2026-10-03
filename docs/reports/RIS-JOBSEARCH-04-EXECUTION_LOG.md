# RIS-JOBSEARCH-04 — Identity & Product Contract Discovery (Gate)

## Status
YELLOW (Discovery abgeschlossen; Gate-Frage beantwortet, keine Architekturentscheidung getroffen)

## Scope
Reine Discovery / Beweisführung — KEINE Implementierung, KEINE Architekturänderung,
KEINE neuen Auth-Routen, KEINE Google-Implementierung, KEINE Frontend-Änderung, KEINE AWS-Mutation.

- Datum: 2026-10-03; Branch: main; HEAD: `cd6b393` (Stand bei Discovery-Beginn)
- Auftrag: Befund des JobSearch-Teams prüfen —
  „keine belastbare Vorgabe für IdP, Login/Auth oder das zukünftige RIS-Produktmodell".
- Methode: Repository-Suche (Dateinamen + Inhalte) über README, `docs/`, `docs/architecture/`,
  `api/`, `src/`, `.env.example`, Reports; keine Chat-/Modellwissens-Ergänzung.
- KEIN Code, KEINE Doku-Überschreibung, KEINE Config-/Infra-Änderung.
  Einzige neue Datei: dieser Report.

## 1. Repository Discovery — geprüfte Quellen (Phase 1)

Gelesen/verifiziert (Inhalte, nicht nur Namen):

- `README.md` — kein Auth-/IdP-/RIS-Kapitel; nur Provider-Keys (OpenRouter/EdenAI/Apify/Upstash/Resend)
- `docs/AGENTS.md` — Roadmap Phase 4: „real authentication, saved candidate profiles,
  application tracker" (Stichworte ohne Verfahren, ohne IdP, ohne Datum)
- `docs/ARCHITECTURE.md` — Gast-Flow, Provider-Router, CV-Cache, anonyme Session; kein IdP/JWT/RIS-Backend
- `docs/API_CONTRACT.md` v1.0.0 (TARGET, 2026-09-25) §7 — verbindliche Endpoint-Auth-Matrix (s. §3)
- `docs/API_INVENTORY.md` (code-validiert, HEAD `3cd58b8`) — IST-Auth je Endpoint
- `docs/ROADMAP.md` — Sprint 2.0/2.1: „candidate profile persistence", „Email verification on alert
  signup" (ohne Identity-/Auth-Spezifikation)
- `docs/API_DOCUMENTATION_STANDARD.md` / `docs/API_VERSIONING_STANDARD.md` — nur generische
  Auth-Schemata als Beispiel (`JWT → API Key` als Breaking-Beispiel; `Bearer <token>` als
  Tabellenzeile), KEINE projektspezifische JWT-Vorgabe
- `docs/architecture/AI_DATA_BOUNDARY_AND_INTERFACES.md` — Datenminimierung, Consent;
  letzter Satz: „These functions will be called by the Recruiting Intelligence System's Agent."
  (einzige zukunftsgerichtete RIS-Erwähnung im Architektur-Ordner — Aufrufabsicht, kein Contract)
- `docs/architecture/ATS_MODULE_AND_INTERFACES.md` — ATS-Regelwerk, kein Identity-Bezug
- `api/_lib/identity.mjs` — einzige implementierte Identität (s. §3)
- `src/types.ts:42-56` (`Profile`), `src/lib/cvProfileStore.ts` (12h-Session-Listen),
  `src/components/CvProfileResult.tsx:50` (Confirm) — Application Profile ohne Owner/Id
- `.env.example` — keine IdP-/Google-Login-/Cognito-Variablen (nur AI-/Job-/Mail-/Cache-Keys
  plus `CRON_SECRET`, `USAGE_DIAGNOSTICS_TOKEN` als Operator-Secrets)
- `docs/reports/RIS-JOBSEARCH-01/02/03-EXECUTION_LOG.md` — Vorbefunde (s. §2, als C gewertet)
- `docs/reports/GEO-WORKMODE-GOOGLE-AI-01-EXECUTION_LOG.md` — „Google" = Google-AI-Vorschläge zu
  Nominatim-Geocoding + WorkMode-Keywords; KEIN Google-Login/Federation
- `docs/reports/STEP_37G_13_SEARCH_PERSISTENCE_EXECUTION_LOG.md` — „13" = UI-Layout-Persistenz;
  KEIN Gate 13A/13B, KEIN Google-13B im Repository gefunden
- Kein Treffer repo-weit (`src/`, `api/`, `docs/*.md`, `.env.example`): Cognito, Keycloak, Auth0,
  Magic-Link, OIDC (User-Kontext), OAuth (User-Kontext), SSO, Login/Signup/Registrierung,
  JWT (User-Kontext), `tenantId`, `account linking`, Federation, Produktmodell, OpenAPI-Datei,
  Architecture Decision Records. (`OIDC`-Treffer nur Vercel-Deploy-Infra in
  `STEP_23C_RECOVERY_EXECUTION_LOG.md`; `tenant`-Treffer nur ATS-Multi-Board-Dedup und
  Provider-Board-Identifier in `ATS_JOB_SOURCES.md:173,302` — kein User-Tenant-Modell.)

## 2. Source of Truth — Kategorisierung (Phase 2)

| Befund | Kategorie | Begründung |
|---|---|---|
| Endpoint-Auth-Matrix (kein User-Login; anonyme Session; Token nur intern) | A — verbindlich dokumentiert | `API_CONTRACT.md` §7/§16 (TARGET v1.0.0) + `API_INVENTORY.md` (code-validiert) |
| Anonyme Session-Mechanik (`mj_session`, 128-Bit, IP-Backstop, kein Personenbezug) | A — dokumentiert + implementiert | `api/_lib/identity.mjs:32-45` (Kommentar: „never trust … beyond its shape") |
| Application-Profile-Typen + CV-Cache + 12h-Listen + Confirm-Flow | A (Typen/Flow) — dokumentiert + implementiert | `ARCHITECTURE.md`, `src/types.ts`, `cvProfileStore.ts`, `CvProfileResult.tsx` |
| „Kein Benutzerbegriff / keine RIS-Anbindung" (Negativbefund) | C — historisch dokumentiert, hier re-verifiziert | RIS-JOBSEARCH-01/02/03 (HEAD `cd6b393` erneut gegen `src/`, `api/`, `docs/` geprüft — weiterhin zutreffend) |
| `mj_session`-/Hash-Deutung als Identität | — (ausgeschlossen) | Per 01/03-Befund + `identity.mjs`-Kommentar KEINE Identität; nicht als Contract verwendbar |
| Generische JWT-/Bearer-Zeilen in Standards | — (kein Projektvertrag) | Nur Beispiel-/Tabellenwerte ohne Projektbindung |
| „RIS-Agent ruft Funktionen auf" (ein Satz, Boundary-Doc) | C — Absicht ohne Contract | Kein Endpoint, kein Schema, kein Auth — keine Vertragskraft |
| IdP / JWT-Claims / Tenant-Modell / Google-Federation / Account Linking / RIS-Produktmodell | E — nicht vorhanden | Kein Beleg im Repository (s. Negativsuche §1) |
| Gate-relevante Widersprüche | keine (D leer) | Nebenbefund außerhalb Gate-Scope: `ARCHITECTURE.md:35` „Dataset L2 (24 h reuse)" vs. tageszeitabhängige 6/12-h-Policy (`config.mjs`, Rest der Doku) — veraltete Zahl im Diagramm, kein Identity-/Contract-Widerspruch |

## 3. Identity Contract (Phase 3)

- **IdP:** OPEN. Kein Provider genannt, keine Rolle beschrieben. Roadmap-Phase-4-Stichwort
  „real authentication" benennt kein Verfahren.
- **Authentication:** Ist-Stand GREEN (als Negativ-Vertrag): Login führt niemand durch —
  `API_CONTRACT.md` §7: `GET /api/jobs`, `POST /api/profile`, `/cover-letter`, `/models`,
  `/alerts`, `/ats-analysis`, `/cv-improvement` = `none`; `POST /api/match`,
  `POST /api/job-details` = anonyme Session-Cookie (Quota/Enrichment, „kein Account-System
  vorhanden"); `GET /api/usage` = Operator-Token; `/api/cron/digest` = Cron-Secret
  (Pflicht noch OPEN DECISION, Deployment). E-Mail/Passwort: nein. Externe IdPs: nein.
  Flows: keine. Zukunft: OPEN.
- **Authorization:** Ist-Stand GREEN: API-Zugriff entscheidet kein IdP — öffentliche Endpoints
  ohne Auth, Quota über anonyme Session + IP (`detailEnrich.mjs`, `sources/index.mjs`
  `identity?`-Passthrough), Diagnose/Cron über Operator-Secrets. RIS akzeptiert: keine
  Aussage (kein RIS-Endpoint) → OPEN.
- **JWT:** OPEN. Kein Issuer, keine Claims, kein `sub`/`tenantId`, keine Gruppen/Scopes im
  User-Kontext. Einzige Token im Repo: `USAGE_DIAGNOSTICS_TOKEN`, `CRON_SECRET`
  (Maschinen-Secrets), Vercel-Infra-OIDC (Deploy, kein User-Token).
- **User Identity:** Ist-Stand GREEN (negativ): technische User-ID existiert nicht; `sub` gibt
  es nicht; Cognito-`sub` gibt es nicht; separate RIS Identity existiert nicht.
  Einzige technische Kennungen: `mj_session` (anonym, kein Personenbezug),
  CV-Inhalts-Hash (Cache-Key, kein User-Key), E-Mail (ungeprüfter Alert-Schlüssel).
- **Tenant Identity:** OPEN. Kein Mandantenmodell für User; `tenant`-Treffer nur
  ATS-Board-Technik ohne User-Bezug.
- **User Profile:** teilweise (YELLOW, s. §6): Application Profile entsteht per
  `CvProfileResult.confirm` (manuell) bzw. `/api/profile`-KI-Extraktion bei Cache-Miss,
  живо im Browser-Session-State + 12h-Listen (`cvProfileStore.ts`) + 30-Tage-Kosten-Cache
  (`cv-profile:<hash>`); Felder `Profile` vs. `SuggestedProfile` dokumentiert —
  aber kanonische Form, Owner und `experienceLevel`-Verbleib sind OPEN (Q1–Q4 aus 02/03).

## 4. JobSearch ↔ RIS Product Contract (Phase 4)

- **Was ist JobSearch:** dokumentiert (README, AGENTS, ARCHITECTURE) — statisches
  Frontend + Serverless-Funktionen: Live-Jobsuche, KI-Scoring, Cover-Letter, Alerts.
- **Was ist RIS:** OPEN — keine Definition, kein Backend, kein Endpoint im Repository.
- **Funktion JobSearch-Frontend:** dokumentiert (ARCHITECTURE: Suche, Confirm/Edit, Consent-UX).
- **Funktion RIS-Backend:** OPEN — existiert nicht; einzige Aussage: ATS-/Match-Ausführung
  bleibt JobSearch (02-Regel, 03-Target-Boundary).
- **Ownership (Auth, Profil, CV-Storage, Agent-Runtime, ATS, Domain):** OPEN/BLOCKED —
  03-Gate: 0/10 Bedingungen erfüllt; Kandidaten (`cvProfile`, benannte Search-/ATS-Einträge,
  Alerts) ohne Owner; Caches/Ergebnisse/Regelwerke als JobSearch bestätigt.
- **Datenfluss JobSearch ↔ RIS:** OPEN — kein Contract, keine API, keine Andockstelle
  (01: „kein Endpoint bietet Profil-CRUD mit Identität").
- **Verbindlicher Integrationspunkt:** OPEN — keiner vorhanden.
- **Was NICHT in JobSearch soll:** teilweise (YELLOW) — 03-Non-Goals + API-CONSOLIDATION-02
  („Do not duplicate RIS responsibilities": agent runtime, registry, discovery, routing,
  WorkItem, SQS/Lambda/Cognito not touched) als Richtungsaussage, aber ohne
  RIS-Vertrag kein vollständiger Negativ-Katalog.
- **Jobsuche-Frontend vs. RIS JobSearch Domain Agent:** OPEN — die Unterscheidung ist im
  Repository NICHT belastbar dokumentiert (kein Domain-Agent-Begriff, keine Abgrenzung).
  → als OPEN gemeldet.

## 5. Google / External IdP (Phase 5)

- Google optional oder verpflichtend: keine Aussage → OPEN.
- Google über Cognito-Federation: nein — weder Google-Login noch Cognito im Repo → OPEN.
- Cognito als JWT-Vertrauensgrenze: nein — Cognito kommt nur in einem
  Nicht-Duplizierungs-Satz (API-CONSOLIDATION-02:24) vor → OPEN.
- Google-Tokens an RIS: keine Aussage → OPEN.
- Automatisches / explizites Account Linking: nichts gefunden → OPEN.
- Produktiv implementiert vs. vorbereitet: weder noch — nicht vorhanden → OPEN.
- Klärung „Google"/„13": `GEO-WORKMODE-GOOGLE-AI-01` = Geocoding-/Filter-Vorschläge;
  `STEP_37G_13` = UI-Persistenz; Gate 13A / Google-13B existieren im Repo nicht.
  Es wird NICHTS aus externen Gates abgeleitet.

## 6. Konfliktanalyse (Phase 6)

| Thema | Repository-Befund | Status | Quelle |
|---|---|---|---|
| IdP | Kein Provider, keine Rolle | OPEN | Negativsuche §1; `API_CONTRACT.md` §7 („kein Account-System"); 03-Q1 |
| Login | Verbindlich: kein User-Login (none / anonyme Session); Zukunft offen | GREEN (Ist, negativ) / OPEN (Zukunft) → gesamt OPEN für Gate-Frage | `API_CONTRACT.md` §7/§16; `API_INVENTORY.md`; `api/_lib/identity.mjs`; 03-Q2 |
| Auth (Authorization) | Kein IdP; Quota via Session+IP, intern via Secrets | GREEN (Ist) / OPEN (RIS-Seite) | `identity.mjs`, `detailEnrich.mjs`, `api/usage.mjs`, `api/cron/digest.mjs` |
| JWT | Keine Claims/Issuer im User-Kontext; nur Operator-/Infra-Tokens | OPEN | `.env.example`; `API_INVENTORY.md`; `STEP_23C` (nur Infra-OIDC) |
| userId | Existiert nicht (weder `sub` noch RIS-Identity) | GREEN (negativ, Ist) | `identity.mjs:32-45`; 01:17; 03:23 |
| tenantId | Kein User-Mandantenmodell (nur ATS-Board-Technik) | OPEN | `ATS_JOB_SOURCES.md:173,302`; 02-Q13 |
| UserProfile | Typen/Flow/Cache belegt; Kanon/Owner/Level offen | YELLOW | `src/types.ts:42-56`; `cvProfileStore.ts`; `ARCHITECTURE.md`; 03-Q3/Q4 |
| JobSearch ↔ RIS | JobSearch belegt; RIS/Integration/Ownership offen; Agent-Unterscheidung fehlt | YELLOW (Richtung) / OPEN (Vertrag) → gesamt OPEN | 01/02/03; `AI_DATA_BOUNDARY…md:205`; `API-CONSOLIDATION-02` |
| Produktmodell | Nur Roadmap-Stichworte; RIS-Gate BLOCKED 0/10 | OPEN | `AGENTS.md` Phase 4; `ROADMAP.md`; 03 §6 |
| Google | Nur Geocoding-Vorschläge + Modellnamen; keine Federation | OPEN | `GEO-WORKMODE-GOOGLE-AI-01`; Modellkatalog |
| Account Linking | Nichts gefunden | OPEN | Negativsuche §1 |

Status-Legende: GREEN = belastbar/aktuell dokumentiert · YELLOW = teilweise/Contract fehlt ·
OPEN = keine belastbare Vorgabe. (Gesamt-Gate: kein einziges Zukunfts-Thema GREEN.)

## 7. Gap Report (Phase 7)

1. **Hat das JobSearch-Team Recht?** Ja — im Kern. Für alle 12 Gate-Punkte fehlt eine
   belastbare, verbindliche Zukunfts-Vorgabe (IdP, Login-Verfahren, JWT/Claims, Tenant,
   Google, Account Linking, RIS-Modell, Integration). Belastbar vorhanden ist nur der
   Ist-Vertrag (kein User-Login, anonyme Session) plus Voranalysen (01–03, Kategorie C).
2. **Welche Vorgaben existieren tatsächlich?** `API_CONTRACT.md` §7/§16 (Endpoint-Auth-Matrix,
   „kein Account-System"), `API_INVENTORY.md` (IST-Auth), `api/_lib/identity.mjs`
   (anonyme Session, explizit keine Identität), `ARCHITECTURE.md` + `src/types.ts` +
   `cvProfileStore.ts` (Profile-Typen, Cache, 12h-Listen), 03-Target-Boundary
   (JobSearch-Ownership bestätigt, RIS-Seite leer), API-CONSOLIDATION-02
   (Nicht-Duplizierungs-Richtung).
3. **Welche Vorgaben fehlen?** IdP-Wahl und -Rolle; Login-Verfahren/Lifetimes/Logout;
   JWT-Issuer/Claims/`sub`/`tenantId`/Scopes; Tenant-Modell; kanonische Profilform + Owner;
   Speicher-Consent/Delete/Export; JobSearch↔RIS-Schnittstelle (Base-URL, Schema, CRUD,
   Fehler, Versionierung); RIS-Produktmodell; Google-Rolle/Federation; Account Linking;
   Frontend↔IdP↔RIS-Verantwortungsgrenzen; Jobsuche-vs-Domain-Agent-Abgrenzung.
4. **Was ist nur implizit aus Code ableitbar?** Anonyme Session + IP als Quota-Identität
   (`identity.mjs`, `detailEnrich.mjs`); E-Mail als faktischer Alert-Schlüssel (ohne
   Nachweis); Hash als Cache-Key (nie Identität); 12h-Verfall der Listen als faktische
   Gast-Migration (Verfall, unentschieden).
5. **Was widerspricht sich?** Gate-relevant: nichts (D leer). Die „kein Account-System"-
   Aussage steht nicht im Widerspruch zu Roadmap-Stichworten („real authentication" =
   Planung ohne Verfahren).
6. **Richtige Stelle für verbindliche Contracts?** `docs/API_CONTRACT.md` (Endpoint/Auth/
   Envelope — Erweiterung um Identity-Sektion nach Entscheidung); `docs/ARCHITECTURE.md`
   (Verantwortungsgrenzen); `docs/ROADMAP.md` (Produktmodell-Entscheidungen statt Stichworte);
   neuer RIS-Contract (Base-URL, Schema, CRUD, Versionierung, Pagination, Errors) erst nach
   A-Entscheidungen — exakt die 03-Gate-Reihenfolge (Q1–Q6/Q8/Q13 → Q7/Q9–Q12/Q14);
   OpenAPI-Artefakt laut `API_CONTRACT.md` §18-Punkt 4 im Contract-Cleanup-Step.

## 8. Audit-Nachweis (AI_AUDITLOG-pflichtig)

- Status: YELLOW (Discovery vollständig; Zukunfts-Contract durchgehend OPEN; kein GREEN erfunden)
- Zeitpunkt: 2026-10-03; Branch: main; HEAD: `cd6b393` (Discovery-Stand; Commit folgt)
- Terraform-Checks: nicht anwendbar (keine Infra; keine ausgeführt)
- Tests/Build/tsc: nicht erforderlich (read-only Discovery, keine Codeänderung) — nicht ausgeführt
- Git-Status: vor Discovery nur vorbestehende `docs/screenshotsfordev/`-Diffs
  (2 deleted, 2 untracked) — nicht angefasst, nicht gestagt
- Geänderte Dateien: ausschließlich `docs/reports/RIS-JOBSEARCH-04-EXECUTION_LOG.md` (neu, dieser Report)
- `docs/AI_AUDITLOG.md` (Template/Instruction, 45 Zeilen) bleibt unverändert — es ist die
  Verfahrensvorgabe, kein beschreibbares Log; dieser Report erfüllt sie als Execution Log.
  Keine AI-/Privacy-/Data-Flow-Entscheidung getroffen → keine AI-Audit-Ergänzung
  (gleiche Regel wie 03 § „AI-Audit-Prüfung").
- Risiken: keine (read-only; keine Vorab-Festlegung getroffen)
- Nächste Schritte: keine (HARD STOP — kein Folge-Gate ohne Beauftragung)
- Resume-Punkt: abgeschlossen, bereit zum Commit

---

## AI-Audit-Prüfung (taskseitig gefordert)

Geprüft, ob dieser Task eine relevante AI-/Privacy-/Data-Flow-Entscheidung dokumentiert:
NEIN — reine Discovery, 0 Entscheidungen, kein Datenfluss verändert, kein Consent-/Privacy-Modell
festgelegt. Folglich keine Ergänzung eines AI-Auditlogs; keine künstliche AI-Audit-Änderung erzeugt.
