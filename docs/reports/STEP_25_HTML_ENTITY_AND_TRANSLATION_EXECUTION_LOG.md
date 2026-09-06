════════════════════════════════════════════════════════════════════
EXECUTION LOG — HTML ENTITY RENDERING FIX + DESCRIPTION LANGUAGE
════════════════════════════════════════════════════════════════════

## STATUS

COMPLETED (TASK A + TASK B implemented, validated, deployed)

## AUDIT / WORK DATE

2026-08-31

## GIT BRANCH + HEAD

- Branch: `main`
- HEAD: `0382051  fix: correct HTML entity decoding order for double-encoded descriptions`
- origin/main: `0382051` (matched at session start)

## WORK SCOPE

Two separate tasks:

1. **TASK A (Bug): HTML entity rendering of job descriptions**
   Goal: string input → entity-decode → sanitize → React HTML boundary →
   browser renders real DOM (`<div><p>Hello</p></div>`).
   Symptom: descriptions shown as literal `&lt;div class=&quot;...&gt;`.

2. **TASK B (Feature): Language detection for job descriptions**
   Goal: add server-side language detection and `lang`/`translate`
   HTML attributes so browsers can translate changing (English)
   content while the UI default is German.

==================================================
TASK A — HTML ENTITY RENDERING (COMPLETED)
==================================================

## COMPLETED SECTIONS

1. Verified production identity: footer `2.0.0 · production · 0382051`.
2. Traced full dataflow: API → `description` (HTML) / `descriptionPlain`
   (text) → `RemainingCard` / `MatchCard` → `renderSanitizedHtml`.
3. Identified TWO independent bugs (two separate code paths).

## FINDINGS

### A.1 — Frontend decoder was a no-op (EXPANDED view)

File: `src/lib/safeHtml.tsx` (`decodeHtmlEntities`)

Before (broken):
```js
const temp = document.createElement("div");
temp.innerHTML = current;
const next = temp.innerHTML;   // re-escapes &lt; back to &lt;
```

A `<div>` parses `&lt;` into a literal `<` text node, then `innerHTML`
re-serializes it back to `&lt;`. Net effect: no decoding + accidental
auto-closing of unclosed tags.

After (fixed): use `<textarea>` `.value` (RCDATA — decodes entities
into text without re-escaping). Element cached module-level for perf;
`while` loop capped at 4 iterations for double-encoding.

### A.2 — API preview decoder used literal chars (COLLAPSED preview)

File: `api/_lib/filter.mjs` (`decodeHtmlEntitiesOnce`)

Before (broken — no-ops, never matched):
```js
.replace(/</g, "<")   // matched literal "<" char, not "&lt;"
.replace(/>/g, ">")
.replace(/"/g, '"')
.replace(/&/g, "&")
```

After (fixed):
```js
.replace(/&lt;/g, "<")
.replace(/&gt;/g, ">")
.replace(/&quot;/g, '"')
.replace(/&amp;/g,  "&")
```

This is the routine that produces `descriptionPlain` (the collapsed
preview). It is DISTINCT from the frontend routine — hence the preview
was still broken even after the expanded view was fixed.

## EVIDENCE / FILE REFERENCES

- `src/lib/safeHtml.tsx` — `decodeHtmlEntities` + `decodeHtmlEntitiesOnce`
- `api/_lib/filter.mjs` — `decodeHtmlEntitiesOnce` / `htmlToPlainText`
- `src/lib/safeHtml.test.ts` — 1 stale test corrected (div auto-close
  assumption removed)

## VALIDATION (TASK A)

- `npm test` → 233 passed (233)
- `npx tsc -b` → exit 0
- `npm run build` → built OK
- Deployed to production: `https://mays-job-matcher.vercel.app`
  (new asset hash `index-DFCVi6VZ.js`), twice (second deploy added A.2).
- Verified live: `descriptionPlain` now decodes entities to plain text.

## CLASSIFICATION (TASK A)

GREEN — both bugs fixed, tests pass, deployed, preview + expanded both
render cleanly.

==================================================
TASK B — DESCRIPTION LANGUAGE / BROWSER TRANSLATION (IN PROGRESS)
==================================================

## COMPLETED SECTIONS

1. Confirmed symptom: some descriptions English, some German (raw
   provider content; not translated by the app). Identical previews for
   Anaplan jobs are provider data (same company intro), NOT a bug.
2. Investigated browser-native translation capabilities + limits:
   - No JS API to trigger built-in page translation.
   - `document.documentElement.lang` controls when browsers offer it.
   - `lang` + `translate` attributes per content block help.
3. Decision (user): implement **B** = `lang`/`translate` attributes +
   server-side language detection.

## COMPLETED (IMPLEMENTED)

1. `detectLanguage(text)` added to `api/_lib/filter.mjs`:
   - heuristic EN/DE via word-frequency scoring (German + English stopword lists)
   - returns `"de"` | `"en"` | `undefined` (min. score 3 confidence)
2. `language` field emitted on jobs:
   - `api/_lib/sources/arbeitnow.mjs` (compactJob)
   - `api/_lib/sources/apify/actors.mjs` (normalizeArbeitsagentur)
3. `language?: string` added to `src/types.ts` `Job`.
4. `renderSanitizedHtml(html, lang?)` in `src/lib/safeHtml.tsx` now sets
   `lang` on the `.html-content` wrapper.
5. `RemainingCard` + `MatchCard`: pass `job.language`; preview `<p>` also
   carries `lang`.
6. `index.html` default `lang` changed `en` → `de` (German-first
   consistent with i18n default).

==================================================
## GIT STATUS NOTE (verified)
==================================================

- `src/lib/safeHtml.tsx` untracked (`??`), `src/lib/safeHtml.ts` deleted
  (`D`) — rename in progress, not yet committed.
- Many untracked debug files present; intended to remain out of any commit.
- No commit made this session yet.

## FILES CHANGED (session so far)

TASK A:
- `src/lib/safeHtml.tsx` (new, decode fix)
- `api/_lib/filter.mjs` (entity regex fix)
- `src/lib/safeHtml.test.ts` (stale expectation fix)

TASK B:
- `api/_lib/filter.mjs` (added `detectLanguage`)
- `api/_lib/sources/arbeitnow.mjs` (emit `language`)
- `api/_lib/sources/apify/actors.mjs` (emit `language`)
- `src/types.ts` (`language?: string`)
- `src/lib/safeHtml.tsx` (`renderSanitizedHtml(html, lang?)`)
- `src/components/RemainingCard.tsx` + `src/components/MatchCard.tsx`
- `tests/api/filter.test.js` (`detectLanguage` tests)
- `index.html` (default `lang` de)

## RESUME POINT

TASK A + TASK B implemented, validated, deployed to production.
Live curl confirms `language` field (`en` / `de`) emitted correctly.
Pending: browser verification of dynamic translation behavior + git
commit/push (user confirmation).

## RISKS

- Uncommitted working-tree diverges from deployed code; footer still
  shows `0382051`. Commit + push pending user confirmation.
- Dynamic-content translation behavior unverified (needs browser test).

## RECOMMENDED NEXT ACTIONS

1. Deploy TASK B to production.
2. Browser verification of dynamic translation.
3. Commit TASK A + TASK B cleanly (only relevant files).

==================================================
STEP 25 — LOCAL IMPLEMENTATION REVIEW + COMMIT
==================================================

## PLAN

