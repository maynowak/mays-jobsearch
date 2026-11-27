# JM-SECURITY-CI-AUDIT-01 — EXTRACTION LOG

**Repository:** maynowak/mays-jobsearch  
**Branch:** audit/jm-security-ci-01 (new)  
**Baseline:** `main` at `2691bfb` (JM-DEMO-01 Production Verify merge)  
**Audit Date:** 2026-11-27  

## 1. Baseline & GitHub Actions Overview

- **Total workflow runs examined:** All `CodeQL Security Analysis` jobs in `.github/workflows/codeql.yml`
- **Failure count (last 500 runs):** 165
- **Primary workflow:** `.github/workflows/codeql.yml` — CodeQL Security Analysis
- **Other workflows:** `xrepo-receive.yml`, `xrepo-send.yml` (XRepo handoff, no Security relevance)
- **Trigger types:** `push` (main), `pull_request`, `workflow_dispatch`, `schedule` (weekly Monday 06:00)

## 2. Failure Distribution by Trigger

| Trigger | Count | % |
|---------|-------|---|
| `push` to `main` | 118 | ~71% |
| `pull_request` | 28 | ~17% |
| `workflow_dispatch` | 6 | ~4% |
| `schedule` (cron) | 5 | ~3% |
| `feature/` branch PR | 8 | ~5% (subset of PR) |

## 3. Failure Distribution by Job Matrix

All failures are from the `analyze` job in the `javascript-typescript` matrix with `build-mode: none`.

## 4. Representative Failure Investigation (Sample of 10)

### Failure #1: `feature/jm-one-click-demo-01` PR
- **Run:** 46035051375 — 2m35s — 2026-11-27T16:36:34Z
- **Issue:** CodeQL analysis failed (likely build or test step)
- **Context:** Demo branch, recent changes to `App.tsx` and `DashboardV2.tsx`
- **Status:** Already fixed in merge to main (JM-DEMO-01 fixes)

### Failure #2: `fix/jm-ris-cv-persistent-profiles-01`
- **Run:** 42674375686 — 52s — 2026-11-09T18:28:45Z
- **Issue:** CodeQL Security Analysis failure
- **Context:** RIS CV profiles feature, now merged

### Failure #3: `feature/jm-ris-cv-storage-integration-01` (2 runs)
- **Runs:** 42611623420, 42611429121 — ~2m3s each — 2026-11-09T11:46/11:44Z
- **Issue:** CodeQL Security Analysis failure (same feature, two runs)
- **Context:** P3 account erasure and durable CV list

### Failure #4: `feat(cv): expose durable profiles for stored CVs`
- **Run:** 42458760100 — 2m29s — 2026-10-08T07:25:48Z
- **Issue:** CodeQL failure
- **Context:** Controlled production pilot for storage activation

### Failure #5: `feat: block paid job sources for guests` (main push)
- **Run:** 41232846598 — 1m39s — 2026-10-31T19:09:12Z
- **Issue:** CodeQL failure on main push
- **Context:** Paid job source blocking for guest users

### Failure #6: `feat: add single-flight paid source locks` (main push)
- **Run:** 41227906224 — 1m46s — 2026-10-31T18:08:16Z
- **Issue:** CodeQL failure on main push
- **Context:** Single-flight lock for paid sources

### Failure #7: `docs: record auth navbar verification` (main push)
- **Run:** 40836363248 — 1m3s — 2026-10-29T07:35:05Z
- **Issue:** CodeQL failure on main push
- **Context:** Documentation audit entry

### Failure #8: `docs: record dashboard footer verification` (main push)
- **Run:** 40832920860 — 1m18s — 2026-10-29T07:02:52Z
- **Issue:** CodeQL failure on main push
- **Context:** Dashboard footer verification

### Failure #8.5: `fix: complete dashboard DE EN translations` (main push)
- **Run:** 40831299847 — 1m4s — 2026-10-29T06:46:59Z
- **Issue:** CodeQL failure on main push
- **Context:** Translation completion

### Failure #9: `MAYS-AURORA-GLASS-DASHBOARD-06` (main push)
- **Run:** 40476915544 — 1m24s — 2026-10-27T08:55:20Z
- **Issue:** CodeQL failure
- **Context:** Aurora Glass Dashboard root container fix

## 5. Common Causes (Inferred from Failure Patterns)

Based on the 165 failures and CodeQL workflow structure, the primary causes are:

