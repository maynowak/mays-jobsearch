# HTTP500-CV-WORKFLOW-SEARCH-01 — Fix HTTP 500 When Starting Search After CV Workflow

## Current status
IN PROGRESS — Added debug logging to capture actual error. Ready for manual testing.

## Audit date/time
2026-09-29 11:35:00 CET

## Git state (Start)
- Branch: main
- HEAD: ba9ff58
- Working tree: clean (except report files)

## Git state (Current)
- Branch: main
- HEAD: 1a5c94e
- Working tree: clean (except report files)

## Task / Purpose
Fix HTTP 500 ("Something went wrong on our end") when user completes CV workflow (creates search profile + ATS profile) and clicks "jobsuche starten" button. The error occurs in the CV workflow path, not manual search.

## Completed audit sections
1. **Code path analysis** — Traced from UI button → `startSearchWithSavedProfile` / `handleSearchWithSelectedCvs` → `runCvSearch` / `runAiSearchWithProfile` → `fetchJobs` → `/api/jobs`
2. **Parameter format audit** — Identified two paths with different `skills` formats:
   - Saved profile path: `skills` = comma-separated string (from Profile type)
   - AI search path: `skills` = JSON string (from `JSON.stringify(selectedSkills)`)
3. **API handler review** — Confirmed `api/jobs.mjs` now has defensive parsing for ALL params (commit ba9ff58)
4. **Frontend serialization review** — `src/api.ts` `fetchJobs` joins arrays with commas, `normalizeSkillsParam` handles JSON strings
5. **Debug logging added** — API handler logs error stack + request query; frontend logs submitted profile in both paths

## Actual findings
### Two distinct search paths from CV workflow:

**Path A: Saved Search Profile** (`startSearchWithSavedProfile` → `handleSubmit` → `runSearch`)
- Source: `cvProfileStore.ts` saved search profile
- `profile.skills`: comma-separated string (e.g., "react,node")
- `profile.targetRoles`: string[]
- `profile.workModes`: WorkMode[]
- `profile.employmentTypes`: EmploymentType[]
- Frontend `fetchJobs` joins arrays with commas
- API handler `parseArrayParam` handles comma-separated strings

**Path B: AI Search (Skill Selection Confirm)** (`handleSkillSelectionConfirm` → `runAiSearchWithProfile`)
- Source: `cvState.selectedSkills` (user-confirmed skills)
- `searchProfile.skills`: JSON string (e.g., `'["react","node"]'`)
- Other fields spread from `baseProfile` (`cvState.cvProfile` or `cvState.profile`)
- `normalizeSkillsParam` in `src/api.ts` handles JSON string → comma-separated
- Other fields passed as-is (should be arrays from Profile type)

### Debug logging added (commit 1a5c94e):
- **API handler** (`api/jobs.mjs`): Logs error stack + request query for debugging HTTP 500
- **Frontend `runCvSearch`**: Logs submitted profile via `console.debug`
- **Frontend `runAiSearchWithProfile`**: Logs searchProfile via `console.debug`

### Potential issues identified (to verify with logs):
1. **Path B `skills` double-encoding risk**: `normalizeSkillsParam` expects JSON string OR comma-separated. Should work but need to verify.
2. **`targetRoles` format**: In Path B, spread from `baseProfile` which should be `string[]`. Frontend joins with commas. API parses with `parseArrayParam`.
3. **`workModes` / `employmentTypes`**: Should be arrays from Profile type. Frontend joins with commas. API parses with `parseArrayParam`.
4. **`radiusKm`**: Could be `null` or number. Frontend sends as string. API `parseNumberParam` handles.
5. **`city`**: String. Passed as-is.

## Evidence / file references
- `src/App.tsx` — `runCvSearch` (line 278), `runAiSearchWithProfile` (line 799), `startSearchWithSavedProfile` (line 556), `handleSearchWithSelectedCvs` (line 587) — **added console.debug logging**
- `src/api.ts` — `fetchJobs` (line 191), `normalizeSkillsParam` (line 186), `ensureArray` (line 186)
- `api/jobs.mjs` — Defensive parsing for all params + error stack/query logging (commit ba9ff58, 1a5c94e)
- `src/lib/cvProfileStore.ts` — Profile storage/retrieval
- `src/types.ts` — Profile type definition

## Classification
**YELLOW** — Debug logging deployed. Need manual testing to capture actual error.

## Terraform checks actually executed and their results
N/A — This project does not use Terraform.

## Git status
- Branch: main
- HEAD: 1a5c94e
- Working tree: clean (except report files)
- Uncommitted: `docs/reports/HTTP500-CV-PROFILE-SEARCH-FIX-01-EXECUTION_LOG.md`, `docs/reports/HTTP500-CV-WORKFLOW-SEARCH-01-EXECUTION_LOG.md`, `docs/reports/SOURCE-INPUT-ADAPTER-01-EXECUTION_LOG.md`

## Files changed (in this investigation)
- `api/jobs.mjs` — Added error stack + request query logging
- `src/App.tsx` — Added `console.debug` in `runCvSearch` and `runAiSearchWithProfile`

## Open questions
1. What is the actual error causing HTTP 500? (Logs will capture on next reproduction)
2. Does it occur in Path A (saved profile), Path B (AI search), or both?
3. Is it a source-specific error (e.g., Greenhouse config missing)?
4. Is `cvState.cvProfile` populated correctly with all fields as arrays?

## Risks
- User cannot start job search after CV workflow completion
- Blocking core user flow
- Generic error message doesn't help debugging

## Recommended next actions
1. **Manual test**: Complete CV workflow → click "jobsuche starten" → check browser console for debug logs + server logs for error details
2. Analyze captured error to identify root cause
3. Apply targeted fix based on actual error

## Current resume point
Debug logging deployed. Ready for manual testing to capture actual error. Next step: reproduce issue and analyze logs.