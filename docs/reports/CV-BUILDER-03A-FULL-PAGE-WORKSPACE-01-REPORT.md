# CV-BUILDER-03A-FULL-PAGE-WORKSPACE-01

**Status:** `CV-BUILDER-03A — FULL-PAGE WORKSPACE IMPLEMENTED / VERIFIED LOCAL / READY FOR MAIN REVIEW`
**Date:** 2026-11-12
**Repository:** `maynowak/mays-jobsearch`
**Branch:** `feature/cv-builder-03a-full-page-workspace`
**Code HEAD:** `36ca447`
**Main baseline:** `4192353`
**Decision:** **STOP before main integration and production release.**

## 1. Starting architecture

The existing CV builder is a React application with:

- import workflow in `CvBuilderImportDialog`;
- import review/manual decisions in `CvBuilderImportReview`;
- editor and validation in `CvBuilderEditor`;
- PDF preview/export in `CvBuilderPreview` and `pdfExport`;
- session-only profile repository in `profileRepository.ts`;
- App-owned editor/import state and modal rendering.

The new work reuses this logic. No second PDF parser, import review, editor
form or PDF export implementation was created.

## 2. Full-page route

Added the regular production route:

`/cv-builder/workspace`

- `rootRouteFor()` routes the path to `CvBuilderWorkspacePage`.
- `main.tsx` renders it inside the existing `LangProvider` and `AuthProvider`.
- The route has its own full-page header, brand link, DE/EN switch and main
  content area.
- No modal overlay, backdrop, focus trap, body scroll lock or fixed dialog
  sizing is used.
- Direct navigation opens a clear start view with:
  - local PDF import;
  - empty CV;
  - resume of an existing in-tab draft when one exists.
- The start view is available at every viewport and reports local-only session
  behavior.

## 3. Import in a new browser tab

`CvBuilderImportDialog` now supports `layoutMode="modal" | "fullpage"`.

- Modal mode keeps the existing behavior.
- Full-page mode removes the overlay/backdrop and uses a normal document-flow
  import workspace.
- The header offers **„↗ In neuem Tab öffnen“** at the start and during an
  active review.
- The import snapshot contains:
  - current step;
  - parsed result;
  - source name;
  - selected sections;
  - manual decisions;
  - selected skills;
  - summary draft;
  - acknowledgement state.
- The new tab hydrates this snapshot, so the user does not re-import the PDF.
- Applying the import transitions to the full-page editor.

The import path remains local. No PDF is uploaded and no RIS request is made
from the workspace.

## 4. Editor in a new tab

`CvBuilderEditor` supports `layoutMode="modal" | "fullpage"`.

- The modal keeps its close/save/discard rules.
- The full-page editor uses a two-column desktop layout (editor + live PDF
  preview) and the existing mobile edit/preview switch.
- Existing sections and actions remain available: personal details, profile,
  experience, education, skills, projects, certificates, languages, links,
  templates, validation, save and PDF export.
- The editor has **„↗ Editor in neuem Tab öffnen“** in modal mode.
- Full-page mode exposes **„📸 Screenshot-Ansicht“** and a controlled
  **„Zum Hauptfenster zurück“** action.
- Full-page mode has no global body lock and no dialog focus trap.

## 5. Handoff and ownership

`workspaceHandoff.ts` implements a same-origin, short-lived transfer:

- URL contains only a random UUID handoff id, never CV data, PDFs or tokens.
- The source opens the workspace with `window.open`.
- The new tab sends a `ready` message; the source validates:
  - exact origin;
  - exact child window (`event.source`);
  - matching handoff id;
  - expected message schema.
- Only then the source sends one `handoff` payload via `postMessage`.
- The new tab validates origin, opener, id and payload before accepting it.
- The handoff id is removed from the visible URL after successful receipt.
- No `localStorage`/`sessionStorage` CV persistence is introduced.
- Ready timeout is 60 seconds.
- A blocked popup returns `false`; the source reports a visible error.
- If the opener is closed, return transfer returns `false` and the workspace
  stays local rather than claiming success.
- Identity is carried as the stable auth key and compared in both tabs; a
  change rejects the handoff/return.
- Source and workspace use the existing session profile repository. The
  workspace starts its repository with the source profile snapshot.

