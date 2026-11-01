# JM-PRIVACY-CV-REDIS-PURGE-02

**Art:** Privacy-Bereinigung / Redis-Purge-Gate
**Stand:** 2026-11-01
**Status:** BLOCKED — Produktions-Redis-Ziel nicht verifizierbar; **keine Löschung**
**Deployment:** keines
**Produktions-Redis:** nicht beschrieben, nicht gelöscht

## 1. Produktionsstand

### 1.1 Vercel Production

Read-only geprüft:

```text
Projekt:      maymilly/mays-job-matcher
Production:   https://www.mays-job-matcher.app
Deployment:   dpl_HzLL5iSUbhkbrwky7BBFELmfwXTw
Erstellt:     2026-10-31 23:21:25 +01:00
Commit:       c787fea
Status:       Ready
```

Build-Log:

```text
Cloning github.com/maynowak/mays-jobsearch
Branch: main
Commit: c787fea
```

`c787fea` enthält den Implementierungs-Commit `049edda`
(`fix: remove CV profile cache and sanitize search logging`).

### 1.2 Ist der cachefreie Stand aktiv?

**Ja.** Das ausgelieferte Production-JavaScript wurde read-only geprüft:

- `/api/profile` wird mit `{ text, model? }` aufgerufen.
- Kein `hash` im Request.
- Kein `cv-profile:`-Cache-Schlüssel im Production-Bundle.
- Kein `profileCacheKey`, `hashText` oder `CV_PROFILE_CACHE`.

Damit ist der cachefreie Stand auf dem Production-Alias aktiv.

### 1.3 Alte Instanzen

Die Production-Aliase zeigen auf `c787fea`. Ältere Deployments sind laut
Vercel weiterhin als Ready-Deployments vorhanden, aber nicht mehr Production
aliasiert. Ein direkter Aufruf einer alten Deployment-URL ist in diesem Task
nicht geprüft worden. Solche Instanzen könnten theoretisch weiterhin alten
Code ausführen, wenn jemand die konkrete URL kennt.

**Bewertung:** normaler Produktions-Traffic kann keine `cv-profile:`-Keys mehr
erzeugen. Eine vollständige Aussage über alle alten Deployment-URLs ist
**NOT VERIFIED**.

## 2. Redis-Zielumgebung

In Vercel Production existieren:

```text
UPSTASH_REDIS_REST_URL    (type: sensitive, environment: Production)
UPSTASH_REDIS_REST_TOKEN  (type: sensitive, environment: Production)
```

Die Werte sind als **sensitive** markiert und über Vercel CLI/API nicht
auslesbar:

- `vercel env pull --environment=production` schreibt nur `[SENSITIVE]`.
- `vercel env run -e production` meldet fehlende Upstash-Konfiguration.
- Die Vercel-API liefert für sensitive Variablen keinen Wert, auch nicht mit
  `decrypt=true`.

Damit ist die konkrete Upstash-Datenbank/der Endpoint **nicht verifiziert**.
Es wurde keine Verbindung zu Production-Redis hergestellt.

## 3. Redis-Bestand `cv-profile:*`

Geplantes Verfahren:

- ausschließlich `SCAN` mit `MATCH cv-profile:*` und Cursor
- exakte Schlüsselprüfung `^cv-profile:[a-f0-9]{64}$`
- TTL-Auswertung nur für exakte Treffer
- keine Ausgabe von Schlüsseln, Hashes oder Werten
- keine Löschung anderer Namespaces

**Produktionsergebnis:**

```text
Anzahl CV-Einträge:       NOT VERIFIED
Anzahl abweichender Keys: NOT VERIFIED
TTLs:                     NOT VERIFIED
Löschungen:               0
```

Grund: fehlender Zugriff auf die als sensitive markierten
Production-Upstash-Zugangsdaten. Ohne bestätigtes Ziel wurde kein `SCAN` und
keine Löschung gegen Production ausgeführt.

## 4. Bereinigungsskript

Neu:

```text
scripts/purge-cv-profile-cache.mjs
```

Sicherheitsregeln:

- Standard ist **Dry-run**.
- Löschung nur mit `--delete --confirm-production`.
- Scan ausschließlich `cv-profile:*`.
- Löschung ausschließlich exakter `cv-profile:<64 lowercase hex>`-Keys.
- `DEL` mit expliziten Key-Listen, keine Wildcard-Löschung.
- Batch-Verarbeitung (`COUNT`/`DEL` in Blöcken).
- SCAN-Duplikate werden pro Pass dedupliziert und separat gezählt.
- Nach einem Delete folgt ein vollständiger, read-only Nachscan
  (`verification`) zur Löschverifikation.
- Keine Ausgabe von Keys/Hashes/Secrets.
- Keine anderen Namespaces.
- Kein `FLUSHDB`, kein `FLUSHALL`.
- Redis-Fehler werden erkannt und als Fehler ausgegeben.
- Wiederholte Ausführung ist idempotent.

Aufruf:

```bash
npm run purge:cv-cache
# nur Dry-run

npm run purge:cv-cache -- --delete --confirm-production
# echte Löschung, nur nach separater Freigabe
```

