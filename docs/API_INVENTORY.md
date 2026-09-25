# API Inventory

**Stand**: 2026-09-25 — vollständig gegen den Code validiert (HEAD `0abbd59`, Branch `main`).

## Source of Truth

Der Code ist die Quelle der Wahrheit. Dokumentation wird gegen den Code validiert.
Diese Inventur wurde ausschließlich aus den tatsächlichen Handlern in `api/`,
`vercel.json` und `src/api.ts` abgeleitet — nicht aus bestehender Dokumentation.

---

## Implemented Interfaces

| Method | Endpoint | Auth | Version | Implementation | Tests |
|---|---|---|---|---|---|
| GET | `/api/jobs` | none | keine (`/api/*`) | `api/jobs.mjs` → `api/_lib/sources/index.mjs: fetchAllJobs` | `tests/api/sources-registry.test.mjs`, `tests/api/apify-actor.test.mjs`, `tests/integration/20-skills-regression.test.mjs`, `tests/integration/cv-to-jobs-e2e.test.mjs` |
| POST | `/api/match` | Anonyme Session (`Set-Cookie: mj-session`) | keine | `api/match.mjs` → `api/_lib/matching.mjs: computeMatch` | `tests/api/match-cache.test.mjs`, `tests/api/match-enrich.test.mjs`, `src/App.test.tsx` |
| POST | `/api/job-details` | Anonyme Session (`Set-Cookie: mj-session`) | keine | `api/job-details.mjs` → `api/_lib/detailEnrich.mjs` | `tests/api/job-details.test.mjs`, `tests/api/detail-enrich.test.mjs` |
| POST | `/api/profile` | none | keine | `api/profile.mjs` → `api/_lib/ai.mjs: chat` | `tests/api/profile-cache.test.mjs`, `src/App.test.tsx` |
| POST | `/api/cover-letter` | none | keine | `api/cover-letter.mjs` → `api/_lib/ai.mjs: chat` | indirekt via `src/api.test.ts`/Komponententests |
| GET | `/api/models` | none | keine | `api/models.mjs` → `api/_lib/models.mjs` | `tests/api/providers.test.mjs` (Provider-Ebene) |
| GET | `/api/model` | none | keine | `api/model.mjs` | — |
| POST / DELETE / GET | `/api/alerts` | none | keine | `api/alerts.mjs` → `api/_lib/alerts.mjs` (Upstash) | — |
| POST | `/api/ats-analysis` | none | keine | `api/ats-analysis.mjs` → `api/_lib/ats.mjs` | `tests/api/ats-analysis.test.js`, `tests/api/ats-extraction.test.js`, `tests/api/ats-model-selection.test.mjs` |
| POST | `/api/cv-improvement` (und interne Sub-Dispatcher `/apply`, `/reanalyze`, `/match-impact` via `req.url`) | none | Antwort-`meta.version = "v1"` (nicht URL) | `api/cv-improvement.mjs` | `tests/api/cv-improvement-api.test.mjs`, `tests/api/cv-improvement-module.test.mjs` |
| GET | `/api/usage` | **Token**: Header `x-usage-token` oder `Authorization: Bearer` (gegen `USAGE_DIAGNOSTICS_TOKEN`) | keine | `api/usage.mjs` → `api/_lib/usage.mjs` | — |
| POST | `/api/cron/digest` | Vercel-Cron-Header `x-vercel-cron` oder `Authorization: Bearer $CRON_SECRET`; **offen, wenn `CRON_SECRET` nicht gesetzt ist** | keine | `api/cron/digest.mjs` (Vercel Cron täglich 07:00) | — |

Hinweis: `GET /api/alerts` liefert nur `{ count }` und wird vom Frontend nicht verwendet.

---

## Detail: Requests / Responses / Errors (aus dem Code)

