# PERSISTENCE-BOUNDARY-01

## Status
YELLOW

## Scope
Analysis only — no code changes

- Audit-Datum: 2026-10-03
- Branch: main, HEAD 3c79ccc (zum Audit-Zeitpunkt)
- Scope: Ist-Analyse der Datenhaltung im Mays Job Matcher (Gast-Kontext, CV-Flow, Consent, TTLs, Löschpfade, RIS-Grenze)
- KEIN Code geändert, KEIN Refactoring, KEINE TTL-/Flow-/Consent-Änderung, KEINE RIS-Anbindung
- Methode: Repository-Suche (localStorage, sessionStorage, IndexedDB, Cookie, Cache, TTL, Consent, Löschpfade) + gezielte Datei-Lektüre. Verhalten aus Code abgeleitet und als "Code-inferred" gekennzeichnet; keine neuen Browser-Tests durchgeführt.

## Executive Finding

1. Die "12h-TTL" ist KEINE dauerhafte Persistenz. Sie lebt ausschließlich in einem modul-globalen In-Memory-`Map` im Frontend (`src/lib/cvProfileStore.ts`, `CV_LISTS_TTL_MS = 12 * 60 * 60 * 1000`, Lazy-Purge bei Zugriff). Ein Reload leert sie. Ein Browser-Neustart leert sie. Sie schützt/hält ausschließlich die benannten Such-/ATS-Profil-Listen pro CV-Hash — nicht das CV, nicht den extrahierten Text, nicht Consent, nicht Suchergebnisse.
2. Der gesamte CV-Workflow-State (Dokumente inkl. `File`-Objekte, extrahierter/anonymisierter Text nur als lokale Funktionsvariable, `cvProfile`, `suggestedProfile`, `selectedSkills`, `atsResult`, Consent-Flags, Auswahl-IDs) ist React-`useState` in `src/App.tsx` bzw. `useState` in `AtsOverlay.tsx` — Code-inferred: Reload = alles weg, neuer Tab = eigener Speicher, Browser-Neustart = alles weg.
3. Echte browser-persistente Speicher sind NUR: `localStorage`-Keys `mj-lang` (App-Sprache) und `lp2-lang` (LandingPage2-Sprache) sowie der Cookie `mj_session` (HttpOnly, `Max-Age` 1 Jahr, siehe `api/_lib/identity.mjs`). Der Cookie enthält keinen CV-Inhalt, sondern eine anonyme Session-ID für Quota-/Credit-Zählung; die zugehörigen Redis-Zähler (`mj-usage:*`, `mj-detail:quota:*`, TTL 62 Tage bzw. 24h) enthalten ebenfalls keine CV-Inhalte (Code-inferred aus Key-Bildung mit gehashten Session-IDs).
4. Serverseitig persistent mit CV-Bezug ist NUR der Profil-Cache `cv-profile:<hash>` in Upstash Redis mit 30-Tage-TTL (`api/profile.mjs`, `CV_PROFILE_CACHE_TTL_SEC = 30 * 24 * 60 * 60`), keyed by SHA-256 des (anonymisierten/normalisierten) CV-Textes, sowie dauerhafte Alert-Abos (`alerts`-Hash, kein TTL). Der Profil-Cache überlebt Reload UND Browser-Neustart (serverseitig) und wird von "CV-Daten entfernen" NICHT gelöscht (kein `cacheDel`-Aufruf im Löschpfad gefunden).
5. "CV-Daten entfernen" (`App.handleCvRemoveData` + `CvDocumentList`-Dialog) löscht nachweislich: In-Memory-Listen (`resetCvProfileLists`), Legacy-`localStorage`-Keys `mj-cv-lists:*`, alle React-States des CV-Workflows (Dokumente, Consent, Profile, Ergebnisse, Auswahl-IDs). Es löscht NICHT: Server-Cache `cv-profile:<hash>`, `mj_session`-Cookie, Redis-Quota-Zähler, Alert-Abos, Sprach-Keys. Ob anonymisierte Inhalte auf Model-/Provider-Seite verbleiben, ist aus dem Repository nicht feststellbar (Open Question).
6. YELLOW (nicht GREEN), weil: (a) der 30-Tage-Server-Profil-Cache CV-abgeleitete Daten hält und vom Client-Löschpfad nicht erreicht wird; (b) der 1-Jahres-Session-Cookie + gehashte Per-User-Redis-Zähler einen wiedererkennbaren Gast-Kontext über Browser-Neustarts hinweg darstellen — fachlich zu klären, ob das der Annahme "kein dauerhaft gespeicherter Benutzerkontext" widerspricht.

## Storage Inventory

