# JM-SECURITY-PERFORMANCE-REVIEW-01 — Security & Performance Review

**Status: ANALYSIS COMPLETE — NO PRODUCT CODE CHANGED — NO MERGE / DEPLOY**
**Date:** 2026-11-26
**Repository:** `maynowak/mays-jobsearch`
**Worktree:** `worktrees/jm-security-performance-review-01`
**Branch:** `feature/jm-security-performance-review-01`
**Base:** `origin/main` `c63911f` (latest code analysis: `ee2ce6f`, `c63911f` is docs-only)
**Task:** `JM-SECURITY-PERFORMANCE-REVIEW-01` (Agent F, XREPO-MULTI-AGENT-ORCHESTRATION-02)

> **No product, API, configuration, package or shared file was modified.** This
> branch contains exactly one new documentation file. No RIS/AWS/Terraform/
> Cognito/consent change, no main merge, no deployment, no secret or real user
> data was read or written. `docs/AI_AUDITLOG.md` was deliberately **not**
> edited because the task forbids it and this is a read-only review.

---

## 1. Scope and method

Reviewed against `c63911f`:

1. CORS allowlist per endpoint (`Access-Control-Allow-Origin: *`).
2. `api/cv-improvement.mjs` and its sub-route dispatch (authorization, body
   size, endpoint confusion, sensitive logging).
3. Remaining `Math.random` uses, separated into security-relevant and harmless
   UI randomness.
4. Historical CodeQL findings: active JS/TS category vs retired categories.
5. `npm run build` chunk warnings and chunk-size decomposition.
6. Prioritized fixes, security vs performance separated.

Evidence sources:

- Static code at `c63911f` with exact `file:line`.
- Real `npm run build` on this worktree.
- Read-only GitHub API queries (`gh api`, repo scope) for CodeQL analyses and
  alerts.
- Minimal, non-mutating production probes (`OPTIONS`, plus two deterministic
  `POST`s with synthetic `{"job":{"title":"Probe"}}` that stop at validation).
  **Zero AI calls, zero Redis/DB writes, zero user data.**

Commands and raw outputs are in §10.

---

## 2. Executive summary

| ID | Severity | Area | Finding |
| --- | --- | --- | --- |
| S1 | **High** | Cron auth | `/api/cron/digest` **fails open**: `x-vercel-cron` header is trusted from any caller, and authorization returns `true` when `CRON_SECRET` is unset (documented as optional). Any internet client can trigger digest emails to all subscribers. |
| S2 | **High** | Unauthenticated AI cost | `/api/ats-analysis` can fan out **up to 20 AI calls per unauthenticated request**; `/api/profile`, `/api/match`, `/api/cover-letter` are also unauthenticated AI endpoints. Global monthly caps are only 1000 (OpenRouter) / 200 (EdenAI), and the per-IP quota is **disabled by default and undocumented** → ~50 amplified requests can exhaust the monthly AI budget (denial of service for real users). All of them send `Access-Control-Allow-Origin: *`. |
| S3 | **Medium** | Alerts | `/api/alerts` `DELETE` unsubscribes any email address with no auth/confirmation; `POST` subscribes arbitrary emails; `GET` exposes subscriber count. Wildcard CORS. |
| S4 | **Medium** | cv-improvement routing | Client calls `/api/v1/cv-improvement*` → **404 in production** (verified). `/apply`, `/reanalyze`, `/match-impact` are implemented but unreachable (path suffix 404). If a rewrite is later added, the unauthenticated AI sub-route becomes live. `req.url.endsWith()` dispatch is brittle. |
| S5 | **Medium** | Body limits | 8 duplicated legacy `readBody()` implementations have no size cap; only the Vercel platform limit (~4.5 MB) bounds them. RIS BFF and analysis v1 already cap bodies correctly. |
| S6 | **Low** | Randomness | Remaining `Math.random()` uses are UI-only or `crypto.randomUUID()` fallbacks. No auth token or authorization decision depends on them. `secureRandomId.ts` exists but is only used by 2 of 9 ID generators. |
| S7 | **Low** | Logging | Endpoints log full `Error` objects (`console.error(..., err)`); AI provider error excerpts (≤180 chars) can be logged. No request body / CV text / profile data is logged. `/api/jobs` is a positive example of redaction. |
| S8 | **Info** | CodeQL | Active category `/language:javascript-typescript`: **0 results** (latest main analysis `2251450331`, `ee2ce6f`). 21 alerts still show `open` globally because 42 stale instances live in retired `/language:javascript` + `/language:typescript`; every current-category instance is `fixed`, 0 dismissed. **Do not claim "zero open alerts."** |
| P1 | Perf | Initial JS | `main` 1,623.90 kB (gzip 444.25 kB) contains `pdfjs-dist` (427.28 kB / 127.56 kB gzip) because `src/lib/pdf.ts` is statically imported. |
| P2 | Perf | App code | ~907 kB (gzip ~228 kB) is app code; there is **no `React.lazy`/route splitting** anywhere in `src/`. |
| P3 | Perf | PDF chunk | `pdfExport` 1,140.45 kB (gzip 508.08 kB) is already lazy — good, keep it. |
| P4 | Perf | CSS | One 279.38 kB (gzip 48.29 kB) CSS bundle is loaded by **both** HTML shells on every route. |
| P5 | Perf | Images | Landing hero is a 1,640.16 kB PNG imported directly; other PNG fallbacks are 1.70–2.67 MB. |