Review the current uncommitted local implementation of TASK B (language
detection + translation metadata), verify the TASK A HTML rendering
architecture is preserved, confirm test/typecheck/build, then commit and
push ONLY the verified TASK A + TASK B files plus the execution logs.

## GIT STATE (initial)

- HEAD: `0382051ca3b24bbd828bd011bc27135444dd1e9b`
- origin/main: `0382051ca3b24bbd828bd011bc27135444dd1e9b`
- HEAD == origin/main

## VALIDATION (pre-commit)

- `npm test` → 238 passed (238)
- `npx tsc -b` → exit 0
- `npm run build` → built OK (386ms)

## SCOPE DECISIONS (user confirmed)

- EXCLUDE component test + test infra: `RemainingCard.test.tsx`,
  `vitest.setup.ts`, `package.json`/`package-lock.json`
  (`@testing-library/jest-dom`).
- INCLUDE `docs/reports/STEP_24_...EXECUTION_LOG.md` (historical append).

## RESULTS (to be filled)

See final section below.

==================================================
STEP 25 — FINAL RESULT
==================================================

## COMMITTED FILES (13)

1. `api/_lib/filter.mjs` (entity regex fix + detectLanguage)
2. `api/_lib/sources/arbeitnow.mjs` (emit language)
3. `api/_lib/sources/apify/actors.mjs` (emit language)
4. `index.html` (default lang de)
5. `src/components/MatchCard.tsx` (renderSanitizedHtml)
6. `src/components/RemainingCard.tsx` (lang/translate + renderSanitizedHtml)
7. `src/lib/safeHtml.test.ts` (decode/sanitize/render tests)
8. `src/lib/safeHtml.ts` (deleted — renamed to .tsx)
9. `src/lib/safeHtml.tsx` (new — renderSanitizedHtml with lang/translate)
10. `src/types.ts` (language?: string)
11. `tests/api/filter.test.js` (detectLanguage + stripHtml regression)
12. `docs/reports/STEP_24_GERMAN_FIRST_LOCALE_LOCATION_EXECUTION_LOG.md`
13. `docs/reports/STEP_25_HTML_ENTITY_AND_TRANSLATION_EXECUTION_LOG.md`

## VALIDATION RESULTS

- `npm test` → 238 passed (238)
- `npx tsc -b` → exit 0
- `npm run build` → built OK (386ms)

## COMMIT

- Hash: `2038085c77fff4587405c48eedcc2b792da9dd06`
- Message: `feat: add job language detection and browser translation metadata`

## PUSH

- `0382051..2038085  main -> main`
- Remote: `github.com:maynowak/mays-jobsearch.git`

## FINAL GIT STATE

- HEAD: `2038085c77fff4587405c48eedcc2b792da9dd06`
- origin/main: `2038085c77fff4587405c48eedcc2b792da9dd06`
- HEAD == origin/main

## EXCLUDED (intentionally uncommitted)

- `src/components/RemainingCard.test.tsx` (component test)
- `vitest.setup.ts` (referenced by committed `vitest.config.ts`)
- `package.json` / `package-lock.json` (`@testing-library/jest-dom`)
- All `debug_*.ts`, `test_*.mjs`, `tests/api/debug*.test.js`, `tests/screenshotsdev/`,
  `make_double_encoded.mjs`, `temp_write_filter.cjs`, `write_safeHtml.cjs`,
  `ENVIRONMENT_MATRIX.md`, `ROOT_CAUSE_ASSESSMENT.md`, `commit_msg.txt`,
  `docs/AI_AUDITLOG.md`, `src/App.landing.test.tsx`, and historical STEP_23/24
  report files.

## PRODUCTION STATUS

- TASK A + TASK B were previously deployed manually to production. The footer
  may still show the old commit `0382051` because the deployed working tree
  differs from the commit made here. Do not use the footer alone as deployment
  identity.
- This commit brings the Git history in line with the deployed code (TASK B
  included), but does NOT itself redeploy.

## OUTSTANDING

- Browser translation remains a BROWSER-BEHAVIOR verification item (no JS API;
  `lang`/`translate` attributes are the supported mechanism).

==================================================
STEP 26 — LANGUAGE TAG + PROXY PATH + TEST BASELINE AUDIT
==================================================

## PLAN

- Objective: one controlled verification/fix step covering (A) Arbeitnow
  language detection + DOM language metadata, (B) actual proxy/network path,
  (C) fix vitest.setup.ts/jest-dom Git inconsistency, (D) browser-translation
  prerequisites, (E) evidence-based next Apify/cost/proxy plan.
- Current Git baseline: HEAD == origin/main == `6c04f3f`.
- Files expected to inspect:
  - `api/_lib/sources/arbeitnow.mjs`, `api/_lib/filter.mjs`, `api/_lib/sources/apify/*.mjs`,
    `api/jobs.mjs` (api routes), `api/_lib/index` source dispatcher
  - `src/components/RemainingCard.tsx`, `MatcchCard.tsx`, `src/lib/safeHtml.tsx`
  - `vitest.config.ts`, `vitest.setup.ts`, `package.json`, `package-lock.json`
  - `vercel.json`, `.env.example`
- Files possibly requiring modification (test infra only): `vitest.setup.ts`,
  `package.json`, `package-lock.json` (and `vitest.config.ts` only if strictly needed).
- Explicit exclusions: no proxy config changes, no Actor changes, no Azure/Terraform
  changes, no translation API, no application behavior changes, no deployment of
  product changes, no cleanup of debug artifacts.
- Planned sequence: baseline → API verification → live DOM verification → browser
  prereq doc → proxy trace → Apify execution path → vitest.setup.ts fix → validation
  → focused test-infra commit → push → next work package plan.

## GIT STATE (baseline)

- HEAD: `6c04f3f1fea2ccca015e6002ef2a6c4aeaba44a5`
- origin/main: `6c04f3f1fea2ccca015e6002ef2a6c4aeaba44a5`
- HEAD == origin/main
- Uncommitted (tracked): `package.json`, `package-lock.json` (jest-dom)
- Untracked: `vitest.setup.ts`, debug/test artifacts, historical reports (unchanged)

## A. ARBEITNOW LANGUAGE VERIFICATION

### A.1 API verification (live production)

`GET https://mays-job-matcher.vercel.app/api/jobs?targetRole=engineer&city=Berlin`
→ HTTP 200, 50 jobs. Sampled:

- Arbeitnow EN jobs → `language: "en"` (e.g. "Full Stack Engineer - Javascript",
  "Backend Engineer", "Data Scientist (f/m/d)")
- Arbeitnow DE jobs → `language: "de"` (e.g. "Full Stack Product Engineer (m/w/d)",
  "Senior Cloud Test & DevOps Engineer (m/w/d)")
- Arbeitsagentur jobs → `language` MISSING (undefined) — see A.2

### A.2 Why Arbeitsagentur jobs have no language

All Arbeitsagentur jobs returned `descriptionPlain: ""` and `description: ""`.
Cause: the Apify Actor is invoked with `includeDetails: false` + `compact: true`
(`api/_lib/sources/apify/actors.mjs` buildInput), so no description text is
fetched. `detectLanguage("")` therefore returns `undefined` (empty-input path).
This is a DATA-AVAILABILITY limitation, NOT a detection defect.

### A.3 Detection pipeline (verified, not assumed)

Arbeitnow path (`api/_lib/sources/arbeitnow.mjs`):
`compactJob()`:
  `descriptionPlain = htmlToPlainText(descriptionHtml)`  → decode + strip HTML
  `language: detectLanguage(descriptionPlain)`           → heuristics on plain text

