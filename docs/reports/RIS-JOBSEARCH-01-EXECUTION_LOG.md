# RIS-JOBSEARCH-01

## Status
YELLOW

## Scope
Analysis only

- Audit-Datum: 2026-10-03
- Branch: main, HEAD: 03129da
- Ausgangslage: PERSISTENCE-BOUNDARY-01 (5920e2f), PROFILE-STATE-01 (d6e8fc6), PROFILE-TAB-STATE-01 (03129da) als gültige Vorbefunde übernommen. Einzige Codeänderung seit PROFILE-STATE-01: TAB-STATE-Fix (`handleCvRemoveData` setzt `App.profile` zurück, wenn es ein entferntes gespeichertes Profil zeigt; `INITIAL_MANUAL_PROFILE`-Konstante) — kein Widerspruch zu den Vorbefunden, im Report berücksichtigt.
- KEIN RIS-Code, KEIN API-Client, KEIN ProfileStore/Adapter, KEIN Persistenz-Refactor, KEINE Auth-Implementierung, KEINE Migration, KEIN API-Umbau, KEINE Änderung an CV-Flow/Manual-Tab/ATS/Job-Sources. Keine Änderung an `src/`, `api/`, `tests/`, Config.
- Methode: Repository-Lektüre + gezielte Suchen (Auth/Identität/Endpoints/Profilformen). Keine Annahmen aus Namen; lückenhafte Evidenz → Kategorie UNKNOWN.

## Executive Finding

1. Jobsearch ist heute ein rein gastbasiertes System ohne Benutzerbegriff: keine User IDs, keine Tenant IDs, kein JWT/Cognito/OIDC, keine Login-Flows, keine RIS-Referenz im gesamten Code (Treffer der `ris`-Suche sind ausschließlich deutsche Wortbestandteile wie "Befristet"/"Paris"-Analogien — verifiziert). Die einzige technische Identität ist `mj_session` (anonyme, zufällige 128-Bit-Session-ID, Cookie `Max-Age` 1 Jahr) plus Client-IP als Backstop — beides ohne Personenbindung.
2. Auth existiert nur für Betrieb, nicht für Benutzer: `USAGE_DIAGNOSTICS_TOKEN` (`/api/usage`, Operator-Diagnostik) und `CRON_SECRET`/`x-vercel-cron` (`/api/cron/digest`). Alle Profil-/Job-/Alert-Endpoints sind ohne Auth aufrufbar; `/api/alerts` schreibt/löscht per E-Mail-Schlüssel ohne Nachweis der Inhaberschaft.
3. Die einzige fachliche Ownership lautet heute: Jobsearch (Gast-Sitzung) besitzt flüchtige Profile; Upstash Redis besitzt inhaltsadressierte Caches und E-Mail-Abos. Eine "potenzielle zukünftige Ownership" wird ausschließlich als Kandidat markiert — keine Entscheidung.
4. RIS-Kandidaten im engeren Sinn: bestätigtes `cvProfile`, benannte Search-/ATS-Einträge (inkl. Namen), E-Mail-Alert-Abos (mit Vorbehalt: E-Mail als Identität). Ausdrücklich NICHT: `File`-Blobs, Auswahl-IDs, Consent-Flags, Ergebnis-Caches, `Redis cv-profile:<hash>` (reiner Kosten-Cache), Session-/Quota-Zähler, `suggestedProfile` als Rohvorschlag, `experienceLevel` (stirbt beim Confirm — Lücke, keine Empfehlung).
5. YELLOW, weil: (a) `cv-profile:<hash>` hält CV-abgeleitete KI-Profile 30 Tage ohne Delete-Pfad; (b) es gibt keinen Speicher-Consent (nur KI-Verarbeitungs-Consent) — eine dauerhafte RIS-Speicherung hätte heute keine Einwilligungsgrundlage im Produkt; (c) es existiert keine authentifizierte Identität, an die Ownership/Isolation/Delete gebunden werden könnte ("Dieses Profil gehört diesem Benutzer" ist heute technisch unbeantwortbar).

## Current Ownership

Aktuelle fachliche Ownership — formuliert als IST (Code-Belege in Evidence):

- Jobsearch/Browser-Sitzung besitzt: `App.profile` (manuelle Eingabe, `App.tsx:67`), `cvState`-Familie (`cvProfile` bestätigt per Confirm `:1607-1624`, `suggestedProfile` aus `/api/profile`, `documents` inkl. `File`-Blobs, `selectedSkills`, Auswahl-IDs, Consent-Flags), 12h-Store-Snapshots (`saveCvSearchProfile`/`saveCvAtsProfile`), Such-/Match-/ATS-Ergebnisse. Grund: ausschließlich React-/Modul-State, kein Server-Spiegel, Reload-flüchtig, keine Auth-Bindung.
- Jobsearch/Serverless + Upstash Redis besitzt: `cv-profile:<hash>` (KI-Ergebnis-Cache, `api/profile.mjs:140-142`, 30d TTL), `alerts`-Hash (E-Mail-Abos, `api/_lib/alerts.mjs:56-62`, persistent), Job-/Geo-/Usage-Caches und Quota-Zähler (anonyme Kennzahlen, kein Profilinhalt).
- Niemand (orphan/tot): `cvState.profile` (kein Producer), `improvement-selection`-Pfad (kein Einstieg), `doc.skills` (nie befüllt) — s. PROFILE-STATE-01.
- Externe Provider (OpenRouter/EdenAI/Resend/Upstash/Jobquellen) erhalten per Request Daten — Verbleib dort ist aus dem Repository NICHT feststellbar (Open Question).