| Mechanismus | Befund (Datei) | Nutzung |
|---|---|---|
| `localStorage` (aktiv, CV-fremd) | `src/i18n.tsx:912,925` (`mj-lang`); `src/components/LandingPage2.tsx:55,73` (`lp2-lang`) | Nur UI-Sprache (de/en). Wird bei "CV-Daten entfernen" NICHT gelöscht. Überlebt Reload + Browser-Neustart (Code-inferred, Web-Standard). |
| `localStorage` (legacy, CV) | `src/lib/cvProfileStore.ts:14,144-156` (`mj-cv-lists:*`, v1); `src/App.tsx:157`, `src/App.tsx:481` (Purge bei Start + bei "CV-Daten entfernen") | v1 speicherte Profil-Listen in `localStorage`. Seit LISTS-02 nur noch In-Memory; Altlasten werden beim App-Start einmalig entfernt. |
| `localStorage` (historisch, Profil-Cache) | `docs/ARCHITECTURE.md:151`, `docs/CHANGELOG.md:79` (`mj-cv-profile:<hash>`, TTL 30 Tage, L1) | In `src/` KEINE aktive Verwendung gefunden (kein `getItem/setItem` mit diesem Key im Produktionscode; nur Test-Cleanup in `src/App.test.tsx:114` referenziert den Prefix). Vermutlich entfernt/ersetzt — als historische Angabe gekennzeichnet. |
| `sessionStorage` | — | KEINE Verwendung in `src/` oder `api/` gefunden. |
| IndexedDB | — | KEINE Verwendung gefunden. |
| Cookies | `api/_lib/identity.mjs:3-56` (`mj_session`, HttpOnly, SameSite=Lax, `Max-Age` 365 Tage, Secure nur in Production); gesetzt in `api/jobs.mjs:64`, `api/match.mjs:78`, `api/job-details.mjs:39` | Anonyme Session-ID für Quota-/Credit-Zählung (TheirStack/JobPipe-User-Credits via `hashToken(sessionId)`, Detail-Quotas `mj-detail:quota:s:<hash>:<day>`). Kein CV-Inhalt im Cookie. Überlebt Reload + Browser-Neustart bis Max-Age (Code-inferred). Wird von "CV-Daten entfernen" NICHT gelöscht. |
| Cache API / Service Worker | — | KEINE Verwendung gefunden (`package.json`/`vite.config.ts` ohne PWA-/Workbox-Einträge; keine `sw`-/`service-worker`-Dateien in `src/`/`public/`). |
| URL-/Query-Persistenz | `src/App.tsx:51-55` (Route aus `pathname`: `/impressum`, `/top`, sonst Landing); `src/App.tsx:150-152` (Hash wird beim Start entfernt); `src/api.ts:223`, `src/hooks/useCityAutocomplete.ts:60` (`URLSearchParams` nur für API-Requests) | KEINE CV-/Profil-/Consent-Persistenz in URL/Query/Hash. |
| React Context mit Persistenz | `src/i18n.tsx:920-930` (`LangProvider`: persistiert nur `mj-lang` nach `localStorage`); sonst Context ohne Storage | Einziger persistenter Context = Sprache. |
| Zustand/Redux/Store-Libs | — | KEINE gefunden. State = `useState`/`useRef` + Modul-`Map` + Modul-`let cache`. |
| Modul-In-Memory (Frontend) | `src/lib/cvProfileStore.ts:43` (`buckets: Map<hash, bucket>` mit `expiresAt`); `src/hooks/useAvailableModels.ts:21` (`let cache`, TTL 5 min) | Profil-Listen (12h-Fenster) bzw. Modellkatalog (5 min). Beides Reload-flüchtig. |
| Serverseitig (Upstash Redis via `api/_lib/cache.mjs`) | `api/profile.mjs:6,100-103,141` (`cv-profile:<hash>`, 30 Tage); `api/_lib/sources/*.mjs`, `api/_lib/sources/apify/index.mjs` (`job-source:*`, 600 s); `api/_lib/detailEnrich.mjs:13,15` (Detail-Cache 7 Tage, Quota 24h); `api/_lib/usage.mjs:15` (Monatszähler 62 Tage); `api/_lib/alerts.mjs:3` (`alerts`-Hash, persistent/kein TTL); `api/_lib/geo.mjs:11` (Geo 30 Tage) | Nur `cv-profile:<hash>` und `alerts` haben Personen-/CV-Bezug; Job-/Geo-/Usage-Caches sind inhaltsfremd. Redis-Ausfall = fail-safe Miss (`cache.mjs:12,22,27` → `null`). |
| TTL-/Expiry-Implementierungen | `src/lib/cvProfileStore.ts:12,56-57,66` (12h, Lazy-Purge); `src/hooks/useAvailableModels.ts:14,46` (5 min, Modul-Cache); serverseitig `SETEX`/`EXPIRE` in `api/_lib/cache.mjs:41-72` | Siehe 12h-Analyse unten. |
| Dokument-/Session-Identifier | `src/App.tsx:381-391` (`sha256Hex` des normalisierten CV-Textes → `doc.hash`, `src/types.ts:292`); `api/profile.mjs:12-14` (Hash-Validierung, nur bei gültigem Hash wird gelesen/geschrieben); `api/_lib/identity.mjs:35-45` (anonyme Session-ID, IP-Backstop) | CV-Hash = Schlüssel für Listen + Server-Profil-Cache. Session-ID = Schlüssel für Quota-Zähler (gehasht). |
| Browser-Caches (HTTP) | — | Nicht untersucht (kein Hinweis im Repo auf custom Cache-Header für CV-Daten); als Open Question vermerkt. |

