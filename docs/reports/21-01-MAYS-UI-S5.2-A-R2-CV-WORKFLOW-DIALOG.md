# MAYS-UI-S5.2-A-R2 — CV-Verarbeitung blockiert Scrollen

- Status: **IMPLEMENTED; CHROMIUM VERIFIED; FIREFOX NOT VERIFIED**
- Date: 2026-10-29
- Branch: `feature/ui-orchestrator-s0`
- Preflight HEAD: `9ac5a22`
- Scope: Dashboard-V2 workflow rendering and scroll-lock regression
- `/profil`: unchanged

## Preflight and reproduction

The working tree contained the same pre-existing user changes and untracked
files as R1. They were preserved and not staged. The issue was reproduced on
`/dev/dashboard-v2` after adding synthetic CV files, selecting one and clicking
“Ausgewählten CV verarbeiten”.

Observed before the fix:

- `handleCvProcess` changed `cvState.step` to `consent-required`.
- The `useEffect` tied to `cvDialogOpen` acquired the central body/html
  scroll-lock.
- The Dashboard-V2 early return rendered `DashboardV2` and `Footer`, but did
  not render `cvProcessingUI`.
- Therefore the lock was active while neither the portal nor the inline
  workflow card was present in the DOM. The user saw no dialog and could not
  scroll.

## Cause and code evidence

The existing Searchpage path renders `{cvProcessingUI}` inside the search
sidebar in `src/App.tsx`, so its workflow card/portal is present. The Dashboard
V2 branches at `src/App.tsx` returned early at the `isDevDashboardV2` and
`isDevDashboardV2Auth` branches and omitted that node.

The existing dialog architecture itself was not the cause:

- `cvOverlayNode` uses `createPortal(..., document.body)`.
- `.cv-workflow-overlay` has the existing high z-index and `overflow-y: auto`.
- `.cv-processing-card` is focusable (`tabIndex={-1}`) and the effect focuses
  it after portal commit.
- `acquireBodyScrollLock` / `releaseBodyScrollLock` use a counter and restore
  html/body overflow, position, top, width and scroll position.

The missing early-return render was the concrete defect. A secondary integration
issue was identified and fixed in the same change: for `document-selected`,
the existing `cvProcessingCard` contains the old document list. Dashboard-V2
already supplies its own CV section/list, so rendering the inline card there
duplicated the list. Dashboard V2 now suppresses the non-dialog inline workflow
card while retaining the portal for actual workflow steps.

## Repair

`src/App.tsx` changes:

1. Render `{cvProcessingUI}` in both DEV Dashboard-V2 early returns, including
   the authenticated preview branch.
2. Keep the existing `cvOverlayNode`, consent, model selection, processing,
   error and focus/scroll-lock workflow unchanged.
3. Suppress the non-dialog inline `cvProcessingCard` on Dashboard-V2 routes;
   the dashboard CV section remains the document-list owner. When a workflow
   dialog is active, the existing portal is still rendered.

No second consent/parser/model implementation was created. External requests
remain behind the existing consent and model-selection steps.

## Regression test

`src/App.test.tsx` now includes
`MAYS-UI-S5.2-A-R2: Dashboard CV workflow dialog`:

- enters `/dev/dashboard-v2`;
- uploads a synthetic CV and selects it for processing;
- clicks the existing processing button;
- asserts the existing consent dialog is visible;
- asserts body and html are locked while open;
- cancels and asserts both overflow values are restored.

Existing Searchpage scroll-lock, Escape, unmount, repeated-open and CV consent
tests remain in place.

## Browser verification

### Chromium

Using Vite development server `http://127.0.0.1:5182` and synthetic PDFs:

- two CVs uploaded and one selected;
- processing button opened the visible consent dialog;
- body/html overflow became `hidden` only while the dialog was open;
- focus landed on `.cv-processing-card`;
- dialog content had `overflow-y: auto` at 390 and 1440 px;
- Cancel restored body/html overflow to empty values;
- no console errors;
- no horizontal overflow at 390 px;
- `/search` remained scrollable at 390 and 1440 px before any dialog;
- Dashboard-V2 checks passed at 390 and 1440 px.

Successful parser/profile processing was not claimed: Vite provides the client
only, and no local API server/credentials were available for the external
`/api/profile` request. The automated App test uses API/PDF mocks; that evidence
is kept separate from the real browser interaction.

### Firefox

Firefox was attempted via Playwright using `/usr/bin/firefox`, but the browser
exited before connecting with `Could not find profile folder`. Firefox is
therefore **NOT VERIFIED**, while Chromium is the supplementary browser
evidence.

## Verification results

- Focused dashboard dialog test: PASS.
- Existing CV workflow/scroll-lock tests: PASS.
- Full suite: **842 passed | 5 skipped; 78 files passed | 3 skipped**.
- `npm run build`: PASS.
- `node --check api/**/*.mjs`: PASS.
- `git diff --check`: PASS.

No new storage, API, package, AWS, Cognito, RIS, DNS, push or deployment change
was made.