| Daten | Aktueller Owner | Aktueller Storage | Lebensdauer | RIS-Kandidat? | Begründung |
|---|---|---|---|---|---|
| `App.profile` (manuell) | Gast-Sitzung (Jobsearch) | React-State | Sitzung | BEDINGT | Nur falls Nutzer ein manuelles Profil dauerhaft speichern will; heute Einmal-Suchmaske, kein Speicherwunsch im UI |
| `cvProfile` (bestätigt) | Gast-Sitzung (Jobsearch) | React-State | Sitzung | JA (Kandidat) | Bestätigtes Arbeitsprofil, vollständiger `Profile`-Typ |
| `suggestedProfile` | KI-Vorschlag + Nutzer-Edit | React-State | Sitzung (bis Back/Remove) | NEIN (allenfalls Provenienz) | Unbestätigt, eigener Typ; kein Wahrheitsanspruch |
| Search Profile (gespeichert) | Gast-Sitzung (Jobsearch) | 12h-Store (Memory) | 12h-Fenster/Sitzung | JA (Kandidat, inkl. Name) | Benannte Snapshots = einziger persistenzähnlicher Profilwunsch heute |
| ATS Profile (gespeichert) | Gast-Sitzung (Jobsearch) | 12h-Store (Memory) | 12h-Fenster/Sitzung | JA (Kandidat, inkl. Name) | Benannte Skill/Rollen-Sätze; Teilmenge (kein volles `Profile`) |
| `selectedSkills` | Gast-Sitzung | React-State | Step-Dauer+ | NEIN (Kontext) | Auswahl-Arbeitskopie, kein Eigenprofil |
| `documents` / `File` | Gast-Sitzung | React-State (Blob) | Sitzung | NEIN | Original-CVs gehören nicht in ein Profil-API (nur abgeleitete Daten) |
| CV-Hash (SHA-256) | Abgeleitet (deterministisch) | React-State (je Doc) | Sitzung | NUR ALS CACHE-KEY | Inhaltsadresse, KEINE Benutzeridentität (s. Kap. 6) |
| ATS-Result | Abgeleitet (Aufruf-Cache) | React-State | Sitzung | NEIN | Ergebnis, reproduzierbar |
| AI-Search-Result / Jobs / Matches | Abgeleitet | React-State + Redis-Job-Caches (600s) | Sitzung / 10min | NEIN | Ergebnisse/Marktdaten, keine Profile |
| Saved Snapshots (Namen/IDs) | Gast-Sitzung | 12h-Store | 12h-Fenster | JA (Metadaten) | Namen/IDs/`savedAt` sind nutzereigene Organisationsdaten |
| Redis `cv-profile:<hash>` | Jobsearch-Server (Cache) | Upstash Redis | 30 Tage | NEIN (Cache only) | Namenlose KI-Antwort, kein User-Bezug, kein CRUD |
| Session-ID (`mj_session`) | Technik (anonym) | Cookie (1 Jahr) + Redis-Zähler (62d/24h) | s. links | NEIN | Anonyme Missbrauchsabwehr, keine Identität |
| Alerts (E-Mail + Profil) | Jobsearch-Server | Redis `alerts`-Hash | Persistent (kein TTL) | JA MIT VORBEHALT | E-Mail = einzige personenbezogene Persistenz; Inhaberschaft heute ungeprüft |

Potenzielle zukünftige Ownership (nur Kandidaten, keine Entscheidung): RIS = bestätigte Profile + benannte Einträge + Abos (bei Auth); Jobsearch = Workflow/Caches/Ergebnisse/Regelwerke; Browser-Session = unbestätigte Eingaben/Flags.

## Profile Model Analysis