## 12h TTL Analysis

- Datei: `src/lib/cvProfileStore.ts`
- Konstante: Zeile 12 — `export const CV_LISTS_TTL_MS = 12 * 60 * 60 * 1000; // 12 Stunden`
- Datenstruktur: Zeilen 37-43 — `CvListsBucket` = `{ searchProfiles, atsProfiles, expiresAt }`; Ablage in `const buckets = new Map<string, CvListsBucket>()` (Zeile 43, Modul-Scope = In-Memory der laufenden Seite).
- Key/Identifier: SHA-256-Hash des anonymisierten/normalisierten CV-Textes (`doc.hash`; gesetzt in `src/App.tsx:690-697`, berechnet in `sha256Hex`, `src/App.tsx:381-391`; Kommentar `src/types.ts:288-292`).
- Gespeicherte Daten: NUR benannte Profil-Listen — `CvSearchProfileEntry { id, name, savedAt, profile: Profile }` und `CvAtsProfileEntry { id, name, savedAt, targetRoles, skills }` (Zeilen 17-30). Es werden "nur anonymisierte/bestaetigte Profildaten gehalten" (Zeilen 4-10).
- Startzeitpunkt: `getOrCreateBucket` (Zeilen 63-70) — `expiresAt = now + CV_LISTS_TTL_MS` beim ERSTEN Save eines Hashs; weitere Saves verlängern NICHT ("Festes Fenster", Zeilen 38-40; Test `cvProfileStore.test.ts:96` bestätigt Nicht-Verlängerung).
- Ablaufberechnung: `getBucket` (Zeilen 53-61) — bei jedem Zugriff (`read`/`save`) gilt `now > bucket.expiresAt` → `buckets.delete(hash)` + `null` ("Lazy-Purge"; kein Timer, kein Hintergrund-Job).
- Cleanup-Verhalten: (a) Lazy bei Zugriff nach Ablauf; (b) bei offener Seite ohne Zugriff bleibt der Eintrag bis zum nächsten Zugriff bestehen (Code-inferred); (c) Reload/neuer Prozess = `Map` weg = alles weg, unabhängig von `expiresAt`; (d) sofortiges Leeren via `resetCvProfileLists()` (Zeile 138-140).
- Schreiber: `saveCvSearchProfile` (Zeile 91), `saveCvAtsProfile` (Zeile 114) — aufgerufen aus `src/App.tsx` (Import Zeile 31).
- Leser: `readCvProfileLists` (Zeile 72), `findSavedSearchProfile` (Zeile 83) — aufgerufen aus `src/App.tsx:525,556` (Edit-Pfade) u.a.
- WAS die TTL schützt/hält: ausschließlich das 12-Stunden-Fenster der benannten Such-/ATS-Profil-Listen pro CV. Sie schützt weder das CV noch Extrakt/Consent/Ergebnisse noch irgendeinen serverseitigen Cache.
- Abgrenzung: Die "12h" in `docs/reports/STEP_23C_RECOVERY_EXECUTION_LOG.md:237` betrifft Vercel-OIDC-Tokens (Dev-Infra), NICHT Gast-/CV-Daten. Die 30-Tage-TTLs (`api/profile.mjs`, `docs/ARCHITECTURE.md:151-152`) betreffen den Server-Profil-Cache, NICHT die 12h-Listen.

## Reload Behaviour

Codepfad (Code-inferred, kein neuer Browser-Test durchgeführt): Upload (`handleCvUploadStart`, `src/App.tsx:399-418`) → Consent (`handleCvConsentAccept`, `:642-656`) → Anonymisierung+Profil (`createProfileFromPdf`, `:662-737`: `extractPdfText` → `anonymizeText` → `normalizeText` → `sha256Hex` → `POST /api/profile`) → Such-/ATS-Profile in `cvProfileStore` → Job-Suche/ATS-Analyse.

