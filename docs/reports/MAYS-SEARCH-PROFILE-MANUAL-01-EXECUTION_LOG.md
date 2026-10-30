# MAYS-SEARCH-PROFILE-MANUAL-01 — Execution Log

- Status: COMPLETE — implementation, tests, build and Chromium runtime smoke green; Firefox/WebKit and the authenticated live flow NOT VERIFIED
- Date: 2026-10-30
- Branch: `main`
- Git baseline: `25f1826` (`fix: close repeated header name masking leak`), `origin/main` in sync (`0 0`)
- Commit: `56b33ba` (`feat: add session-only manual search profiles`), pushed to `origin/main`, in sync after push
- Related fix in this change set: `CV-FILESIZE-DISPLAY-01` (size display + 0-byte upload guard)

## Scope

Implement independent, manually definable search profiles under Dashboard → "Job-Präferenzen":

- no CV, no CV hash, no artificial CV entry,
- no model call for creating/editing/saving/selecting/duplicating/deleting,
- existing `Profile` search contract and existing `/api/jobs` search path reused,
- session-only storage (in-memory), explicitly communicated in the UI,
- separate from ATS matching (no shared score, no invented percentages/weights),
- DE/EN surfaces using the existing Aurora design tokens and UI primitives.

Additional defect in the same scope: CV file sizes below 50 KB were displayed as `0.0 MB`, and 0-byte PDFs were accepted by the multi-upload path.

## Data model

`src/lib/manualSearchProfiles.ts` (new):

```ts
interface ManualSearchProfile {
  id: string;                    // session-unique, stable across edits
  schemaVersion: 1;
  name: string;
  description?: string;
  origin: "manual";
  searchConfig: Profile;         // existing search contract, unchanged
  matchingPreferences: {
    requiredSkills: string[];
    preferredSkills: string[];
    excludedTerms: string[];
  };
  createdAt: string;
  updatedAt: string;
}
```

- Hierarchy unchanged: `CV → SearchProfile → ATSSearchProfile` remains the only CV-bound chain.
- Manual profiles are a separate, parallel collection: `SESSION → ManualSearchProfiles`.
- No migration, no link into `cvProfileStore`, no CV-hash derivation.
- Validation requires a name and at least one target role **or** one keyword, because `/api/jobs` needs at least one search term.
- `toSearchProfile()` returns a defensive copy of `searchConfig` and is the only hand-over point to the search path.

## Session store

- `createManualSearchProfileRepository()` is a `Map`-backed in-memory repository with `list/get/save/delete`.
- Held in an App `useRef`; a fresh repository is created per App mount, therefore a reload clears the collection (verified in unit + integration + browser smoke).
- `save()` never overrides `id`/`createdAt`; `applyManualSearchProfileDraft()` refreshes only `updatedAt`.
- All reads return defensive copies (`cloneManualSearchProfile`), so callers cannot mutate stored records.
- No `localStorage`, no `sessionStorage`, no backend call, no account-persistence claim.
- UI wording: badge "Nur diese Sitzung" / "This session only", button "Für diese Sitzung speichern", note that no CV, no CV hash and no AI model is involved.

## Dashboard and UI

- `ManualSearchProfilesSection.tsx` (new): list, create, edit, duplicate, delete with inline confirmation, and "Damit suchen".
- `DashboardV2.tsx`: new optional `preferencesSection`; the "Job-Präferenzen" nav item is enabled only when the section is supplied, otherwise it stays "soon"/disabled. Removed from the "Upcoming features" grid.
- `DashboardV2AuthenticatedPreview.tsx`: prop pass-through for `/profil` and the authenticated preview route.
- `App.tsx`: store wiring plus `handleSaveManualProfile`, `handleDeleteManualProfile`, `handleDuplicateManualProfile`, `handleSearchWithManualProfile`.
- One term per line for required/preferred/excluded textareas (unambiguous, lossless). Keywords/roles keep the existing comma contract.
- `parsePhraseList` added in `src/lib/skills.ts` so manually typed multi-word keywords such as `Cloud Architecture` stay one term; `parseTargetRoles` now delegates to it. `parseSkills` whitespace semantics are unchanged, so ATS tokenization is not affected.
- Existing primitives only: `Card`, `Badge`, `Button`, `Status`, existing `.field` markup, existing Aurora CSS variables. No Tailwind, no new dependency.

## Search integration

- "Damit suchen" runs `toSearchProfile(profile)` → `handleProfileChange(...)` → `handleSubmit(...)` → `navigateInApp("/search")`.
- Exactly one request to the existing `/api/jobs` path; the form is pre-filled with the profile values.
- No second job API, no parallel request, no automatic `/api/match` or `/api/ats-analysis` call.
- `api/jobs.mjs` contains no model/LLM usage; model calls remain confined to `/api/match`, `/api/profile`, `/api/ats-analysis`.
- During an active search/matching run, profile actions are disabled (`busy`).

## ATS separation

- Manual criteria are stored in `matchingPreferences`, separate from ATS evidence fields and from `CvProfile`/`ATSSearchProfile` data.
- `evaluateManualProfileMatch()` is a pure deterministic helper (`match` / `mismatch` / `unknown`) with term-boundary matching and no percentages, weights or model input.
- Deliberate boundary: the helper is **not** wired into result filtering or the ATS overlay in this change set. It is unit-tested groundwork, not a user-facing score.
- ATS tokenization regression is covered by the unchanged `parseSkills`/`parseTargetRoles` tests plus the existing ATS suites.

## CV-FILESIZE-DISPLAY-01 (same change set)

### Display root cause

`CvDocumentList.tsx` formatted every document as `(doc.size / 1024 / 1024).toFixed(1) + " MB"`. Any valid PDF below ~50 KB rounded to `0.0 MB`.