## 5. Isolierte Tests

Test:

```text
tests/tools/verify-cv-profile-purge.mjs
npm run test:cv-purge:redis
```

Umgebung: Docker `redis:7-alpine`, ausschließlich synthetische Daten. Keine
Upstash-/Production-Verbindung.

Ergebnis:

```text
status: PASS
checks: 55
```

Geprüft:

1. Exakte CV-Schlüssel werden erkannt.
2. Abweichende `cv-profile:*`-Keys (falsche Länge, Großbuchstaben, Suffix)
   werden nicht gelöscht.
3. Dry-run löscht nichts.
4. `--delete`-Pfad löscht nur die exakten CV-Keys.
5. Andere Namespaces (`job-source:*`, `mj-detail:*`, `mj-usage:*`, `geo:*`,
   `alerts`) bleiben erhalten.
6. Wiederholte Ausführung ist sicher/idempotent.
7. Redis-Fehler werden als Fehler erkannt.
8. SCAN-Duplikate werden nicht doppelt gelöscht/gezählt.
9. Der Nachscan nach dem Delete meldet keine verbleibenden CV-Keys.

## 6. Unverändertheit anderer Redis-Daten

In Production wurde **keine** Redis-Operation ausgeführt. Damit sind
unverändert:

- Job-Source-Caches (`job-source:*`)
- Apify-/Arbeitsagentur-Caches
- Detail-Caches (`mj-detail:*`)
- Geo-Caches (`geo:*`)
- Usage-/Budget-Zähler (`mj-usage:*`)
- Alert-Subscriptions (`alerts`)
- alle übrigen Namespaces

Es wurden keine Suchparameter, Alerts, Budgets oder Job-Caches gelöscht.

## 7. Freigabegate

Vor einem Production-Purge sind erforderlich:

1. **Upstash-Ziel bestätigen** — konkrete Production-Datenbank/Endpoint
   identifizieren, ohne Secrets in Logs/Reports zu schreiben.
2. **Produktions-Dry-run** mit dem Skript; Ausgabe nur als aggregierte Counts.
3. **Separate Freigabe** für die konkrete Zielumgebung.
4. **Erst dann** `--delete --confirm-production`.
5. Nach dem Purge: erneuter Scan (`validKeys = 0`), Prüfung der anderen
   Namespaces, Dokumentation.
6. Alte Deployment-URLs bewerten/löschen, damit kein alter Code neue
   `cv-profile:*`-Keys schreiben kann.

Bis dahin gilt: **HARD STOP vor produktiven Redis-Löschoperationen.**

## 8. Tests / Regression

| Prüfung | Ergebnis |
|---|---|
| `npm run test:cv-purge:redis` | PASS — 55 Checks |
| Gesamtsuite | PASS — 1033 passed, 5 skipped |
| TypeScript | PASS |
| Build | PASS |
| `git diff --check` | PASS |
| Production-Deployment | `c787fea` aktiv |
| Production-Redis-Scan | **NOT VERIFIED** |
| Production-Löschung | **keine** |

## 9. Offene Freigaben

1. Production-Upstash-Zugang für den Dry-run bereitstellen.
2. Ziel-Datenbank explizit bestätigen.
3. Dry-run-Ergebnis prüfen.
4. Production-Purge freigeben.
5. Alte Vercel-Deployments bewerten.

## 10. Production-Redis-Identifikation (02A)

**Stand:** `e76a224`
**Ergebnis:** BLOCKED — Ziel nicht eindeutig identifiziert.

Read-only geprüft:

| Prüfung | Ergebnis |
|---|---|
| `vercel storage list` | keine Storage-Resources im Scope |
| `vercel storage status` | keine Storage-Verbindung zum Projekt |
| `vercel integration list` | keine Marketplace-Resources |
| Vercel Production Env | `UPSTASH_REDIS_REST_URL`/`TOKEN` vorhanden, Typ `sensitive` |
| Env-Werte über CLI/API | nicht auslesbar (`decrypt=true` liefert keinen Wert) |
| Lokale autorisierte Upstash-Credentials | nicht vorhanden |
| Upstash-Datenbank-ID | **NOT VERIFIED** |
| Datenbankname | **NOT VERIFIED** |
| REST-Hostname | **NOT VERIFIED** |
| Region | **NOT VERIFIED** |

Es wurden keine geschützten Variablen rekonstruiert und keine
Sicherheitsbeschränkungen umgangen. Ohne eindeutige Zuordnung wurde
`npm run purge:cv-cache` **nicht** gegen Production ausgeführt.

Offener Blocker: Der konkrete Production-Upstash-Zugang muss durch den
zuständigen Betreiber lokal bereitgestellt oder die Datenbank anhand der
Upstash-Konsole eindeutig bestätigt werden.

## 11. Git

- Purge-Tool/Test: `27a7a58`
- Scan-Härtung (Duplikate/Nachscan): `247e81d`
- Dokumentations-Commit: `3b255df` (wird durch den 02A-Nachtrag ergänzt)
- Kein AWS-/RIS-/Vercel-Deployment.
- Kein GitHub-Release.
