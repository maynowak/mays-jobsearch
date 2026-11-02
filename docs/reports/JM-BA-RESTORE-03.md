# JM-BA-RESTORE-03

**Art:** Arbeitsagentur-Suche / Apify-Adapter / Search-Strategy / Reparatur
**Status:** CODE-FEHLER REPARIERT UND LOKAL VERIFIZIERT — kein Deployment, keine Live-Runs
**Datum:** 2026-11-02
**Baseline:** `main` @ `937314e`, `origin/main` synchron

## 1. Bestandsaufnahme

Geprüft:

- Source `arbeitsagentur` (`api/_lib/sources/apify/actors.mjs`)
- Apify-Actor `blackfalcondata~arbeitsagentur-jobs-feed`
- Apify-Adapter (`api/_lib/sources/apify/index.mjs`)
- Registry (`api/_lib/sources/index.mjs`)
- Guest-Policy (`api/_lib/sourcePolicy.mjs`)
- Cache/Dataset-Reuse, Run-/IP-Quotas
- Suchparameter, Query-Mapping
- Filter und `applySearchStrategyWithTargetRole`
- Deduplizierung
- Frontend-Anzeige (`JobSources`, BA-Label, Source-Badges)

## 2. Befund

### 2.1 Zwei Ursachen im lokalen Reproduktionspfad

Mit gemockten Apify-Datensätzen wurden die drei Beispiele nachgestellt:

- Java Developer, Frankfurt
- Softwareentwickler, Darmstadt
- Cloud Engineer, Mainz

**Fehler 1 — Source-Filter verwarf BA-Datensätze**

`fetchActorJobs` bildete die lokalen Keyword-Tokens aus dem Skills-Array. Bei einem Skills-Array wie `["Java Developer"]` blieb der mehrwortige Ausdruck als **ein** Token erhalten. Der Actor liefert aber deutsche bzw. hyphenisierte Titel wie:

- `Java-Entwickler` statt `Java Developer`
- `Cloud-Engineer` statt `Cloud Engineer`

Die lokale Prüfung `haystack.includes("java developer")` schlug fehl, obwohl der Actor bereits passende Datensätze geliefert hatte. Die Datensätze wurden damit im Adapter verworfen.

**Fehler 2 — Search-Strategy verwarf denselben Fall erneut**

`buildCandidatePool` bewertet Skills zunächst als vollständige Phrase. Für `["Java Developer"]` fand `scoreJobBySkills` keinen Treffer in `Java-Entwickler` / `Cloud-Engineer`. Bei genau einem Skill greift die bisherige Threshold-Schleife nicht, weil sie nur bei `threshold > 1` weiter absenkt. Ergebnis: leerer Kandidatenpool trotz vorhandener Actor-Daten.

### 2.2 Was nicht die Ursache war

- **Keine Frontend-Anzeige-Ursache:** BA-Jobs werden bei vorhandenem `jobs[]` über die bestehende Job-/Source-Anzeige gerendert; es wurde kein Frontend-Code geändert.
- **Keine Dedup-Ursache:** Die Deduplizierung war für diesen Fall nicht der erste Verlustpunkt.
- **Keine nachgewiesene Produktionskonfigurationsursache:** `APIFY_API_TOKEN` ist in Production gesetzt; `JOB_SOURCE_ARBEITSAGENTUR_ENABLED` ist nicht explizit gesetzt → Default `true`. `APIFY_MONTHLY_MAX_RUNS` ist nicht explizit gesetzt → Default `100`.
- **Nicht verifiziert:** Ob der aktuelle Production-Lauf zusätzlich `limit_reached`, `busy`, `quota_unavailable` oder einen Apify-Upstream-Fehler hat. `/api/usage` ist ohne `USAGE_DIAGNOSTICS_TOKEN` nicht lesbar; es wurden keine Secrets ausgegeben und keine Live-Runs gestartet.

Ein HTTP 200 von `/api/jobs` allein beweist keine erfolgreiche BA-Quelle.

## 3. Reparatur

### 3.1 Source-Filter

`api/_lib/sources/apify/index.mjs`:

- Rollen und Skills werden für den lokalen Actor-Result-Filter in einzelne Wörter aufgeteilt.
- Der vollständige Query-String wird weiterhin an den Actor übergeben.
- Dadurch bleiben Actor-Treffer mit deutscher/hyphenisierter Schreibweise erhalten.

### 3.2 Search-Strategy-Fallback

`api/_lib/searchStrategy.mjs`:

