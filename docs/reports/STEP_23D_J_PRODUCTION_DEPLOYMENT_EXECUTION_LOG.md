# STEP 23D-J — PRODUCTION DEPLOYMENT — TARGETED VERIFICATION

**Datum:** 2026-08-26
**Status:** COMPLETE — API DATAFLOW STILL INCORRECT
**Basis-Commit:** d4800d4b67223c6b9a330de8b1a91b7b58a0df28 (HEAD = origin/main)
**Branch:** main

---

## 0. PRECONDITION

**Commit:** d4800d4b67223c6b9a330de8b1a91b7b58a0df28
**Status:** Pushed to origin/main, verified
**Local Validation:** 207/207 tests PASS, TypeScript PASS, Build PASS, git diff --check PASS

---

## 1. PRODUCTION DEPLOYMENT

### 1.1 Deploy Commands Executed

**Initial Deploy (linked to wrong project `mays-jobsearch`):**
```bash
vercel --prod --scope maymilly
```

**Re-link to correct project `mays-job-matcher`:**
```bash
vercel link --scope maymilly --project mays-job-matcher --yes
```

**Production Deploy to correct project:**
```bash
vercel --prod --scope maymilly
```

**Forced redeploy without cache:**
```bash
vercel --prod --scope maymilly --force
```

### 1.2 Deployment Results
- **Project:** mays-job-matcher (correct project)
- **Production Alias:** https://mays-job-matcher.vercel.app
- **Build:** ✅ Success (342-390ms)
- **Deploy Time:** 15-17s
- **Status:** ✅ Ready

---

## 2. PRODUCTION API VERIFICATION

### 2.1 Query Production API

**Endpoint:** `GET https://mays-job-matcher.vercel.app/api/jobs?skills=royalty`

**Target Job:** "Engineering Manager, Royalty Share - PDEGO" at sonymusicentertainment

### 2.2 Actual Production Response (OBSERVED)

```json
{
  "title": "Engineering Manager, Royalty Share - PDEGO",
  "company_name": "sonymusicentertainment",
  "description": "<p><strong>About Sony Music Entertainment</strong></p>\n<p>At Sony Music Entertainment, we fuel the creative journey...",
  "descriptionPlain": "<p><strong>About Sony Music Entertainment</strong></p> <p>At Sony Music Entertainment, we fuel the creative journey..."
}
```

### 2.3 Field Analysis

| Field | Type | Contains `<p>` | Contains `</p>` | Contains `<strong>` | Contains `<` | Contains `>` | Contains `&` | First ~200 chars |
|-------|------|----------------|-----------------|---------------------|-----------------|-----------------|------------------|------------------|
| **description** | string | NO (raw `<p>`) | NO (raw `</p>`) | NO (raw `<strong>`) | YES | YES | YES | `<p><strong>About Sony Music Entertainment</strong></p>\n<p>At Sony Music...` |
| **descriptionPlain** | string | NO (raw `<p>`) | NO (raw `</p>`) | NO (raw `<strong>`) | YES | YES | YES | `<p><strong>About Sony Music Entertainment</strong></p> <p>At Sony Music...` |

### 2.4 Comparison with Expected

| Field | Expected | Actual | Status |
|-------|----------|--------|--------|
| **description** | Raw HTML (can be entity-encoded) | Contains `<`, `>`, `&` | ✅ ACCEPTABLE |
| **descriptionPlain** | Plain text, NO HTML artifacts | Contains `<p>`, `</p>`, `<strong>`, `<`, `>`, `&` | ❌ **FAILED** |

---

## 3. HTTP VERIFICATION

### 3.1 Root /
```bash
curl -I https://mays-job-matcher.vercel.app/
```
**Result:** HTTP/2 200, `content-type: text/html; charset=utf-8`, `etag: "1e8d0773ae31ad9e78962a12e222dfad"`

### 3.2 /top
```bash
curl -I https://mays-job-matcher.vercel.app/top
```
**Result:** HTTP/2 200, `content-type: text/html; charset=utf-8`, `etag: "1e8d0773ae31ad9e78962a12e222dfad"`

---

## 4. ROOT CAUSE OF DEPLOYMENT FAILURE

Despite multiple forced deployments (`vercel --prod --scope maymilly --force`) and re-linking to the correct project (`maymilly/mays-job-matcher`), the Vercel serverless functions are **not updating** with the fixed code.

**Evidence:**
- Local code fix verified: `api/_lib/filter.mjs` has correct entity-decoding order
- Local tests pass: 207/207 tests PASS
- Local build passes: TypeScript PASS, Build PASS
- Multiple forced deployments executed (`--force` flag used)
- Cache bypass attempted (`--force`, cache-busting headers, cache-buster query params)
- Re-linked to correct project (`maymilly/mays-job-matcher`)
- Project correctly aliased to `https://mays-job-matcher.vercel.app`

**Hypothesis:** Vercel serverless function cache/edge cache is not invalidating, or serverless function bundles are cached separately from build cache and not being rebuilt despite `--force` flag.

---

## 5. COMMANDS EXECUTED

```bash
# Initial deploy (wrong project)
vercel --prod --scope maymilly

# Re-link to correct project
vercel link --scope maymilly --project mays-job-matcher --yes

# Deploy to correct project
vercel --prod --scope maymilly

# Forced redeploy without cache
vercel --prod --scope maymilly --force

# HTTP verification
curl -I https://mays-job-matcher.vercel.app/
curl -I https://mays-job-matcher.vercel.app/top

# API verification (multiple attempts with cache-busting)
curl -s "https://mays-job-matcher.vercel.app/api/jobs?skills=royalty" | jq ...
curl -s "https://mays-job-matcher.vercel.app/api/jobs?skills=royalty&nocache=$(date +%s)" -H "Cache-Control: no-cache" ...
curl -s "https://mays-job-matcher.vercel.app/api/jobs?skills=royalty&v=3" -H "Cache-Control: no-cache, no-store, must-revalidate" ...
```

---

## 6. DEPLOYMENT STATUS

| Check | Status |
|-------|--------|
| Production deployed to correct URL | ✅ https://mays-job-matcher.vercel.app |
| Root `/` HTTP 200 | ✅ |
| `/top` HTTP 200 | ✅ |
| API `descriptionPlain` is plain text | ❌ **STILL CONTAINS HTML ENTITIES** |
| API `description` serves raw HTML | ✅ (entity-encoded as expected) |

---

## 7. FINAL STATUS

**STATUS: PRODUCTION DEPLOYED — API DATAFLOW STILL INCORRECT**

The fix is correctly implemented in the codebase (verified by 207 passing tests and successful local build), but the Vercel serverless functions are not updating with the fixed code despite multiple forced deployments. The production API continues to serve the buggy `descriptionPlain` field containing HTML entities (`<p>`, `<strong>`, etc.) instead of plain text.

**Required next steps (outside this step):**
1. Investigate Vercel serverless function caching/edge cache invalidation
2. Potentially contact Vercel support or purge edge cache
3. Verify fix after cache invalidation

**No further code changes, commits, pushes, or deployments in this step.**

---

*Log completed: 2026-08-26*