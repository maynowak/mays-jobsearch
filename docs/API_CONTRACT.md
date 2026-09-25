# API Contract — Mays Job Search

**Version**: 1.0.0
**Status**: TARGET BASELINE (kein Implementierungsschritt)
**Last Updated**: 2026-09-25
**Based on**: `docs/API_INVENTORY.md` (API-DOC-01, code-validiert, HEAD `02c81ea`)

---

## 1. Purpose

Dieses Dokument definiert den verbindlichen **TARGET API Contract** für die
Jobsearch-Anwendung. Es trennt strikt:

- **IST** — was der Code heute tut (siehe `docs/API_INVENTORY.md`).
- **TARGET** — die getroffene Vertragsentscheidung.
- **MIGRATION** — wie von IST zu TARGET gewechselt wird (nicht Teil dieses Schritts).

Kein Endpoint wurde in diesem Schritt technisch verändert.

---

## 2. Source of Truth

Reihenfolge der Wahrheit:

1. **Implementierter Code** (`api/`, `src/api.ts`) — IST.
2. **Dieses Dokument** — TARGET-Entscheidungen.
3. `docs/API_DOCUMENTATION_STANDARD.md` / `docs/API_VERSIONING_STANDARD.md` —
   Standards, die gegen die Entscheidungen hier geprüft wurden (§ Kompatibilität).

`docs/API_INVENTORY.md` bleibt die IST-Inventur und wird nicht hiermit vermischt.

---

## 3. Current State (Kurzfassung)

- 12 Serverless-Function-Dateien, 14 konkrete Schnittstellen unter `/api/*` (kein URL-Version-Prefix).
- Überwiegend flache Success-Responses; Envelope `{ data, meta }` nur in den cv-improvement-Subpfaden.
- Überall flaches Fehlerformat `{ error: string, code: string }`.
- Uneinheitliche Auth: none (meiste), Session-Cookie (`/api/match`, `/api/job-details`), Token (`/api/usage`), Cron (`/api/cron/digest`).
- Frontend referenziert `/api/v1/cv-improvement*`, ohne dass im Repo Server-Routen dafür existieren.

---

## 4. Target Contract (Übersicht)

- **Base Path**: `/api` — URL-Major-Versionierung für Verträge ab TARGET: `/api/v1/...` (Entscheidung B unten).
- **Response**: `{ data, meta }`-Envelope bei Erfolg; `{ error: { code, message, details? }, meta }` bei Fehler.
- **Request-ID**: `X-Request-ID` (Client optional; Server generiert/echot Pflicht im TARGET).
- **Auth**: endpoint-spezifisch (Matrix in §7) — **kein** globaler Zwang.
- **Lifecycle/Deprecation**: 90-Tage-Mindestüberlappung, Deprecation-Header + Meta (Standard bleibt).

---

## 5. Base URL

**IST**: Alle Clients rufen **relative Pfade** auf (gleiche Origin wie die
ausgelieferte Seite). Kein `localhost:8000` im Code. Production-URL ist im
Repo nur indirekt bekannt (README-Live-Demo `mays-job-matcher.vercel.app`).

**TARGET**:
- API Base Path: `/api`.
- Clients verwenden weiterhin **relative Pfade** (gleiche Origin).
- Production Base URL = die Vercel-Deployment-Domain der Anwendung.

**OPEN DECISION (EXTERNAL / DEPLOYMENT)**: Die verbindliche kanonische
Production-URL (Custom Domain vs. `*.vercel.app`) ist aus dem Repository nicht
beweisbar und wird als reine Deployment-Entscheidung geführt. Nicht
erfunden/geraten.

**MIGRATION**: keine (relative Pfade bleiben).

---

## 6. Versioning

**IST**: Alle produktiv erreichbaren Routen unversioned (`/api/*`). Einziges
Versionierungssignal: `meta.version = "v1"` in cv-improvement-Antworten.
Der Client referenziert bereits `/api/v1/cv-improvement*`, ohne dass
serverseitige Routen existieren.

**TARGET**: **Option A — URL-basierte Major-Versionierung `/api/v{N}/...`** für
den öffentlichen Vertrag, ab der nächsten Vertragsänderung bzw. dem separaten
Contract-Cleanup-Step. Begründung:

- Ein bestehender Projekt-Standard (`API_VERSIONING_STANDARD.md`) beschreibt
  genau dies als Pflicht — die Entscheidung ist damit dokumentationskonform.
