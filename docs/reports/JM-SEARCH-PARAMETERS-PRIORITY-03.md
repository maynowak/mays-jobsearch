# JM-SEARCH-PARAMETERS-PRIORITY-03

**Art:** Suchparameter-/Profil-/Datenschutz-Implementierung
**Status:** IMPLEMENTIERT / VERIFIZIERT (lokal)
**Deployment:** keines
**Datum:** 2026-10-31

## 1. Aktuelle Suchparameterarchitektur

Die bestehenden Verträge bleiben unverändert:

```typescript
interface SearchConfigurationV1 {
  skills: string;
  targetRoles: string[];
  city: string;
  radiusKm: number | null;
  workModes: WorkMode[];
  employmentTypes: EmploymentType[];
}

interface MatchingPreferencesV1 {
  requiredSkills: string[];
  preferredSkills: string[];
  excludedTerms: string[];
}
```

Relevante Pfade:

| Datei | Rolle |
|---|---|
| `src/lib/profiles/contractTypes.ts` | V1-Verträge |
| `src/lib/profiles/profileMappers.ts` | `Profile` ↔ `SearchConfigurationV1` |
| `src/lib/profiles/profileValidation.ts` | Validierung inkl. `radiusKm: null` und Enums |
| `src/lib/manualSearchProfiles.ts` | unabhängige manuelle Suchprofile |
| `src/lib/profiles/sessionRepositories.ts` | Session-Adapter für manuelle/CV-Profile |
| `src/components/ManualSearchProfilesSection.tsx` | manuelle Suchprofil-UI |
| `src/App.tsx` | Übergabe an die bestehende Suche |
| `api/jobs.mjs` | Suchparameter-Parsing |
| `api/_lib/searchStrategy.mjs` | Mehrfachbegriffe/Quoted Phrases, Kandidatenpool |
| `api/_lib/sources/index.mjs` | Quellen-Registry und Suche |
| `api/_lib/sources/apify/index.mjs` | Arbeitsagentur/Apify |

Mehrteilige Begriffe bleiben als ein Token erhalten:

- `parsePhraseList`/`formatSkills` auf der UI-Seite.
- `splitQuotedPhrases`/`normalizeSkills` auf der API-Seite.
- `radiusKm: null` bleibt „Entfernung egal“ und wird nicht in einen harten Ortsfilter umgewandelt.

## 2. Manuelle Suchprofile

Manuelle Profile sind vollständig CV-unabhängig:

- `ManualSearchProfile` hat `origin: "manual"`, `searchConfig` und
  `matchingPreferences`.
- Kein `cvHash`, kein `documentId`, kein PDF.
- Repository ist eine **In-Memory-Map** für die laufende Sitzung; kein
  `localStorage`, kein Backend, keine Redis-Persistenz.
- Erstellen, Bearbeiten, Duplizieren, Löschen und „Damit suchen“ laufen ohne
  Modellaufruf.
- „Damit suchen“ übergibt das Profil an den bestehenden Suchpfad
  (`handleProfileChange` + `handleSubmit`) und startet genau eine `/api/jobs`-
  Anfrage.
- Die Session-Isolation über `beginNewProfileSession` und
  `ProfileSessionEndedError` bleibt erhalten.

Bestehende Tests belegen:

- Manuelles Profil ohne CV/Hash.
- Mehrteilige Begriffe in Muss-/Wunsch-/Ausschlusslisten.
- Bearbeiten/Duplizieren/Löschen.
- Genau eine bestehende Suche, kein `createProfile`-Aufruf.

## 3. CV-basierte Suchparameterübernahme

Ablauf:

1. PDF wird im Browser mit `pdfjs-dist` verarbeitet; die PDF-Datei wird nicht
   hochgeladen.
2. Der normalisierte Text wird für die lokalen CV-Profil-Listen gehasht.
3. `POST /api/profile` erhält nur `{ text, model? }`.
4. `api/profile.mjs` ruft die AI bei **jeder** Anfrage auf.
5. Das Ergebnis ist ein editierbarer Vorschlag; der Benutzer übernimmt/anpasst
   die Suchparameter.