Confirmed detectLanguage IS invoked in the Arbeitnow path.

Local deterministic check:
- EN html → plain text → detectLanguage → `"en"` ✅
- DE html → plain text → detectLanguage → `"de"` ✅

### A.4 Classification

CASE A — correct: English provider content → `language:"en"`. NOT a bug.

B. DOM language metadata (source-verified)

RemainingCard.tsx passes `job.language` →
  expanded: `renderSanitizedHtml(html, lang)` → `<div class="html-content" lang=... translate=...>`
  collapsed: `<p class="remaining-description" lang=... translate=...>`
safeHtml.tsx `renderSanitizedHtml`: `lang={lang||undefined}`, `translate={lang==="en"?"yes":undefined}`

- EN job → `lang="en" translate="yes"`
- DE job → `lang="de"` (no translate)
- unknown → no lang/translate (undefined)

Language metadata is attached to the rendered content boundary, not to an
unrelated text representation. MatchCard renders AI text (`why`/`prepare`), not
job descriptions, so it correctly does NOT need `job.language`.

C. Browser translation prerequisites

- `<html lang="de">` default set (index.html) ✅
- per-content `lang`/`translate` on description blocks ✅
- LANGUAGE DETECTION = app; LANG/TRANSLATE attr = app; actual translation = browser
- No translation API/engine added. Application-side handling = PASS; browser
  auto-translation remains manual/behavioral.

D. Proxy path trace (verified — NO application proxy exists)

- Arbeitnow: `provider = "direct-api"`, direct `fetch()` to
  `https://www.arbeitnow.com/api/job-board-api` (no proxy).
- Apify: serverless fn calls `https://api.apify.com/v2/...` directly (no proxy).
  Actor `blackfalcondata~arbeitsagentur-jobs-feed` runs on Apify infra; its
  buildInput has NO `proxy` field, and client.mjs sets no proxy options.
- `vercel.json` `rewrites` = only SPA route `/top` → `/index.html` (not a proxy).
- Upstash Redis = data store (cache/alerts), not a proxy.
- No `/api/proxy`, no forwarding handler, no CORS-rewriting proxy anywhere in
  the repo (`grep -i proxy/forward/rewrite/cors` → only Upstash + vercel rewrite).

Flow (actual):
Browser → /api/jobs (Vercel fn) → source adapter → (direct fetch) → Arbeitnow API
Browser → /api/jobs (Vercel fn) → source adapter → Apify REST → Actor (Apify infra) → target site

The "proxy" the user remembered is the Vercel DEV runtime proxy
(`vercel dev` → http://localhost:3000 → Vite dynamic port), documented in
`docs/reports/TEST_SAFETY_PHASE1_CURRENT.md` — a DEVELOPMENT tooling proxy,
not application code. STEP 25's "no proxy configured" referred specifically to
Apify proxy configuration (PATH B), which is accurate.

E. Apify execution model (verified)

- Actor: `blackfalcondata~arbeitsagentur-jobs-feed`, `maxJobs: 40`, `maxResults: 40`,
  `mode: "full"`, `includeDetails: false`, `compact: true`.
- Sync execution: start run → poll `waitForRun` up to 50s → read dataset.
- Cache: L1 records cache (TTL 600s) keyed by query+location; L2 dataset reuse
  within `datasetRefreshMs()` (peak 6h / off-peak 12h) — repeated searches reuse
  dataset, avoiding new runs.
- Concurrency: ONE synchronous Actor run per cache-missing request (no parallel
  Actor fan-out).
- Limits: `APIFY_MONTHLY_MAX_RUNS = 30`, soft limit `$4.00` (advisory, via
  `apifyRunLimitReached()` guard). Concurrency of runs ≠ proxy IP count.

F. Apify proxy requirement (no change)

- No 403/429/CAPTCHA/blocking evidence in code/logs.
- Actor doc not inspected to require proxy; buildInput has no proxy field.
- RECOMMENDATION: APIFY PROXY = NOT REQUIRED CURRENTLY. No config change made.

G. vitest.setup.ts / jest-dom verification

- `vitest.config.ts` (committed) has `test.environment = "jsdom"` and
  `setupFiles = ["./vitest.setup.ts"]`.
- `vitest.setup.ts` (UNtracked) imports `@testing-library/jest-dom` and sets
  `globalThis.expect/vi`.
- `package.json`/`lock` (UNcommitted) add `@testing-library/jest-dom@^7.0.1`.
- No committed test uses any jest-dom matcher (grep = NONE) and none uses
  `globalThis.vi`/`expect`. jest-dom is used only by the UNcommitted
  `RemainingCard.test.tsx`.
- Inconsistency: committed config references an untracked setup file whose
  import depends on an uncommitted package → fresh checkout `npm test` fails.
- DECISION: commit `vitest.setup.ts` + jest-dom dependency so the committed
  config→setup→dependency chain is complete and self-consistent (matches the
  requirement "do not depend on an untracked local file").

## STEP 26 — FINAL RESULT

### Test-infra commit
- Hash: `1dc7ef8d1ad6ff58fbc867d49be748ebdac412ea`
- Message: `test: commit shared Vitest DOM setup`
- Files: `vitest.setup.ts` (new), `package.json`, `package-lock.json` (jest-dom)
- Push: `6c04f3f..1dc7ef8  main -> main`
- HEAD == origin/main == `1dc7ef8`

### Validation (local working tree)
- `npm test` → 238 passed (25 files)
- `npx tsc -b` → exit 0
- `npm run build` → built OK (367ms)
- `git diff --check` → clean

### Fresh-checkout reproducibility (verified via clean clone)
- `git clone --depth 1 --branch main` → HEAD `1dc7ef8`
- `npm install` → 123 packages, 0 vulnerabilities
- `npm test` → 21 files, 230 passed (no missing-setup error)
- Confirms the committed repo no longer depends on an untracked setup file.

### A. Arbeitnow language — PASS
- EN provider → `language:"en"` → `lang="en" translate="yes"` on DOM.
- DE provider → `language:"de"` → `lang="de"`.
- Arbeitsagentur jobs have empty descriptions (`includeDetails:false`) so
  `language` is `undefined` — data-availability limitation, not a defect.

### B. Browser translation — app prerequisites PASS; manual browser check still required
### C. Project proxy — NONE (direct fetch; Vercel dev runtime proxy is tooling only)
### D. Apify proxy — not configured, not required currently (no blocking evidence)
### E. Apify cost/scaling — 1 sync Actor run per cache-miss, 600s L1 cache, L2 dataset
   reuse (6h/12h), monthly max 30 runs / $4 soft limit
### F. Test baseline — COMMITTED (`1dc7ef8`), fresh checkout verified

No deployment performed (test-infrastructure-only change; no product behavior change).

==================================================
STEP 27 — APIFY ARBEITSAGENTUR IST-ZUSTAND DIAGNOSE (read-only)
==================================================

## PLAN

Diagnose ONLY why the Job-Matcher UI shows only Quelle=Arbeitnow and no
Arbeitsagentur/Apify jobs. Inspection only, no code change, no Actor run,
no includeDetails change, no proxy work.

## GIT STATE

- HEAD == origin/main == `07ffdb3` (working tree has only untracked debug/artifact files)

## ACTION / RESULT — call + merge path traced

1. Apify adapter IS called on a normal search: live `/api/jobs` returns
   `meta.apify = {enabled:true, reason:null}`, `meta.sources = {arbeitnow:17, arbeitsagentur:40}`,
   `sourceDetails` lists arbeitsagentur `provider:"apify" enabled:true`.
2. Enable/disable: `JOB_SOURCE_ARBEITSAGENTUR_ENABLED` (default true) +
   `APIFY_API_TOKEN`. Both active in prod (source enabled, 40 rows fetched).
3. No timeout / missing env / disabled source / empty result: 40 AA rows are
   fetched and merged (`dedupJobs`), so the skip is NOT in the source/cache path.
4. Source id set in `api/_lib/sources/apify/actors.mjs` → `SOURCE_ID = "arbeitsagentur"`,
   `source: [SOURCE_ID]` in `normalizeArbeitsagentur`.
5. THE FILTER that removes AA results: `fetchAllJobs` → `applySearchFilters`
   (`api/_lib/filter.mjs`) with the API query `employmentType`.

## ROOT CAUSE (proven by live API)

The app default profile sets `employmentTypes: ["full_time"]`
(`src/App.tsx` initial `profile`), so every default search sends
`employmentType=full_time`.

`employmentMatches(job, ["full_time"])`:
- collects `job.jobTypes` + `job.contractType` into `jobEmploymentTokens`.
- AA jobs have `jobTypes = null` (normalize does not set jobTypes) and
  `contractType ∈ {KEINE_ANGABE (29), UNBEFRISTET (9), BEFRISTET (1)}`.
- full_time aliases = {full_time, fulltime, full-time, full time, vollzeit, full-time position}.
- German contract types (unbefristet/befristet/keine_angabe) are NOT in the alias
  set → `employmentMatches` returns false → AA jobs dropped.

Live proof:
- `GET /api/jobs?...&employmentType=full_time` → jobs by source `{arbeitnow:11}` (0 AA).
- `GET /api/jobs?...` (no employment filter) → jobs by source `{arbeitnow:16, arbeitsagentur:39}`.

Contrast: Arbeitnow jobs carry `jobTypes` like "Full Time"/"Full time"/"fulltime
permanent" which DO match the aliases, so they survive the filter.

## SECONDARY OBSERVATION (not fixed)

- `KEINE_ANGABE` ("not specified") is treated as a non-matching employment token
  and thus filtered out, even though "no data" arguably should pass (the code
  already passes jobs with a truly empty token set). This is a mapping gap.
- The code conflates CONTRACT type (UNBEFRISTET/fixed-term) with EMPLOYMENT type
  (full/part-time) in `jobEmploymentTokens`; the alias list only covers employment
  terms. This conflation contributes to the misclassification.

## SEPARATION (only existing evidence)

- A) Why no AA jobs appear: default `employmentType=full_time` filter removes AA
  jobs because their employment/contract tokens don't match. PROVEN.
