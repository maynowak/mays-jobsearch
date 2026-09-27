# API-CONSOLIDATION-02 — EXECUTION LOG

Read current source documentation.
Do not invent missing contracts.
Do not duplicate RIS responsibilities.

## Current status
- Status: COMPLETE (read-only consolidation, no API code changed)
- Date: 2026-09-27
- Classification: YELLOW — TARGET contract stands, 1 blocking routing gap unchanged, 3 doc defects unchanged

## Git
- Branch: main
- HEAD = origin/main = f689fdfcd5adf82d542366bd232d1d2249f471f0
- Working tree at start: CLEAN
- Previous inventory baseline: 0abbd59 (2026-09-25)
- Previous contract baseline: a6a865c (API-CONTRACT-01, TARGET v1.0.0)

## Audit scope
- Re-verify `docs/API_CONTRACT.md` (TARGET) against code at HEAD
- Re-verify `docs/API_INVENTORY.md` (IST) against `api/`, `src/api.ts`, `vercel.json`
- Check open decisions: `/api/v1` routing, envelope, error format, `X-Request-ID`, cron auth, boundary shapes, provider doc defects
- No migration, no route/auth/response change in this step (per CONTRACT §17)
- No RIS duplication: agent runtime, registry, discovery, routing, WorkItem, SQS/Lambda/Cognito not touched

## Completed audit sections
1. `api/` file inventory vs INVENTORY table — DONE
2. `src/api.ts` client calls vs server routes — DONE
3. `vercel.json` rewrites/functions — DONE
4. `api/models.mjs` delta since 0abbd59 — DONE
5. `docs/AI_PROVIDERS.md` defect check — DONE
6. `docs/architecture/AI_DATA_BOUNDARY_AND_INTERFACES.md` shape check — DONE
7. `docs/API_CV_IMPROVEMENT.md` path check — DONE
8. `api/cron/digest.mjs` auth check — DONE
9. Tests + typecheck — DONE

## Actual findings (verified)

### 1. Server routes — UNCHANGED since inventory
- 12 function files under `api/`, no `api/v1/` directory (verified `ls api/v1` → not found)
- `vercel.json` has only functions + 1 cron (`/api/cron/digest` 07:00) + 1 rewrite (`/top` → `/index.html`). No `/api/v1` rewrite.
- Evidence: `api/*.mjs`, `api/cron/digest.mjs`, `vercel.json`

### 2. Client calls — UNCHANGED, blocking gap persists
- `src/api.ts` still calls `/api/v1/cv-improvement*` at 4 sites: `:416`, `:446`, `:527`, `:582`
- All other client calls use unversioned `/api/*` (jobs, match, job-details, models, model, profile, cover-letter, alerts, ats-analysis)
- Consequence: ohne `api/v1/`-Datei oder Rewrite liefert Vercel 404 für genau diese 4 Calls. Unit-Tests rufen Handler direkt, ohne URL-Routing — decken das nicht ab.
- Classification of gap: BLOCKING, documented in CONTRACT §14/§16 + INVENTORY Unresolved #1, NICHT hier behoben

### 3. Only `api/` code delta since 0abbd59: `api/models.mjs`
- `defaultModel: configured` → `defaultModel: compatible ?? configured`, mit `getCompatibleFallback(configured)` davor
- Comment: verhindert systematisches `model_not_free` bei veralteter/kostenpflichtiger Env-Konfiguration (Befund 573266d)
- Kein Vertrags-Shape-Change: Response-Felder identisch, nur Wert-Auflösung
- Evidence: `git diff 0abbd59..HEAD -- api/models.mjs`

### 4. Response envelope — IST still flat, TARGET not migrated (expected)
- IST: flach überall, Envelope `{data, meta}` nur in cv-improvement Subpfaden `/apply`, `/reanalyze`, `/match-impact`
- TARGET (§9): `{data, meta:{requestId, version}}` + `{error:{code,message,details?}, meta}` für alle öffentlichen Endpoints, interne `/api/usage` + `/api/cron/digest` als dokumentierte Ausnahme
- No migration executed — korrekt per CONTRACT §17 (Parallel Run ≥90 Tage, separater Step)

### 5. Error format — IST still flat (expected)
- IST: `{error: string, code: string}`, kein `details`, kein `meta.requestId`
- TARGET §10 catalogue unchanged, codes still valid (bad_request, model_unavailable, free_quota_exceeded, etc.)
- Evidence: alle Handler, `api/_lib/providers/errors.mjs`

