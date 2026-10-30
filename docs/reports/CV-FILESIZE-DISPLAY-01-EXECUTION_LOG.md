# CV-FILESIZE-DISPLAY-01 — Execution Log

- Status: COMPLETE — display fix and upload guard implemented, tested and smoke-checked in Chromium; Firefox/WebKit NOT VERIFIED
- Date: 2026-10-30
- Branch: `main`
- Git baseline: `25f1826`
- Delivered together with `MAYS-SEARCH-PROFILE-MANUAL-01` (see `MAYS-SEARCH-PROFILE-MANUAL-01-EXECUTION_LOG.md`)

## Reported defect

- Every CV under ~50 KB was shown as `0.0 MB` in the document list (e.g. a 25 KB PDF).
- The dashboard multi-upload accepted 0-byte PDF files and marked them as ready for processing; only the single upload validated type and size.

## Root causes

1. `CvDocumentList.tsx` hard-coded MB with one decimal: `(doc.size / 1024 / 1024).toFixed(1)`.
2. `App.handleAddCvFiles()` mapped every selected file into a `CvDocument` without validation. `CvUpload.tsx` had its own type/size checks, so the two upload paths diverged and neither rejected exactly 0 bytes.

## Fix

- `src/lib/fileSize.ts` — `formatFileSize(bytes, locale)`:
  - invalid/negative/0 → `0 B`
  - bytes without decimals; KB/MB/GB with one decimal
  - locale-aware digits/separators via `Intl.NumberFormat` (`de-DE` comma, `en-US` point)
  - unit promotion at the 1024 boundary so `1048575` bytes does not render as `1024,0 KB`
- `src/lib/cvFileValidation.ts` — single shared validation:
  - `MAX_CV_FILE_SIZE_BYTES = 10 MB` (unchanged limit)
  - rejection reasons `not-pdf`, `too-large`, `empty`
  - only exactly 0 bytes is `empty`; small valid PDFs remain accepted
  - `partitionCvFiles()` splits accepted/rejected for multi-upload
- `CvDocumentList.tsx` uses `formatFileSize` + `fileSizeLocale(lang)`.
- `CvUpload.tsx` and `App.handleAddCvFiles()` use the shared validation; `handleCvUploadStart()` re-validates defensively.
- Multi-upload status: `cv.emptyFilesSkipped` (only empty files) or `cv.invalidFilesSkipped` (type/size), rendered in the dashboard CV section via a new `message` prop and the existing `Status` component.

## Expected display values

| Bytes | DE | EN |
| --- | --- | --- |
| 0 | `0 B` | `0 B` |
| 850 | `850 B` | `850 B` |
| 25 600 | `25,0 KB` | `25.0 KB` |
| 524 288 | `512,0 KB` | `512.0 KB` |
| 1 572 864 | `1,5 MB` | `1.5 MB` |

## Verification

- `src/lib/fileSize.test.ts` — unit values, locale mapping, 1024 promotion, invalid input
- `src/lib/cvFileValidation.test.ts` — 0-byte rejection, small valid PDF acceptance, 10 MB limit, type check, multi-upload partition
- `src/components/CvDocumentList.test.tsx` — table-driven DE values, EN locale, processed document still shows correct size
- `src/ManualSearchProfiles.integration.test.tsx` — empty PDF rejected in the dashboard multi-upload, small valid PDF accepted, empty PDF rejected on the upload tab with a readable message
- `npm test -- --run` — PASS (925 passed, 5 skipped)
- `npm run build` — PASS; `npx tsc --noEmit -p tsconfig.app.json` — PASS; `git diff --check` — PASS
- Chromium smoke at 1440×900 / 390×844 — preferences and CV section render without console errors or horizontal overflow

## Boundaries

- The stored byte value is unchanged; only presentation and pre-processing validation changed.
- No new dependency, no API change, no upload of file content, no model call.
- Rejected files are not added to the document list and therefore cannot enter CV extraction, anonymization or profile creation.

## Open points

- Firefox/WebKit rendering of the size column NOT VERIFIED.
- No screenshot-based visual regression baseline added.