- B) What includeDetails:false yields: no description/tags (`descriptionPlain=""`,
  `tags=[]`), so `language` is `undefined` and AI keyword matching relies on title only.
- C) Whether includeDetails:true is desirable later: NOT evaluated (out of scope).
- D) Cost of includeDetails:true: NOT evaluated (no pricing assumption made).

## STATUS — no code change, awaiting review

STEP 27 = DIAGNOSIS COMPLETE. STOP.

==================================================
STEP 28 — EMPLOYMENT-/CONTRACT-TYPE SEMANTIK (read-only)
==================================================

## PLAN

Analyze the employmentType filter logic fachlich + technisch after STEP 27
proved Arbeitsagentur jobs are filtered out. NO code change. Produce Ist-Analyse
+ decision matrix.

## GIT STATE

- HEAD == origin/main == `14ccef6` (before this step's log commit)

## IST-ANALYSE

### 1. UI values for employmentType
- `EMPLOYMENT_TYPES = ["full_time", "part_time"]` (`src/types.ts`).
- UI checkbox group (`SearchForm.tsx`); labels EN "Full time"/"Part time",
  DE "Vollzeit"/"Teilzeit".
- Default profile: `employmentTypes: ["full_time"]` (`App.tsx`).

### 2. Arbeitnow fields
- Single field `job_types` (free-form tag array) → mapped to `job.jobTypes` in
  `arbeitnow.mjs compactJob`. NO separate contract field (verified raw API: keys
  are only company_name, created_at, description, job_types, location, remote,
  slug, tags, title, url).
- `job_types` is HETEROGENEOUS: mixes employment scope ("Full Time","Part time",
  "fulltime permanent"), contract duration ("Permanent","Temporary","Full-time
  fixed-term"), experience ("Experienced","Entry","Mid","Manager","berufserfahren")
  and other ("Intern","Student","Freelance","Contract","Traineeship").

### 3. Arbeitsagentur fields
- Dedicated `contractType` field (UNBEFRISTET/BEFRISTET/KEINE_ANGABE) in
  `normalizeArbeitsagentur` (`api/_lib/sources/apify/actors.mjs`) — PURELY
  contract duration.
- NO employment-scope field: `jobTypes` is not set (null).

### 4. Employment scope (Vollzeit/Teilzeit/Minijob)
- Arbeitnow: inside `job_types` ("Full Time", "Part time", …).
- Arbeitsagentur: none available in compact output.

### 5. Contract duration (befristet/unbefristet/keine Angabe)
- Arbeitsagentur: `contractType` = UNBEFRISTET/BEFRISTET/KEINE_ANGABE (dedicated).
- Arbeitnow: inside `job_types` ("Permanent"/"Temporary"/"Full-time fixed-term").

### 6. Why contractType is in jobEmploymentTokens
- `filter.mjs` `jobEmploymentTokens(job)` merges `job.jobTypes` + `job.contractType`
  into ONE token set, then `employmentMatches` checks that set against
  full_time/part_time aliases. Intent was to catch employment signals from both
  sources, but this CONFLATES contract duration with employment scope.

### 7. Existing separate modeling
- YES on the frontend: `types.ts` already has separate `jobTypes?: string[]` and
  `contractType?: string`; `jobMeta.ts` has separate `CONTRACT_TYPE_LABEL_KEYS`,
  `CONTRACT_TYPE_NO_DATA`, `isContractTypeNoData`, `contractTypeLabelKey`; and
  `RemainingCard` renders `contractType` as its own badge. So the FRONTEND models
  them separately, but the API filter (`filter.mjs`) does NOT — that is the mismatch.

### 8. How unknown values are handled
- `employmentMatches`: any token not in the alias set → no match → job excluded
  (so KEINE_ANGABE/UNBEFRISTET/BEFRISTET all exclude AA jobs under full_time).
- Frontend `jobTypeLabelKey`/`contractTypeLabelKey` return null for unknown codes
  (badge hidden / prettify fallback) — informational only.

### 9. Fachliche options for KEINE_ANGABE
- strict: "not specified" → matches nothing → EXCLUDE from employment filter.
- inclusive: "not specified"/missing scope → treated as matching ALL employment
  filters (keep the job).
- separate: model "unspecified" as own state, shown separately, independent of
  the employment filter.

### 10. Cross-source consistent solution
Employment scope (full_time/part_time) and contract duration (befristet/
unbefristet) are DIFFERENT dimensions. The employment filter must consider ONLY
employment-scope signals, never contractType. Arbeitsagentur exposes no scope →
treat as "unspecified" (inclusive by default) rather than inventing a full/part
classification from UNBEFRISTET/BEFRISTET.

## DECISION MATRIX

| Option | Behaviour | Vorteil | Nachteil | Empfehlung |
|---|---|---|---|---|
| 1. Strict (ist) | contractType im Employment-Token-Set; unbekannte Werte → ausgeschlossen | keine Änderung | AA wird bei full_time komplett entfernt; Vertragsdauer mit -umfang vermischt; KEINE_ANGABE wird fälschlich ausgeschlossen | NEIN |
| 2. Nur „keine Daten" inklusiv | KEINE_ANGABE/leer → durchlassen, Rest unverändert | kleine Änderung; AA mit KEINE_ANGABE wieder drin | UNBEFRISTET/BEFRISTET weiterhin falsch als Scope gewertet (bleiben ausgeschlossen); Vermischung bleibt | TEILWEISE (nicht ausreichend) |
| 3. Scope vs. Dauer trennen (empfohlen) | Employment-Filter nutzt NUR Beschäftigungsumfang-Signale; contractType separat/informativ; unbekannter Umfang → inklusiv | fachlich korrekt; quellenübergreifend konsistent; respektiert „UNBEFRISTET ≠ Vollzeit" | kleiner Code-Change (nicht in diesem Step); AA-Jobs haben „Umfang unbekannt" → full_time wirkt dort als „nicht Teilzeit" | JA (als Folge-Fix) |
| 4. Expliziter dritter UI-Zustand „unbekannt" | zusätzliche Filteroption „nicht angegeben"; AA mappt dorthin | klare Trennung, explizite Nutzersteuerung | UI-Änderung + Default-Entscheidung (unbekannt standardmäßig rein?) | Optional (Ergänzung zu 3) |

## STATUS — analyse only, no code change, awaiting review

STEP 28 = EMPLOYMENT/CONTRACT SEMANTIK ANALYSIERT. STOP.

==================================================
STEP 29 — EMPLOYMENT-TYPE-FILTER KORRIGIEREN
==================================================

## PLAN

Correct ONLY the employment-type filter logic so that `contractType` is NO
longer used as an employment-scope signal (per STEP 28 decision Option 3).
Minimal scope: `api/_lib/filter.mjs` + `tests/api/filter.test.js`. No model
refactor, no Apify change, includeDetails stays false, no proxy, no deploy.

Explicit rule for unknown employment scope: a job with NO employment-scope
signal (empty `jobTypes`) is treated as "unspecified" and accordingly PASSES the
employment filter (inclusive), never excluded as if it were the opposite of
full_time/part_time. `contractType` remains an independent informational field
and is NOT part of the employment decision.

## GIT STATE (start)

- HEAD == origin/main == `7756c7d`. Working tree: working fixes to be made.

## ACTION

- `api/_lib/filter.mjs`: `jobEmploymentTokens()` currently merges
  `job.jobTypes` + `job.contractType`. Removed the `contractType` branch so only
  `jobTypes` feeds employment matching. (`employmentMatches` already returns
  `true` for an empty token set — so unknown scope = inclusive = pass.)
- `tests/api/filter.test.js`: add regression tests (see TESTS section).

## TESTS (regression)

1. Arbeitnow Full Time + full_time → match
2. Arbeitnow Part Time + full_time → no match
3. AA UNBEFRISTET + jobTypes null + full_time → PASS (not treated as non-full)
4. AA BEFRISTET + jobTypes null + full_time → PASS
5. AA KEINE_ANGABE + jobTypes null → PASS (explicit)
6. no employmentType → both sources visible

(Results below after implementation)

## RESULT

- `api/_lib/filter.mjs`: removed the `job.contractType` branch in
  `jobEmploymentTokens()`. Employment matching now uses ONLY `job.jobTypes`.
  Empty/absent `jobTypes` → `employmentMatches` returns `true` (unspecified
  scope = inclusive, never excluded as "opposite" of the filter).
- `tests/api/filter.test.js`: added 6 employmentMatches regression tests +
  2 applySearchFilters tests (8 new tests).

### Validation
- `npm test` → 246 passed (25 files) [was 238 → +8]
- `npx tsc -b` → exit 0
- `npm run build` → built OK (327ms)
- `git diff --check` → clean

### API probe (FIXED local filter, real live data)
- no filter: `{arbeitnow:14, arbeitsagentur:39}` = 53 jobs
- employmentType=full_time: `{arbeitnow:10, arbeitsagentur:39}` = 49 jobs
  (before fix: arbeitsagentur was 0)
- employmentType=part_time: `{arbeitnow:6, arbeitsagentur:39}` = 45 jobs

Arbeitsagentur jobs are now retained under every employment filter (their
scope is unknown → inclusive), while Arbeitnow full-/part-time scope signals
still filter correctly.

### Explicit rule (documented)
Unknown employment scope (no `jobTypes`) = "unspecified" = PASSES the
employment filter. `contractType` (UNBEFRISTET/BEFRISTET/KEINE_ANGABE) is never
used as an employment signal. This is the documented, non-implicit behaviour.

## GIT STATE

- Working tree now has modified: `api/_lib/filter.mjs`,
  `tests/api/filter.test.js`, and this execution log. NOT yet committed.

## NEXT

STOP — no deploy, no further work-package step. Await review of the filter fix.

==================================================
STEP 29 — COMMIT / PUSH (review granted)
==================================================

## COMMIT

- Message: `fix: separate employment matching from contract type`
- Files: `api/_lib/filter.mjs`, `tests/api/filter.test.js`, execution log.
- Hash + push: see FINAL GIT STATE below.

## FINAL GIT STATE

- Commit hash: `b4589bd`
- Push: `7756c7d..b4589bd  main -> main`
- HEAD == origin/main == `b4589bd`
- Working tree: clean (code/tests/log); only pre-existing untracked debug/artifact
  files remain (unchanged, not touched).

STATUS = STEP 29 COMMITTED + PUSHED. NO DEPLOY. STOP.

==================================================
STEP 30 — BA DIRECT: LAZY JOB DETAILS („Mehr/Weniger anzeigen")
==================================================

## PLAN

Goal: for Arbeitsagentur jobs, the job card shows short details first and a
„Mehr anzeigen" action that lazily fetches full details via
`GET /pc/v4/jobdetails/{refnr}` FROM THE BROWSER, then „Weniger anzeigen".
No server crawler, no server preload, no batch, no Apify change, no
includeDetails:true, no proxy. Investigate existing adapter + card + whether
refnr/details loading already exist + BA detail response before coding.

## GIT STATE (start)

- HEAD == origin/main == `a30f0cb`.

## INVESTIGATION RESULT

1. No existing detail endpoint / detail loading: grep for `/pc/`, `refnr`,
   `jobdetails`, `referenceId`, `portalUrl` → only `referenceId` (slug) +
   `portalUrl` in `api/_lib/sources/apify/actors.mjs`.
2. Short details already on AA job: title, employer→company_name, location,
   remote, contractType, salary, startDate, created_at(publishedDate),
   `url` = `https://www.arbeitsagentur.de/jobsuche/suche?id=<refnr>`,
   and `slug` = `aa-<referenceId>` where `referenceId` = `13644-290571-S` (the
   BA refnr). The BA refnr IS available but currently only inside `slug`/`url`
   (not stored as its own field).
3. BA detail endpoint response: `GET https://rest.arbeitsagentur.de/jobboerse/
   jobsuche-service/pc/v4/jobdetails/13644-290571-S` → HTTP 403, empty
   `text/plain` body. Same 403 for `/pc/v6/jobs`, with and without a browser
   User-Agent. No `Access-Control-Allow-Origin` header present.

## BLOCKER (proven)

The BA Jobsuche API now requires authentication (OAuth2 / API key) and returns
no CORS headers. A DIRECT browser fetch
(`fetch("https://rest.arbeitsagentur.de/.../pc/v4/jobdetails/{refnr}")`) will
fail with 403 + CORS. The literal „browser→BA" architecture cannot work without
a BA credential/relay, which conflicts with the stated „kein Proxy / keine
serverseitige Detailabfrage" constraints.

## NEXT

STOP — report blocker + options to user, await direction before implementing.

==================================================
STEP 30A — BA BROWSERZUGRIFF PRÄZISIEREN (read-only)
==================================================

## PLAN

Clarify the difference between BA BROWSER access (works) and BA REST access
(403, no CORS). Read-only: identify the exact BA link URL, whether it is a
public page or REST endpoint, what data is visible, whether the description can
render in the browser, whether the link already exists in our dataset, and
whether an official REST/API path exists for our app. Address explicitly whether
„Mehr anzeigen in der Karte" is technically reachable via a legitimate direct
browser access. No proxy/relay, no CORS workaround, no auth, no Apify run, no
code change, no deploy.

## GIT STATE

- HEAD == origin/main == `a30f0cb`.

## RESULT (verified)

1. BA link URL (per AA job `url`/`portalUrl`):
   `https://www.arbeitsagentur.de/jobsuche/suche?id=<refnr>`
   → HTTP 302 → `/jobsuche/suche?id=<refnr>&suchbereich=jobs` (HTTP 200).
   This is the EXACT link the user follows in the browser.
2. It is a normal public job-search WEB page, NOT a REST endpoint. The served
   HTML (368 KB) is an Angular SPA shell: `<title>Alle Jobs | Jobsuche der BA</title>`,
   `ng-version` present, `config/config.js` + `main-*.js`. The `{refnr}` string
   appears 0 times in the raw HTML → details are NOT server-rendered.
3. Data visible: in the browser the FULL job (description, employer, salary, …)
   IS eventually shown — but only AFTER the Angular app boots and the BA page's
   own JS fetches details from the BA REST backend (same-origin on
   arbeitsagentur.de, auth-protected).
4. Full description can render in the BROWSER, but only inside BA's own origin
   context. It is not present in the static HTML shell we can fetch.
5. Link already present in our dataset: YES — `Job.url` =
   `https://www.arbeitsagentur.de/jobsuche/suche?id=<refnr>` (mapped from
   `record.portalUrl`).
6. Official REST/API access for OUR app: NO. `rest.arbeitsagentur.de/jobboerse/
   jobsuche-service/pc/v4/jobdetails/{refnr}` and `/pc/v6/jobs` → HTTP 403,
   empty `text/plain`, no `Access-Control-Allow-Origin` (verified with and
   without browser UA, with `clientId` param, with `X-API-Key` header).
7. Cross-check (Apify Actor README): the only documented way to obtain the FULL
   description programmatically is the Actor's `includeDetails:true` (list +
   enrich detail pages) — which is OUT OF SCOPE here (`kein includeDetails:true`,
   `kein Apify-Umbau`). The Actor itself accesses only "publicly available data
   on arbeitsagentur.de"; there is no free public BA detail REST endpoint.

## CONCLUSION (documented)

- Navigation to BA page = POSSIBLE (open existing `url`/`portalUrl`).
- Programmatic `fetch()` from our app to BA = NOT POSSIBLE (403 + no CORS; the
  detail data is not in the served HTML shell).
- These are NOT contradictory: the browser "sees" the job because BA's own SPA
  runs on BA's origin with BA's auth; our app cannot replicate that cross-origin.
- Therefore the UX goal „Mehr anzeigen → vollständige BA-Details INNERHALB
  unserer Karte per direktem Browser-fetch" ist mit einem legitimen direkten
  Browserzugriff NICHT erreichbar. Erreichbar wäre nur: (a) extern den
  `portalUrl` öffnen (Navigation), oder (b) ein Relay/Apify `includeDetails`
  (beides hier explizit ausgeschlossen).

## NEXT

STOP — awaiting direction. Reported options do not include a working direct
browser detail feed; further work needs a product decision (external link vs.
relay vs. Apify detail enrichment).

==================================================
STEP 31 — BA DIRECT VS. APIFY DETAILVERSORGUNG (read-only)
==================================================

## PLAN

Decide how full Arbeitsagentur job details should be provided for a
„Mehr/Weniger anzeigen" UX. Compare Option A (BA Direct + external portalUrl),
Option B (Apify includeDetails:true), Option C (other already-present legitimate
mechanism). Read-only: verify Apify actor doc/code for includeDetails fields,
cost, request model. No code change, no includeDetails enable, no Apify run, no
proxy, no deploy, no commit.

## GIT STATE

- HEAD == origin/main == `1264cc1`.

## RESULT — Apify includeDetails:true (verified from actor README + repo code)

1. Additional fields (detail enrichment): `description`, `descriptionHtml`,
   `descriptionMarkdown`, `employerContactInfo`, `extractedEmails`,
   `extractedPhones`, `employerDescription`, `employerWebsite`, `employerSize`.
   Standard (non-compact) fields also include `occupation`, `allOccupations`,
   `postalCode`, `region`, `country`, `lat`/`lng`, `isFullTime`/`isPartTime…`/
   `isMiniJob`, `salaryMin/Max/Currency/Type`, `startDate`, `publishedDate`,
   `firstPublishedDate`, `modifiedDate`, `isCareerChange`,
   `isTemporaryStaffing`, `isPrivateAgency`, `isDisabilityFriendly`,
   `distanceKm`, `allianzPartnerName/Url`, `contentHash`, `scrapedAt`.
2. Full description: YES (`description` + `descriptionHtml` + `descriptionMarkdown`).
3. Anforderungen/Skills/Adresse/Metadaten: description text (contains
   requirements) + employer contact/address-like fields (postalCode, location,
   region, country, lat/lng, employerWebsite, employerSize). No dedicated
   "skills" array in the actor output.
4. portalUrl remains present: YES (listed even in compact output).
5. Details loaded for every emitted job: YES (two-stage: list then enrich each).
6. Detail request per job: README says "two-stage mode: list, then enrich each
   job with the full description + detail-page fields" → effectively a
   per-job detail fetch, executed by the actor (server-side), NOT by the user.
7. Request/run structure for N jobs: ONE actor run per cache-missing search;
   actor internally does list + ~N detail fetches. User triggers ONE backend
   search, not N requests.
8. Cost belastbar (from README): pay-per-event — run start $0.00005, per result
   $0.00079/job. 40 jobs ≈ $0.00005 + 40×$0.00079 ≈ $0.032 per full run.
9. Cost NOT belastbar without a real run: any includeDetails-specific surcharge
   (not documented), actual run duration (risk vs 50s sync timeout), whether
   per-result price changes with enrichment.
10. UI diff includeDetails:false vs true: false = `description`/`descriptionPlain`
   empty (current; no in-card text, `language` undefined). true = full
   `description`/`descriptionHtml` → existing RemainingCard description block +
   DOMPurify rendering + `language` detection become available for AA jobs.

## REQUEST MODEL (not conflated)

- BA Direct: requests originate from the user's browser on navigation; our app
  makes 0 BA REST calls.
- Apify: BA requests are executed by the Actor (server-side, on Apify infra);
  the user does NOT trigger each per-job detail fetch.

## DECISION MATRIX

| Option | UX | BA Requests | Wer löst Requests aus? | Apify-Kosten | Engineering | Lock-in | Vorteil | Nachteil |
|---|---|---|---|---|---|---|---|---|
| A. BA Direct + externe portalUrl | Short in Karte; „Mehr anzeigen" öffnet BA-Seite (kein In-Card-Detail) | 0 aus unserer App (BA-SPA lädt im Nutzer-Browser) | Nutzer (Navigation) | unverändert (includeDetails:false) | minimal (externer Link auf `job.url`) | keines | kostenlos, legitim, kein Proxy/CORS | keine Details in der Karte; Nutzer verlässt App |
| B. Apify includeDetails:true | Voll-Details IN der Karte; aber PRELOAD (nicht lazy) → „Mehr/Weniger" schaltet vorhandene Daten instant (kein Spinner) | ~N Detail-Fetches durch Actor (server-side) | unser Backend-Search (ein Run), nicht der Nutzer je Job | ~$0.00005 + $0.00079/Job (≈$0.032 bei 40 Jobs); Surplus nicht belastbar | gering (buildInput-Flag + RemainingCard-Desc-Block für AA freigeben; Sprache/Tags gewonnen) | höher (Details hängen am Actor) | In-Card-Details, Wiederverwendung DOMPurify, besseres AI-Matching | nicht „lazy"; Kosten skalieren mit N; Run ggf. > 50s-Timeout; pay-per-result |
| C. andere vorhandene legitime Option | — | — | — | — | — | — | Keine gefunden (kein bestehender Detail-Endpoint/Relay im Projekt) | Keine gefunden |

## EMPFEHLUNG (Technik)

Option B (Apify includeDetails:true) ist der einzige heutige Weg, vollständige
AA-Details IN der Karte anzuzeigen. Er liefert sie aber als PRELOAD, nicht als
lazy Browser-Fetch → der „Loading/Spinner"-Schritt entfällt; „Mehr/Weniger"
schaltet bereits geladene Daten (erfüllt damit die Anforderung „erneut ohne
erneuten Request"). Option A ist der einzig erlaubte „BA Direct"-Weg und deckt
nur externe Navigation ab.

## PRODUKTENTSCHEIDUNG (Vorschlag)

Priorität auf UX „Details in der Karte" → Option B. Priorität auf absolute
Kostenfreiheit/kein Detail von Apify → Option A (externer BA-Link). Mischform
denkbar: Option A als „Direkt zur BA"-Link + Option B für In-Card-Beschreibung.

## OFFENE PUNKTE

- Ob includeDetails:true einen Aufpreis pro Result hat (nicht dokumentiert).
- Ob der enriched Run die 50s-Sync-Grenze überschreitet (nur per echtem Run messbar).
- Ob das Feature „lazy/spinner" wirklich verlangt wird oder PRELOAD akzeptabel ist.

## NEXT

STOP — awaiting review of decision matrix + recommendation.

==================================================
STEP 31 — FOLLOW-UP: startUrls als gezielter Detail-Enrichment-Run (read-only)
==================================================

## PLAN

Verify whether the Actor's `startUrls` input (one or more concrete BA job URLs)
really works as a TARGETED detail-enrichment path, and how it interacts with
`maxResults`, search params and `includeDetails`. Read-only (actor OpenAPI
schema + README + repo buildInput). No run, no code change.

## GIT STATE

- HEAD == origin/main == `2aafb38`.

## RESULT

Verified against the actor's public OpenAPI input schema
(`https://api.apify.com/v2/actors/1AplK7NbBBWHirQFr/builds/cHaZPhdTCleRHuhpQ/openapi.json`,
HTTP 200) + README + repo `api/_lib/sources/apify/actors.mjs`.

1. `startUrls` (array): "Paste specific arbeitsagentur.de job links to scrape
   exactly those listings instead of running a search. Accepts portal and
   job-detail URLs. When provided, the search term and filters are ignored."
   → YES, startUrls is a TARGETED scrape of EXACTLY the listed jobs. Accepts both
   the portal URL (`https://www.arbeitsagentur.de/jobsuche/suche?id=<refnr>`, which
   we already have as `Job.url`) and job-detail URLs.
2. Search params when startUrls is set: `query`, `location` and all filters
   (contractType, jobType, workType, radius, bundesland, remoteOnly, …) are
   IGNORED ("search term and filters are ignored").
3. `maxResults` when startUrls is set: effectively bypassed. The schema defines
   maxResults as "Maximum number of job listings to return" for SEARCH mode; the
   "scrape exactly those listings" wording means the result set is driven by the
   URLs, not by maxResults. (This interaction is documented only by implication,
   not by an explicit startUrls∩maxResults rule → flagged below.)
4. `includeDetails` when startUrls is set: STILL APPLIES. includeDetails is the
   detail-enrichment TOGGLE (not a search param/filter), so
   `startUrls=[…] + includeDetails:true` = targeted full-detail fetch
   (description/descriptionHtml, employer meta, salary range) for those specific
   jobs.
5. Repo buildInput TODAY does NOT set startUrls: it sends query, location,
   maxResults(40), mode:"full", includeDetails:false, compact:true,
   excludeEmptyFields:false. Using startUrls would be a code change in buildInput.

## IMPLICATIONS (as a potential NEW option "D")

- A targeted startUrls run is server-side (Apify), one run per on-demand request,
  NOT browser-triggered → same "serverseitige Detailabfrage / Apify-Umbau"
  classification as Option B; it is NOT the forbidden "BA direct browser fetch"
  but it IS "kein ein Detailrequest pro Job durch den Actor".
- Cost (belastbar, README): run start $0.00005 + $0.00079/result → 1 job ≈
  $0.00084; N jobs ≈ $0.00005 + N×$0.00079.
- NOT belastbar without a real run: whether a `jobsuche/suche?id=` portal URL
  yields EXACTLY 1 record (the Paste-mode bullet also lists "search-results URLs"
  and "category SEO URLs", which could yield >1), and total run latency.

## NEXT

STOP — findings reported; no implementation, await review.

==================================================
STEP 32B — BA → APIFY TARGETED DETAIL ENRICHMENT + USER QUOTA
==================================================

## PLAN

Implement the decided hybrid strategy:
- Normal search: BA short details stay; „Mehr anzeigen" → server-side Apify
  targeted detail run (`startUrls:[portalUrl]`, `includeDetails:true`), cached.
- AI path: after successful match, enrich ONLY the evaluated AA jobs in ONE
  batch run (never the whole list); degrade on error.
- Server-side per-user-per-day quota on ENRICHED jobs (cache-hits = 0), enforced
  atomically via Redis; safe fail-closed on Redis outage; keyed by hashed client
  IP (no auth exists). Validate slugs server-side (no arbitrary external URLs).
- Keep global APIFY_MONTHLY_MAX_RUNS backstop.

Files planned:
- `api/_lib/config.mjs` (new limit), `api/_lib/cache.mjs` (atomic reserve+decr),
  `api/_lib/sources/apify/actors.mjs` (buildTargetedDetailInput + export normalize),
  `api/_lib/detailEnrich.mjs` (new), `api/job-details.mjs` (new POST route),
  `api/match.mjs` (enrich evaluated AA jobs), `src/api.ts`, `src/components/RemainingCard.tsx`,
  `src/i18n.tsx`, `src/types.ts` (if needed), tests.

## GIT STATE (start)

- HEAD == origin/main == `2709580`.

## ARCHITECTURE DECISION

Hybrid: normal search keeps BA short details (Apify `includeDetails:false`,
`compact:true`). „Mehr anzeigen" → server-side Apify TARGETED detail run
(`startUrls:[portalUrl]`, `includeDetails:true`, `compact:false`) via
`api/_lib/detailEnrich.mjs`. AI path enriches only the evaluated AA jobs in ONE
batched run (never the full list), and degrades on error. Details cached in
Upstash Redis (7-day TTL) keyed by refnr; cache hits = 0 quota cost.

## FILES / CHANGES

- `api/_lib/config.mjs` — new `apifyDetailMaxPerUserPerDay` (default 20, env
  `APIFY_DETAIL_MAX_PER_USER_PER_DAY`).
- `api/_lib/cache.mjs` — `cacheReserveIncr` (atomic EVAL check+reserve),
  `cacheDecrBy` (best-effort refund).
- `api/_lib/sources/apify/actors.mjs` — `buildTargetedDetailInput(startUrls)`
  (`includeDetails:true`, `compact:false`); normalize now prefers
  `descriptionHtml`; exported `normalizeArbeitsagentur`.
- `api/_lib/detailEnrich.mjs` (NEW) — slug validation, cache, quota, batch run.
- `api/job-details.mjs` (NEW) — POST route `{ jobs: [slugs] }`.
- `api/match.mjs` — `enrichEvaluatedJobs` (best-effort, degrade on error).
- `src/api.ts` — `fetchJobDetails`.
- `src/components/RemainingCard.tsx` — AA lazy „Mehr/Weniger anzeigen" + spinner + error/retry.
- `src/i18n.tsx` — `results.detailLoading`, `results.detailError`.
- Tests: `tests/api/detail-enrich.test.mjs`, `tests/api/job-details.test.mjs`,
  `tests/api/match-enrich.test.mjs`.

## QUOTA MODEL

- Counts ENRICHED (new) jobs, not HTTP requests. Cache hits = 0.
- Per-user-per-day, keyed by `mj-usage:detail:<sha256(ip).slice(0,24)>:<YYYY-MM-DD(UTC)>`.
- Atomic reserve via Redis EVAL: returns -1 (exceeded) / number (reserved) / null (Redis down).
- Fail-closed: Redis down → `quota_unavailable` → 503, NO Apify run.
- Refund best-effort on run/partial failure (counts only truly enriched jobs).
- Global `APIFY_MONTHLY_MAX_RUNS` backstop remains (checked before quota reserve).

## SECURITY MODEL

- No auth in app → identity = hashed client IP (from `x-forwarded-for` / `x-real-ip`).
- Client supplies ONLY slugs; server validates slug shape `^aa-[A-Za-z0-9-]+$` and
  builds portalUrl server-side (hard-coded BA host) — arbitrary external startUrls
  are impossible.
- No user-provided userId is read (route passes only `{ clientIp }`).
- Limits documented as IP-based; NAT/CGNAT and IP-spoofing boundaries acknowledged.

## TESTS

- `npm test` → 266 passed (28 files) [was 246 → +20]
- `npx tsc -b` → exit 0
- `npm run build` → built OK (318ms)
- `git diff --check` → clean
- New: detail-enrich (13), job-details (5), match-enrich (2).

## OPEN POINTS

- IP-based quota is a coarse limit (shared NAT, spoofed `x-forwarded-for` assumed
  trusted on Vercel). A real auth/user identity would strengthen it.
- BA detail description renders as plain text/HTML depending on actor output;
  `descriptionHtml` preferred, plain text fallback.
- Targeted run latency (up to 50s sync) — surfaced via spinner/error, not measured.
- includeDetails surcharge on pay-per-result not documented (real-run verification pending).

==================================================
STEP 32C — RATE LIMIT / COST PROTECTION HARDENING
==================================================

## PLAN

Harden STEP 32B without reimplementing it:
A. default detail quota 20 → 30 (config + .env.example).
B. anonymous identity: server-issued HttpOnly session cookie (primary) + IP
   backstop (anti-abuse), both server-side, hashed in Redis, fail-closed.
C. AI enrichment timing: move AFTER successful AI response; enrich only the
   evaluated/returned BA jobs (not all search results); degrade on error; AI
   failure → zero detail runs.
D. Apify token via Authorization Bearer (remove ?token= from URLs).
E. global monthly run guard made race-safe for the paid detail path (atomic
   reserve/refund on the existing monthly key).
F. preserve slug validation + server-built portal URL.
G. tests + npm test/tsc/build/diff-check.

## GIT STATE (start)

- HEAD == origin/main == `48aa696`.

## RESULT

### A. Quota config
- `apifyDetailMaxPerUserPerDay` default 20 → 30 (config + `.env.example`).
- New `apifyDetailMaxPerIpPerDay` default 100 (IP backstop).

### B. Anonymous identity + quota model
- New `api/_lib/identity.mjs`: server-issued HttpOnly `mj_session` cookie
  (crypto-random 32-hex), `clientIp`, `hashToken` (sha256, 24 hex in Redis keys).
- Quota keys (UTC day, 24h TTL): `mj-detail:quota:s:<hash(session)>:<day>` (primary,
  limit 30) and `mj-detail:quota:ip:<hash(ip)>:<day>` (backstop, limit 100).
- Cookie is HttpOnly + SameSite=Lax (+Secure in prod). Raw IPs/session ids are
  never stored (only hashes).
- Trust boundary server-side only: body userId is never read.
- Guarantee (documented): the IP backstop is the real anti-abuse layer; session
  rotation / arbitrary cookie values alone do not grant more quota, but an actor
  that also rotates IPs (VPN/proxy) is the documented residual limit. NAT users
  share the looser 100/day IP bucket.

### C. AI enrichment ordering
- `api/match.mjs`: enrichment moved AFTER a successful usable AI response; only
  the returned/evaluated BA jobs are enriched (one batch), best-effort; AI
  failure → zero detail runs.

### D. Apify Bearer token
- `client.mjs`: startApifyRun/waitForRun/readDataset now use
  `Authorization: Bearer <token>`; token removed from URLs.

### E. Global monthly backstop race-safety
- `usage.mjs` adds atomic `reserveApifyRunSlot()` / `refundApifyRunSlot()` on the
  same monthly `mj-usage:apify:runs:<month>` key (EVAL check+increment).
- `detailEnrich` reserves the run slot before the paid run and refunds it when
  the run cannot start (start error / quota rejection).

### F. Targeted run safety
- Preserved: strict `aa-*` slug parse, server-built BA portal URL, one batch run,
  includeDetails:true only on targeted runs, cache → quota → Apify order.

### G. Tests
- `npm test` → 272 passed (29 files) [was 266 → +6; refresh of existing + new]
- `npx tsc -b` → exit 0
- `npm run build` → OK (463ms)
- `git diff --check` → clean
- New/updated tests cover: default quota 30, cache-hit zero quota, batch one run,
  per-session + IP-backstop quota, fail-closed on Redis down, atomic global
  run-slot, AI failure → zero detail runs, only returned BA jobs batched,
  Bearer token header + no token in URL, arbitrary URL rejected, anonymous
  identity (session + IP, no userId).

## COMMIT

(see FINAL GIT STATE)