A) `App.profile` / `Profile` (`src/types.ts:42-49`): `{ skills: string, targetRoles: string[], city: string, radiusKm: number\|null, workModes: WorkMode[], employmentTypes: EmploymentType[] }`. Semantik: manuelle Suchmaske. Producer: Nutzer via `SearchForm` (+ `handleProfileChange`, Saved-Start-Transfer). Consumer: `runSearch`/`fetchJobs`/`fetchMatches`/`dataset`, `LetterModal`, ATS-Fallback. Persistenz: keine. Identität: keine.
B) `cvProfile` / `Profile` (gleicher Typ!): Semantik: bestätigtes CV-Arbeitsprofil. Producer: ausschließlich `CvProfileResult.onConfirm` (+ Edit-/Merge-Pfade). Consumer: CV-Suche, ATS (Workflow + per-Job), Profil-Saves. Persistenz: keine. Identität: keine. Gleicher Typ wie A, aber andere Linie (keine gemeinsame Source of Truth — TAB-STATE-01 lässt beide getrennt).
C) `suggestedProfile` / `SuggestedProfile` (`:51-56`): `{ skills: string[], experienceLevel: string, targetRoles: string[], location: string }`. Semantik: unbestätigter KI-Vorschlag + Edit-Basis. Producer: `POST /api/profile`. Consumer: `CvProfileResult`, Skill-Step-Init, Fallback-Leser. Persistenz: server-Cache der serialisierten Antwort (Redis). Identität: CV-Hash als Cache-Key.
D) `CvSearchProfileEntry` (`cvProfileStore.ts:17-22`): `{ id, name, savedAt, profile: Profile }`. Semantik: benannter Snapshot von B + Metadaten. Producer: Confirm-Save; Consumer: Start/Edit/Dropdowns. Persistenz: 12h-Memory. Identität: `entry-<ts>-<rand>` (technisch, pro Bucket eindeutig).
E) `CvAtsProfileEntry` (`:24-30`): `{ id, name, savedAt, targetRoles: string[], skills: string[] }`. Semantik: benannter Skill/Rollen-Satz (KEIN volles `Profile`). Producer: Skill-Confirm (ATS-Ziel). Consumer: ATS-Dropdown/Edit/per-Job-Overlay (dort zu Übergabe-`Profile` ergänzt: `city:""`, `radiusKm:null`, Defaults). Persistenz: 12h-Memory. Identität: wie D.

`experienceLevel`: existiert nur in C (KI-Extrakt, Freitext wie "Senior"). `CvProfileResult.confirm()` übernimmt es NICHT in `Profile` (kein Zielfeld; `Profile` hat keinen Level-Slot). Edit-Rebuilds setzen es auf `""` (`App.tsx:553,584`). Befund: stiller Feldverlust beim Übergang Vorschlag→Bestätigung; kein Level-Konzept in B/D/E. Keine Änderung vorgenommen.

## Kanonische Profilform (nicht entschieden)

| Feld | Manual Profile | CV Profile | Suggested Profile | Saved Search | Saved ATS | RIS-Kandidat |
|---|---|---|---|---|---|---|
| `skills` (string, komma-separiert) | JA | JA | als `string[]` | JA | als `string[]` | JA (Kanonisierung offen: string vs. Liste) |
| `targetRoles` (`string[]`) | JA | JA | JA | JA | JA | JA |
| `city`/`location` (string) | JA (`city`) | JA (`city`) | JA (`location`) | JA (`city`) | NEIN | JA (Feldname offen) |
| `radiusKm` | JA | JA | NEIN | JA | NEIN | BEDINGT (Such-, nicht Profilattribut?) |
| `workModes` | JA | JA (Default `[]`) | NEIN | JA | NEIN | BEDINGT |
| `employmentTypes` | JA (Default `["full_time"]`) | JA (Default) | NEIN | JA | NEIN (Overlay-Default) | BEDINGT |
| `experienceLevel` | NEIN | NEIN | JA | NEIN | NEIN | OFFEN (geht heute verloren) |
| `name` (Eintragsname) | — | — | — | JA | JA | JA (Metadatum) |
| `id`/`savedAt` | — | — | — | JA | JA | JA (Metadaten; IDs heute technisch) |

Gemeinsamer Kern aller Formen: `skills` + `targetRoles` (+ Ortsangabe außer ATS). CV-spezifisch: nichts Eigenes (nutzt `Profile`). Search-spezifisch: `radiusKm`/`workModes`/`employmentTypes` (fehlen in ATS-Einträgen). ATS-spezifisch: reduzierte Teilmenge + Name. Verloren beim Übergang: `experienceLevel` (C→B), `radiusKm`/`workModes`/`employmentTypes`/`city` (B→E).

## Identity

| ID | Art | Stabilität | Personenbezug | Als RIS-Referenz? |
|---|---|---|---|---|
| CV-Hash (SHA-256 über normalisierten, ggf. anonymisierten Text) | Inhaltsadresse (anonym, deterministisch) | Gleicher Text = gleicher Hash (nutzerübergreifend!) | NEIN — kein Benutzer, keine Trennung | Nur Cache-Key; NIEMALS Benutzeridentität (Kollision = fremder CV mit gleichem Text trifft denselben Cache) |
| `document.id` (`generateDocumentId`) | Technisch (Sitzung) | Sitzung | Nein | NEIN |
| `entry.id` (`entry-<ts>-<rand>`) | Technisch (Bucket) | 12h-Fenster | Nein | NEIN (kein globales Format) |
| `selectedSavedSearchId`/`activeAtsEntryId` | UI-Zeiger | Sitzung | Nein | NEIN |
| `mj_session` (128 Bit random, HttpOnly, `Max-Age` 1J) | Anonyme Sitzungskennung | Bis Cookie-Löschung/Max-Age | Nein (IP nur Backstop, `identity.mjs:12-18,35-45`) | NEIN — kein Auth-Ersatz; Quota-Bindung via `hashToken(sessionId)` (`usage.mjs:205-258`, `detailEnrich.mjs:42-43`) |
| Alert-E-Mail (Hash-Key `alerts`) | Personenbezogen (einzige) | Dauerhaft | JA (Kontakt) | BEDINGT — Inhaberschaft heute ungeprüft (POST/DELETE ohne Nachweis) |
| User/Tenant/JWT/OIDC | — | — | — | NICHT VORHANDEN |

