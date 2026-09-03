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