---

## 3. CORS allowlist

### 3.1 Current state

Every legacy public API sets a wildcard origin. No endpoint sets
`Access-Control-Allow-Credentials`, and there is no `Vary: Origin`:

| Endpoint | `Access-Control-Allow-Origin` | Auth | Side effects / cost |
| --- | --- | --- | --- |
| `POST /api/jobs` | `api/jobs.mjs:40` | none | Upstream job source calls (Apify/Arbeitnow), Redis cache |
| `POST /api/match` | `api/match.mjs:52` | none | **AI calls**, BA detail enrichment |
| `POST /api/profile` | `api/profile.mjs:72` | none | **1 AI call per request**, 30k-char CV text |
| `POST /api/cover-letter` | `api/cover-letter.mjs:411` | none | **AI call** |
| `POST /api/ats-analysis` | `api/ats-analysis.mjs:97` | none (client-supplied `ai.consent`) | **up to 20 AI calls** (`:203`, `:218`) |
| `POST /api/cv-improvement` | `api/cv-improvement.mjs:58` | none | deterministic today; AI sub-routes are dead (§4) |
| `POST /api/job-details` | `api/job-details.mjs:257` | none | AI translation + Apify enrichment, **per-IP quota exists** (`:202`) |
| `GET /api/models` | `api/models.mjs:7` | none | public metadata |
| `ANY /api/alerts` | `api/alerts.mjs:22` | none | subscribe / **unsubscribe by email** / count |
| `GET /api/usage` | `api/usage.mjs:44` | token (`x-usage-token` / Bearer, `:17–22`) | diagnostics |
| `POST /api/cron/digest` | `api/cron/digest.mjs:70` | `CRON_SECRET` / `x-vercel-cron`, **fails open** (`:59–67`) | **sends emails to all subscribers** |

RIS BFF routes (`/api/ris/*`) are the positive counter-example: **no CORS
header at all** (`grep -rn "Access-Control" api/ris api/_lib/ris` → no
matches), so browsers block cross-origin calls. They are bearer-authenticated
(Cognito access token, `api/_lib/ris/auth.mjs:56`, verified in each handler,
e.g. `api/_lib/ris/cvsHandler.mjs:106`) and additionally gated by
`RIS_TEST_USER_ALLOWLIST` (`api/_lib/ris/config.mjs:67`).

The analysis v1 API is also service-to-service only: HMAC-signed
`x-analysis-token`, scopes, signed consent, schema version, 64 KB JSON /
4 MB PDF caps, default-off (`api/_lib/analysis/security.mjs:17–18,162–187`;
`api/_lib/analysis/handlers/cvParse.mjs:11–23`), and it does **not** set CORS
(`sendEnvelope`, `security.mjs:78–100`).

### 3.2 Is this a credential leak?

**No.** There is no credential-bearing request mode that `*` exposes:

- No `Access-Control-Allow-Credentials` anywhere (`grep` → no matches).
- No cookie-based authentication. Cookies are only *cleared* on legacy
  cookie-free endpoints (`api/jobs.mjs:43–45`, `api/match.mjs:58–60`,
  `api/job-details.mjs:264–266`).
- User authentication is bearer-token based and only used against the RIS BFF,
  which sets no CORS header (`src/lib/cvStorageApi.ts:90`,
  `src/lib/searchProfilesApi.ts:90`, `src/lib/risConsentApi.ts:60`,
  `src/lib/accountErasureApi.ts:42`,
  `src/lib/applications/risRemoteRepository.ts:181`).

A malicious origin therefore cannot read another user's data or steal a
session. The concrete risks are different:

1. **Cost / availability abuse (primary risk).** Any website can drive the
   unauthenticated AI endpoints from its visitors' browsers and read the
   responses. Because the only global guard is the monthly provider cap
   (`openRouterMonthlyMaxRequests` default 1000,
   `api/_lib/config.mjs:91–94`; `edenaiMonthlyMaxRequests` default 200,
   `:156–159`; enforced in `api/_lib/providers/index.mjs:77` via
   `limitReached()`), an attacker can exhaust the month's AI budget and make
   matching/cover letters/profile extraction fail for real users.
2. **Third-party embedding.** The endpoints behave as a free public API; there
   is no origin/attribution/rate contract.
3. **State-changing cross-origin calls.** `/api/alerts` (`POST`/`DELETE`) and
   `/api/cron/digest` (`POST`) are reachable from any origin.
4. **Job scraping / upstream quota.** `/api/jobs` returns aggregated job data
   and consumes Apify/Arbeitnow budget (Apify is bounded by
   `APIFY_MONTHLY_MAX_RUNS`).

### 3.3 Missing abuse protection (root cause of S2)

