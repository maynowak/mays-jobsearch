# STEP 23D-K — PRODUCTION API DATAFLOW FORENSICS

**Datum:** 2026-08-26
**Status:** IN PROGRESS
**Basis-Commit:** d4800d4 (HEAD = origin/main)
**Branch:** main

---

## 0. INITIALISIERUNG

### 0.1 Ausgangslage
- **Commit:** d4800d4 (HEAD = origin/main)
- **Production:** Vercel project maymilly/mays-job-matcher
- **Problem:** descriptionPlain enthält weiterhin HTML-Entities trotz Fix in d4800d4

### 0.2 Ziel
Exakten Production-Codepfad für /api/jobs identifizieren und Root Cause bestimmen.

---

## PHASE 1 — LOCAL CODE PATH

### 1.1 Welche Datei implementiert /api/jobs?
**Datei:** `api/jobs.mjs`
- Exportiert einen Vercel Function Handler
- Importiert `fetchAllJobs` aus `./_lib/jobs.mjs`
- Importiert `HttpError` aus `./_lib/filter.mjs`

### 1.2 Vercel Routing (vercel.json)
```json
{
  "functions": {
    "api/**/*.mjs": { "maxDuration": 60 }
  },
  "rewrites": [
    { "source": "/top", "destination": "/index.html" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```
- Alle `api/**/*.mjs` werden als Vercel Functions deployed
- `/api/jobs` wird durch `api/jobs.mjs` bedient (keine Rewrite-Regel dafür)

### 1.3 Import/Call Graph
```
/api/jobs (api/jobs.mjs)
    ↓
fetchAllJobs (api/_lib/jobs.mjs)
    ↓
fetchAllJobs (api/_lib/sources/index.mjs)
    ↓
source.fetchJobs() → arbeitnow.mjs / apify/actors.mjs
    ↓
compactJob() → stripHtml() (api/_lib/filter.mjs)
    ↓
decodeHtmlEntities() → decodeHtmlEntitiesOnce()
```

### 1.4 stripHtml Implementation (api/_lib/filter.mjs)
**Aktueller Code (decodeHtmlEntitiesOnce):**
```javascript
function decodeHtmlEntitiesOnce(html) {
  return String(html)
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "&")      // ← PROBLEM: generic & replace FIRST
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x24;/g, "$");
}
```

**ROOT CAUSE IDENTIFIED:** Generic `&` → `&` replace runs BEFORE specific entity replaces (`<`, `>`, `"`, `&apos;`, numeric entities). This corrupts entity decoding.

**Trace with input `<p>`:**
1. `&nbsp;` → ` ` : no change
2. `&` → `&` : `<p>` → `<p>` (the `&` in `<` becomes `&`)
3. `<` → `<` : no `<` char found (string now has `<p>`)
4. `>` → `>` : no `>` char
5. **Result: `<p>` — entities NOT decoded!**

### 1.5 stripHtml Call Chain
```javascript
// api/_lib/sources/arbeitnow.mjs:56-58
function compactJob(job) {
  const rawDescription = job.description || "";
  const descriptionPlain = stripHtml(rawDescription);  // ← HERE
  return { ..., description: rawDescription, descriptionPlain };
}
```

### 1.6 No Duplicate stripHtml Implementations
```bash
grep -r "function stripHtml" /home/dci-student/projects/Mays-Jobsearch/api/ /home/dci-student/projects/Mays-Jobsearch/src/
```
**Result:** Only ONE implementation in `api/_lib/filter.mjs`

### 1.7 Vercel Build Output
```bash
ls -la /home/dci-student/projects/Mays-Jobsearch/.vercel/output/
```
No local `.vercel/output` directory exists (build happens on Vercel)

---

## PHASE 2 — LOCAL REPRODUCTION

### 2.1 Local Test with Production Data
```bash
node -e "
const { stripHtml } = require('./api/_lib/filter.mjs');
const input = '<p><strong>About Sony Music Entertainment</strong></p>';
console.log('Input:', input);
console.log('Output:', stripHtml(input));
"
```

### 2.2 Actual Local Test Results (PHASE K-RECHECK 2)
```bash
node -e "
const { stripHtml } = await import('./api/_lib/filter.mjs');
const testCases = [
  '<p><strong>About Sony Music Entertainment</strong></p>',
  '<p><strong>About Sony Music Entertainment</strong></p>',
  '<p><strong>About Sony Music Entertainment</strong></p>'
];
for (const input of testCases) {
  const output = stripHtml(input);
  console.log('Input:', JSON.stringify(input));
  console.log('Output:', JSON.stringify(output));
  console.log('---');
}
"
```