- Der Client zeigt mit `cv-improvement` bereits in diese Richtung.
- Ein Version-Prefix löst die Breaking-Change-Frage des Response-Envelope
  (flach → `{data, meta}`) sauber über `v2`-Migration, ohne bestehende
  `/api/*`-Consumers zu brechen.

Bedingungen: Major-only in URL (`v1`, `v2`...), keine Minor/Patch-Versionen,
kein `/api/latest`.

**MIGRATION** (prinzipiell, NICHT jetzt ausführen):
- Legacy `/api/*` bleibt während der Überlappung funktional (Parallel Run).
- Neue Versionen entstehen unter `api/v1/…` als eigene Function-Dateien.
- Erster Anwendungsfall: cv-improvement (siehe §14) und Search (§15).

---

## 7. Authentication — Endpoint-Matrix

Kein globaler Auth-Mechanismus. Entscheidung je Endpoint:

| Endpoint | Current Auth (IST) | Target Auth | Reason |
|---|---|---|---|
| `GET /api/jobs` | none | none | öffentliche Suche; keine Nutzerdaten |
| `POST /api/match` | Session-Cookie (anonym) | Session-Cookie (anonym) | Quota/Enrichment-Kontext; kein Account-System vorhanden |
| `POST /api/job-details` | Session-Cookie (anonym) | Session-Cookie (anonym) | Quote-Limiting an Session gekoppelt |
| `POST /api/profile` | none | none | CV-Text kommt bewusst anonym; Anonymisierung clientseitig |
| `POST /api/cover-letter` | none | none | wie match |
| `GET /api/models` | none | none | öffentliche Metadaten |
| `GET /api/model` | none | none | öffentliche Metadaten |
| `POST/DELETE/GET /api/alerts` | none | none | E-Mail-basiert; Opt-out per DELETE |
| `POST /api/ats-analysis` | none | none | **AI-Consent am Request (`ai.consent`) ist die Gate, nicht Auth** |
| `POST /api/cv-improvement*` | none | none | deterministisch, kein externer AI-Call |
| `GET /api/usage` | Token (`x-usage-token` / Bearer vs. `USAGE_DIAGNOSTICS_TOKEN`) | Token (unverändert) | interne Diagnose — nicht öffentlich |
| `POST /api/cron/digest` | `x-vercel-cron` oder `Bearer CRON_SECRET`; **offen wenn Secret fehlt** | `x-vercel-cron` / `Bearer CRON_SECRET` **Pflicht** | Cron sicher abschließen (siehe Open Decisions) |

**OPEN DECISION**: `CRON_SECRET`-Pflicht erfordert eine Deployment-Änderung
(Env in Vercel). Bis dahin bleibt IST dokumentiert; kein Code geändert.

**MIGRATION**: keine Auth-Migration; einziges künftiges Ziel: Cron-Endpoint
offline streng (dokumentiert), sonst keine Änderung.

---

## 8. Request Standard

TARGET für alle Requests:

- **Content-Type**: `application/json; charset=utf-8` für alle POST-Bodies; GET ausschließlich über Query-Parameter.
- **Path-Parameter**: TARGET vermeidet Custom-Path-Params für diese App (keine vorhandenen); Sub-Routen als eigene Routen (z. B. `/apply`).
- **Query-Parameter**: camelCase, Strings; Zahlen als Dezimal-Strings; Listen als CSV; leerer Wert = „nicht gesetzt".
- **Body-Felder**: camelCase; Pflichtfelder explizit je Endpoint (siehe Inventory); unbekannte Felder werden ignoriert (IST-Verhalten, bleibt).
- **Header**: `Content-Type`; intern: `x-mj-attempt` (Model-Fallback-Attempt, dokumentiert als intern); optional `X-Request-ID`.

Detail-Entscheidung **X-Request-ID**: **TARGET = ja, UUID v4.** Client SOLLTE
`X-Request-ID` senden; Server MUSS im TARGET einen `requestId` in
`meta` zurückgeben — gesendeten Wert spiegeln oder selbst generieren.
(Ist-Implementierung: nicht vorhanden — Migration erforderlich.)

Multi-Word-Skills (SEARCH-STRATEGY-03) bleiben durch den Request-Vertrag
geschützt: `skills` als JSON-Array im Query-String hat Vorrang vor der
Legacy-Tokenisierung (§15).