- Per-IP quota exists (`api/_lib/ipQuota.mjs`) and is used by
  `api/job-details.mjs:202` and the job sources, but it is **disabled unless
  `IP_QUOTA_ENABLED=true`** (`ipQuota.mjs:46–51`), and deriving a scope also
  requires `MJ_IP_QUOTA_SECRET` (`api/_lib/ip.mjs:100–104`, returns `null`
  when absent → no quota). Neither variable appears in `.env.example` or
  `docs/DEPLOYMENT.md` (`grep -rn "IP_QUOTA"` only hits code/tests).
- `/api/profile`, `/api/match`, `/api/cover-letter`, `/api/ats-analysis` do
  **not** call the IP quota at all.
- `/api/ats-analysis` amplifies: `Promise.allSettled(recommendations.map(...))`
  (`api/ats-analysis.mjs:203–220`) with requirements capped at 20
  (`api/_lib/ats.mjs:669`), i.e. up to 20 external AI formulation calls for one
  request that only needs `ai.enabled === true` and `ai.consent === true` from
  the body (`api/ats-analysis.mjs:115–121`).

**Live header evidence** (`curl -X OPTIONS https://www.mays-job-matcher.app…`):
`/api/jobs`, `/api/match`, `/api/profile`, `/api/cover-letter`,
`/api/ats-analysis`, `/api/job-details`, `/api/models`, `/api/alerts`,
`/api/cv-improvement`, `/api/usage`, `/api/cron/digest` all returned
`access-control-allow-origin: *`. `/api/ris/cvs`, `/api/ris/applications`,
`/api/ris/consents` returned **no** CORS header.

---

## 4. CV-improvement routing

### 4.1 Implemented routes vs. deployed routes

`api/cv-improvement.mjs` dispatches one handler by URL suffix:

- `api/cv-improvement.mjs:70` → `/apply`
- `:71` → `/reanalyze`
- `:72` → `/match-impact`
- otherwise → deterministic improvement plan

`vercel.json` contains **no** rewrite for `cv-improvement` (see the
`rewrites` array). Vercel filesystem routing exposes only
`/api/cv-improvement` for `api/cv-improvement.mjs` — not nested paths.

The client, however, calls the `/v1/` paths:

- `src/api.ts:526` → `/api/v1/cv-improvement`
- `src/api.ts:556` → `/api/v1/cv-improvement/apply`
- `src/api.ts:637` → `/api/v1/cv-improvement/reanalyze`
- `src/api.ts:692` → `/api/v1/cv-improvement/match-impact`