**Results:**
- Raw HTML (`<p><strong>...</strong></p>`): PASS → `"About Sony Music Entertainment"`
- Entity-encoded (`<p><strong>...</p>`): **FAIL** → `"<p><strong>About Sony Music Entertainment</strong></p>"` (unchanged!)
- Double-encoded: **FAIL** (same as above)

---

## PHASE K-RECHECK 1 — COMMIT VS WORKTREE

### 1.8 Git State Verification
```bash
git rev-parse HEAD
# d4800d4b67223c6b9a330de8b1a91b7b58a0df28

git rev-parse origin/main
# d4800d4b67223c6b9a330de8b1a91b7b58a0df28

git status --short
# M api/_lib/sources/apify/actors.mjs (and other files, but NOT api/_lib/filter.mjs)

git show d4800d4:api/_lib/filter.mjs | head -40
sed -n '1,100p' api/_lib/filter.mjs
```

**Result:** Both d4800d4 AND working tree contain IDENTICAL buggy code in `decodeHtmlEntitiesOnce`.

---

## PHASE K-RECHECK 3 — COMMIT INHALT

### 3.1 Commit d4800d4 Analysis
```bash
git show --stat --oneline d4800d4
# d4800d4 fix: normalize HTML entities before stripping job descriptions
# 3 files changed, 101 insertions(+), 11 deletions(-)
# api/_lib/filter.mjs | 34 +++++++++++++++-------
# tests/api/filter.test.js | 76 ++++++++++++++++++++++++++++++++++++++++++++++++
```

### 3.2 The Bug in d4800d4
The commit INTRODUCED a new bug while claiming to fix the issue:

**Buggy `decodeHtmlEntitiesOnce` in d4800d4:**
```javascript
function decodeHtmlEntitiesOnce(html) {
  return String(html)
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "&")      // ← BUG 1: Runs FIRST, corrupts < → <, > → >
    .replace(/</g, "<")      // ← BUG 2: Matches literal '<' char, NOT '<' string
    .replace(/>/g, ">")      // ← BUG 3: Matches literal '>' char, NOT '>' string
    .replace(/"/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x24;/g, "$");
}
```

**Trace with input `<p>`:**
1. `&nbsp;` → ` ` : no change
2. `&` → `&` : `<p>` → `<p>` (the `&` in `<` becomes `&`)
3. `<` → `<` : NO MATCH (string has `<`, not literal `<`)
4. `>` → `>` : NO MATCH (string has `>`, not literal `>`)
5. **Result: `<p>` — ENTITIES NOT DECODED!**

### 3.3 Test File Analysis
```bash
git show d4800d4 -- tests/api/filter.test.js
```

**Tests 2 & 3 use JavaScript string literals:**
```javascript
it("2) Entity-encoded HTML decodes and strips to plain text", () => {
  const input = "<p><strong>Hello</strong></p>";  // ← LITERAL < and > in JS source!
  const result = stripHtml(input);
  expect(result).toBe("Hello");
});
```

These are NOT entity-encoded strings. In JS source, `"<p>"` contains literal `<` and `>` characters. To test entity-encoded input, it should be `"<p><strong>Hello</strong></p>"`.

**Conclusion:** Tests PASS but do NOT test the actual bug scenario (entity-encoded HTML from external APIs).

---

## PHASE K-RECHECK 4 — REGRESSION TEST

```bash
npm test -- tests/api/filter.test.js
# 7 tests PASS (but they test literal HTML, not entity-encoded HTML)
```

**Actual bug scenario test:** FAILS (see PHASE K-RECHECK 2)

---

## PHASE K-RECHECK 5 — PRODUCTION VERIFICATION

### 5.1 Production API Call
```bash
curl -s "https://mays-job-matcher.vercel.app/api/jobs?limit=20" | node -e "
const data = require('fs').readFileSync(0, 'utf-8');
const json = JSON.parse(data);
for (const job of json.jobs) {
  if (job.descriptionPlain && (job.descriptionPlain.includes('<') || job.descriptionPlain.includes('>') || job.descriptionPlain.includes('&'))) {
    console.log('ID:', job.id);
    console.log('descriptionPlain:', job.descriptionPlain.substring(0, 200));
    console.log('---');
  }
}
"
```

**Results:** 18/20 jobs have entity-encoded `descriptionPlain` containing:
- `<` `>` (HTML tags as entities)
- `&` `&#x26;` (`&` as entities)
- `&nbsp;` (non-breaking space)
- `"` `'` (quotes)

Example:
```
descriptionPlain: "<div class="content-intro"><p><span style="font-weight: 400;">At Ripple..."
```

This matches the LOCAL BUG BEHAVIOR exactly.

---

## PHASE K-RECHECK 6 — DEPLOYMENT IDENTITY

