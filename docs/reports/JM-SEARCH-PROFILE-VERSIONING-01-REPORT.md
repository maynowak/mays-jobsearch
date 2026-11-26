# JM-SEARCH-PROFILE-VERSIONING-01 — Optimistic Versioning for Durable Search Profiles

**Status:** `IMPLEMENTED / VERIFIED LOCAL — NO LIVE RIS WRITE`
**Branch:** `feature/jm-search-profile-versioning-01`
**Base:** `origin/main` `c63911f`
**Scope:** Jobsearch BFF/client/UI only. No RIS repository, AWS, Terraform,
Cognito, consent, deployment or main merge.

## 1. Goal

Send the **loaded** record version on durable manual, CV-search and ATS
search-profile updates and deletes, without changing the RIS contract. A stale
version must fail closed, show a clear conflict, and reload the newer record
instead of overwriting it.

## 2. Contract decision

| Decision | Value |
|---|---|
| Update body field | `version` (positive integer) |
| Delete transport | existing `?version=` query parameter |
| Create paths | unchanged; no `version` field is sent |

Evidence inside this repository:

- RIS records already carry `version` in
  `src/lib/profiles/contractTypes.ts`.
- The BFF already forwards `?version=` on DELETE in
  `api/_lib/ris/searchProfilesHandler.mjs`.
- The BFF forwards manual/CV PUT bodies unchanged and only normalizes ATS
  bodies, so the client field must be preserved explicitly for ATS.

Limitation: direct inspection of the RIS repository/OpenAPI is outside this
task's boundary (`AGENTS.md`). The Jobsearch-side evidence supports `version`;
no RIS contract or RIS code was changed. If RIS rejects the field, the write
fails closed and this remains a separately authorised RIS-contract dependency.
No live RIS write was performed.

## 3. Implementation

### Contract types and client

- `src/lib/profiles/contractTypes.ts`
  - `UpdateManualSearchProfileInputV1`, `UpdateCVSearchProfileInputV1` and
    `UpdateATSProfileInputV1` now expose an optional `version`.
- `src/lib/searchProfilesApi.ts`
  - remote update signatures require a positive `version`;
  - update bodies include `version`;
  - delete requests add `version` to the query;
  - `requireSearchProfileVersion()` refuses a missing/invalid version before
    any request (`version_required`);
  - `isSearchProfileVersionConflict()` recognises HTTP `409`,
    `version_conflict` and the BFF `conflict` fallback.
  - create functions are unchanged and do not add `version`.

### BFF

- `api/_lib/ris/searchProfilesHandler.mjs`
  - ATS PUT now allows and validates `version` and preserves it after
    normalization;
  - ATS POST still rejects `version` as an unexpected field, so creates stay
    version-free;
  - manual/CV PUT bodies remain forwarded unchanged;
  - existing DELETE `version` forwarding remains unchanged.

### Hook and UI

- `src/lib/usePersistentSearchProfiles.ts`
  - manual mapping preserves the loaded `version`;
  - `saveManual`, `deleteManual`, `updateCv`, `deleteCv`, `updateAts` and
    `deleteAts` thread the loaded version;
  - manual 409s reload the list before rethrowing the conflict.
- `src/components/PersistentCvProfilesOverlay.tsx`
  - edit state keeps the loaded CV/ATS version;
  - update and delete call sites send it;
  - 409s reload the current list, show a conflict message and do not retry.
- `src/components/ManualSearchProfilesSection.tsx`
  - edit form keeps the loaded version;
  - save/delete pass it through;
  - 409s show a dedicated conflict message.
- `src/App.tsx`
  - manual save/delete handlers forward the optional version only on the
    persistent path; session repositories are unchanged.
- `src/lib/manualSearchProfiles.ts`
  - the session model may carry an optional durable `version`; session-only
    profiles still have none and do not invent one.
- `src/i18n.tsx`
  - DE/EN conflict messages for manual and CV/ATS profile managers.

## 4. Tests added

- `src/lib/searchProfilesApi.test.ts`
  - manual, CV and ATS update bodies include the loaded version;
  - manual, CV and ATS delete URLs include the loaded version;
  - create requests contain no `version`;
  - 409 is classified as a conflict;
  - an update without a version is rejected before fetch.
- `tests/api/ris-search-profiles.test.mjs`
  - manual PUT forwards the version body;
  - manual and ATS DELETE forward `?version=`;
  - ATS PUT preserves the version after normalization;
  - ATS POST rejects a version before calling RIS.
- `src/components/ManualSearchProfilesSection.test.tsx`
  - edit and delete pass the loaded version;
  - stale-version save shows the conflict message and no success notice;
  - create passes no version.
- `src/components/PersistentCvProfilesOverlay.test.tsx`
  - CV update/delete send the loaded version;
  - ATS update/delete send the loaded version;
  - a 409 reloads the list, shows the conflict and is not retried.

## 5. Verification evidence

```bash
npx vitest run \
  src/lib/searchProfilesApi.test.ts \
  src/components/ManualSearchProfilesSection.test.tsx \
  src/components/PersistentCvProfilesOverlay.test.tsx \
  tests/api/ris-search-profiles.test.mjs
# 4 files passed, 53 tests passed

npm run build
# tsc -b + vite build PASS

node --check api/_lib/ris/searchProfilesHandler.mjs
# PASS

git diff --check
# PASS

git diff -- . ':!docs' | grep -inE "(secret|api[_-]?key|private[_-]?key|password|client_secret|begin (rsa|ec|openssh) private)"
# no matches
```

Full suite (parallel):

```text
Test Files  8 failed | 196 passed | 3 skipped (207)
Tests       10 failed | 2154 passed | 5 skipped (2169)
```

Observed failures:

- 8 tests in `src/ManualSearchProfiles.integration.test.tsx` fail at module load
  with the documented pre-existing environment error
  `Denied ID …/node_modules/pdfjs-dist/build/pdf.worker.min.mjs?url`.
- `src/components/CvBuilderEditorRisStorage.test.tsx` has two timing failures
  in the same PDF/CV-builder area.
- Six additional files fail during `loadAndTransform` in the parallel run.

No failure points at the search-profile versioning paths; the focused suites
above are green.

## 6. Boundaries / limitations

- No RIS repository inspection, no RIS code change, no live RIS write.
- No AWS/Terraform/Cognito/consent/API-deployment change.
- No main merge, deployment, branch deletion or force-push.
- `docs/AI_AUDITLOG.md` was intentionally not edited (another agent owns it in
  this orchestration task).
- The RIS PUT acceptance of `version` is inferred from the Jobsearch BFF
  contract and must be confirmed by a separately authorised RIS check or live
  synthetic E2E before production reliance.