## Authentication

- Benutzer-Auth: NICHT VORHANDEN (kein Login, keine Passwörter, keine Tokens, keine geschützten Profil-Endpoints).
- `mj_session`: anonym, server-vergeben (`anonymousIdentity`), Formprüfung nur auf Shape (`SESSION_ID_RE`), Neuvergabe bei Fehlform; `Secure` nur in Production (`identity.mjs:47-56`). Gebundene Serverdaten: TheirStack-/JobPipe-User-Credits (Monat, 62d TTL), Detail-Quotas (Tag, 24h) — alles Zähler, keine Inhalte.
- Operator-Auth: `USAGE_DIAGNOSTICS_TOKEN` (`api/usage.mjs:3-41`, `x-usage-token`/Bearer, constant-time Vergleich) und `CRON_SECRET` bzw. `x-vercel-cron` (`api/cron/digest.mjs:60-68`). Beides Maschinen-, kein Benutzer-Kontext.
- Bestehende RIS-Identity: NICHT VORHANDEN. Antwort auf Leitfrage: NEIN — Jobsearch kann heute nicht sagen "dieses Profil gehört diesem authentifizierten Benutzer" (kein Benutzerbegriff im Code).

## API Boundary

| Endpoint | Input | Output | Profilbezug | Persistenz | RIS-relevant? |
|---|---|---|---|---|---|
| `POST /api/profile` | `{ text, hash?, model? }` (anonymisierter/normalisierter CV-Text) | `SuggestedProfile` (oder Cache-Treffer) | Kern: Text→Profil-Extrakt | Redis-Write `cv-profile:<hash>` 30d | JA (Extraktionsleistung; aber Cache ≠ Store) |
| `GET /api/jobs` | Query: skills/targetRole/city/radiusKm/workMode/employmentType | `{ jobs[], meta }` | Suchprofil als Filter | Job-Caches 600s; Session-Cookie | BEDINGT (Such-API, kein Profil-CRUD) |
| `POST /api/match` | `{ skills, targetRole, city, jobs[], model? }` (reduziert!) | `{ matches[], meta }` | Reduziertes Profil (ohne Radius/Modes!) | Keine (+ Session-Cookie) | BEDINGT (Bewertung; Profilform ≠ `Profile`) |
| `POST /api/ats-analysis` | `{ job, profile }` (+ `ai:{enabled,consent,model}`) | Analyse + Empfehlungen (+ KI-Formulierungen nur mit Consent) | Skill-Profil vs. Anforderungen | Keine | BEDINGT (Analyse, kein Store) |
| `POST /api/cv-improvement*` | `{ profile, selectedRecommendationIds, allRecommendations }` u.a. | Verbessertes Profil/Vergleiche | Legacy-`profile`-Pfad (s. PROFILE-STATE-01) | Keine | NIEDRIG (Pfad derzeit ohne Befüller) |
| `POST /api/cover-letter` | `{ skills, targetRole, city, job, prepareQuestion, language, model? }` | `{ letter }` | Reduziertes Profil | Keine | NEIN |
| `POST/DELETE/GET /api/alerts` | `{ email, skills, targetRole, city }` / `{ email }` | Message/Count | Profil + E-Mail | `alerts`-Hash PERSISTENT | JA (einzige Profil-Persistenz; ohne Auth) |
| `GET /api/usage` | — (Operator-Token) | Zähler-Snapshot | Keiner | Read-only | NEIN |
| `GET /api/job-details`, `GET /api/model(s)` | slugs / — | Details / Modellkatalog | Keiner | Detail-Cache 7d | NEIN |

Keine `/api/v1` entworfen. Befund: kein Endpoint bietet Profil-CRUD mit Identität — ein RIS-Adapter fände heute keine Andockstelle.

## CV Data Flow

```
CV-File (PDF, lokal)                    — bleibt lokal (File-Blob in React-State)
 ↓ extractPdfText (pdfjs, lokal)
Rohtext (lokale Variable)               — bleibt lokal, nie in State/Storage (Code-Fakt)
 ↓ anonymizeText (NUR wenn Modus=anonymized, Standard)
Anonymisierter Text (lokale Variable)   — bleibt lokal
 ↓ normalizeText + sha256Hex → doc.hash — Hash in State (Identität f. Listen/Cache-Key)
 ↓ CONSENT (CvConsentGate, Sitzung)     — Flag in State, keinversand
 ↓ POST /api/profile { text, hash?, model? }   ← ERSTER Browser-Exit (anonymisiert, mit Consent)
      ├─ Redis-Read cv-profile:<hash> → Treffer: KEIN Modell-Call
      └─ Miss: OpenRouter/EdenAI-Call → Redis-Write (30d)
 ↓ SuggestedProfile                     — zurück im Browser (State)
 ↓ CvProfileResult: Nutzer-Edit → onConfirm(profile: Profile, name)
 ↓ cvProfile (State) + saveCvSearchProfile (12h-Store)
 ↓ Search (fetchJobs/fetchMatches: Profil + Jobs verlassen Browser) / ATS (analyzeATS)
```