### 6. Auth matrix — verified, unchanged
- none (meiste), Session-Cookie (match, job-details), Token (usage: `x-usage-token`/Bearer vs `USAGE_DIAGNOSTICS_TOKEN`), Cron (`x-vercel-cron` oder Bearer CRON_SECRET)
- `api/cron/digest.mjs:59-67 isAuthorized`: `return true` wenn kein CRON_SECRET gesetzt → öffentlich aufrufbar. OPEN DECISION aus CONTRACT §18 #2 persists.
- `ai.consent` bleibt Gate für ats-analysis, nicht Auth — unverändert (§13)

### 7. Doc defects — all 3 persist, reported not resolved
- `docs/AI_PROVIDERS.md`: Python-Fragment persists (`if '## Usage & cost guards' in content:` + `content.replace(...)`), plus doppelte `Development / Sandbox Testing` Section (ca. Zeile 96 + 153). Nicht kopiert, nicht gewählt.
- `docs/architecture/AI_DATA_BOUNDARY_AND_INTERFACES.md`: zwei `FormulationRequest`-Shapes persistieren — MODULE BOUNDARY camelCase (`requirementId`, `matchedKeyword`, `changeType`) vs CURRENT IMPLEMENTATION snake_case (`originalText`, `requirement`, `change_type`). Source-owner decision required.
- `docs/API_CV_IMPROVEMENT.md`: dokumentiert `POST /api/v1/cv-improvement` als existierend (Zeile 5, 300ff), Repo-Route ist `api/cv-improvement.mjs` mit Suffix-Dispatch. Mismatch persists.
- `GET /api/versions`, `X-API-Version`, `X-API-Key`, OpenAPI/`request_schema.json`, `X-Request-ID`: weiterhin dokumentiert-aber-nicht-implementiert — korrekt als TARGET/Open Decision geführt

### 8. AI boundary / consent — verified intact
- Anonymisierung `src/lib/anonymize.ts` lokal vor jedem externen Modell-Call (PRIVACY-BOUNDARY)
- Single Consent (Pfad B) nach CV-UPLOAD-UX-01, `ai.enabled && ai.consent` Gate in ats-analysis
- `ai.model?` optional, Durchreichung bis `chat({model})`, Recovery `ats-model-recovery` — unverändert seit BROWSER-BUG-22
- Provider credentials/routing/quotas server-side only — keine Mobile-/Client-Verlagerung

## Evidence / file references
- `docs/API_CONTRACT.md` v1.0.0 (TARGET, 2026-09-25)
- `docs/API_INVENTORY.md` (IST, HEAD 0abbd59)
- `api/*.mjs`, `api/cron/digest.mjs:59-67`, `api/models.mjs:13-29`, `api/_lib/ai.mjs`, `api/_lib/providers/`
- `src/api.ts:195,206,217,227,231,243,260,269,278,342,416,446,527,582`
- `vercel.json`
- `docs/AI_PROVIDERS.md` (292 Zeilen, Fragment + Duplikat)
- `docs/architecture/AI_DATA_BOUNDARY_AND_INTERFACES.md:19-60`
- `docs/API_CV_IMPROVEMENT.md:5,300,333-344`
- `docs/AI_AUDITLOG.md` (Template Zeile 1-45 befolgt: verified facts only, resume point)

## Verification executed
- `npm test` (vitest): 43 files, 503 passed (baseline 486 bei Inventur, 490 bei letztem Audit — Zuwachs aus CV-Features, keine API-Regression)
- `npx tsc --noEmit`: PASS, exit 0
- `git diff --check`: CLEAN
- `git show` / `grep` / `ls` only — no code edits in `api/`, `src/api.ts`, `vercel.json`

## Git status (end)
- Modified by this step: `docs/reports/API-CONSOLIDATION-02-EXECUTION_LOG.md` (new), `docs/AI_AUDITLOG.md` (entry appended)
- `api/`, `src/`, `vercel.json`: explicitly unchanged — confirmation
- No commit performed in this step (commit per project gate by owner)

