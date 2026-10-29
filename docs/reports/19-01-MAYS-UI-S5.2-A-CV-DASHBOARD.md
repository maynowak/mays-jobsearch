# MAYS-UI-S5.2-A — Vorhandene CV-Profile im Dashboard anzeigen

- Status: **IMPLEMENTED; VERIFIED LOCALLY; NO PRODUCTION `/profil` SWITCH**
- Date: 2026-10-29
- Branch: `feature/ui-orchestrator-s0`
- Preflight HEAD: `9e039a2`
- Final implementation commit: pending at report creation
- Scope: DEV Dashboard-V2 previews only; no new API or durable storage

## Preflight and preserved changes

Repository: `/home/dci-student/projects/Mays-Jobsearch`.

Pre-existing user changes were present in `src/components/SourcesInfo.test.tsx`,
`src/i18n.tsx`, and several untracked documents/assets/scripts. They were not
edited, staged or committed. `/profil` remains on the existing legacy route.

The existing S0–S5 planning reports and repository instructions were read before
implementation. The real Cognito browser E2E remains **NOT VERIFIED** as
documented by S4; this task used the existing DEV/demo and controlled auth
preview architecture only.

## Existing CV data flow and lifetime

The integration reuses the existing owners and boundaries:

1. `src/components/CvUpload.tsx` validates PDF extension/MIME and the 10 MB
   limit, then delegates to `App.tsx`.
2. `src/App.tsx` stores `CvDocument[]` in React state. A document contains the
   in-memory `File`, name, size, selected flag, optional parser `skills` and,
   after processing, the normalized/anonymized text hash.
3. `src/lib/pdf.ts` parses in the browser; `src/lib/anonymize.ts` optionally
   anonymizes locally. Consent, anonymization and model selection remain in the
   existing workflow in `App.tsx`.
4. `src/lib/cvProfileStore.ts` maps named search and ATS profiles by CV hash.
   It is a process-memory `Map`, not localStorage or account persistence.
   Buckets expire lazily after 12 hours from first creation; the limit is 50
   entries per list and five assigned ATS profiles per search profile.
5. The dashboard selects exactly one review document. Its hash alone determines
   the displayed search/ATS lists. No lists are merged across documents.

The dashboard intentionally does not display the global `cvState.atsResult` as
a CV-specific result: the current state has no document-hash association for
that analysis. Displaying it for an arbitrary selected CV would risk mixing
data. Existing ATS profile entries remain available through the hash-scoped
selection and detail view.

## Implementation

### New dashboard section

`src/components/DashboardV2CvSection.tsx` is a presentational integration layer
that reuses:

- `CvDocumentList` for existing document selection, removal, more-upload,
  processing, search and all-data removal actions;
- `CvProfilesOverlay` for the existing per-CV profile tables/details;
- `readCvProfileLists(hash)` for hash-scoped search/ATS selectors;
- existing `CvDocument`, `Profile`, `CvSearchProfileEntry` and
  `CvAtsProfileEntry` structures.

It adds no parser, consent, AI, API or persistence implementation. The section
shows parser-produced `CvDocument.skills`, current CV-scoped search/ATS
selection boxes, and selected profile summaries. Empty documents expose the
existing PDF upload entry. The session/12-hour boundary is visible in the UI.

### Dashboard wiring

- `src/components/DashboardV2.tsx`: CV navigation is enabled only when a CV
  section is supplied; other future items remain disabled. Selecting CV renders
  the supplied section without triggering analysis.
- `src/components/DashboardV2AuthenticatedPreview.tsx`: accepts the same
  presentational CV section while preserving loading/error/signed-out/auth
  state handling.
- `src/App.tsx`: passes existing `cvState` and handlers to the DEV dashboard
  previews. `handleDashboardCvSelect` makes the review selection exclusive,
  clears dependent search/ATS selection IDs and does not call an API/model.
- `src/i18n.tsx`: added DE/EN labels for the dashboard CV review and storage
  boundary.
- `src/styles.css`: responsive CV section, selectors, parser tags and summary
  styles using existing tokens.

## Verification

### Automated

- New `src/components/DashboardV2CvSection.test.tsx`: PASS.
  - two CV hashes show only their own parser skills and profile options;
  - profile selector changes call callbacks only;
  - no analysis/API callback is invoked by opening or switching.
- Existing `src/lib/cvProfileStore.test.ts`: PASS, including hash isolation and
  TTL behavior.
- Focused dashboard tests: PASS — 19 tests across the new section, Dashboard-V2
  and profile store.
- Full suite: **840 passed | 5 skipped; 78 files passed | 3 skipped**.
- `npm run build`: PASS.
- `node --check api/**/*.mjs`: PASS.
- `git diff --check`: PASS.

### Browser smoke

Against Vite development server `http://127.0.0.1:5181`:

- `/dev/dashboard-v2`, DE/default: selecting `Lebenslauf` shows the CV section,
  empty state and existing PDF upload entry.
- 390, 768 and 1440 px: no horizontal overflow.
- Dashboard CV navigation is active; unrelated future navigation remains
  disabled.
- No `/profil` route change was made.

Real two-file browser upload with actual PDFs and real authenticated claims was
not available in this environment. The two-hash isolation is covered with
deterministic store/component tests. Real Cognito E2E remains **NOT VERIFIED**.

## Existing versus newly integrated behavior

### Existing, reused

- PDF validation, browser parser, anonymization, consent, model selection and
  processing workflow.
- In-memory CV document state and hash-scoped 12-hour profile store.
- CV list, remove, upload-more, process/search and remove-all controls.
- Search-profile and ATS-profile tables/detail overlay.

### Newly integrated

- Dashboard-V2 CV navigation activation when the section is supplied.
- Single-CV review picker and dependent hash-scoped profile selectors.
- Parser-skill review and explicit session/TTL explanation in Dashboard-V2.
- DEV demo/auth preview wiring and isolation tests.

## Remaining limitations and follow-up

- Parser results are limited to the existing `CvDocument.skills` field. A
  richer per-document parser result model is not introduced here.
- ATS analysis results remain unavailable in the CV dashboard unless a future
  contract associates them with a CV hash; this avoids false cross-CV display.
- File objects and profile lists remain session/process memory by design.
- No new durable storage, API, account ownership or `/profil` replacement was
  added.

## Suggested next steps

1. Run a browser fixture with two real text PDFs in DEV to capture durable
   evidence of upload, removal and expiry behavior.
2. Decide whether ATS analysis results need a document-hash association.
3. Keep any authenticated durable CV/profile storage as a separate privacy/API
   work package.

No push, deployment or AWS/Cognito/RIS/DNS change was performed.