---

## 9. Response Standard

**IST**: überwiegend flache JSON-Bodys; Envelope `{ data, meta }` nur in
cv-improvement-Subpfaden; kein `requestId`.

**TARGET** (einheitlich, migrierbar):

Success `200`:
```json
{
  "data": { "...": "endpoint-spezifisch" },
  "meta": { "requestId": "uuid", "version": "v1", "generatedAt"?: "iso" }
}
```

Error:
```json
{
  "error": { "code": "bad_request", "message": "…", "details": {} },
  "meta": { "requestId": "uuid" }
}
```

**Begründete Abweichung (dokumentiert, endgültig für TARGET)**: rein interne
Endpoints **dürfen** von der Envelope abweichen:
- `POST /api/cron/digest` (interner Cron; Antwort wird nicht von Clients
  konsumiert: `{ ok, checked, sent, skipped, errors[] }`).
- `GET /api/usage` (interne Diagnose; Snapshot-Objekt).

Begründung: beide sind keine öffentlichen Verträge; sie werden nicht von
Drittclients gelesen. Für alle öffentlichen Endpoints gilt die Envelope.

**MIGRATION**: Breaking Change → nur über Versionierung (§6): `/api/v1/*`
liefert Envelope, `/api/*` bleibt bis zur Sunset-Phase flach.

---

## 10. Error Standard

TARGET-Form: §9 (Error-Block). Mapping-Tabelle (TARGET):

| Situation | HTTP | Code |
|---|---|---|
| Validierung (Body/Fields) | 400 | `bad_request`, `missing_text`, `text_too_long`, `invalid_slug` |
| Unauthorized | 401 | `unauthorized` (z. B. `/api/usage` Token falsch) |
| Forbidden / deaktiviert | 403 | `forbidden` (`/api/usage` ohne Env-Token) |
| Not Found | 404 | `not_found`, `source_not_found` |
| Rate Limit / Tageslimit | 429 | `rate_limited`, `free_quota_exceeded`, `quota_exceeded`, `apify_limit_reached` |
| Upstream/Provider-Fehler | 502 | `network`, `upstream`, `bad_ai_response` |
| Model/Provider nicht verfügbar | 503 | `model_unavailable`, `models_unavailable`, `quota_unavailable`, `missing_config` |
| Intern | 500 | `internal` |
| Methode nicht erlaubt | 405 | `method` |

Die heute verwendeten Codes bleiben TARGET; neue Codes nur nach Dokumentation
hier. `details` ist optional und bleibt frei von PII.

---

## 11. Request ID

Siehe §8: `X-Request-ID` ist TARGET (UUID v4, Client optional, Server
generiert/echot Pflicht). IST: nicht implementiert. MIGRATION: Teil des
Envelope-Rollouts (meta.requestId + Header-Echo).

---

## 12. Deprecation / Lifecycle

**TARGET bleibt der bestehende Standard** (`API_VERSIONING_STANDARD.md`):
- Lifecycle DEVELOPMENT → ACTIVE → DEPRECATED → SUNSET → REMOVED.
- Mindestüberlappung 90 Tage, `X-API-Deprecated`/`X-API-Sunset-Date`-Header +
  `meta.deprecation` in Responses.

Nur dokumentiert — Implementierung erfolgt im Contract-Cleanup/Migrationsschritt.
**IST**: nichts davon implementiert.

---

## 13. AI Contract (BROWSER-BUG-22 begründet)

### `POST /api/ats-analysis`

TARGET-Request:
```json
{
  "job": { "title": "…", "tags": ["…"], "slug": "…" },
  "profile": { "skills": "…" },
  "ai": { "enabled": false, "consent": false, "model": "optional-string" }
}
```

Semantik (verbindlich, deckt sich mit der Implementierung seit BROWSER-BUG-22):
- `ai.model` **fehlt** → Server-Default-Modell (Provider-Konfiguration).
- `ai.model` **vorhanden** → dieses Modell wird bis `chat({ model })`
  durchgereicht; die Response spiegelt es in `ai.model`.
- KI-Formulierung läuft **nur** bei `ai.enabled === true && ai.consent === true`.
- Modell-Verfügbarkeitsfehler → HTTP 429/503 via `isModelUnavailable`-Pfad;
  Frontend-Recovery: ATS-spezifischer Step `ats-model-recovery` (Modellwechsel
  + nur ATS erneut), kein CV-Reset.