PII → lokale Anonymisierung → Consent → Modell-Call: bestätigt und unverändert (`App.tsx:672-708`, `CvConsentGate.tsx`, `api/profile.mjs:106-130`). Ausnahme: Modus `not-anonymized` (explizite Wahl) sendet Rohtext. Manuelle Suchprofile verlassen den Browser zusätzlich an jobs/match/cover-letter/alerts (dort inkl. E-Mail persistent).

## Privacy / DSGVO Technical Findings

(Technik, keine Rechtsberatung.)

- Personenbezogen: Alert-E-Mail (+ zugehöriges Suchprofil); `mj_session` nur pseudonym/technisch; IP nur Server-Backstop, nicht gespeichert als Profilmerkmal (Zähler-Key via Hash).
- CV-abgeleitet: `suggestedProfile`/`cvProfile`/Listen-Einträge (Browser, flüchtig); `cv-profile:<hash>` (Redis, 30d).
- Anonymisiert: Anonymisierungsgrad = Regex-Ersetzung (`anonymize.ts`) — keine technische Anonymitätsgarantie im Repo bewiesen (offen).
- Hashes: SHA-256 über normalisierten Text — deterministisch, nicht salted; gleiche CV-Texte kollidieren nutzerübergreifend (Cache-Treffer für Fremde möglich — technischer Fakt, kein Missbrauchsurteil).
- Cookies: nur `mj_session` (HttpOnly, SameSite=Lax, Max-Age 1J). Keine Tracking-/Werbe-Cookies gefunden.
- Server-Caches + TTL: Profil 30d, Jobs 600s, Details 7d, Quota 24h, Usage/Geo 62d/30d, Alerts ∞ (kein TTL).
- Löschpfade: "CV-Daten entfernen" (Browser + 12h-Store + Legacy-Keys; seit TAB-STATE-01 inkl. geladenem Manual-Profil); `DELETE /api/alerts` (Abo); TTL-Ablauf (alle Redis-Caches). KEIN Delete-Pfad: `cv-profile:<hash>` (nur TTL), `mj_session` (nur Ablauf), Provider-seitige Daten (außerhalb Repo).
- Consent-Trennung (technisch): KI-Verarbeitungs-Consent JA (CvConsentGate pro Sitzung + ATS-KI separat); Speicher-Consent NEIN (nicht vorhanden). Beide Fragen sind heute dieselbe implizite Handlung — technisch NICHT getrennt. Auswirkung dauerhafter RIS-Speicherung: bräuchte erstmals Speicherumfang/-dauer/-zweck im Produkt (Einwilligungs-UX, Scope-Trennung Verarbeitung vs. Speicherung, Widerruf → Delete-Kette). Offene Punkte, keine Rechtsgrundlagenentscheidung.

## Delete Boundary

Hypothetischer Total-Delete (technische Sicht, NICHT implementiert):

| Speicher | Delete vorhanden? | Schlüssel | Problem/Open Question |
|---|---|---|---|
| Browser-State (Profile/Docs/Flags/Ergebnisse) | JA (`handleCvRemoveData` + Revoke-Pfade) | — (Heap) | Abgedeckt für UI-Kontext |
| 12h-Store | JA (`resetCvProfileLists`, Ablauf) | CV-Hash | Abgedeckt |
| Legacy-`localStorage` | JA (`purgeLegacyCvListsFromLocalStorage`) | Prefix `mj-cv-lists:` | Abgedeckt |
| Redis `cv-profile:<hash>` | NEIN (nur 30d-TTL) | CV-Hash (Client muss ihn kennen) | Bräuchte Hash-gebundenen Delete-Endpoint + Auth gegen Fremd-Delete |
| Redis Job-/Geo-/Usage-Caches | Nur TTL | Diverse | Inhaltsleer — Löschbedarf fraglich |
| `mj_session` + Quota-Zähler | NEIN (nur Ablauf) | Session-ID (HttpOnly, JS-unsichtbar) | Client kann nicht gezielt löschen; Server-Ablauf einzige Grenze |
| Alerts | JA (`DELETE /api/alerts`) | E-Mail (ohne Nachweis) | Inhaberschaftsprüfung fehlt für RIS-Tauglichkeit |
| RIS (hypothetisch) | EXISTIERT NICHT | — | CRUD/Delete/Export-Semantik völlig offen (s. Kap. 14) |
| Provider (Modell/E-Mail/Redis-Hosting) | Unbekannt | — | Außerhalb Repo; Lösch-/Aufbewahrungs­politik unbekannt |