This mismatch is already documented internally at
`docs/API_CV_IMPROVEMENT.md:3` ("kein `api/v1/`-Verzeichnis und kein Rewrite →
404-Risiko") and `docs/API_CONTRACT.md:42,80`.

**Live verification (2026-11-26):**

| Request | Result |
| --- | --- |
| `OPTIONS /api/cv-improvement` | `204` + `access-control-allow-origin: *` |
| `OPTIONS /api/cv-improvement/apply` | `404` (`x-vercel-error: NOT_FOUND`) |
| `OPTIONS /api/cv-improvement/reanalyze` | `404` |
| `OPTIONS /api/cv-improvement/match-impact` | `404` |
| `OPTIONS /api/v1/cv-improvement` | `404` |
| `OPTIONS /api/v1/cv-improvement/apply` | `404` |

Consequence: the UI actions that call `applyCvImprovement` /
`computeMatchImpact` (`src/App.tsx:2388`, `src/App.tsx:2552`) fail with a 404 in
production. The server-side `/apply`, `/reanalyze`, `/match-impact` branches
are dead code in the deployed artifact.

### 4.2 Authorization

- The reachable `/api/cv-improvement` branch is deterministic
  (`analyzeJobForAts` + `generateImprovementPlan`, `api/cv-improvement.mjs:216–247`)
  and persists nothing. No auth is strictly required for it.
- `/apply` returns the caller's own `profile` back; no cross-user read/write,
  no IDOR.
- `/match-impact` is **not** deterministic: it calls
  `computeMatchForJob` twice (`api/cv-improvement.mjs:93,99`), and
  `computeMatchForJob` → `computeMatch` → `chat()` (`api/_lib/matching.mjs:80,134`)
  performs external AI requests. If the route were exposed (rewrite added, or
  deployed under a different runtime where `req.url` keeps the suffix), it
  would be an unauthenticated, 2-AI-call-per-request endpoint with wildcard
  CORS and no IP quota.
- `/reanalyze` is deterministic (`analyzeJobForAts` twice) but still
  unauthenticated.

### 4.3 Endpoint confusion

- `req.url.endsWith("/apply")` is a fragile router. It also means the *base*
  URL can never return the plan if a proxy appends a matching suffix.
- **Tested and not exploitable on Vercel today:** a query string such as
  `POST /api/cv-improvement?x=/match-impact` still executed the **base** branch
  (`{"error":"Profile must be an object"}` instead of the match-impact
  validator's `"Original profile must be an object"`), and
  `?q=/reanalyze` also hit the base branch. Vercel does not include the query
  string in the dispatched `req.url` here.
- Latent bug: the base branch re-reads the stream
  (`api/cv-improvement.mjs:213`, `const body2 = req.body || (await readBody(req))`)
  after `:79` already consumed it. With no platform body parser, this would
  hang until the 60 s function timeout. On Vercel `req.body` is always set, so
  the live probe returned `400` in 0.4 s.
- Adjacent routing bug (not cv-improvement, but same review surface):
  `api/ats-analysis.mjs:83` uses `require("./_lib/model.mjs")` inside an ESM
  module. If the legacy ATS AI path runs (`ai.enabled && ai.consent`), this
  throws `ReferenceError: require is not defined`. Not exploitable beyond a
  500, but it breaks the feature.

### 4.4 Body size

`readBody()` in `api/cv-improvement.mjs:14–26` accumulates chunks with no
limit. Same pattern exists in 8 legacy endpoints (grep `function readBody`).
The only bound is Vercel's platform request-body limit (~4.5 MB). By contrast:

- RIS BFF caps JSON at 20 KB (`api/_lib/ris/cvsHandler.mjs:11`,
  `api/_lib/ris/searchProfilesHandler.mjs:16`,
  `api/_lib/ris/consentsHandler.mjs:59`) and applications at 200 KB
  (`api/_lib/ris/applicationsHandler.mjs:17`).
- Analysis v1 caps JSON at 64 KB and PDF at 4 MB
  (`api/_lib/analysis/security.mjs:17–18`, enforced in
  `readJsonBody`/`readRawBody`, `:261,289`).

### 4.5 Sensitive data in logs

- `api/cv-improvement.mjs:254` logs the raw `Error` object. There is no
  `console.log(req.body)`, no profile/CV text, no job description.
- Reached errors are controlled messages; the match-impact branch is not
  reachable, so no profile data reaches an AI provider from this endpoint
  today.
- General pattern worth tightening: provider error text is logged
  (`api/_lib/providers/openrouter.mjs:349–365,373–378`, excerpt ≤180 chars) and
  legacy endpoints log the whole `err`. It is not user data by construction,
  but upstream messages can echo request fragments.
- Positive example: `/api/jobs` logs only error metadata and parameter names,
  never values (`api/jobs.mjs:92–112`).

**Verdict for item 2:** no authorization bypass and no sensitive-data logging
in the reachable cv-improvement path. The real issues are dead/incorrect
routing (S4), missing body cap (S5), and a latent unauthenticated AI path if
the sub-routes are ever exposed.

---

## 5. `Math.random()` inventory

`src/lib/secureRandomId.ts` provides `secureRandomIdSuffix()` based on
`crypto.getRandomValues` and throws when no secure source exists
(`secureRandomId.ts:13–24`). It is used by
`src/lib/cvProfileStore.ts:68` and `src/lib/manualSearchProfiles.ts:159` only.

### 5.1 Security-adjacent (but not exploitable today)

All of these prefer `crypto.randomUUID()` and fall back to
`Date.now()` + `Math.random()` only when `crypto.randomUUID` is unavailable
(non-secure context / old runtime). None is used as an authentication or
authorization token; none grants access to another user's data.

| File:line | Value | Why it is not a vulnerability | Recommendation |
| --- | --- | --- | --- |
| `src/lib/cvBuilder/workspaceHandoff.ts:152` | hand-rolled UUID v4 for the same-origin CV-builder handoff id (URL param + `postMessage` correlation) | postMessage is origin-checked; an attacker cannot read a cross-origin tab URL or its messages | Use `crypto.randomUUID` only, or fail closed; replace fallback with `secureRandomIdSuffix` |
| `src/lib/cvBuilder/contractTypes.ts:83` | draft/entry ids | local state only | same |
| `src/lib/cvBuilder/profileTypes.ts:44` | `cvb-…` profile ids | local + server returns its own id | same |
| `src/lib/applications/manualJob.ts:47` | manual job id | local session list key | same |
| `src/lib/applications/sessionRepository.ts:52` | local application id | session storage key | same |
| `src/lib/applications/risRemoteRepository.ts:54` | RIS idempotency key (`ris-…`) | server scopes idempotency per authenticated user; key is not a bearer credential | Prefer server-issued/secure key; low risk |
| `src/components/ApplicationMigrationDialog.tsx:23` | migration key | local de-duplication | same |
| `src/components/ApplicationsSection.tsx:101` | local id | local list | same |
| `src/components/ApplicationLetterComparison.tsx:67` | letter version id | local | same |
| `src/App.tsx:933,1222` | CV/letter document ids | local session | same |
| `src/App.tsx:1920` | operation token (`${doc.id}:${Date.now()}:${Math.random()}`) | only guards stale async results in one tab; not a secret | Can keep; not a security boundary |
| `api/_lib/analysis/cvParser.mjs:498` | server parse-result id | not used for authz; analysis API is HMAC-authenticated separately | Prefer `randomUUID` (already first) — fallback is dead under Node 22 |

### 5.2 Harmless UI randomness (do not change)

| File:line | Use |
| --- | --- |
| `src/components/ModelSelector.tsx:75` | DOM `id` for an accessible listbox |
| `src/components/MatchPulse.tsx:38,70,77` | animation timing/jitter |
| `src/components/JobStream.tsx:480` | auto-note scheduling jitter (avoid thundering herd) |
| `tests/api/analysis-v1-foundation.test.mjs:34,49` | synthetic test ids |

**Verdict for item 3:** no security-relevant `Math.random` use remains. The
CodeQL `js/insecure-randomness` class is not triggered by these because the
values are not used in a security-sensitive context. Consistency cleanup is
Low priority.

---

## 6. Historical CodeQL findings

### 6.1 Active category

`codeql.yml` analyzes exactly one language:

- `codeql.yml:40` → matrix `language: javascript-typescript`,
  `build-mode: none` (`:39` in the same matrix)
- `codeql.yml:84` → upload `category: "/language:${matrix.language}"`

Latest analysis on `main` (GitHub API, `code-scanning/analyses`):

| Analysis | Category | Results | Commit | Created |
| --- | --- | --- | --- | --- |
| `2251450331` | `/language:javascript-typescript` | **0** | `ee2ce6f` | 2026-11-25T20:47:19Z |
| `2251302508` | `/language:javascript-typescript` | 0 | PR #70 merge | 2026-11-25T20:24:56Z |
| `2251097925` | `/language:javascript-typescript` | 0 | `776112b` | 2026-11-25T19:55:22Z |
| `2250706879` | `/language:javascript-typescript` | 0 | `b4157e5` | 2026-11-25T18:59:40Z |

`c63911f` (this branch's base) is docs-only, so CodeQL's path filter
(`.github/workflows/codeql.yml:6–10`) intentionally does not re-run; the last
code state remains `ee2ce6f` with 0 results.

### 6.2 Retired categories — why "21 open" is misleading

`GET /repos/maynowak/mays-jobsearch/code-scanning/alerts?state=open` returns
**21** alerts. For each of the 21, the `instances` endpoint shows:

- 1 open instance in `/language:javascript` (**retired**)
- 1 open instance in `/language:typescript` (**retired**)
- the current `/language:javascript-typescript` instance is **`fixed`**

Summary of the 42 open instances: `{'/language:javascript': 21,
'/language:typescript': 21}`. **No alert has an open current-category
instance.** 0 alerts are dismissed; 88 alerts are `fixed`, all in
`/language:javascript-typescript`.

Alert mix (still counted as open globally):

| Rule | Severity | Count | Example location |
| --- | --- | --- | --- |
| `js/unused-local-variable` | note | 11 | `api/ats-analysis.mjs:2` |
| `js/identity-replacement` | warning | 6 | `src/lib/jobMeta.ts:71–76` |
| `js/incomplete-url-substring-sanitization` | warning | 3 | `tests/api/apify-actor.test.mjs:57` |
| `js/xss-through-dom` | warning | 1 | `src/lib/safeHtml.tsx:7` (latest js-typescript instance fixed on `df1fe01`) |

Current code is consistent with the active 0: the only
`dangerouslySetInnerHTML` sink is `src/lib/safeHtml.tsx:159`, fed by
`DOMPurify.sanitize` with an explicit tag/attribute allowlist and
`ALLOW_DATA_ATTR: false` (`safeHtml.tsx:106–139`), and the cover-letter
renderer is text-only (`src/lib/jobDescriptionReview.ts:104`).

### 6.3 Required wording

- ✅ Allowed: "0 open findings in the active
  `/language:javascript-typescript` category (analysis `2251450331`,
  `ee2ce6f`)."
- ❌ Not allowed: "0 open CodeQL alerts" — GitHub still reports 21 open
  alerts backed only by retired-category instances.

Triage recommendation: either leave them as historical evidence, or dismiss
each with reason "retired category; current category instance fixed" **with an
explicit, auditable decision**. Do not silently dismiss to make a dashboard
green.

---

## 7. Build and chunk analysis

`npm run build` (`tsc -b && vite build`) completed **PASS** on this worktree.

### 7.1 Exact warning text

```
[INEFFECTIVE_DYNAMIC_IMPORT] src/lib/pdf.ts is dynamically imported by
src/components/CvBuilderImportDialog.tsx but also statically imported by
src/App.tsx, src/components/CvBuilderImportDialog.tsx, src/components/LetterModal.tsx,
dynamic import will not move module into another chunk.

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking:
  https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

No `chunkSizeWarningLimit` was changed; thresholds remain at the default.

### 7.2 Emitted chunks (Vite 8.2.1, rolldown)

| Asset | Size | gzip |
| --- | --- | --- |
| `dist/assets/main-D65sivwN.js` | **1,623.90 kB** | **444.25 kB** |
| `dist/assets/pdfExport-BRMMMH8r.js` | **1,140.45 kB** | **508.08 kB** |
| `dist/assets/main-xGYIEwfW.css` | 279.38 kB | 48.29 kB |
| `dist/assets/pdf.worker.min-CHFwMXne.mjs` | 1,262.39 kB | (asset, fetched on demand) |
| `dist/assets/jm-profile-waves-BuZ4DJg_.webp` | 615.90 kB | — |
| `dist/assets/DejaVuSans-uCh15Ap1.ttf` | 759.72 kB | — |
| `dist/assets/DejaVuSans-Bold-D5xQDVUG.ttf` | 708.92 kB | — |
| `dist/assets/DejaVuSerif-DghJTtZ-.ttf` | 380.66 kB | — |
| `dist/assets/DejaVuSerif-Bold-Cx_8Lz6X.ttf` | 356.66 kB | — |
| `dist/assets/Futuristische_Lobby_mit_holografischen_Displays-BZXP6YGX.png` | 2,672.03 kB | — |
| `dist/assets/job-matcher-next-step-CR_eHHHN.png` | 1,795.35 kB | — |
| `dist/assets/job-matcher-next-step-searchpage-DBhP2L1q.png` | 1,700.24 kB | — |
| `dist/assets/Futuristische_Stadt_im_blauen_Abendlicht2-6mwq4ooo.png` | 1,640.16 kB | — |

`main` is the only chunk above the 500 kB threshold that is **eagerly loaded
on every route**. `pdfExport` is above the threshold but is a dynamic import
(`src/components/CvBuilderEditor.tsx:871,911`) and is only fetched on PDF
export — the warning is expected and acceptable there.

### 7.3 Composition (diagnostic build only)

To attribute the `main` chunk, a throwaway config in `/tmp` (not in the repo,
not committed) rebuilt with `manualChunks`:

| Probe chunk | Size | gzip |
| --- | --- | --- |
| app + remaining vendor (`main`) | 907.14 kB | 228.41 kB |
| `pdfjs-dist` | **427.28 kB** | **127.56 kB** |
| react + scheduler | 260.90 kB | 77.72 kB |
| `dompurify` | 26.80 kB | 10.65 kB |
| `pdf-lib` + `fontkit` | 1,131.87 kB | 504.87 kB |
| `pdfExport` glue | 8.62 kB | 3.35 kB |

`grep -o "pdfjs" dist/assets/main-D65sivwN.js | wc -l` → **64** matches, and
`pdf.worker.min` is a separate 1.26 MB asset. So ~26 % of the eager JS (and
~29 % of its gzip weight) is the PDF *reader*, pulled in only because
`src/lib/pdf.ts` is statically imported by `App.tsx:9`,
`LetterModal.tsx:24` and `CvBuilderImportDialog.tsx:5`, while
`CvBuilderImportDialog.tsx:222` also imports it dynamically.

### 7.4 Is lazy loading / splitting justified?

Yes, for `main`:

- The CV-builder, dashboard/profile and applications surfaces are heavy but
  not needed on the landing/search first paint. There is **no**
  `React.lazy`/route-level dynamic import anywhere in `src/` (`grep -rn
  "React.lazy\|lazy(" src` → none); `App.tsx` statically imports 40+ components
  (`src/App.tsx:11–73`), including `CvBuilderEditor` and
  `ApplicationsSection`.
- Fixing the `pdf.ts` import alone moves 427.28 kB (127.56 kB gzip) out of
  the initial bundle without changing behavior.
- Route-level splitting of `/profil`, `/profil?tab=applications`,
  `/cv-builder/workspace` and the legal pages is justified by the 907 kB
  app chunk and the route separation already present in `vercel.json`
  rewrites.

Not justified / keep as is:

- `pdfExport` is already lazy; do not inline it.
- `pdf.worker` is fetched only when parsing a PDF; keep.
- Raising `chunkSizeWarningLimit` would hide the signal — explicitly **not**
  recommended.

### 7.5 CSS and images

- Both `index.html` and `app.html` load `styles.css` + `landingpage2.css`
  (`index.html:37–38`, `app.html:9–10`), producing one 279.38 kB / 48.29 kB gzip
  bundle for every route, including `/profil` and the CV workspace
  (`src/styles.css` = 376,949 bytes; `landingpage2.css` = 26,630 bytes).
- `LandingPage2.tsx:2` imports the 1,640.16 kB PNG directly and uses it as a
  `backgroundImage` (`:240`), so the landing hero downloads that PNG on first
  paint. Other large PNGs are `image-set` fallbacks behind WebP
  (`src/styles.css:1630–1631,1673–1674,1712–1713,1780–1781,2601–2602`); modern
  browsers pick WebP, but the PNGs still ship in `dist` and are one cache-miss
  away.
- PDF fonts (DejaVu, ~2.2 MB total) are only referenced from the lazy
  `pdfExport` module, so they are not part of the initial load — good.

---

## 8. Prioritized recommendations

### 8.1 Security-critical (do first)

1. **S1 — Fail closed on `/api/cron/digest`.** Require `CRON_SECRET` and
   verify `Authorization: Bearer` with a timing-safe compare; remove the
   unconditional `x-vercel-cron` trust (or accept it only in addition to the
   secret). Update `docs/DEPLOYMENT.md:119` from "Optional" to "Required" and
   `.env.example:110–111`. Add a unit test for missing/wrong/valid secret.
   *Files:* `api/cron/digest.mjs:59–67`, docs.
2. **S2 — Bound AI cost per client.** Enable the existing IP quota by default
   for `/api/profile`, `/api/match`, `/api/cover-letter` and `/api/ats-analysis`
   (reuse `api/_lib/ipQuota.mjs`), document `IP_QUOTA_ENABLED` /
   `MJ_IP_QUOTA_SECRET` / window limits in `.env.example` and
   `docs/DEPLOYMENT.md`, and cap the ATS formulation fan-out (e.g. max 5
   recommendations per request) or gate it behind the authenticated analysis
   API. Keep the global monthly cap as a backstop.
3. **S2/S3/S8 — Replace wildcard CORS where it is not a product contract.**
   Add an origin allowlist for `/api/cron/digest`, `/api/alerts` and
   `/api/usage` at minimum (`Vary: Origin`, explicit
   `Access-Control-Allow-Origin`). For the AI endpoints, either intentionally
   document them as a public API **with rate limits** or restrict origins.
4. **S3 — Authenticate unsubscribe.** Issue a signed, per-subscriber
   unsubscribe token (HMAC of email + secret) in the digest email and require
   it for `DELETE`; keep `POST` rate-limited; stop exposing the subscriber
   count publicly. *File:* `api/alerts.mjs:21–60`,
   `api/_lib/alerts.mjs:60–62`.
5. **S4 — Resolve cv-improvement routing.** Choose one:
   (a) add explicit rewrites for `/api/v1/cv-improvement` + sub-routes and
   protect/limit the AI sub-route, or (b) remove the dead client calls and the
   unreachable branches. In both cases replace the `endsWith()` dispatch with
   an explicit body/query `action` allowlist, add a 64 KB body cap, remove the
   duplicate `readBody`, and add a route test that asserts the deployed path.
6. **S5 — Add body caps to legacy endpoints.** Adopt the analysis v1
   `MAX_JSON_BYTES` (64 KB) or RIS limits (20 KB/200 KB) in the shared
   `readBody` helpers; return `413` with a friendly `{error, code}`.
7. **S6 — Use `secureRandomIdSuffix()` for the remaining ID fallbacks** (or
   fail closed). Keep `MatchPulse`/`JobStream`/`ModelSelector` randomness.
8. **S7 — Reduce logging surface.** Log error name/code plus a request id,
   not whole `Error` objects; keep provider excerpts behind a debug flag.
9. **CodeQL hygiene.** Keep the active category at 0 and state the exact
   category/analysis id in release reports. Decide explicitly whether the 21
   retired-category alerts are documented or dismissed with a reason; do not
   present a bare "0 alerts" claim.

### 8.2 Performance (separate track, no security impact)

1. **P1 — Make PDF parsing lazy.** Remove the static `extractPdfText` imports
   from `src/App.tsx:9` and `src/components/LetterModal.tsx:24` (and the static
   import in `CvBuilderImportDialog.tsx:5`), using the existing dynamic import
   path. Expected: `main` 1,623.90 → ~1,196 kB (gzip 444 → ~317 kB), removing
   the `INEFFECTIVE_DYNAMIC_IMPORT` warning.
2. **P2 — Route-level code splitting.** `React.lazy` + `Suspense` for the
   dashboard/profile (`/profil`), applications tab, CV-builder workspace and
   legal pages. Target: halve the 907 kB app chunk for non-dashboard routes.
3. **P4 — Split CSS per shell/route.** The landing shell does not need the
   dashboard/CV styles; the app shell does not need `landingpage2.css`.
4. **P5 — Replace/compress the landing hero.** Convert
   `Futuristische_Stadt_im_blauen_Abendlicht2.png` (1,640 kB) to WebP/AVIF with
   responsive `srcset`, and lazy-load below-fold imagery; delete unused PNG
   fallbacks where an equivalent WebP exists.
5. **Keep** the lazy `pdfExport` chunk and separate `pdf.worker`; do not raise
   the 500 kB warning limit.

### 8.3 Suggested follow-up tasks

| Task | Type | Content |
| --- | --- | --- |
| `JM-SECURITY-CRON-AUTH-01` | Security | Fail-closed cron auth + tests + env docs |
| `JM-SECURITY-AI-QUOTA-01` | Security | IP quota on AI endpoints, ATS fan-out cap, CORS/origin contract |
| `JM-SECURITY-ALERTS-AUTH-01` | Security | Signed unsubscribe token, rate limit, remove count |
| `JM-API-CV-IMPROVEMENT-ROUTING-01` | Correctness/Security | Fix or remove `/api/v1/cv-improvement*`; body cap; dispatch allowlist |
| `JM-SECURITY-BODY-LIMITS-01` | Security hardening | Shared capped `readBody`, 413 responses |
| `JM-PERF-PDF-LAZY-01` | Performance | Dynamic-only `src/lib/pdf.ts` |
| `JM-PERF-ROUTE-SPLITTING-01` | Performance | `React.lazy` for profile/applications/cv-builder/legal |
| `JM-PERF-ASSETS-CSS-01` | Performance | CSS split + WebP hero + responsive images |
| `JM-SECURITY-CODEQL-TRIAGE-01` | Governance | Document/dismiss retired-category alerts with reasons |

---

## 9. Verification performed

| Check | Result |
| --- | --- |
| `git status --short --branch` | only untracked `node_modules` symlink (pre-existing) |
| `npm run build` (`tsc -b && vite build`) | **PASS**, 367 modules, 2.27 s, warnings above |
| `node --check` on 75 `api/**/*.mjs` files | **PASS** (exit 0) |
| Production `OPTIONS` header probes | as in §3.1 and §4.1 |
| Production deterministic `POST` probes | base route only; no AI call, no write |
| GitHub CodeQL analyses/alerts | as in §6 |
| Product/API/config diff | none (report file only) |

Full test suite was **not** run: this is an analysis-only, docs-only branch and
no code changed. The baseline product behavior is unchanged by this task.

---

## 10. Raw evidence appendix

### 10.1 Build

```
dist/assets/main-D65sivwN.js      1,623.90 kB │ gzip: 444.25 kB
dist/assets/pdfExport-BRMMMH8r.js 1,140.45 kB │ gzip: 508.08 kB
dist/assets/main-xGYIEwfW.css       279.38 kB │ gzip:  48.29 kB
dist/assets/pdf.worker.min-CHFwMXne.mjs 1,262.39 kB
✓ built in 2.27s
```

### 10.2 Production routing probe

```
OPTIONS /api/cv-improvement            -> 204, access-control-allow-origin: *
OPTIONS /api/cv-improvement/apply      -> 404, x-vercel-error: NOT_FOUND
OPTIONS /api/cv-improvement/reanalyze  -> 404
OPTIONS /api/cv-improvement/match-impact -> 404
OPTIONS /api/v1/cv-improvement         -> 404
POST /api/cv-improvement {"job":{"title":"Probe"},"profile":{}}
  -> 200 deterministic plan (base route)
POST /api/cv-improvement?x=/apply {"job":{"title":"Probe"},"profile":{}}
  -> 200 deterministic plan (base route; query suffix not dispatched)
POST /api/cv-improvement?q=/reanalyze {"job":{},"originalProfile":{},"improvedProfile":{}}
  -> 400 "Profile must be an object" (base route; not reanalyze)
POST /api/cv-improvement?x=/match-impact {"job":{}}
  -> 400 "Profile must be an object" (base route; no AI call)
```

### 10.3 CodeQL

```
GET /code-scanning/analyses?per_page=12
2251450331 /language:javascript-typescript  results=0  ee2ce6f  2026-11-25T20:47:19Z
...
GET /code-scanning/alerts?state=open    -> 21
per-alert instances:
  open:   /language:javascript (1), /language:typescript (1)
  fixed:  /language:javascript-typescript (latest instance)
GET /code-scanning/alerts?state=dismissed -> 0
GET /code-scanning/alerts?state=fixed     -> 88 (all js-typescript)
```

### 10.4 CORS grep

```
api/jobs.mjs:40            api/match.mjs:52          api/profile.mjs:72
api/cover-letter.mjs:411   api/cv-improvement.mjs:58 api/ats-analysis.mjs:97
api/job-details.mjs:257    api/models.mjs:7          api/alerts.mjs:22
api/usage.mjs:44           api/cron/digest.mjs:70
api/ris/**, api/_lib/ris/** -> no Access-Control header
```

### 10.5 Randomness grep

```
src/lib/applications/manualJob.ts:47
src/lib/applications/sessionRepository.ts:52
src/lib/applications/risRemoteRepository.ts:54
src/lib/cvBuilder/contractTypes.ts:83
src/lib/cvBuilder/workspaceHandoff.ts:152
src/lib/cvBuilder/profileTypes.ts:44
src/components/ModelSelector.tsx:75
src/components/MatchPulse.tsx:38,70,77
src/components/JobStream.tsx:480
src/components/ApplicationMigrationDialog.tsx:23
src/components/ApplicationsSection.tsx:101
src/components/ApplicationLetterComparison.tsx:67
src/App.tsx:933,1222,1920
api/_lib/analysis/cvParser.mjs:498
```

---

## 11. Explicit statement

**No product code, API code, serverless route, configuration, `package.json`,
build config, shared file, or `docs/AI_AUDITLOG.md` was changed by this task.**
The only change on branch `feature/jm-security-performance-review-01` is this
report. No real user/CV/application data was read or written. No RIS, AWS,
Terraform, Cognito, consent, DNS or storage resource was touched. No main
merge, no deployment, no force-push, no branch deletion.

**AI / Privacy / Data-flow assessment:** the review only read existing code and
public production metadata. No new AI provider, data category, prompt, model
call, consent requirement or retention change was introduced. The identified
risks are existing availability/cost and unauthenticated-state-change issues;
the recommended fixes do not require new personal data processing. Because the
task explicitly forbids editing `docs/AI_AUDITLOG.md`, no audit entry was added
and no product change requires one.
