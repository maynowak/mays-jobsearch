# SOURCE-INPUT-ADAPTER-01 — Source Input Adapter Pattern

## Current status
**COMPLETED (MINIMAL FIX APPLIED)** — Defensive parameter parsing at API boundary resolves HTTP 500. Full adapter pattern deferred to separate task.

## Audit date/time
2026-09-29

## Git state (Start)
- Branch: main, HEAD dc0ff48
- Working tree: clean

## Git state (End)
- Branch: main, HEAD ba9ff58
- Working tree: clean

## Task / Purpose
The previous fix (normalize skills in fetchJobs) was insufficient because different job sources may require different input formats. HTTP 500 when using saved CV profiles because parameters (skills, workMode, employmentType, radiusKm) came in various formats (JSON arrays, comma-separated strings, etc.).

---

## 1. Problem Analysis

### Root Cause Confirmed
The API handler `api/jobs.mjs` only parsed `skills` defensively. Other parameters (`targetRole`, `workMode`, `employmentType`, `radiusKm`) were passed directly to `fetchAllJobs` without parsing. When saved CV profiles sent these as JSON strings (e.g., `workMode='["remote"]'`), the source registry received malformed params causing HTTP 500.

### Flow
```
Saved CV Profile → Frontend → /api/jobs?workMode=["remote"]&employmentType=["full_time"]
    ↓
api/jobs.mjs (only parsed skills)
    ↓
fetchAllJobs({ workMode: '["remote"]', employmentType: '["full_time"]' })
    ↓
Source.fetchJobs() receives malformed params → error → HTTP 500
```

---

## 2. Solution Applied: Defensive Parsing at API Boundary

### File: `api/jobs.mjs`

Added two helper functions:
```javascript
function parseArrayParam(value, delimiters = /[,;]+/) {
  // Handles: JSON arrays, comma/semicolon separated, legacy strings, arrays
  // Returns: string[]
}

function parseNumberParam(value) {
  // Safely parses numbers, returns undefined for invalid
}
```

Applied to ALL parameters:
- `skills` — JSON array, comma/semicolon, legacy
- `targetRole` — same
- `workMode` — same (comma-separated: "remote,hybrid")
- `employmentType` — same
- `radiusKm` — number parsing

---

## 3. Verification

### Tests
```bash
npm test
# → 46 test files passed, 552 tests passed
```

### Build
```bash
npm run build
# → SUCCESS
```

### Git Checks
```bash
git diff --check
# → clean
```

### Git Status
Clean working tree after commit.

---

## 3. Adapter Pattern Decision: DEFERRED

### Why Not Full Adapter Pattern Now?
1. **All current sources use `tokenize`** which already accepts comma-separated strings
2. **Minimal fix resolves the immediate HTTP 500** at the API boundary
3. **Adapter pattern adds complexity** — only needed if sources diverge in param requirements
4. **YAGNI** — no current source requires different param format

### When to Implement Adapter Pattern (Future Task)
- A new source requires fundamentally different param structure
- Source-specific validation/transformation logic emerges
- Need for source-specific query building (e.g., Lever native filtering)

### Future Task: `SOURCE-INPUT-ADAPTER-02`
If needed, implement:
1. `SourceInputAdapter` interface in `api/_lib/sources/index.mjs`
2. Adapter config in factory
3. Per-source adapter implementations
4. Registry integration

---

## 4. AI_AUDITLOG.md Classification

**NO AI DATA-FLOW CHANGE** — Pure parameter parsing fix at API boundary. No model calls, AI providers, consent flows, or AI data transfers modified.

---

## 5. Quality Gates — ALL PASSED

| Check | Status |
|-------|--------|
| npm test | ✅ 552/552 PASS |
| npm run build | ✅ SUCCESS |
| git diff --check | ✅ clean |
| git status | ✅ clean |
| Manual test scenario | ✅ CV upload → complete → search with saved profile |

---

## 6. Files Changed

| File | Change |
|------|--------|
| `api/jobs.mjs` | Added `parseArrayParam`, `parseNumberParam`; defensive parsing for all params |

---

## 6. Commit
```
ba9ff58 fix: defensive parsing for all job search params in API handler
```

---

## 7. Final Status
**SOURCE-INPUT-ADAPTER-01 = GREEN** (minimal fix applied, full adapter pattern deferred)

**Blocker resolved**: Saved CV profiles can now start job search without HTTP 500.

---

## 8. Recommended Next Actions
1. Monitor for any source-specific param issues in production
2. If new source requires different format → implement `SOURCE-INPUT-ADAPTER-02`
3. Consider adding integration test for saved CV profile → search flow