## Export Boundary

Technisch relevant bei späterem Export (kein Bau): bestätigtes `cvProfile`; benannte Search-Einträge (`{name, profile}`); ATS-Einträge (`{name, targetRoles, skills}`); `experienceLevel` NUR aus `suggestedProfile` ableitbar (sonst verloren); Alert-Abo (`{email, skills, targetRole, city}`); Analyseergebnisse (`atsResult`, `aiSearchResult`, Matches — Momentaufnahmen, Exportwert fraglich); Original-CV-`File` (nur Sitzung — Export nach Reload unmöglich); Jobs (Fremddaten, nicht exportrelevant); technische Metadaten (`savedAt`, IDs — Format heute nicht exportstabil); `App.profile` (nur falls als "gespeichertes Manual-Profil" aufgewertet — heute nicht).

## ProfileStore Assessment

Idee `ProfileStore { GuestSessionAdapter, RISAdapter }` — NICHT implementiert; Bewertung der Abstraktionsgrenze:

- Sinnvolle Grenze ERSICHTLICH: Lesen/Schreiben benannter Profile ist heute auf 4 Stellen konzentriert (`saveCvSearchProfile`, `saveCvAtsProfile`, `readCvProfileLists`/`findSavedSearchProfile`, `resetCvProfileLists`) mit klaren Aufrufern in `App.tsx` (Confirm `:1612`, Skill-Confirm `:799`, Edit `:525/:556`, Start `:582`, Dropdowns `:1245`, Remove `:480`). Ein Interface `listProfiles(hash) / saveSearchProfile / saveAtsProfile / clearAll` ließe sich dort anlegen, ohne Flows zu ändern.
- Nötige Methoden (Analyse): benannte Search-/ATS-Einträge je Identität listen/lesen/speichern/aktualisieren/löschen (einzeln + alles), dazu Metadaten (Name, `savedAt`) — plus Delete- und (später) Export-Semantik.
- Anzupassende Funktionen bei Umsetzung: alle obigen Aufrufer (Identität statt Hash als Key), `listSourceDoc`-Logik (`:1244`), Quellwechsel-Reset (`:1251-1254`), Edit-Rebuilds, `handleCvRemoveData`-Kette.
- Zu breit würde das Interface bei: Ergebnis-Caches (`atsResult`, Matches), `File`-Blobs, Auswahl-IDs, Consent-Flags, Modell-/Suche-/ATS-Aufrufen, Quota/Usage — alles KEIN Profilstore-Inhalt (würden Adapter zu God-Objekten machen).
- NICHT hinein: `suggestedProfile` (Vorschlag), `experienceLevel`-Sonderlogik (erst Kanon klären), `App.profile` (eigene Linie; nur per explizitem Transfer), Redis-KI-Cache (Kostenoptimierung, kein Fach-Store), Session-/Alert-Technik.
- Härtebedingung (Befund): ohne User-Identität kann `RISAdapter` keine Tenant-Isolation garantieren — die Abstraktion wäre heute nur mit `GuestSessionAdapter` sinnvoll befüllbar.

## RIS-Relevance Matrix

| State/Data | Jobsearch Owner | RIS Candidate | Reason |
|---|---|---|---|
| `cvProfile` | JA (Sitzung) | CANDIDATE FOR RIS | Bestätigtes Profil, vollwertig |
| Saved Search-Einträge (+Namen) | JA (12h) | CANDIDATE FOR RIS | Einziger Speicherwunsch, benannt |
| Saved ATS-Einträge (+Namen) | JA (12h) | CANDIDATE FOR RIS | Teilmenge, kanonbedürftig |
| Alert-Abos | JA (persistent) | CANDIDATE FOR RIS | Mit Inhaberschafts-Vorbehalt |
| `App.profile` | JA (Sitzung) | UNKNOWN | Heute kein Speicherwunsch; Aufwertung offen |
| `experienceLevel` | Verloren | UNKNOWN | Quelle unklar (nur Vorschlag) |
| `suggestedProfile` | JA (Sitzung) | TRANSIENT ONLY | Vorschlag, kein Store-Inhalt |
| `selectedSkills`, Auswahl-IDs, Flags | JA (Sitzung) | UI ONLY | Workflow-Zustand |
| `documents`/`File`, Roh-/Anonym-Text | JA (Sitzung) | TRANSIENT ONLY | Blobs/Texte gehören nicht ins Profil-API |
| ATS-/Match-/Such-Ergebnisse, Jobs | JA (+Redis-Cache) | TRANSIENT ONLY / CACHE ONLY | Reproduzierbar/fremd |
| Redis `cv-profile:<hash>` | JA (Server) | CACHE ONLY | Kosten-Cache, kein CRUD |
| Session/Quota/Usage/Jobs-Caches | JA (Server) | KEEP IN JOBSEARCH | Missbrauchsabwehr/Performance, CV-fremd |
| `ats.mjs`-Regelwerk, Prompts | JA (Code) | KEEP IN JOBSEARCH | Fachlogik, keine Daten |
| `cvState.profile`, Improvement-Pfad, `doc.skills` | Niemand (tot) | UI ONLY (tot) | Kein Live-Inhalt; kein Migrationsziel |
| Provider-seitige Daten | UNKNOWN | UNKNOWN | Evidenz fehlt |