Weitere AI-Endpoints:
- `POST /api/profile`: `model?`, `x-mj-attempt`, `hash`-Cache (anonymisiert, consent-unabhängiger Schritt — es wird kein PII-Rohtext an AI gesendet; siehe Anonymisierung).
- `POST /api/match`: `model?`; Session-Cookie; AI-Verfügbarkeitsfehler über Provider-Codes (siehe Error-Matrix).
- `POST /api/cover-letter`: `model?`.

### Consent-Bezug
AI-Verarbeitung mit CV-Inhalten passiert nur nach explizitem Consent
(CvConsentGate im CV-Workflow; ConsentGate im AtsOverlay für die
Formulierungen). `ai.consent` ist der Pflicht-Schalter im Vertrag.

### Anonymisierungsabgrenzung
Die CV-Anonymisierung (`src/lib/anonymize.ts`) läuft **lokal im Browser** und ist
**keine AI-Operation**. Sie wird im Vertrag nicht als AI-Verarbeitung geführt.
Serverseitig wird nur der bereits (ggf. anonymisierte) CV-Text verarbeitet.

### Provider/Fallback
- Serverseitig: Provider aus Config (OpenRouter primär, EdenAI optional) —
  kein Request-Contract-Thema.
- Clientseitig: `withModelFallback` versucht gewähltes → empfohlenes →
  verfügbare Modelle (nur match/profile; ATS nutzt seit BUG-22 explizites
  Modell + Recovery-Punkt).

---

## 14. CV Improvement Contract

**IST**: `api/cv-improvement.mjs` mit internem URL-Suffix-Dispatch (`/apply`,
`/reanalyze`, `/match-impact`); Standardantwort **flach**
(`{ improvement, analysis, meta: { version: "v1", generatedAt } }`);
Subpfade liefern Envelope `{ data, meta: { version: "v1", requestId, timestamp } }`;
**keine** `api/v1/`-Dateien im Repo.

**TARGET-Entscheidung**: **Option A — echte versionierte Route.**
`/api/v1/cv-improvement`, `/api/v1/cv-improvement/apply`,
`/api/v1/cv-improvement/reanalyze`, `/api/v1/cv-improvement/match-impact`
werden zur verbindlichen Target-Form:

- Response: einheitlich Envelope `{ data, meta: { requestId, version: "v1" } }`
  — Angleichung des bisher flachen Standard-Endpunkts an die Subpfaden-Form.
- Request: wie heute dokumentiert in `docs/API_CV_IMPROVEMENT.md`
  (job/profile-Objekte unverändert).

**MIGRATION**: separater Schritt — Server-Routen unter `api/v1/...` anlegen,
Client ist bereits darauf verdrahtet; Legacy `/api/cv-improvement` erhält
Deprecation-Markierung bis Sunset. **Nicht jetzt ausführen.**

---

## 15. Search Contract

### `GET /api/jobs` — TARGET (unveränderte Semantik aus dem Code)

Query-Parameter (alle optional):
| Param | Typ | Semantik |
|---|---|---|
| `skills` | string | **JSON-Array-String** (Multi-Word-fähig, z. B. `["Spring Boot"]`) ODER Legacy `;`/`,`-Liste. JSON-Form hat Vorrang und bleibt geschützt (SEARCH-STRATEGY-03). |
| `targetRole` | string | Zielrolle |
| `city` | string | Ortsfilter — **nur wirksam mit `radiusKm > 0`** (BUG-04) |
| `radiusKm` | number-string | fehlt/0 → „Entfernung egal" (kein Geo-Filter) |
| `workMode` | CSV | `remote,hybrid,onsite` |
| `employmentType` | CSV | `full_time,part_time` |

Success 200: `{ jobs: Job[], meta: { totalScanned, totalFiltered, city[], keywords[], sources, sourceCounts, disabledSources, sourceDetails[], jobsCombined, searchStrategy, apify } }`.

TARGET-Versionierung: `/api/v1/jobs` im Zielbild gleicher Parameter-
Semantik, Response in Envelope-Form (Breaking → neue Version, §6/§9).
Multi-Skill-Semantik bleibt im TARGET unverändert erhalten.

**MIGRATION**: `/api/jobs` bleibt vorerst maßgeblich (kein Breaking in der
Bestehenden); Envelope-Variante kommt mit `/api/v1/jobs`, danach Legacy-
Deprecation.