| Schritt | Was bleibt | Was geht verloren | Warum |
|---|---|---|---|
| A) Normaler React-State (vor Reload) | Alles im `cvState` + `buckets`-Map + `models`-Modul-Cache | — | JS-Heap der Seite |
| B) F5 / Reload | `mj-lang`, `lp2-lang` (localStorage); `mj_session`-Cookie; serverseitige Redis-Einträge (`cv-profile:<hash>`, Usage-Zähler, Job-Caches) | Gesamter `cvState` (Dokumente+`File`-Objekte, `selectedDocumentIds`, `consentGiven`, `anonymizationMode`-Auswahl, `suggestedProfile`, `cvProfile`, `selectedSkills`, `atsResult`, `aiSearchResult`, Improvement-States, `activeAtsEntryId`, `selectedSavedSearchId`, `editingSearchName`, `profilesDocId`); `buckets`-Map (12h-Listen); `models`-Cache; `AtsOverlay`-State (`analysis`, `consentGiven`); manueller `profile`-State, `matches`, `foundJobs`, `dataset`, `selectedModel`-Auswahl | Kein Re-Hydratisierungscode gefunden: `App.tsx:149-158` entfernt nur Hash/Scroll und purgt Legacy-Keys; `readStoredLang` lädt nur Sprache. Modul-`Map` wird neu initialisiert. (Existierender Test `src/App.test.tsx:1284-1320` deckt "CV-Daten entfernen", NICHT Reload.) |
| C) Neuer Browser-Tab (gleicher Browser, gleiche Session) | `mj-lang`, `lp2-lang`, `mj_session`-Cookie (Cookie-Scope, nicht Tab-Scope); serverseitige Redis-Einträge | Gesamter React-/Modul-State (eigener JS-Heap pro Tab). Ausnahme: derselbe `cv-profile:<hash>`-Cache-Treffer wäre bei erneutem Upload desselben CVs serverseitig wieder abrufbar (ohne Re-Run der KI) | Tabs teilen sich `localStorage`/Cookies, aber nicht den JS-Heap |
| D) Browser schließen (Session-Ende) | `localStorage`-Keys; `mj_session`-Cookie NUR falls der Browser persistente Cookies behält (kein `Expires`-Datum gesetzt, aber `Max-Age=1 Jahr` → Code-inferred: überlebt Session-Ende, sofern nicht "beim Beenden löschen" aktiv); Redis-Einträge bis TTL | JS-Heap inkl. `buckets`-Map und `cvState` | Prozessende |
| E) Browser erneut öffnen | Wie D: Sprache + ggf. `mj_session` + Redis-Einträge bis TTL | Alle CV-/Consent-/Ergebnis-States (müssen neu erzeugt werden) | Keine Persistierung implementiert |

## Browser Restart Behaviour

Siehe Tabelle D/E oben. Kernsatz (Code-inferred): Ein Gast erhält nach Browser-Neustart KEINEN wiederhergestellten CV-Kontext — kein Dokument, kein Profil, keine Listen, kein Consent, keine Ergebnisse. Was einen Neustart überlebt: (1) UI-Sprache, (2) der anonyme `mj_session`-Cookie (1 Jahr Max-Age; nur Session-ID, kein CV-Inhalt), (3) serverseitige Redis-Einträge bis zu ihrer TTL — darunter `cv-profile:<hash>` (30 Tage, CV-abgeleitet, per Hash abrufbar, aber ohne Hash-Referenz im Browser nicht auffindbar), Quota-/Usage-Zähler (62 Tage/24h, keine Inhalte), Alert-Abos (dauerhaft, E-Mail-basiert, kein Gast-Session-Kontext).

## CV Data Removal

- UI: Button `cv.removeData` = "CV-Daten entfernen" (`src/i18n.tsx:622`), Bestätigungsdialog (`alertdialog`, `src/components/CvDocumentList.tsx:40,197`, `src/styles.css:2515`), Test `src/App.test.tsx:1284-1320`.
- Funktion: `handleCvRemoveData` (`src/App.tsx:479-518`).
- Tatsächlicher Löschpfad (verifiziert):
  1. `resetCvProfileLists()` → `buckets.clear()` (alle 12h-Listen aller Hashes sofort weg).
  2. `purgeLegacyCvListsFromLocalStorage()` → entfernt alle `localStorage`-Keys mit Prefix `mj-cv-lists:*`.
  3. React-Resets: `setProfilesDocId(null)`, `setAtsProfileName("")`, `setSelectedSavedSearchId(null)`, `setActiveAtsEntryId(null)`, `setConsentDismissed(false)`, `setCvState({...Initial...})` — Dokumente LEER, `selectedDocumentIds` LEER, `consentGiven: false`, `suggestedProfile/cvProfile/profile` NULL, `atsResult/aiSearchResult/improvement*` NULL, `selectedSkills` LEER.
- NICHT gelöscht (kein Codepfad gefunden): Server-Profil-Cache `cv-profile:<hash>` (kein `cacheDel` im Löschpfad; Eintrag lebt bis 30-Tage-TTL weiter und ist bei Re-Upload desselben CVs wieder treffbar); `mj_session`-Cookie; Redis-Quota-/Usage-Zähler; `alerts`-Abos; `mj-lang`/`lp2-lang`; etwaige Provider-/Modell-seitige Daten (außerhalb des Repos).
- Abgeleitete/anonymisierte Daten: im Browser bleiben nachweislich KEINE zurück (Listen + States werden geleert). Serverseitig bleibt das abgeleitete `SuggestedProfile` unter `cv-profile:<hash>` bestehen (anonymisierter Input → KI-Profil; der Hash selbst ist aus anonymisiertem Text gebildet). IDs/Metadaten im Browser (`entry.id = entry-<timestamp>-<rand>`, `savedAt`, `doc.id`) sind mit dem State weg.
- Historischer Hinweis: `ATS-PROFILE-INVESTIGATION-01` (Zeile 25) dokumentierte, dass Auswahl-IDs nach dem Entfernen stehen blieben — per `CV-UPLOAD-UX-10` (`src/App.tsx:484-486`) werden `selectedSavedSearchId`/`activeAtsEntryId` heute zurückgesetzt.

