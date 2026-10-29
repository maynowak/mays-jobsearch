# MAYS-UI-S5.2-A-R1 — Weiteren CV hochladen reparieren

- Status: **IMPLEMENTED; CHROMIUM VERIFIED; FIREFOX NOT VERIFIED (RUNTIME BLOCKED)**
- Date: 2026-10-29
- Branch: `feature/ui-orchestrator-s0`
- Preflight HEAD: `7495dc5`
- Scope: repeated CV upload input only; no API or storage change

## Preflight

Repository: `/home/dci-student/projects/Mays-Jobsearch`.

Pre-existing user changes remained untouched and uncommitted:
`src/components/SourcesInfo.test.tsx`, `src/i18n.tsx`, and the existing
untracked user documents/assets/reports/scripts. `/profil` remains unchanged.

The Dashboard-V2 CV section from S5.2-A was compared with the Searchpage flow.
Both use the existing `CvDocumentList`/`App.tsx` state path; no second upload
implementation was introduced.

## Reproduction and root cause

The upload path was:

```text
"Weitere CVs hochladen"
  → inputRef.current.click()
  → hidden input onChange
  → handleFileSelect
  → onAddFiles
  → App.handleAddCvFiles
  → combined documents array
```

`App.handleAddCvFiles` already appended new files to the existing array and
enforced the ten-document limit. The defect was in `CvDocumentList`:

1. The empty-state file input was a separate input without the shared
   `inputRef`.
2. After the first document, the add-more control rendered a hidden input nested
   inside a `<button>`. This invalid interactive nesting made the programmatic
   click/input lifecycle unreliable, particularly in Firefox.
3. The input location therefore changed across the first-upload state
   transition instead of using one stable input element.

`handleFileSelect` already cleared `event.target.value` after `onAddFiles`, so
same-file re-selection was intended to work; the fix preserves that behavior.
Cancelling a native dialog does not fire `change` and therefore leaves the
existing state untouched.

## Fix

`src/components/CvDocumentList.tsx` now:

- mounts one stable hidden multi-file input for both empty and non-empty states;
- keeps the ref attached to that input throughout the component lifetime;
- makes both empty-state and “Weitere CVs hochladen” controls call that same
  input without nesting an input inside a button;
- retains `handleFileSelect` value reset after each successful change;
- retains existing PDF validation in the upstream upload path, ten-document
  limit, append behavior, duplicate behavior and cancellation behavior.

The stable input remains inside the existing actions host class so existing
Searchpage/App tests and selectors continue to exercise the same upload path.

## Selection and data-isolation behavior

- Review picker (`CV zur Durchsicht`) remains separate from document checkboxes
  used for processing/search.
- Adding a second document does not select or process it automatically.
- The dashboard picker can switch the review document without a model/API call.
- Search/ATS profile lists continue to be read by the selected document's CV
  hash only; no list merge or cross-CV fallback was added.
- Empty documents still show an understandable upload entry; parser/API
  processing remains a separate explicit action.

## Tests and browser evidence

### Automated

- Added regression test in `src/components/CvDocumentList.test.tsx`:
  first upload and second upload use the same input, the input value resets,
  and the second file reaches `onAddFiles`.
- Existing App regression test `BROWSER-BUG-08: zweiter CV lässt sich über die
  Liste hochladen`: PASS after the stable-input fix.
- Full suite: **841 passed | 5 skipped; 78 files passed | 3 skipped**.
- `npm run build`: PASS.
- `node --check api/**/*.mjs`: PASS.
- `git diff --check`: PASS.

### Chromium

Against Vite development server `http://127.0.0.1:5182` with two synthetic
PDF files (`cv-a.pdf`, `cv-b.pdf`):

1. Open `/dev/dashboard-v2` and select “Lebenslauf”.
2. Add `cv-a.pdf` from the empty state → one list item.
3. Select “Weitere CVs hochladen”, add `cv-b.pdf` → two list items.
4. Switch the review picker to `cv-b.pdf` → selected value is the second CV.
5. Remove the first CV → one list item remains.
6. Open add-more and cancel (`setInputFiles([])`) → list remains unchanged.
7. Add `cv-a.pdf` again → two list items.
8. At 390 px, document overflow remained false.

Observed result:

```json
{"two":2,"selected":"cv-1793278473317-3wobdeg","removed":1,"cancelled":1,"readded":2,"overflow":false}
```

This browser check covered upload/list state only; no parser, AI or API server
was needed and no API claim is made from Vite-only execution.

### Firefox

Firefox was attempted with `/usr/bin/firefox` through Playwright. It could not
launch in this environment (`Could not find profile folder`, process exit 1).
Therefore Firefox behavior is **NOT VERIFIED**, not reported as passed. The
Chromium result and the DOM/unit regression are the available evidence.

### Responsive and language smoke

Chromium checked the Dashboard-V2 CV section in DE/EN at 390, 768 and 1440 px;
the section rendered and no overflow was observed. Keyboard operation remains
provided by native buttons/selects and the existing file input. Existing
consent/upload tests were retained.

## Data-flow boundary

This repair changes only file-input mounting and event delivery. It does not
change:

- browser PDF parsing or anonymization;
- consent gates or model selection;
- `/api/profile`, ATS, improvement or job APIs;
- session-memory CV documents/profile lists;
- 12-hour lazy TTL or remove-all behavior;
- Cognito, AWS, RIS, DNS, deployment or `/profil`.

## Follow-up

If Firefox is available in CI or a developer workstation, rerun the exact
two-PDF sequence there and append the result. No further implementation is
blocked for Chromium, but final cross-browser acceptance remains conditional on
that Firefox run.