6. Die Suche läuft anschließend über den bestehenden `/api/jobs`-Pfad.

Änderungen:

- **CV-Profil-Cache in Redis entfernt.**
  `api/profile.mjs` importiert keinen Cache mehr, erzeugt keinen
  `cv-profile:<hash>`-Schlüssel und schreibt keine abgeleiteten Profile mehr.
- **CV-Hash nicht mehr an `/api/profile` gesendet.** `src/api.ts` sendet nur
  `text` und optional `model`; `App.tsx` übergibt den Hash nur noch an die
  lokalen CV-Listen.
- Der Hash bleibt ein Browser-Session-Schlüssel für CV-Listen; er ist keine
  Voraussetzung für manuelle Profile oder für die Profilerstellung.

Kostenfolge: Wiederholte Verarbeitung desselben CVs löst jetzt erneut einen
AI-Aufruf aus. Die globalen OpenRouter-/EdenAI-Budgets bleiben unverändert
wirksam.

Die CV-/ATS-Hierarchie (`CV → SearchProfile → ATSSearchProfile`) und die
12h-Session-Listen bleiben unverändert.

## 4. Redis-Nutzung der Job-Quellen

Redis bleibt für Job-Source-, Detail- und Kostenzwecke erhalten. Kein neuer
dauerhafter Suchprofil-Speicher.

| Zweck | Schlüssel | TTL |
|---|---|---|
| Apify/Arbeitsagentur L1 | `job-source:arbeitsagentur:<query>\|<location>` | 600 s |
| Apify L2 Dataset-Metadaten | `job-source:arbeitsagentur:dataset:<query>\|<location>` | Peak 6 h / Off-Peak 12 h |
| Adzuna | `job-source:adzuna:<country>\|<what>\|<where>` | 600 s |
| TheirStack | `job-source:theirstack:<JSON body>\|<locations>` | 600 s |
| JobsPipe | `job-source:jobspipe:<JSON body>\|<locations>` | 600 s |
| Arbeitsagentur-Detail | `mj-detail:arbeitsagentur:<refNr>` | 7 Tage |
| Geocoding | `geo:city:<city>` | 30 Tage |
| Usage/Budgets | `mj-usage:*` | 62 Tage |

Bewertung:

- Suchbegriffe und Standorte stehen in Job-Source-Schlüsseln im Klartext.
  Redis ist ein serverseitiger technischer Cache, kein öffentlicher Store.
- TTLs sind kurz (600 s) für Job-Suchen; Detail-/Geo-Caches länger.
- Keine User-ID, keine E-Mail, kein `mj_session` in den Job-Source-Keys.
- Quellen sind durch das `job-source:<sourceId>:`-Präfix isoliert.
- `cv-profile:*` wird nicht mehr erzeugt. Bereits vorhandene Altkeys laufen
  durch ihre bisherige TTL aus; es gibt keinen neuen Schreibpfad.
- Ein Wechsel auf gehashte Suchschlüssel ist **nicht** Teil dieses Tasks.
  Später zu bewerten: Cache-Hit-Verlust, HMAC-Key-Management, Migration alter
  Keys, Debugging und Kompatibilität mit L2-Dataset-Metadaten.

## 5. Datenschutz- und Logging-Bewertung

### `/api/jobs`

Der bisherige Fehlerpfad:

```js
console.error("[/api/jobs] request query:", req.query)
```

wurde entfernt. Stattdessen werden nur noch **Parameternamen** und
Fehler-Metadaten geloggt:

```js
console.error("[/api/jobs] unexpected:", { name, code });
console.error("[/api/jobs] request diagnostics:", {
  method,
  presentParams: ["skills", "city", ...],
});
```

- Keine Suchbegriffe.
- Keine Stadt.
- Keine Zielrolle.
- Keine Roh-Query.
- Stacktrace nur außerhalb von `production`.
- Keine zusätzlichen Nutzerkennungen.