- Wenn die exakte Phrase eines mehrwortigen Skills keinen Treffer liefert, wird einmalig mit den Einzelwörtern und Threshold `1` geprüft.
- Der Fallback greift nur, wenn tatsächlich andere Wörter entstehen und die exakte Suche leer ist.
- Bestehende Threshold-/Fallback-Logik bleibt erhalten.

### 3.3 Nicht geändert

- Apify-Actor und Actor-Input
- Apify-Cache/Dataset-Reuse
- Monats-/IP-/Detail-Quotas
- Guest-Policy
- Source-Registry
- Frontend-Anzeige
- Keine BA-Direkt-API
- Keine Header-/CORS-/403-Umgehung
- Keine neuen automatischen Suchläufe

## 4. Tests

### 4.1 Reproduktion mit gemockten Apify-Daten

Neue Regressionstests in `tests/api/apify-actor.test.mjs`:

- Java Developer, Frankfurt
- Softwareentwickler, Darmstadt
- Cloud Engineer, Mainz
- jeweils mit `paidSourcesAllowed: false` (Gast) und `true` (angemeldet)
- zusätzlich Target-Role-Varianten mit deutschen/hyphenisierten Titeln

**Vor der Korrektur:**

- Java Developer mit Skills-Array `["Java Developer"]` → Test schlug fehl, BA-Job wurde verworfen.
- Cloud Engineer mit Skills-Array `["Cloud Engineer"]` → derselbe Phrase-Filter.
- Softwareentwickler ist ein Ein-Wort-Skill und war nicht vom Phrase-Filter betroffen.

**Nach der Korrektur:**

- Java Developer, Frankfurt → **1 BA-Treffer**
- Softwareentwickler, Darmstadt → **1 BA-Treffer**
- Cloud Engineer, Mainz → **1 BA-Treffer**
- Gast und angemeldet → beide Pfade erfolgreich
- Target-Role-Varianten → erfolgreich

### 4.2 Ausgeführte Prüfungen

| Prüfung | Ergebnis |
|---|---|
| Apify-Adapter / BA-Regression | **13 passed** |
| Search-Strategy / Registry / Guest-Policy (gezielt) | **90 passed** |
| Gesamtsuite | **1134 passed, 5 skipped** |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |

## 5. Produktionsprüfungen / offene Punkte

1. **Deployment:** Die Korrektur ist lokal committed, aber **nicht deployed**. Production läuft weiterhin mit dem bisherigen Stand.
2. **Monatslimit:** Der Produktionszähler konnte nicht gelesen werden. Bei `mj-usage:apify:runs:<Monat> >= APIFY_MONTHLY_MAX_RUNS` bleibt die Quelle korrekt auf `limit_reached`; das ist kein Codefehler.
3. **Cache/Dataset:** Ein aktueller leerer bzw. veralteter Dataset-/L1-Cache konnte ohne interne Diagnostics nicht ausgeschlossen werden.
4. **Apify-Upstream:** Actor-/Token-/Kontoprobleme konnten ohne Run/Token-Zugriff nicht geprüft werden.
5. **Diagnose:** `meta.sourceReasons`/`meta.apify` werden von der öffentlichen `/api/jobs`-Response bewusst entfernt. Eine interne, geschützte Diagnose ist für die nächste Produktionsprüfung erforderlich.
6. **Live-Test:** Kein kostenpflichtiger Apify-Run ohne ausdrückliche Freigabe.

## 6. Erforderliche nächste Schritte

1. Änderung deployen — **nur nach separater Freigabe**.
2. Danach eine konkrete Suche mit den drei Beispielen ausführen; BA-Ergebnisse im Frontend prüfen.
3. Bei weiterhin 0 BA-Treffern interne Usage-Diagnostics mit `USAGE_DIAGNOSTICS_TOKEN` lesen:
   - `apify.runs`
   - `jobSources.arbeitsagentur.requests/runs/cacheHits/cacheMisses`
   - `sourceReasons`/`apify.reason`
4. Bei `limit_reached` keine eigenmächtige Erhöhung; Betreiberentscheidung und ggf. Kostenfreigabe.
5. Bei `missing_config`/`upstream`/`busy` die Apify-Konfiguration bzw. den Actor-Status prüfen.

## 7. Geänderte Dateien

- `api/_lib/sources/apify/index.mjs`
- `api/_lib/searchStrategy.mjs`
- `tests/api/apify-actor.test.mjs`

## 8. Grenzen

- Kein Deployment.
- Keine kostenpflichtigen Apify-Runs.
- Keine Änderung an AWS, RIS, Cognito, BA-Direkt-API oder Quoten.
- Keine Secrets ausgegeben.