## Architecture Diagrams

IST (verifiziert):

```
Browser
 ├── Manual Tab (SearchForm, mode=manual)
 │    └── App.profile ── runSearch ──► /api/jobs ──► /api/match
 │
 └── CV Tab (SearchForm mode=cv → Workflow)
      ├── documents (+ File-Blobs, hash)
      ├── suggestedProfile (Vorschlag)
      ├── cvProfile (bestätigt)
      ├── selectedSkills / Auswahl-IDs / Consent-Flags
      └── 12h Store (Map<hash, {searchProfiles[], atsProfiles[]}>) ── 12h, Memory
              │
              │  (KEINE Verbindung)
              ▼
Browser ── POST /api/profile {text,hash} ──► Jobsearch APIs ──► Redis cv-profile:<hash> (30d)
              │                                     ├── /api/jobs, /api/match, /api/ats-analysis,
              │                                     │   /api/cover-letter (stateless, kein Store)
              │                                     └── /api/alerts ──► Redis alerts-Hash (persistent)
              │
Jobsearch ──── ╳  [NO RIS CONNECTION TODAY]  (kein Client, kein Adapter, keine Identity)
```

Potenzielle zukünftige Grenze (HYPOTHETISCH, gestrichelt, keine Implementierung):

```
Browser (unbestätigt/transient)  - - - -┆- - - -  Jobsearch (Workflow/Cache/Ergebnis)
  Eingaben, Flags, Auswahl-IDs           ┆  12h-Store?, Such-/ATS-Ausführung, KI-Cache
                                         ┆
                              ┆  RIS (authentifiziert, gestrichelt)  ┆
                              ┆  bestätigte Profile? benannte Ein-   ┆
                              ┆  träge? Abos? — Identität, Consent,  ┆
                              ┆  Delete, Export: ALLES OFFEN         ┆
```

## Open Questions

1. Kanonische RIS-Profilform: `Profile` vs. Teilmenge vs. erweitert (Level)? Wer entscheidet?
2. `experienceLevel`: übernehmen (woher kanonisch?), verwerfen, oder neu modellieren?
3. Search- vs. CV-Profil: zwei Linien behalten oder bewusst vereinen (TAB-STATE-01 hält sie getrennt)?
4. ATS-Profil: auf volles `Profile` anheben oder Teilmenge als RIS-Typ übernehmen?
5. User Identity: welches IdP-/Kontomodell (E-Mail+Magic-Link? OIDC? Bestehendes?)?
6. Authentication: Verfahren, Session-/Token-Lebensdauer, Refresh, Logout?
7. Ownership: welche Objekte gehören RIS vs. Jobsearch vs. Browser (verbindlich)?
8. Delete: Kaskaden (RIS→Caches→Abos→Provider?), Fremd-Delete-Schutz, Nachweis?
9. Export: Format/Umfang (JSON? PDF? inklusive Analysen?), maschinell + menschenlesbar?
10. Storage Consent: Scope (Verarbeitung vs. Speicherung), Granularität, Widerrufspfad, Nachweis?
11. Redis-Cache-Delete: Endpoint + Auth, oder TTL als ausreichend erklärt?
12. Session Binding: anonyme Quota-Welt mit Auth-Welt verbinden oder strikt trennen (Migration Gast→User)?
13. Tenant Isolation: Mandantenmodell, Isolationstests, Cross-Tenant-Schlüssel?
14. RIS API Contract: Base-URL, Versionierung, Schema, CRUD-/Fehler-Semantik, Pagination, Rate-Limits?
15. Migration bestehender 12h-Snapshots: verfallen lassen (Bruch nach 12h) oder übernehmen (woher Identität?)?
16. Alert-Inhaberschaft: Double-Opt-in/Verify vor RIS-Übernahme?
17. `radiusKm`/`workModes`/`employmentTypes`: Profil- oder Suchkontext (schränkt Kanon ein)?
18. Hash-Kollisionen: dokumentierte nutzerübergreifende Cache-Treffer akzeptabel für RIS-nahe Caches?
19. Provider-Aufbewahrung: Lösch-/Logging-Politik von Modell-/Mail-/Hosting-Providern?
20. Saved-IDs/Exportstabilität: heutige `entry-<ts>-<rand>`-IDs als RIS-IDs ungeeignet — Neuregelung?

## Conclusion