## Consent Boundary

Implementiert (nur dokumentiert, nichts geändert):

- A) Einwilligung zur KI-Verarbeitung: JA — zweistufig. (1) CV-Profil: `CvConsentGate` (`src/components/CvConsentGate.tsx`: Checkbox-Pflicht, `consented`-State lokal, `onAccept` → `handleCvConsentAccept` → `cvState.consentGiven = true`). Sitzungsweit: Folge-Uploads überspringen den Dialog (`step: prev.consentGiven ? "creating-profile" : "consent-required"`, `src/App.tsx:414`), d.h. EINE Zustimmung pro Sitzung deckt mehrere Dokumente. Abbruch ohne Zustimmung = kein AI-Call, Dokument bleibt, Dialog reöffnbar (`consentDismissed`, `handleCvConsentCancel`). (2) ATS-KI-Formulierungen: separates `ConsentGate` (`src/components/ConsentGate.tsx`) bzw. `consentGiven`-State in `AtsOverlay.tsx:40`; KI-Pfad nur mit `consent: true` (`:94-98`); Basis-ATS-Analyse läuft lokal/deterministisch ohne Consent (`api/_lib/ats.mjs:345`, `analyzeATS(..., { enabled: false })`).
- B) Einwilligung zur Speicherung: NICHT als separate Einwilligung gefunden. Es gibt keinen "Speichern zustimmen"-Dialog; die 12h-Listen und der 30-Tage-Server-Cache folgen implizit aus Verarbeitung/Profil-Erstellung. Explizit dokumentiert als FEHLEND.
- C) Technische Session-/Cache-Daten: Cookie `mj_session` wird ohne Einwilligungs-Dialog gesetzt (Response-Header in `jobs`/`match`/`job-details`); `localStorage`-Sprache ohne Dialog; Redis-Job-/Quota-Caches ohne Dialog (alle ohne CV-Inhalt außer `cv-profile:<hash>`).
- D) Authentifizierte RIS-Persistenz: NICHT vorhanden (Roadmap Phase 4: "real authentication, saved candidate profiles, application tracker" — `docs/AGENTS.md`). Kein Login-, kein User-, kein RIS-Adapter-Code gefunden.

Persistenz der Consent-States selbst: `cvState.consentGiven`, `consented` (CvConsentGate), `consentGiven` (AtsOverlay), `consentDismissed` — alle reines `useState`, Code-inferred: Reload = Zustimmung weg = erneute Zustimmung nötig.

## Privacy Boundary

Bekannter Fluss (unverändert): PDF bleibt auf dem Gerät (`extractPdfText(doc.file)` clientseitig, `src/App.tsx:672`); PII-Reduktion via `anonymizeText` (Muster-Ersetzung, `src/lib/anonymize.ts`) NUR wenn `anonymizationMode === "anonymized"` (Standard; `src/App.tsx:685-687`); danach Consent-Gate; danach `POST /api/profile` mit `{ text (normalisiert), hash?, model? }` (`src/api.ts:274-287`); Server antwortet mit `SuggestedProfile` (oder Redis-Cache-Treffer ohne KI-Call).

- VOR dem Boundary (Browser, lokal): `File`-Objekt, extrahierter Rohtext (nur lokale `text`-Variable in `createProfileFromPdf`, NICHT in State persistiert — Code-inferred aus `:662-708`), anonymisierter Text (ebenfalls nur lokale `processedText`-Variable), `doc.hash` (SHA-256 des normalisierten Textes, in State + als Cache-Key verwendet).
- NACH dem Boundary (Browser verlassen): normalisierter (ggf. anonymisierter) Text an `/api/profile` (→ OpenRouter-Chat, `api/profile.mjs:122-130`); gespeichertes Ergebnis `SuggestedProfile` im Server-Cache `cv-profile:<hash>` (30 Tage). Manuelle Suchprofile (`skills`, `targetRole`, `city`) verlassen den Browser zusätzlich an `/api/jobs`, `/api/match`, `/api/cover-letter`, `/api/alerts` (E-Mail dort persistent).
- Lokal danach: `suggestedProfile`, `cvProfile`, Listen-Einträge, ATS-/Match-Ergebnisse — alles React-/Modul-State, Reload-flüchtig.
- Modus-Lücke: Bei `anonymizationMode === "not-anonymized"` geht der NICHT anonymisierte Text an das Modell (explizite Nutzerwahl im Flow; `CvAnonymizationChoice`-Komponente vorhanden).