## 6. Save and conflict behavior

- Workspace save creates or updates only its local session repository.
- Return to the source is explicit.
- The source applies an update only when the source profile's current version
  equals the workspace `baseVersion`.
- A mismatch returns `conflict`; the source shows the conflict message and does
  not overwrite the newer source data.
- New/unknown workspace profiles are created in the source repository.
- Unsaved workspace drafts are returned as drafts; no save is implied.
- No silent overwrite and no second RIS/profile persistence.

Unit coverage for the return helper includes:

- matching version → update;
- changed source version → conflict, source remains unchanged;
- unknown workspace profile → create;
- unsaved workspace draft → draft.

## 7. Screenshot view

Full-page editor header adds **„📸 Screenshot-Ansicht“**.

On entry:

- all `details` sections are expanded;
- inner editor/preview max-heights and overflow constraints are removed;
- the whole page becomes browser-scrollable;
- preview and form content are fully displayed;
- sticky/overlay behavior is removed for the workspace;
- at mobile widths the preview is also shown in screenshot mode.

On exit, the previous `details` open states are restored and CV field values
remain unchanged. The mode is display-only: no screenshot is created,
transferred or stored automatically, and no screenshot API is called.

## 8. Privacy and session isolation

- Synthetic data only in committed tests.
- No private PDF, contact data, screenshot or export is committed.
- No CV data in URLs.
- No hidden localStorage CV storage.
- No RIS write, no consent change, no AWS/Cognito/Terraform change.
- No unexpected API calls; local E2E observed only the existing
  `GET /api/models` request from the source page.
- No identity mixing: handoff and return carry and compare the verified stable
  identity key; repositories remain session/in-memory only.

## 9. Responsive and browser E2E

New E2E: `tests/e2e/cv-builder-full-page-workspace-03a.mjs`

Verified:

- modal import → **open in new tab** → skill selection preserved (`14/15`);
- full-page import has no modal overlay;
- import apply → full-page editor;
- personal data remains intact;
- screenshot mode expands 8 sections;
- viewports **320, 390, 768, 1024, 1440, 1920**:
  - 0 px horizontal overflow;
  - page height greater than viewport;
  - editor and preview computed overflow `visible`;
- full-page browser screenshot produced (`/tmp` only);
- screenshot exit restores section state and leaves the edited name unchanged;
- save in workspace → return → source editor receives the value;
- editor open in new tab → edit → save → return → source receives the changed
  value;
- direct `/cv-builder/workspace` shows the start view, not a modal;
- DE/EN workspace switch;
- popup blocker shows the translated visible error;
- no non-GET API and no RIS API calls.

## 10. Test results

| Check | Result |
|---|---|
| Focused workspace/parser/structure/editor/root tests | **84 PASS** |
| Serial full suite | **1788 PASS / 5 skipped** |
| TypeScript / production build | **PASS** |
| Existing import/parser/mapping/workflow/02D/PDF/02E E2E | **PASS** |
| New full-page workspace E2E | **PASS** |
| `git diff --check` | **PASS** |
| Secret/privacy scan | **PASS** |
| PDF export real download (existing 02F/PDF E2E) | **PASS** |

Baseline prior to this feature was **1777 PASS / 5 skipped**. The new tests
raise the total to **1788 PASS / 5 skipped** (11 additional tests including the
root-route and handoff return cases).

## 11. Git

- Branch created from `main` `4192353`.
- Code/test commit: `36ca447`.
- Documentation commit follows on the same feature branch.
- No merge, no production deployment, no force-push, no history rewrite.
- Automatic Vercel preview builds remain enabled.

## 12. Known limits

- The workspace is still session-only; reloading the workspace tab does not
  persist a CV beyond the current page state.
- Handoff requires an opener and therefore cannot transfer CV data to a
  directly opened workspace; direct mode starts with a clean start view.
- A closed source tab deliberately disables successful return transfer; local
  editing and PDF export remain available.
- The version conflict path is implemented and unit-tested; a fully interactive
  two-tab conflict browser scenario is not part of the committed E2E.
- Screenshot view is display-only; browser screenshot creation remains a user
  action.
- No real production deployment was performed.

**STOP before main integration and production release.**