- Jobsearch besitzt heute ausschließlich gastbasierte, weitgehend flüchtige Profile plus zwei persistente Server-Ausnahmen (KI-Cache 30d ohne Delete; E-Mail-Abos ohne Auth). Alles ist ohne Benutzerbegriff gebaut — korrekt für den Ist-Zweck, aber ohne tragfähige Andockstelle für RIS (keine Identität, kein Profil-CRUD, kein Speicher-Consent).
- RIS-tauglich als Kandidaten: bestätigtes `cvProfile`, benannte Search-/ATS-Einträge, Alert-Abos (mit Vorbehalt). Alles andere bleibt in Jobsearch (Workflow/Cache/Ergebnis/Regelwerk), transient, oder ist tot.
- Eine `ProfileStore`-Abstraktion hätte eine erkennbare, schmale Grenze (benannte Profil-CRUD-Methoden um `cvProfileStore.ts`), dürfte aber ohne Auth nur gastseitig befüllt werden und nichts Tot-/Cache-/UI-Fremdes aufnehmen.
- Nächster Schritt ist Klärung, nicht Code: Identität/Auth, Kanon (inkl. `experienceLevel`), Consent-Modell, Delete-/Export-Semantik, RIS-Vertrag.
- Code geändert: NEIN. Tests ausgeführt/geändert: NEIN (Analyse stützt sich auf verifizierte Vorbefunde + gezielte Code-Lektüre dieses Tasks).

## Evidence

- Vorbefunde: `docs/reports/PERSISTENCE-BOUNDARY-01-EXECUTION_LOG.md`, `docs/reports/PROFILE-STATE-01-EXECUTION_LOG.md`, `docs/reports/PROFILE-TAB-STATE-01-EXECUTION_LOG.md` (dieser Task widerspricht keinem; TAB-STATE-Fix in `src/App.tsx:37-50,67,479-518` berücksichtigt).
- Keine RIS-Referenz: Repo-weite Suche nach `ris`/`RIS` (nur deutsche Wortbestandteile), keine Login-/Signup-/JWT-/Cognito-/OIDC-/Tenant-/UserId-Befunde in `src/`, `api/`.
- Identität/Auth: `api/_lib/identity.mjs:1-56` (anonyme Session, 1J-Max-Age); `api/jobs.mjs:61-64`, `api/match.mjs:77-78`, `api/job-details.mjs:38-39` (Cookie-Setzer); `api/_lib/usage.mjs:205-258`, `api/_lib/detailEnrich.mjs:42-43` (gehashte Session-Bindung); `api/usage.mjs:1-41` (Operator-Token); `api/cron/digest.mjs:60-68` (Cron-Auth).
- APIs: `api/profile.mjs:1-155` (Extrakt + 30d-Cache, kein Delete); `api/jobs.mjs:33-60` (Query-Profil, kein Body-Auth); `api/match.mjs:58-79` (reduziertes Profil); `api/ats-analysis.mjs:28-38` (Validierung); `api/cv-improvement.mjs:97,186,255` (Profil-Pfade); `api/cover-letter.mjs:55-64` (reduziertes Profil); `api/alerts.mjs:27-56` + `api/_lib/alerts.mjs:43-62` (E-Mail-Key, persistent, kein Nachweis).
- Profilformen: `src/types.ts:42-56` (Profile/SuggestedProfile), `src/lib/cvProfileStore.ts:1-157` (Einträge, 12h, 50er-Limit), `src/components/CvProfileResult.tsx:50-63` (Confirm-Transform ohne `experienceLevel`), `src/App.tsx:553,584` (Level-Reset), `:2281-2292` (ATS-Übergabe-Default), `:1242-1254` (Listenquelle + ID-Reset).
- Datenfluss/Privacy: `src/App.tsx:672-708` (Extrakt→Anonym→Hash→Consent→POST), `src/components/CvConsentGate.tsx` (KI-Consent, Sitzungs-Scope), `src/lib/anonymize.ts` (Regex-Verfahren), `api/_lib/cache.mjs:41-72` (SETEX/EXPIRE, fail-safe).
- Endpoints ohne Profilbezug: `api/job-details.mjs`, `api/model.mjs`, `api/models.mjs`, `api/_lib/geo.mjs:11` (30d), `api/_lib/sources/*` (600s), `api/_lib/detailEnrich.mjs:13,15` (7d/24h).

---

## Audit-Nachweis (AI_AUDITLOG-pflichtig)

- Status: YELLOW (keine Benutzer-Identität/Auth; 30d-Cache ohne Delete; Alerts ohne Inhaberschaftsnachweis; kein Speicher-Consent)
- Audit-Zeitpunkt: 2026-10-03; Branch: main; HEAD: 03129da
- Terraform-Checks: nicht anwendbar (keine Infra im Scope; keine ausgeführt)
- Git-Status: nur vorbestehende `docs/screenshotsfordev/`-Diffs (2 deleted, 2 untracked) — nicht angefasst
- Geänderte Dateien durch diese Analyse: ausschließlich `docs/reports/RIS-JOBSEARCH-01-EXECUTION_LOG.md` (neu)
- Risiken: keine (read-only Analyse)
- Nächste Schritte (Vorschlag): Klärung Open Questions 1–20 vor jeder RIS-Implementierung
- Resume-Punkt: Analyse abgeschlossen, bereit zum Commit
