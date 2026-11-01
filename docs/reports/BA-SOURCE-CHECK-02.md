# BA-SOURCE-CHECK-02

**Art:** Arbeitsagentur-Quellenprüfung / Architektur-Abgleich / Dokumentation
**Status:** READ-ONLY CHECK ABGESCHLOSSEN — keine Codeänderung, kein Deployment
**Datum:** 2026-11-01
**Baseline:** `main` @ `f6e5c8e`, `origin/main` synchron

## 1. Fragestellung

Geprüft werden sollte die Annahme:

> Die Bundesagentur für Arbeit (BA) hat eine eigene API-Anfrage-Routine. Zusätzlich
> gibt es die Apify-Anfrage. Beide laufen parallel. Zusätzliche Routinen prüfen
> BA-Anfragen bei Apify auf weitere Daten.

## 2. Ergebnis

**Im aktuellen Repository `main` gibt es keine zweite, direkte BA-API-Source.**

Die tatsächliche Architektur ist:

1. **Eine registrierte BA-Source** mit der ID `arbeitsagentur`.
2. Diese Source läuft über den **Apify-Actor**
   `blackfalcondata~arbeitsagentur-jobs-feed`.
3. Die Source wird zusammen mit den anderen aktivierten Quellen über
   `Promise.allSettled` parallel abgefragt.
4. Für BA-Jobs ohne Beschreibung gibt es eine **zweite Apify-Routine**:
   Detail-Enrichment per `startUrls` auf denselben Actor.
5. Es gibt **keine** Code-Routine, die `rest.arbeitsagentur.de` direkt
   aufruft.

Die zweite Apify-Routine ist also kein direkter BA-API-Adapter, sondern eine
gezielte Detailabfrage bei Apify für bereits gefundene BA-Referenzen.

## 3. Code-Evidenz

### 3.1 Source-Registry

`api/_lib/sources/index.mjs` registriert:

```js
export const SOURCES = [
  arbeitnow,
  greenhouse,
  adzuna,
  jobspipe,
  theirstack,
  ...publicAtsSources,
  ...APIFY_ACTORS.map(createApifySource),
];
```

`APIFY_ACTORS` enthält nur den BA-Actor. Eine separate direkte BA-Source ist
nicht vorhanden.

### 3.2 BA-Source

`api/_lib/sources/apify/actors.mjs`:

```js
export const SOURCE_ID = "arbeitsagentur";
actorId: "blackfalcondata~arbeitsagentur-jobs-feed"
provider: "apify"
maxJobs: 40
```

Aktivierung:

```js
getConfig().jobSourceArbeitsagenturEnabled &&
Boolean(process.env.APIFY_API_TOKEN)
```

Ohne `APIFY_API_TOKEN` ist die Quelle nicht aktiv.

### 3.3 Zusätzliche Apify-Detailroutine

`api/_lib/detailEnrich.mjs` baut für fehlende BA-Jobs Portal-URLs und startet
denselben Apify-Actor mit:

```js
actor.buildTargetedDetailInput(
  missing.map((m) => portalUrlForRefNr(m.refNr))
)
```

Diese Routine wird aufgerufen von:

- `/api/match` für gematchte BA-Jobs ohne Beschreibung,
- `/api/job-details` für ausdrücklich angeforderte BA-Slugs.

Sie ergänzt Beschreibung/Details und cached sie sieben Tage. Sie läuft nicht
als zweite BA-Source parallel zur Listenabfrage, sondern **nach** der
Listen-/Match-Phase und nur bei Bedarf.

### 3.4 Kein direkter BA-API-Aufruf im Code

Repository-weite Suche nach:

```text
rest.arbeitsagentur.de
jobsuche-service
pc/v6/jobs
pc/v4/app/jobs
```

ergab ausschließlich Treffer in Dokumentationsdateien. `git log --all -S`
fand ebenfalls nur Dokumentations-Commits, keine Code-Implementierung.

## 4. Direkter BA-API-Gegencheck (read-only)

Aus der aktuellen Server-Umgebung wurden keine kostenpflichtigen Apify-Runs
gestartet; stattdessen wurden direkte BA-Endpunkte geprüft:

| Endpunkt | Ergebnis |
|---|---|
| `rest.arbeitsagentur.de/.../pc/v4/app/jobs/?was=java&size=1` | **403**, 1 Byte |
| `rest.arbeitsagentur.de/.../pc/v6/jobs?was=java&size=1` | **403**, 1 Byte |
| `rest.arbeitsagentur.de/.../pc/v4/jobdetails/...` | **403**, 1 Byte |
| `rest.arbeitsagentur.de/` | **403**, 1 Byte |
| `www.arbeitsagentur.de/jobsuche/suche?was=java` | **200**, HTML |