### `GET /api/jobs`
- Query: `skills` (String; JSON-Array oder Legacy `;`/,` Liste), `targetRole`, `city`, `radiusKm`, `workMode` (CSV), `employmentType` (CSV) — alle optional.
- 200 → `{ jobs: Job[], meta: { totalScanned, totalFiltered, city[], keywords[], sources, sourceCounts, disabledSources, sourceDetails, jobsCombined, searchStrategy, apify } }`
- Errors: `HttpError`-kodiert (`network` 502, `rate_limited` 429, `upstream` 502 aus Arbeitnow-Quelle), sonst 500 `{ error, code: "internal" }`.
- Geo-Semantik (seit BROWSER-BUG-04): `city` wird nur an die Quellen gereicht, wenn `radiusKm` numerisch > 0 ist („Entfernung egal" = kein Ortsfilter).

### `POST /api/match`
- Body: `{ skills, targetRole, city, jobs[] (Pflicht, non-empty), model?, }`; Header `x-mj-attempt` optional.
- 200 → `{ matches: Match[], meta }`; setzt `Set-Cookie` (anonyme Session für Detail-Enrichment der Arbeitsagentur-Jobs).
- Errors: 400 `bad_request` (jobs fehlt/leer), 405 `method`, 4xx/5xx der AI-Provider-Ebene (401 `key_invalid`, 402 `insufficient_credits`, 429 `free_quota_exceeded` u. a. via `api/_lib/ai.mjs`), 500 `internal`.

### `POST /api/job-details`
- Body: `{ jobs: string[] }` (Slugs, Pflicht non-empty).
- 200 → `{ jobs: Record<string, Job>, meta: { enrichedCount } }`; setzt Session-Cookie.
- Errors: 400 `bad_request`/`invalid_slug`, 429 `quota_exceeded`/`apify_limit_reached`, 503 `quota_unavailable`/`missing_config`, 404 `source_not_found`, 502 Fallback, 500 `internal`.

### `POST /api/profile`
- Body: `{ text (Pflicht, ≤ 30000 Zeichen), hash?, model? }`; Header `x-mj-attempt` optional.
- 200 → `SuggestedProfile` flach: `{ skills[], experienceLevel, targetRoles[], location }`. Bei `hash`: Upstash-Cache (TTL 30 Tage).
- Errors: 400 `missing_text` / `text_too_long`, 502 `bad_ai_response`, AI-Provider-Codes, 500 `internal`.

### `POST /api/cover-letter`
- Body: `{ skills, targetRole, city, job{title, company_name, ...} (Pflicht), language?, prepareQuestion?, model? }`; Header `x-mj-attempt` optional.
- 200 → `{ letter: string, meta: { job, language } }`.
- Errors: 400 `bad_request`, AI-Provider-Codes, 500 `internal`.

### `GET /api/models`
- 200 → `{ models: [{id,name,provider}], providers: [{id,name,enabled,configured}], defaultModel, fallbackModel, recommendedModel, fallbackMaxAttempts }`.
- Errors: 405 `method`, 502 `models_unavailable` (oder Provider-Status).

### `GET /api/model`
- 200 → `{ model: string | null }`. Kein Method-Guard im Fehlerfall (405 nur via OPTIONS); Errors: keine expliziten.

### `POST /api/alerts`
- Body: `{ email (Pflicht, E-Mail-Regex), skills|targetRole (mind. eins), city? }` → 200 `{ ok: true, message }`.
- `DELETE`: Body `{ email }` → 200 `{ ok: true, message }`.
- `GET`: → 200 `{ count }` (nur Server-Seite; Frontend nutzt GET nicht).
- Errors: 400 `bad_request`, 405 `method`, 503 `missing_config` (Upstash), 500 `internal`.

### `POST /api/ats-analysis`
- Body: `{ job (Pflicht), profile { skills }, ai?: { enabled?, consent?, model? } }`.
  - `ai.model` ist seit BROWSER-BUG-22 optional und wird bis `formulateCVText` → `chat({ model })` durchgereicht; ohne Feld bleibt das Server-Default aktiv.
- 200 → `{ analysis { score, keywordCoverage, criticalGaps, requirements, matches }, recommendations[], ai { requested, executed, consentRequired, consentGiven, provider, model, externalProcessing, dataMinimized, privacyStatus, dataCategories, privacyPolicy, formulations[] } }`.
- Errors: 400 `bad_request`, 405 `method`, 500 `internal`.

### `POST /api/cv-improvement*` (Sub-Dispatch über `req.url`-Suffix)
- Standard (kein Suffix): Body `{ job, profile }` → 200 **flach**: `{ improvement { plan, summary, totalRequirements, generatedAt }, analysis { score, keywordCoverage, criticalGaps, summary }, meta: { version: "v1", generatedAt } }`.
- `/apply`: Body `{ profile, selectedRecommendationIds (Pflicht non-empty), allRecommendations (Pflicht) }` → 200 **Envelope**: `{ data: { improvedProfile, appliedCount, appliedRecommendations }, meta: { version: "v1", requestId, timestamp } }`.
- `/reanalyze`: Body `{ job, originalProfile, improvedProfile }` → 200 Envelope `{ data: { before, after, delta }, meta: {...} }`.
- `/match-impact`: gleiche Body-Struktur → 200 Envelope `{ data: { before, after, delta, changes }, meta: {...} }`.
- Errors überall: 400 `bad_request`, 405 `method`, 500 `internal` (flach `{ error, code }`).

### `GET /api/usage`
- Auth: `x-usage-token` Header oder `Authorization: Bearer` vs. `USAGE_DIAGNOSTICS_TOKEN` (Constant-Time-Compare).
- 200 → Usage-Snapshot (Zähler). Errors: 401 `unauthorized`, 403 `forbidden` (Endpoint deaktiviert ohne Token-Env), 405 `method`, 500 `internal`.

### `POST /api/cron/digest`
- Auth: automatisch bei Vercel-Cron (`x-vercel-cron`-Header), sonst optional `Bearer $CRON_SECRET`; **ohne gesetztes `CRON_SECRET` ist der Endpoint öffentlich aufrufbar** (Befund, siehe Mismatches).
- 200 → `{ ok: true, checked, sent, skipped, errors[] }`. Errors: 401 `unauthorized`, 405 `method`, 500 `missing_config`/`internal`.

---

## Frontend Client (`src/api.ts`) — tatsächliche Aufrufe

| Funktion | URL im Client | Methode |
|---|---|---|
| `fetchJobs` | `/api/jobs` | GET |
| `fetchMatches` | `/api/match` | POST (+ `x-mj-attempt`) |
| `fetchJobDetails` | `/api/job-details` | POST |
| `fetchModels` | `/api/models` | GET |
| `fetchModel` | `/api/model` | GET |
| `createProfile` | `/api/profile` | POST (+ `x-mj-attempt`) |
| `generateCoverLetter` | `/api/cover-letter` | POST (+ `x-mj-attempt`) |
| `subscribeAlert` / `unsubscribeAlert` | `/api/alerts` | POST / DELETE |
| `analyzeATS` | `/api/ats-analysis` | POST (`ai.model` optional seit BUG-22) |
| `fetchCvImprovement` | **`/api/v1/cv-improvement`** | POST |
| `applyCvImprovement` | **`/api/v1/cv-improvement/apply`** | POST |
| `reanalyzeCv` | **`/api/v1/cv-improvement/reanalyze`** | POST |
| `computeMatchImpact` | **`/api/v1/cv-improvement/match-impact`** | POST |

Client-Fehlerhandling: `ApiError { message, status?, code? }`, Retries nur via `withModelFallback` (Model-Verfügbarkeit), `isModelUnavailable`, `isFreeQuotaExceeded`.

---

## Documentation Mismatches

| Endpoint / Thema | Dokumentiert | Tatsächlicher Code | Klassifikation | Evidence |
|---|---|---|---|---|
| Anzahl Endpunkte | alte `API_INVENTORY.md` (2026-09-20): „13", mit Duplikaten (`/api/match`, `/api/job-details` doppelt) | 12 Function-Dateien, 12+2 konkrete Schnittstellen | DOCUMENTATION-MISMATCH | `api/*.mjs`, `api/cron/*.mjs` |
| Version-Prefix | Alter Bestand: „alle unversioned" | Frontend ruft `/api/v1/cv-improvement*` auf; **kein `api/v1/`-Verzeichnis und kein Rewrite in `vercel.json`** existiert | DOCUMENTATION-MISMATCH + Vertragsrisiko | `src/api.ts:416,446,527,582`; `vercel.json`; `ls api/` |
| CV-Improvement Response | `docs/API_CV_IMPROVEMENT.md`: `{ data, meta: { version, requestId } }`-Envelope | Standard-Endpoint liefert **flach** (`{ improvement, analysis, meta }` ohne `requestId`); nur Sub-Pfade nutzen die Envelope | DOCUMENTATION-MISMATCH | `api/cv-improvement.mjs` (269–286 vs 191–202 etc.) |
| CV-Improvement Pfad | `docs/API_CV_IMPROVEMENT.md`: `POST /api/v1/cv-improvement` | Repo-Route ist `api/cv-improvement.mjs` (ohne `v1`), Sub-Dispatch via `req.url.endsWith` | DOCUMENTATION-MISMATCH | `api/cv-improvement.mjs:96–98` |
| Auth pauschal „none" | alte Inventory: „No authentication required for any public endpoints" | `/api/usage` verlangt `x-usage-token`/Bearer; `/api/cron/digest` verlangt Cron-Header/Secret (offen ohne `CRON_SECRET`); `/api/match` & `/api/job-details` setzen Session-Cookies | DOCUMENTATION-MISMATCH | `api/usage.mjs:15–41`, `api/cron/digest.mjs:59–77`, `api/match.mjs:77–78` |
| Alerts-Methoden | alte Inventory: „POST/DELETE /api/alerts" | Handler unterstützt zusätzlich GET (`{ count }`) | DOCUMENTATION-MISMATCH (klein) | `api/alerts.mjs:58–61` |
| Error-Format | `API_DOCUMENTATION_STANDARD.md`: `{ error: { code, message, details }, meta: { requestId } }` | Tatsächlich flach: `{ error: string, code: string }`, kein `error.details`, kein `meta.requestId` | STANDARD ≠ IST | alle Handler |
| Response-Envelope | Standard: `{ data, meta: { version, requestId, timestamp? } }` | Überwiegend flache Responses; Envelope nur in cv-improvement-Subpfaden | STANDARD ≠ IST | alle Handler |
| `X-Request-ID` | Standard: Pflicht-Empfehlung (Client sendet, Server echot) | im Code nicht implementiert | DOCUMENTED-BUT-NOT-IMPLEMENTED | Suche in `api/` |
| `GET /api/versions` Discovery | `API_VERSIONING_STANDARD.md` §6.1 | nicht implementiert | DOCUMENTED-BUT-NOT-IMPLEMENTED | kein Handler |
| Header `X-API-Version` | Standard: Pflicht in allen Responses | nirgends gesetzt | DOCUMENTED-BUT-NOT-IMPLEMENTED | Suche in `api/` |
| API Key `X-API-Key` | Standard §?: API-Key für service-to-service | nicht implementiert (einzige Auth: usage-token/cron-secret/session-cookie) | DOCUMENTED-BUT-NOT-IMPLEMENTED | Suche in `api/` |
| OpenAPI / `request_schema.json` | im Auftrag als Prüfpunkt genannt | **keine OpenAPI-Datei und keine `request_schema.json` im Repo** — „OpenAPI SearchRequest vs request_schema.json" kann nicht verglichen werden | UNCERTAIN (nicht verifikationsfähig) | Repo-weite Suche |
| Base-URL `localhost:8000` | im Auftrag als Prüfpunkt genannt | nirgends im aktiven Code/Doku; tatsächliche URLs: Vercel-Demo `mays-job-matcher.vercel.app` (README), Vite-Dev 5173 | DOCUMENTED-BUT-NOT-IMPLEMENTED (bzw. veraltet) | README.md:6 |
| `/api/cv-improvement` in alter Inventory | als einzelner unversioned Endpoint gelistet | Handler enthält 4 Sub-Modi über URL-Suffix — die Suffix-Routen haben **keine eigenen Function-Dateien** | DOCUMENTATION-MISMATCH | `api/cv-improvement.mjs` |

---

## Implemented but not documented

- `GET /api/alerts` (`{ count }` — nur Server-seitig; alte Doku nannte nur POST/DELETE).
- `ai.model` am ATS-Endpunkt (seit BROWSER-BUG-22) — bislang nicht in `docs/API_CV_IMPROVEMENT.md`/alter Inventory.
- Session-Cookie (`Set-Cookie: mj-session`) auf `/api/match` und `/api/job-details` (Anonyme Identität für Arbeitsagentur-Detail-Enrichment + Quota).
- `x-mj-attempt`-Request-Header (Modell-Fallback-Attempt-Propagierung) auf `/api/match`, `/api/profile`, `/api/cover-letter`.
- Job-Quellen-Metadaten (`meta.sources`, `meta.sourceCounts`, `meta.sourceDetails`) in `/api/jobs`.

## Documented but not implemented

- `X-API-Key`-Auth (nur Standard-Dokument).
- `GET /api/versions` (Version Discovery).
- `X-API-Version`-Response-Header und `X-API-Deprecated`-/`X-API-Sunset-*`-Header.
- Deprecation-`meta` in Responses.
- Einheitliche Fehler-Struktur `{ error: { code, message, details }, meta }`.
- OpenAPI-Spezifikation / `request_schema.json` (nicht im Repo auffindbar).
- `localhost:8000` als Basis-URL (im aktiven Code nicht vorhanden).

## Unresolved / Requires Decision

1. **`/api/v1/cv-improvement*` vs. tatsächlichem Routing:** Der Client ruft `v1`-URLs, der Server legt keine `api/v1/`-Dateien an und `vercel.json` enthält keine Rewrites. Aus dem Repo ist nicht herleitbar, dass diese Routen in Production bedient werden (Vercel würde ohne `api/v1/`-Datei 404 liefern). Die cv-improvement-Unit-Tests rufen den Handler direkt, ohne URL-Routing. → **Entscheidung nötig** (Routing ergänzen oder Client auf unversioned umstellen) — NICHT in diesem Task beheben.
2. **`/api/cron/digest` ohne `CRON_SECRET` ist öffentlich** aufrufbar (`isAuthorized` gibt `true`, wenn kein Secret gesetzt ist). Sicherheitsrelevante Entscheidung nötig — NICHT in diesem Task beheben.
3. **Zwei Response-Formate koexistieren** (flach vs. `{data, meta}`-Envelope nur in cv-improvement-Subpfaden) — welche Variante der Standard werden soll, ist offen (Versioning-Standard sagt Envelope; IST sagt überwiegend flach).
4. `api/model.mjs` hat keinen Method-Guard-Fehlerpfad (jetzt dokumentiert; bewusste Entscheidung offen).
5. Standard-vs-IST-Überführung (Migration Plan) bleibt Draft — keine Umsetzung in diesem Task.

---

## STANDARD vs. IST (Versioning, §8 des Auftrags)

**STANDARD (docs/API_VERSIONING_STANDARD.md v1.0.0):**
- URL-basierte Major-Versionierung Pflicht: `/api/v1/...`
- Response-Envelope mit `meta.version`, `meta.requestId`
- Header `X-API-Version`, Deprecation-Header/-Meta
- Version Discovery `GET /api/versions`

**IST (Code):**
- Alle produktiv erreichbaren Routen ohne Version-Prefix (`/api/*`).
- Einziges Versionierungssignal: `meta.version = "v1"` in cv-improvement-Antworten (nicht URL-basiert).
- Keine der Standard-Header/-Discovery-Mechanismen implementiert.
- Der Client referenziert `/api/v1/*` nur für cv-improvement — ohne entsprechende Server-Routen.

**DIFFERENZ:**
Der Standard ist nicht eingeführt. Die Dokumente beschreiben einen Zielzustand, der mit dem Code nicht übereinstimmt. Widersprüche innerhalb der Doku selbst: `API_CV_IMPROVEMENT.md` dokumentiert eine Envelope für den Standard-Endpoint, die der Code dort nicht liefert, und einen v1-Pfad, den es im Repo-Routing nicht gibt.

---

## Git / History Nachweis

- Branch: `main`, HEAD = `origin/main` = `0abbd59` (2026-09-25)
- Der im früheren Befund genannte Commit **`dc03af8` existiert nicht** in diesem Repository (`git show dc03af8` → „unbekannter Commit"), auf keinem Branch (`git log --all`). Damit können die dort behaupteten Checkpoint-Vorfahren in diesem Repo nicht verifiziert werden.
- Hinweis „Remote-main sei leer": in keinem Dokument des Repos auffindbar (inkl. `docs/AI_AUDITLOG.md`). Tatsächlicher Stand: `origin/main` existiert und ist identisch mit HEAD (292 Commits Gesamthistorie) — siehe auch Follow-up-Notiz in `docs/AI_AUDITLOG.md`.

---

## Test Coverage (aktuell, code-basiert)

| Bereich | Dateien |
|---|---|
| Jobs/Sources/Strategie | `tests/api/sources-registry.test.mjs`, `tests/api/apify-actor.test.mjs`, `tests/api/apify-client.test.mjs`, `tests/api/filter.test.js`, `tests/api/search-strategy.test.mjs`, `tests/integration/20-skills-regression.test.mjs`, `tests/integration/cv-to-jobs-e2e.test.mjs` |
| Match | `tests/api/match-cache.test.mjs`, `tests/api/match-enrich.test.mjs`, `src/App.test.tsx` |
| Profile | `tests/api/profile-cache.test.mjs`, `src/App.test.tsx` |
| ATS | `tests/api/ats-analysis.test.js`, `tests/api/ats-extraction.test.js`, `tests/api/ats-model-selection.test.mjs` |
| CV Improvement | `tests/api/cv-improvement-api.test.mjs`, `tests/api/cv-improvement-module.test.mjs` |
| Provider/Quota | `tests/api/providers.test.mjs`, `tests/api/openrouter-provider.test.mjs`, `tests/api/edenai-provider.test.mjs`, `tests/api/quota-429.test.mjs` |
| Details/Enrichment | `tests/api/job-details.test.mjs`, `tests/api/detail-enrich.test.mjs` |
| Safety | `tests/api/safety-observer.test.mjs` |
| Client/Frontend | `src/api.test.ts`, Komponententests unter `src/components/*.test.tsx` |
| Keinen eigenen API-Test | `/api/model`, `/api/alerts`, `/api/usage`, `/api/cron/digest`, `/api/cover-letter` (direkt) |

Gesamtsuite zum Stand der Inventur: 486 Tests (426 Unit-/API-Tests in `tests/` + `src/` + Integration).