- **HEAD commit:** d4800d4b67223c6b9a330de8b1a91b7b58a0df28
- **origin/main:** d4800d4b67223c6b9a330de8b1a91b7b58a0df28
- **Working tree filter.mjs:** IDENTICAL to d4800d4 (no local modifications)
- **Production deployment:** Likely d4800d4 (same commit)

The bug is in the SOURCE CODE, not in caching or deployment mismatch.

---

## PHASE K-RECHECK 7 — URSACHEN-ANALYSE

| Ursache | Status |
|---------|--------|
| A) d4800d4 enthält den Fix nicht wirklich | **BEWIESEN** — d4800d4 hat einen NEUEN Bug eingeführt |
| B) Working Tree enthält Fix, aber d4800d4 nicht | NICHT ZUTREFFEND — beide identisch buggy |
| C) api/jobs.mjs importiert andere Implementation | AUSGESCHLOSSEN — nur EINE stripHtml in api/_lib/filter.mjs |
| D) Production läuft mit anderem Deployment/Commit | UNLIKELY — HEAD = origin/main = d4800d4 |
| E) Function-Build enthält anderen Code | UNLIKELY — Source Code ist buggy |
| F) Routing zeigt auf andere Function | AUSGESCHLOSSEN — vercel.json routed /api/jobs → api/jobs.mjs |
| G) Runtime-/Caching-Problem | **NICHT die Root Cause** — A-F ausgeschlossen, Bug ist im Code |

**ROOT CAUSE = A** — Commit d4800d4 claims to fix entity decoding but introduces a bug in `decodeHtmlEntitiesOnce`:
1. Wrong replacement ORDER: generic `&` → `&` runs BEFORE specific entities
2. Wrong regex PATTERNS: `/</g` and `/>/g` match literal `<` `>` chars, not `<` `>` strings

---

## PHASE K-RECHECK 8 — BEWEIS-ZUSAMMENFASSUNG

**BEWEIS 1:** Local test with entity-encoded input FAILS (output = input unchanged)

**BEWEIS 2:** Production `descriptionPlain` contains `<`, `>`, `&`, `&nbsp;` — matches local bug exactly

**BEWEIS 3:** d4800d4 `decodeHtmlEntitiesOnce` has wrong regex patterns and wrong order

**BEWEIS 4:** Tests in d4800d4 test literal HTML (`"<p>"`), NOT entity-encoded (`"<p>"`)

**BEWEIS 5:** No other stripHtml implementation exists in codebase

---

## STATUS = STEP 23D-K ROOT CAUSE PROVEN

### 1. Beweis
- Local reproduction: entity-encoded HTML NOT decoded by current implementation
- Production output matches local bug behavior exactly
- Source code analysis confirms wrong regex patterns and replacement order in `decodeHtmlEntitiesOnce`

### 2. Tatsächlicher Codepfad
`api/jobs.mjs` → `api/_lib/jobs.mjs` → `api/_lib/sources/index.mjs` → source fetchers → `compactJob()` → `stripHtml()` → `decodeHtmlEntities()` → `decodeHtmlEntitiesOnce()` (BUGGY)

### 3. Production-Codepfad
Same as local — Vercel deploys `api/**/*.mjs` as functions, `/api/jobs` → `api/jobs.mjs` (verified via vercel.json). HEAD = origin/main = d4800d4.

### 4. Ursache
**Commit d4800d4 introduced a regression in `decodeHtmlEntitiesOnce`:**
- `.replace(/&/g, "&")` runs first, corrupting `<` → `<`, `>` → `>`
- `.replace(/</g, "<")` matches literal `<` character, NOT `<` string
- `.replace(/>/g, ">")` matches literal `>` character, NOT `>` string

### 5. Minimaler Fix
In `api/_lib/filter.mjs`, function `decodeHtmlEntitiesOnce`:

**Current (buggy):**
```javascript
.replace(/&nbsp;/g, " ")
.replace(/&/g, "&")
.replace(/</g, "<")
.replace(/>/g, ">")
.replace(/"/g, '"')
.replace(/&apos;/g, "'")
.replace(/&#x2F;/g, "/")
.replace(/&#x24;/g, "$")
```

**Fixed (correct order + correct patterns):**
```javascript
.replace(/&nbsp;/g, " ")
.replace(/</g, "<")
.replace(/>/g, ">")
.replace(/"/g, '"')
.replace(/&apos;/g, "'")
.replace(/&#x2F;/g, "/")
.replace(/&#x24;/g, "$")
.replace(/&/g, "&")  // generic LAST
```

**Note:** The original pre-d4800d4 code in `stripHtml` had correct patterns (`<`, `>`, `"`) but wrong ORDER (tag-stripping before entity-decoding). The fix must: decode entities FIRST (with correct patterns), THEN strip tags.