### Geocoding

`api/_lib/geo.mjs` loggt bei einem Nominatim-Fehler nicht mehr die eingegebene
Stadt, sondern nur die Fehlermeldung.

### Weitere Logs

Die übrigen Provider-Logs enthalten keine expliziten Suchparameter. Es wurden
keine neuen Logs mit Nutzerdaten eingeführt.

## 6. Trennung Session / künftige RIS-Persistenz

- Manuelle Suchprofile: App-weite In-Memory-Map, nur laufende Sitzung.
- CV-Such-/ATS-Listen: In-Memory-Buckets mit 12h-Fenster.
- Kein `localStorage` für Profile, kein neuer Cookie.
- Keine Remote-Persistenz und keine RIS-Schreiboperation.
- Der V1-Persistenzvertrag bleibt Grundlage für eine spätere freiwillige
  RIS-Speicherung, ist aber nicht aktiviert.
- Keine Vermischung mit Cognito-Identität oder RIS-Tenant-Zuordnung.

## 7. Testergebnisse

| Prüfung | Ergebnis |
|---|---|
| Manual-Search-Profile-Tests | PASS |
| Profile-Repository-Tests | PASS |
| Suchparameter-Mapping/Validierung | PASS |
| `tests/api/profile-no-cache.test.mjs` | PASS — 4 Tests |
| `/api/jobs` Logging-Test | PASS |
| `geo` Logging-Test (keine Stadt) | PASS |
| `src/api.test.ts` (kein Hash im Request) | PASS |
| Job-Source-/Quellen-Tests | PASS |
| Gast-Jobsuche | PASS |
| Apify-Kostenkontrolle (Redis) | PASS |
| CV-Gast-E2E | PASS — 1440/390 |
| Auth-Session-Isolation | PASS |
| Gesamtsuite | PASS — 1033 passed, 5 skipped |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| `test:budget:redis` | PASS |
| `test:ip-quota:redis` | PASS |
| `test:lock:redis` | PASS |
| `test:ip-quota:rest` | PASS — 6 Tests |
| Live-Deployment | keines |

## 8. Offene Entscheidungen

1. **Gehashte Job-Source-Keys:** nicht umgesetzt; Kosten-, Hit-Rate-,
   Migrations- und HMAC-Key-Folgen sind separat zu bewerten.
2. **Altkeys `cv-profile:*`:** kein Löschpfad; sie laufen mit ihrer bisherigen
   TTL aus. Ein administrierter Purge ist nicht Teil dieses Tasks.
3. **RIS-Persistenz:** bleibt zukünftiger, freiwilliger Schritt mit eigenem
   Datenschutz- und Freigabeverfahren.
4. **AI-Kosten:** Wegfall des CV-Caches erhöht Wiederholungsaufrufe; globale
   Budgets bleiben die Grenze.
5. **Matching-Präferenzen:** bleiben gespeicherte Information und sind nicht
   ohne separaten Produktauftrag in die produktive Filterung eingebaut.

## 9. Geänderte Dateien

- `api/profile.mjs`
- `api/jobs.mjs`
- `api/_lib/geo.mjs`
- `src/api.ts`
- `src/App.tsx`
- `src/api.test.ts`
- `tests/api/jobs-public-meta.test.mjs`
- `tests/api/profile-no-cache.test.mjs` (vormals `profile-cache.test.mjs`)
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/API_INVENTORY.md`
- `docs/DEPLOYMENT.md`
- `docs/CERTIFICATION_SUBMISSION.md`
- `docs/AI_AUDITLOG.md`
- this report

## 10. Git

- Keine AWS-/RIS-/Vercel-Änderung.
- Keine neue Profil-Datenbank.
- Kein neuer Cookie.
- Implementierungs-Commit: `049edda`
- Dokumentations-Commit: `4eb836d`
- Remote-Synchronität: nach Push geprüft.