## Open questions (require source-owner decision, not invention)
1. `/api/v1/cv-improvement*` routing: `api/v1/`-Dateien anlegen oder Client auf unversioned zurück? (BLOCKING)
2. `CRON_SECRET`-Pflicht für `/api/cron/digest` (Deployment/Ops)
3. `GET /api/model` Sunset zugunsten `/api/v1/models` (CONTRACT §18 #3)
4. OpenAPI-Artefakt erzeugen im Contract-Cleanup-Step (§18 #4)
5. `FormulationRequest` camelCase vs snake_case — source owner fix
6. `AI_PROVIDERS.md` Python-Fragment + Duplikat entfernen — source owner fix
7. Kanonische Production-URL (Deployment, EXTERNAL)

## Risks
- 4 CV-Improvement-Calls 404 in Production bis Routing-Entscheidung umgesetzt
- Cron-Digest öffentlich aufrufbar ohne CRON_SECRET
- Envelope/Error-Migration ohne Versionierung würde bestehende `/api/*`-Consumer brechen — daher TARGET-gated, kein stiller Fix

## Recommended next actions
1. Contract-Cleanup-Step (separat): `api/v1/`-Routen + Envelope + `meta.requestId` + OpenAPI, mit Parallel Run + Deprecation-Headern
2. Ops: `CRON_SECRET` in Vercel setzen + Pflicht aktivieren
3. Doku-Fixes durch Source Owner (Providers-Fragment, Boundary-Shapes)
4. Danach `docs/API_INVENTORY.md` auf neues HEAD aktualisieren

## Current resume point
- Consolidation complete at HEAD f689fdf. Next resume: Contract-Cleanup-Step oder Inventory-Refresh nach Routing-Entscheidung. This log is the resume source.

---

## AI_AUDITLOG.md-Eintrag (AUDITLOG-CLEANUP-01, verschoben aus docs/AI_AUDITLOG.md)

### API-CONSOLIDATION-02 — API IST vs TARGET RE-VERIFIKATION (READ-ONLY)
- Date: 2026-09-27
- Task: API-CONSOLIDATION-02 (aktueller Stand APIs analysieren + konsolidieren)
- Purpose: TARGET `docs/API_CONTRACT.md` v1.0.0 gegen Code an HEAD f689fdf (= origin/main, clean) re-verifizieren; keine Migration, keine Route-/Auth-/Response-Aenderung.
- AI instruction befolgt:
  Read current source documentation.
  Do not invent missing contracts.
  Do not duplicate RIS responsibilities.
- Findings (verifiziert, kein Inventing):
  1. Server-Routen unveraendert: 12 Function-Dateien, kein `api/v1/`-Verzeichnis, `vercel.json` ohne v1-Rewrite. Einzige `api/`-Aenderung seit Inventur 0abbd59: `api/models.mjs` defaultModel via `getCompatibleFallback` (Wert-Aufloesung, kein Shape-Change).
  2. BLOCKING unveraendert: `src/api.ts:416,446,527,582` ruft `/api/v1/cv-improvement*`, Server hat keine v1-Routen -> Prod-404-Risiko. Tests rufen Handler direkt (kein URL-Routing).
  3. Envelope/Error/`X-Request-ID`/`GET /api/versions`/`X-API-Version`/`X-API-Key`/OpenAPI: weiterhin TARGET/offen, IST flach — korrekt nicht migriert (Parallel-Run-Step ausstehend).
  4. Auth-Matrix verifiziert unveraendert; `/api/cron/digest` ohne CRON_SECRET weiterhin offen (`isAuthorized return true`) — Open Decision.
  5. Doku-Defekte persistieren (reported, nicht resolved): `docs/AI_PROVIDERS.md` Python-Fragment + doppelte Sandbox-Section; Boundary `FormulationRequest` camelCase vs snake_case; `docs/API_CV_IMPROVEMENT.md` dokumentiert v1-Pfad als existierend.
  6. Consent/Anonymisierung intakt: lokal vor jedem Modell-Call, `ai.enabled && ai.consent` Gate, `ai.model?` mit Recovery.
- Files changed: docs/reports/API-CONSOLIDATION-02-EXECUTION_LOG.md (neu), docs/AI_AUDITLOG.md (dieser Eintrag). `api/`, `src/api.ts`, `vercel.json` explizit unveraendert.
- Tests: `npm test` 503/503 PASS (43 files); `npx tsc --noEmit` PASS; `git diff --check` CLEAN.
- Execution log: docs/reports/API-CONSOLIDATION-02-EXECUTION_LOG.md (Resume-Quelle).
- Classification: YELLOW — TARGET steht, 1 Blocking + 3 Doku-Defekte + Cron-Entscheidung offen, alle beim Source Owner.