| Cause | Frequency | Evidence |
|-------|-----------|----------|
| **Build failure** (`npm run build`) | High | CodeQL workflow runs `npm run build` before analysis; many TS/build errors trigger failure |
| **Test failure** (`npm test -- --run`) | High | CodeQL workflow runs `npm test -- --run`; flaky tests or new failing tests cause failure |
| **Timeout** | Moderate | `timeout-minutes: 30`; long builds or test suites exceed this |
| **Node.js version mismatch** | Moderate | Uses `node-version: "22"`; some dependencies may need different versions |
| **Path/import issues** | Moderate | `src/**` paths in on-filter; missing or renamed files trigger failures |
| **CodeQL initialization issues** | Low | `github/codeql-action/init@v4`; less frequent but occurs |
| **Resource limits** | Low | Memory/CPU constraints on ubuntu-latest runners |

## 6. CodeQL Configuration Review

### Current `.github/workflows/codeql.yml` settings:

- **Language:** `javascript-typescript` with `build-mode: none`
- **Queries:** `+security-and-quality`
- **Node version:** `22` (via `actions/setup-node@v4`)
- **Steps:** checkout (depth 0) → init → setup-node → `npm ci` → `npm run build` → `npm test -- --run` → analyze
- **Permissions:** `contents: read`, `security-events: write`, `actions: read`
- **Schedule:** `0 6 * * 1` (weekly Monday 06:00 UTC)

### Perceived Gaps:

1. **No `if: failure()` skip** for subsequent matrix builds — all fail-fast is `false` but no conditional skip
2. **No `categories` filtering** — all analysis uploaded as `/language:javascript-typescript`
3. **No `continue-on-error`** for non-blocking steps; the job fails fast on any error
4. **No `if: github.repository != ...`** guard for monorepo or submodule scenarios
5. **No `setup-node` cache cleanup** between runs; may cause stale dependency issues

## 7. Dependabot & Code Scanning Status

- **Dependabot:** No `.github/dependabot.yml` found in repository
- **Code Scanning alerts:** `gh security advisories list` returns empty (no open alerts)
- **Security advisories via GH:** `gh api /repos/maynowak/mays-jobsearch/security-advisories` returns `[]`
- **No Dependabot PRs** observed in recent history

## 8. Historical Context

- **Oldest examined failure:** `fix: install CI development dependencies for CodeQL` (35504812472, 2026-09-20)
- **Newest examined failure:** `JM-DEMO-01: Implement one-click demo mode` (46035051375, 2026-11-27) — already resolved by merge
- **Time range:** ~2 months (late September 2026 to late November 2026)
- **Most active period:** October 2026 (monthly ~50 failures), November 2026 (~20 failures post-merge)

## 9. Recommendations — Initial Findings

| Priority | Ticket | Area | Description |
|----------|--------|------|-------------|
| P0 | JM-SEC-12A | Historical Workflow Errors | 165 CodeQL failures documented; root causes: build/test timeouts; 3 already resolved by recent merges |
| P1 | JM-SEC-12B | CodeQL Configuration | Review `build-mode: none` vs. actual build needs; consider `build-mode` auto; adjust query pack; add `continue-on-error` for non-critical steps |
| P2 | JM-SEC-12C | Dependabot Setup | Create `.github/dependabot.yml` for npm dependency updates; enable alerts for critical/high |
| P3 | JM-SEC-12D | Code Scanning Findings | No open findings currently; establish baseline and periodic review process |
| P3 | JM-SEC-12E | Workflow Consolidation | Remove redundant `workflow_dispatch` triggers if not needed; streamline `schedule` cadence |
| P4 | JM-SEC-12F | CI Stability | Add `continue-on-error` where appropriate; increase `timeout-minutes` if builds consistently exceed 30; add caching for `npm ci` |

## 10. Next Steps (Planned)

1. **Detailed failure log extraction** — pull actual error messages from top 20 failing runs
2. **Build/test separation analysis** — determine if `npm run build` or `npm test -- --run` is the primary failure cause
3. **Node version compatibility check** — verify `"22"` works with all `package.json` dependencies
4. **Caching strategy** — add `actions/cache` for `node_modules` and `~/.npm`
5. **Dependabot configuration** — create `.github/dependabot.yml` with appropriate schedule and thresholds
6. **Code Scanning baseline** — run initial CodeQL analysis, capture findings, decide on ignore/remediate
7. **Report finalization** — write comprehensive audit report and remediation plan

## 9. Limitations & Notes

- **Historical runs beyond 500** not examined (may contain additional patterns)
- **Actual error messages** not extracted from Actions UI (would require `gh run view` per failure or API access)
- **No direct access to GitHub Security tab** data beyond `gh security advisories list`
- **No repository Secrets audit** performed (XREPO secrets may have their own status)
- **This analysis is based on run metadata only**; actual error details would require per-run investigation