---

## 16. Endpoint Matrix (verbindlich)

| Endpoint | Current Path | Target Path | Current Auth | Target Auth | Request | Response | Error | AI | Migration |
|---|---|---|---|---|---|---|---|---|---|
| Jobs Search | `/api/jobs` | `/api/v1/jobs` | none | none | Query (§15) | Envelope (meta.requestId) | §10 | no | Legacy flach → v1 Envelope |
| AI Match | `/api/match` | `/api/v1/match` | Session-Cookie | Session-Cookie | body+`x-mj-attempt` | Envelope | §10 | yes (model, fallback) | flach → Envelope; Cookie bleibt |
| Job Details | `/api/job-details` | `/api/v1/job-details` | Session-Cookie | Session-Cookie | body slugs | Envelope | §10 | no | flach → Envelope |
| Profile | `/api/profile` | `/api/v1/profile` | none | none | body text/hash/model | Envelope | §10 | yes | flach → Envelope |
| Cover Letter | `/api/cover-letter` | `/api/v1/cover-letter` | none | none | body+`x-mj-attempt` | Envelope | §10 | yes | flach → Envelope |
| Models | `/api/models` | `/api/v1/models` | none | none | — | Envelope | §10 | meta | flach → Envelope |
| Model | `/api/model` | (deprecated zugunsten `/api/v1/models`) | none | none | — | Envelope | §10 | meta | Legacy in v1 als Teil von models; Sunset planen |
| Alerts | `/api/alerts` | `/api/v1/alerts` | none | none | body email+profile | Envelope | §10 | no | GET `{count}` wird intern dokumentiert |
| ATS Analysis | `/api/ats-analysis` | `/api/v1/ats-analysis` | none | none | body inkl. `ai.model?` (§13) | Envelope | §10 | **yes** | flach + Legacy → v1 |
| CV Improvement | `/api/cv-improvement` (+Suffix-Dispatch) | `/api/v1/cv-improvement` (+`/apply`,`/reanalyze`,`/match-impact` als Routen) | none | none | §14 | Envelope (vereinheitlicht) | §10 | no (deterministisch) | §14 |
| Usage | `/api/usage` | bleibt `/api/usage` (intern, unversioned) | Token | Token | — | (Ausnahme, bleibt flach) | §10 | no | keine (intern, außerhalb des öffentlichen Vertrags) |
| Cron Digest | `/api/cron/digest` | bleibt (intern) | Cron-Header/Secret | Cron-Header/Secret **Pflicht** (Entscheidung nötig s. §18) | — | (Ausnahme, bleibt) | §10 | no | keine |

---

## 17. Migration Principles

1. Parallel Run: `/api/*` (legacy) und `/api/v1/*` koexistieren ≥ 90 Tage.
2. Keine Breaking-Änderung ohne Major-Version (`v2` etc.).
3. Frontend zuerst auf v1 umstellen, dann Legacy-Sunset.
4. Rollback-ready (Legacy-Handler bleibt deploybar).
5. Jede Migration aktualisiert `docs/API_INVENTORY.md` + Contract Matrix.
6. `/api/usage` und `/api/cron/digest` sind intern — kein öffentlicher
   Lifecycle.

---

## 18. Open Decisions

1. **Kanonische Production-URL** — Deployment-Entscheidung (EXTERNAL), nicht aus dem Repo ableitbar.
2. **`CRON_SECRET`-Pflicht** für `/api/cron/digest` (aktuell offen ohne Secret) — erfordert Deployment-/Ops-Entscheidung; Empfehlung: Pflicht.
3. **Vorgehen bei `GET /api/model`**: in v1 redundant zu `/api/v1/models` — Target sah Deprecation vor; Entscheidung über Sunset-Zeitpunkt offen.
4. **OpenAPI-Artefakt**: TARGET = Ja, eine generierte OpenAPI-Spezifikation soll im Contract-Cleanup-Step erzeugt werden (Maschinenlesbarkeit). **Noch nicht** gebaut; es existiert heute keine OpenAPI-Datei und kein `request_schema.json` im Repo — diese Tatsache bleibt im IST dokumentiert.
5. **Resend-/Digest-Beobachtbarkeit**: nicht Teil des API-Vertrags — nur notiert falls relevant beim Lifecycle-Schritt.

---

*Ende API Contract v1.0.0 — rein deklarativ.*