Das bestätigt den bereits dokumentierten Befund: Der öffentliche BA-Portalpfad
ist erreichbar, der REST-Host blockt keyless Serveranfragen aus dieser
Umgebung. Ein direkter BA-Source-Adapter wäre damit ohne geklärte
Auth-/IP-/Vertragslage nicht belastbar.

## 5. Production-Konfiguration

Geprüft wurden nur Environment-**Namen**, keine Secrets:

- `APIFY_API_TOKEN` ist in Production gesetzt.
- `JOB_SOURCE_ARBEITSAGENTUR_ENABLED` ist nicht explizit gesetzt → Default
  `true`.
- Es gibt keinen BA-spezifischen API-Key und keine separate BA-Source-
  Konfiguration.
- `/api/usage` ist in Production deaktiviert (`403`, kein
  `USAGE_DIAGNOSTICS_TOKEN`), daher keine Einsicht in Run-/Cache-/Fehlerzähler.
- Es wurde kein echter Apify-Run ausgelöst.

## 6. Apify-Actor

Der Actor ist öffentlich, nicht deprecated und wurde am **28.10.2026** zuletzt
aktualisiert. Die vom Code verwendeten Input-Felder passen zum veröffentlichten
Input-Schema:

- `query`
- `location`
- `maxResults`
- `mode`
- `includeDetails`
- `compact`
- `excludeEmptyFields`
- `startUrls` für Detail-Enrichment

Der Actor ist kostenpflichtig (pay-per-event, aktuell ca. `$0.00079` pro
Job-Record plus Run-Start). Die App begrenzt BA auf 40 Jobs pro Listen-Run.

## 7. Tests

Gezielte, gemockte Tests ohne Apify-Kosten:

```text
tests/api/apify-actor.test.mjs
tests/api/sources-registry.test.mjs
tests/api/guest-source-policy.test.mjs

22 passed
```

Abgedeckt: BA enabled/disabled, Listen-Flow, Cache, Dataset-Reuse,
Cost-Guard, Dedup, Guest-Policy und die explizite Apify-Ausnahme.

## 8. Bewertung der Annahme

| Annahme | Befund |
|---|---|
| BA hat eine eigene API-Routine in der App | **Nicht im aktuellen `main` vorhanden.** |
| Apify hat eine zusätzliche Anfrage-Routine | **Ja:** Listen-Run plus gezielter Detail-Run. |
| Beide laufen parallel | **Nein:** BA-Liste und BA-Detail laufen sequenziell/bedarfsgesteuert; parallel laufen die verschiedenen Job-Quellen. |
| BA-Anfragen werden bei Apify gegengeprüft | **Teilweise:** Ja, aber umgekehrt: BA-Jobs aus dem Apify-Listenlauf werden bei Apify per `startUrls` für Details nachgeladen. |
| Es gibt eine zweite direkte BA-Source | **Kein Code-/Konfigurationsbeleg in diesem Repository.** |

Falls in einer anderen laufenden Umgebung tatsächlich eine direkte BA-Routine
existiert, stammt sie nicht aus diesem `main`-Stand. Für eine belastbare
Prüfung wären Branch, Repository, Deployment-Commit oder ein konkretes
Produktionslog nötig.

## 9. Risiken / offene Punkte

1. **Direkter BA-Zugriff:** Keyless vom Server aktuell 403; keine
   Produktionsverifikation ohne geklärte Auth-/IP-Lage.
2. **Apify:** Kein Live-Run in diesem Check; aktuelle Trefferquote und
   Fehlerbild bleiben offen.
3. **Diagnose:** `/api/usage` ist deaktiviert; BA-Run-/Cache-Zähler sind nicht
   einsehbar.
4. **Kosten:** Jeder echte BA-Run ist kostenpflichtig; Live-Test nur mit
   ausdrücklicher Freigabe und kleinem `maxResults`.

## 10. Empfehlung

- Wenn eine direkte BA-API tatsächlich Teil des Zielbilds ist: als separaten
  Source-Adapter mit geprüfter Auth-/Vertragslage implementieren, nicht als
  versteckte zweite Routine.
- Bis dahin gilt für diesen Code: **BA = Apify-Listenlauf + Apify-Detail-
  Enrichment**, parallel zu den anderen Quellen.
- Für den nächsten belastbaren Nachweis: autorisierter Apify-Testlauf mit
  `maxResults: 5` und temporärer Usage-Diagnostics-Freigabe.

**Keine Codeänderung, kein Commit, kein Deployment, kein echter Apify-Run.**