## Current Ownership

| Daten | Ursprung | Speicherort | Persistenztyp | TTL | Reload | Browser-Neustart | Löschpfad |
|---|---|---|---|---|---|---|---|
| Hochgeladenes CV (`File`) | Nutzer-Upload | React-State (`cvState.documents[].file`) | Memory (Heap) | Sitzungsdauer (bis Remove/Reload) | VERLOREN | VERLOREN | "CV-Daten entfernen" (Dokumente=[]); Einzel-Remove (`handleRemoveCvDocument`) |
| Extrahierter CV-Text (roh) | `extractPdfText` (clientseitig) | Lokale Funktionsvariable (`text` in `createProfileFromPdf`) — nicht persistent / React state only (kein State-, kein Storage-Schreibpfad gefunden) | Keine | — | VERLOREN | VERLOREN | Automatisch (Scope-Ende) |
| Anonymisierter CV-Text | `anonymizeText` (clientseitig, nur wenn Modus=anonymized) | Lokale Variable (`processedText`/`normalized`) → Request-Body | Keine (transient) | — | VERLOREN | VERLOREN | Automatisch; Request-Transparenz siehe Privacy Boundary |
| `doc.hash` (SHA-256) | Client (`sha256Hex(normalisierter Text)`) | React-State (`documents[].hash`) + Key für Listen/Server-Cache | Memory | Sitzungsdauer | VERLOREN | VERLOREN | "CV-Daten entfernen" |
| `cvProfile` (bestätigtes Profil) | Nutzer-Bestätigung aus `suggestedProfile` | React-State | Memory | Sitzungsdauer | VERLOREN | VERLOREN | "CV-Daten entfernen" |
| `suggestedProfile` (KI-Vorschlag) | `POST /api/profile` (KI oder Cache-Treffer) | React-State | Memory | Sitzungsdauer | VERLOREN | VERLOREN | "CV-Daten entfernen" |
| Search Profile (benannte Liste) | Nutzer-Save aus Profil | Modul-`Map` (`buckets`) | Memory + TTL-Fenster | 12h ab erstem Save (keine Verlängerung), Lazy-Purge | VERLOREN | VERLOREN | "CV-Daten entfernen"; Ablauf; `resetCvProfileLists` |
| ATS Profile (benannte Liste) | Nutzer-Save aus Skills/Rollen | Modul-`Map` (`buckets`) | Memory + TTL-Fenster | 12h (wie oben) | VERLOREN | VERLOREN | Wie oben |
| `selectedSkills` | Skill-Auswahl-Step | React-State | Memory | Sitzungsdauer | VERLOREN | VERLOREN | "CV-Daten entfernen" |
| `targetRoles` (Arbeitskopie) | Profil-/Skill-Steps | React-State (in Profil-Objekten / ATS-Einträgen) | Memory | Sitzungsdauer | VERLOREN | VERLOREN | "CV-Daten entfernen" |
| `selectedDocumentIds` | Dokument-Auswahl | React-State | Memory | Sitzungsdauer | VERLOREN | VERLOREN | "CV-Daten entfernen" (+ Einzel-Select/Remove) |
| Consent (CV-KI) `consentGiven` | `CvConsentGate`-Checkbox | React-State (+ `consentDismissed`-Flag) | Memory | Sitzungsdauer | VERLOREN (erneute Zustimmung nötig) | VERLOREN | "CV-Daten entfernen" (Reset auf false) |
| Consent (ATS-KI) | `ConsentGate`/`AtsOverlay`-Checkbox | React-State (`AtsOverlay.consentGiven`) | Memory | Sitzungsdauer (Overlay-Lebensdauer) | VERLOREN | VERLOREN | Overlay schließen |
| Model Selection (`selectedModel`) | Nutzer-Auswahl / Defaults | React-State + Modul-Cache (5-min-Katalog) | Memory | Sitzungsdauer / 5 min (Katalog) | VERLOREN | VERLOREN | — (kein Löschpfad nötig, keine Persistenz) |
| ATS analysis result | `analyzeATS` (lokal deterministisch + optional KI) | React-State (`atsResult`, `AtsOverlay.analysis`) | Memory | Sitzungsdauer | VERLOREN | VERLOREN | "CV-Daten entfernen" |
| Job search result/cache | `/api/jobs`, `/api/match` | React-State (`matches`, `foundJobs`, `dataset`, `aiSearchResult`) + serverseitig Redis `job-source:*` (600 s, inhaltsfremd: Job-Datensätze, keine CV-Daten) | Memory (Client) / Redis 600 s (Server) | Sitzungsdauer / 10 min | Client VERLOREN; Server bis TTL | Client VERLOREN; Server bis TTL | "CV-Daten entfernen" (Client); Server via TTL |
| Session identifiers | Server (`anonymousIdentity`) | Cookie `mj_session` (HttpOnly) + Redis-Zähler (`mj-usage:*`, `mj-detail:quota:*`, gehashte Session) | Cookie 1 Jahr Max-Age; Redis 62 Tage / 24h | s. links | BLEIBT | BLEIBT (sofern Browser Cookies behält) | KEIN Löschpfad im Produkt gefunden |
| Usage-related state | Server (`usage.mjs`, `detailEnrich.mjs`) | Redis (Zähler, keine Inhalte) | 62 Tage (Monat) / 24h (Quota) | s. links | BLEIBT (server) | BLEIBT (server) | TTL-Ablauf |
| Server-Profil-Cache | `/api/profile` (KI-Ergebnis) | Redis `cv-profile:<hash>` | 30 Tage | 30 Tage | BLEIBT (server) | BLEIBT (server) | NUR TTL-Ablauf (kein Client-Löschpfad) |
| Alert-Abo (E-Mail + Profil) | `AlertCard` → `POST /api/alerts` | Redis `alerts`-Hash | Persistent (kein TTL) | Unbegrenzt | BLEIBT | BLEIBT | `DELETE /api/alerts` (separater Abo-Löschpfad, nicht Teil von "CV-Daten entfernen") |
| UI-Sprache | Nutzer-/Browser-Wahl | `localStorage` (`mj-lang`, `lp2-lang`) | Persistent (kein TTL) | Unbegrenzt | BLEIBT | BLEIBT | KEIN (bleibt bewusst erhalten; kein CV-Bezug) |