### Fix

- New `src/lib/fileSize.ts`: `formatFileSize(bytes, locale)` scales B → KB → MB → GB with locale-aware number formatting (`Intl.NumberFormat`) and unit promotion at the 1024 boundary.
- `fileSizeLocale(lang)` maps `de → de-DE`, `en → en-US`.
- `CvDocumentList.tsx` now renders `formatFileSize(doc.size, fileSizeLocale(lang))`.
- Expected values, covered by test and browser DOM: `0 B`, `850 B`, `25,0 KB`, `512,0 KB`, `1,5 MB` (EN: `1.5 MB`).

### 0-byte upload guard

- New `src/lib/cvFileValidation.ts`: `MAX_CV_FILE_SIZE_BYTES = 10 MB`, reasons `not-pdf` / `too-large` / `empty` (only exactly 0 bytes counts as empty; small valid PDFs stay accepted), plus `partitionCvFiles()`.
- `CvUpload.tsx` (single upload) and `App.handleAddCvFiles` (multi upload) use the same validation; `handleCvUploadStart` re-checks as defense-in-depth.
- Multi-upload reports skipped files through `cv.emptyFilesSkipped` / `cv.invalidFilesSkipped`; `DashboardV2CvSection` now renders the status message so rejections are visible on `/profil`.
- File type check and the 10 MB limit are unchanged.

## Verification

| Check | Result |
| --- | --- |
| `npm test -- --run` | PASS — 85 files passed, 3 skipped; 925 tests passed, 5 skipped (baseline before this change: 864 passed, 5 skipped) |
| `npx tsc --noEmit` | exit 0 (see deviation note) |
| `npx tsc --noEmit -p tsconfig.app.json` | exit 0 |
| `npm run build` (`tsc -b && vite build`) | PASS |
| `git diff --check` | PASS |
| Chromium smoke, 1440×900 and 390×844 | PASS — preferences section renders, profile creation/save works, multi-word keyword `Cloud Architecture` preserved, session notice visible, mobile horizontal overflow 0 px, no console errors |
| Reload behavior | PASS — in-memory list empty after a fresh page load |
| Network during profile actions | Only `GET /api/models` on app mount (model-selector metadata). No `POST /api/jobs`, `/api/match`, `/api/profile` or `/api/ats-analysis` |
| Firefox / WebKit | NOT VERIFIED |
| Authenticated live flow against deployed backend | NOT VERIFIED (no production deploy in this cycle) |
| Manual screen-reader/a11y audit | NOT VERIFIED |

### Type-check deviation (repo-conform)

`npx tsc --noEmit` is a no-op with this repository's reference-only root `tsconfig.json`. The effective checks are `tsc -b` (run by `npm run build`) and `npx tsc --noEmit -p tsconfig.app.json`; both pass. No API files were changed, so no new `node --check api/**/*.mjs` run was required.

## AI / privacy / data-flow impact

- No new AI provider, model call, destination, API endpoint or storage backend.
- Profile CRUD is local React state only; no CV data, CV hash or model input is created or transmitted.
- Session-only storage means no account persistence and no cross-device availability; the UI states this explicitly.
- The defect fix does not add data flow: it only formats a locally known byte count and rejects invalid local files before processing.
- No real CV, provider or production data was used for verification.

## Review follow-up

An independent review of the diff reported no blockers and two should-fix items:

- **Fixed:** focus loss when opening/closing the profile form. The form now auto-focuses the name field, and save/cancel return focus to the "Neues Suchprofil" button. The toolbar button is disabled while the form is open, so an open draft cannot be discarded by a second click.
- **Fixed:** a pending delete confirmation was not cleared when starting create/edit or cancelling; it could reappear for the old profile. It is now reset on those transitions.
- **Documented, not changed:** required/preferred/excluded criteria are stored and summarized but intentionally not applied to result filtering, and `evaluateManualProfileMatch` is production-unused. This is the deliberate boundary described above; wiring it needs a separate product decision.
- **Documented, not changed:** the dashboard CV section receives the global App status, so a non-CV status could appear there. The prop was added to make upload rejections visible; no duplicate `id="status"` occurs because only one `Status` is mounted per route.

## Open points

- `evaluateManualProfileMatch()` is intentionally unused by production filtering. If result filtering is desired, it needs its own product decision, UI copy and tests.
- Firefox/WebKit and the authenticated live flow remain open verification items.
- Mobile CSS was checked for overflow and basic visibility only; no pixel-level visual review of every breakpoint.

## Changed files

New:
- `src/lib/manualSearchProfiles.ts`, `src/lib/manualSearchProfiles.test.ts`
- `src/components/ManualSearchProfilesSection.tsx`, `src/components/ManualSearchProfilesSection.test.tsx`
- `src/lib/fileSize.ts`, `src/lib/fileSize.test.ts`
- `src/lib/cvFileValidation.ts`, `src/lib/cvFileValidation.test.ts`
- `src/ManualSearchProfiles.integration.test.tsx`

Modified:
- `src/App.tsx`, `src/components/DashboardV2.tsx`, `src/components/DashboardV2AuthenticatedPreview.tsx`
- `src/components/CvDocumentList.tsx`, `src/components/CvUpload.tsx`, `src/components/DashboardV2CvSection.tsx`
- `src/lib/skills.ts`, `src/i18n.tsx`, `src/styles.css`
- `src/components/CvDocumentList.test.tsx`, `src/components/DashboardV2.test.tsx`

## Deploy / push side effects

- Commit `56b33ba` created on `main` and pushed to `origin/main` (`0 0` afterwards).
- No production deployment performed and no `vercel --prod` executed.
- The project has no automatic Git deploy; the push does not publish production.
- No secrets, no `.env`, no generated build artifacts committed.