RIS-relevante Boundary (CURRENT OWNER / CURRENT STORAGE / CURRENT LIFETIME, keine Zukunftsentscheidung): Kandidaten-Stammdaten existieren heute NUR als flüchtiger Gast-State (Owner: Browser-Heap, Lebensdauer: Sitzung) plus zwei persistente Ausnahmen — (1) `cv-profile:<hash>` in Redis/30 Tage (Owner: Jobsearch-Serverless/Upstash; Key = Inhalts-Hash, kein User-Key) und (2) `alerts`-Hash in Redis/ohne TTL (Owner: Jobsearch/Upstash; Key = E-Mail). Alles andere Persistente (`mj_session`, Usage-Zähler, Job-Caches, Sprach-Keys) ist bewusst CV-fremd. Ein späterer RIS-Adapter müsste mindestens diese drei Objekte betrachten (flüchtiges Sitzungsprofil, Hash-Cache, E-Mail-Abos); welche davon künftig ins RIS gehören, ist NICHT entschieden (siehe Open Questions).

## Open Questions

1. Ist der anonyme 1-Jahres-`mj_session`-Cookie + gehashte Per-User-Redis-Zähler (62 Tage) mit der Annahme "kein dauerhaft gespeicherter Benutzerkontext" vereinbar, oder braucht es eine kürzere Session-Lebensdauer / Opt-out? (Fachentscheidung, keine Analyse-Annahme getroffen.)
2. Soll der Server-Profil-Cache `cv-profile:<hash>` (30 Tage, CV-abgeleitet) künftig vom Client-Löschpfad ("CV-Daten entfernen") erreichbar sein (z.B. `DELETE`-Endpoint mit Hash), oder ist TTL-Ablauf ausreichend? Heute: kein Löschpfad.
3. Verbleiben anonymisierte CV-Texte / Profile auf Provider-Seite (OpenRouter/Modell-Provider, Resend, Upstash) über die dokumentierten TTLs hinaus (Logging, Abuse-Monitoring, Backups)? Aus dem Repository NICHT feststellbar.
4. Gilt der historische `mj-cv-profile:<hash>`-localStorage-L1 (ARCHITECTURE.md/CHANGELOG.md) als endgültig entfernt, oder existiert noch ein unentdeckter Schreibpfad? In `src/` kein aktiver Schreib-/Lesezugriff gefunden; Doku-Abgleich offen.
5. Sollen HTTP-Browser-Caches (z.B. API-Responses mit Profil-Inhalten) zusätzlich untersucht werden (Header-Audit)? In dieser Analyse NICHT untersucht.
6. Ist EINE Sitzungseinwilligung für mehrere CV-Dokumente (`prev.consentGiven`-Wiederverwendung) fachlich gewollt, oder soll Consent pro Dokument gelten? Heute: pro Sitzung (Code-Fakt, keine Wertung).

## Evidence

- 12h-TTL: `src/lib/cvProfileStore.ts:12` (Konstante), `:37-43` (Bucket/Map), `:53-70` (Lazy-Purge/festes Fenster), `:91-135` (Schreiber), `:72-89` (Leser), `:138-140` (Reset), `:144-156` (Legacy-Purge); Tests `src/lib/cvProfileStore.test.ts:87-114`.
- CV-State/Flow: `src/App.tsx:99-127` (State-Initial), `:399-418` (Upload), `:642-656` (Consent-Accept), `:662-737` (PDF→Anonym→Hash→`/api/profile`), `:476-518` (RemoveData), `:149-158` (Start-Effekt ohne Re-Hydratisierung); `src/types.ts:281-293` (`CvDocument`), `:336-371` (`CvProcessingState`).
- Consent: `src/components/CvConsentGate.tsx:1-98` (Checkbox-Pflicht, lokaler State), `src/components/ConsentGate.tsx:1-45`, `src/components/AtsOverlay.tsx:40` (lokaler Consent-State), `:46-69` (deterministische Basis-Analyse ohne KI), `:86-108` (KI nur mit Consent).
- Anonymisierung: `src/lib/anonymize.ts:1-39` (Muster), `src/App.tsx:683-689` (Modus-Bedingung).
- Server-Cache: `api/profile.mjs:6` (30-Tage-TTL), `:99-104` (Cache-Read), `:140-142` (Cache-Write); `api/_lib/cache.mjs:41-72` (SETEX/EXPIRE, fail-safe `null`); Job-Caches `api/_lib/sources/adzuna.mjs:11`, `jobspipe.mjs:21`, `theirstack.mjs:21`, `apify/index.mjs:18` (je 600 s); `api/_lib/detailEnrich.mjs:13,15` (7 Tage/24h); `api/_lib/usage.mjs:15` (62 Tage); `api/_lib/geo.mjs:11` (30 Tage Geo).
- Session/Cookie: `api/_lib/identity.mjs:1-56` (Cookie-Name, 1-Jahr-Max-Age, HttpOnly, anonyme ID, IP-Backstop); gesetzt `api/jobs.mjs:63-64`, `api/match.mjs:77-78`, `api/job-details.mjs:38-39`; Verbrauch `api/_lib/usage.mjs:205-258`, `api/_lib/detailEnrich.mjs:42-43`.
- Alerts (persistent): `api/_lib/alerts.mjs:3` (`alerts`-Hash), `api/alerts.mjs:27-56` (POST/DELETE).
- Sprache (persistent, CV-fremd): `src/i18n.tsx:910-930`, `src/components/LandingPage2.tsx:55-73`.
- Abwesenheiten (gesucht, nichts gefunden): `sessionStorage`, IndexedDB, `document.cookie` (Client), Service Worker/Cache API (`package.json`/`vite.config.ts` ohne PWA-Einträge; keine SW-Dateien), Zustand/Redux, URL-Persistenz für CV-Daten.
- Historisch: `docs/ARCHITECTURE.md:20,151-152`, `docs/CHANGELOG.md:79`, `docs/COMPONENT_GUIDE.md:76`, `docs/reports/STEP_36A_EXECUTION_LOG.md:20` (L1-localStorage-Darstellung); `docs/reports/CV-PROFILE-LISTS-02-EXECUTION_LOG.md:34-37,65` (Umstellung auf Memory); `docs/reports/CV-PROFILE-LISTS-04-EXECUTION_LOG.md:11-14` (Remove-Button); `docs/reports/ATS-PROFILE-INVESTIGATION-01-EXECUTION_LOG.md:19-28` (12h-Löschung, Auswahl-ID-Befund); `docs/reports/CV-FLOW-06-01-06-02-EXECUTION_LOG.md:357` (consentGiven in-memory); `src/App.test.tsx:110-118,1284-1320` (Test-Isolation + Remove-Test).
- Modelle (Memory, 5 min): `src/hooks/useAvailableModels.ts:14-21,45-60`.
- Negativ-Suchen (Repo-weit, Stand HEAD): `localStorage|sessionStorage|IndexedDB|document.cookie|caches.open|serviceWorker` (nur Treffer wie oben dokumentiert); `43200|"12h"` in `src/`/`api/` (nur `cvProfileStore.ts` + OIDC-Infra-Doku).

## Conclusion

- Die 12h-TTL ist ein rein flüchtiges In-Memory-Fenster für benannte Profil-Listen; sie begründet KEINE dauerhafte Gast-Persistenz. Reload und Browser-Neustart löschen den gesamten CV-Kontext im Browser nachweislich (Code-inferred; kein Re-Hydratisierungscode vorhanden).
- Persistent über den Browser hinaus leben: UI-Sprache (harmlos), der anonyme `mj_session`-Cookie mit Quota-Zählern (wiedererkennbar, aber inhaltsleer) sowie serverseitig der 30-Tage-Profil-Cache und dauerhafte Alert-Abos. Nur der Profil-Cache ist CV-abgeleitet und vom "CV-Daten entfernen"-Pfad NICHT abgedeckt — das ist der einzige YELLOW-treibende Client/Server-Bruch neben der fachlich zu klärenden Session-Cookie-Lebensdauer (1 Jahr).
- Consent ist heute NUR KI-Verarbeitungs-Consent (pro Sitzung + separat für ATS-KI); ein Speicher-Consent existiert NICHT. Eine authentifizierte RIS-Persistenz existiert NICHT.
- Code geändert: NEIN. Tests ausgeführt: NEIN (zur Analyse nicht notwendig; existierende Tests nur referenziert).
