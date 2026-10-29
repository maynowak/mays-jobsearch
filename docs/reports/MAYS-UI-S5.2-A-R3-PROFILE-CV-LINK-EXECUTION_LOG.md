# MAYS-UI-S5.2-A-R3 — Profile/CV-upload link execution log

- Status: COMPLETE — GREEN for scoped changes; unrelated untracked workspace files untouched
- Date: 2026-10-29
- Branch: `main`
- HEAD at audit start: `d0db63c docs: finalize CV selection execution log`
- Scope: connect the existing Profile dashboard CV view to the existing Searchpage CV-upload tab without adding storage, APIs, or duplicate CV management.

## Common data source and routing

- The single source remains `App.tsx`'s `cvState.documents`, including document IDs, files, hashes, parser skills, selected IDs, and workflow state.
- Search-/ATS-profile lists remain in the existing session-only `cvProfileStore` `Map`, keyed by the anonymized CV content hash with the existing 12-hour TTL and limits.
- Internal `/profil` ↔ `/search` navigation now uses `history.pushState`/`popstate` while App remains mounted, so the in-memory CV inventory is retained. Direct reload still starts a new session and intentionally does not restore CV files.
- Profile action `Im CV-Upload öffnen` navigates to `/search?cv=upload`; SearchForm activates its existing CV tab through a controlled opening signal. It does not upload, process, search, or call a model.
- Navbar Search/Profile links use the same internal navigation path, preserving the session inventory through browser back/forward.

## Hierarchy and safeguards

- Active CV → selected search profile → ATS profiles belonging to that search profile.
- Dashboard ATS selection is accepted only for the active CV and selected search profile; the displayed ATS list is filtered by `searchProfileId`.
- Existing Searchpage upload, multi-selection, processing, edit, and search routines remain the only processing paths.
- No profile data is copied between CVs; removal and store refresh continue using the existing App handlers and hash validation.

## Verification

- `npx vitest run src/components/DashboardV2CvSection.test.tsx src/components/Navbar.test.tsx src/ProfileRoute.test.tsx` — PASS (17 tests)
- `npm test -- --run` — PASS (850 passed, 5 skipped)
- `npm run build` — PASS (`tsc -b` + Vite build)
- `find api -name '*.mjs' -print0 | xargs -0 -n1 node --check` — PASS
- `git diff --check` — PASS
- Existing synthetic two-CV/hash/profile fixtures remain separate from live processing/provider calls. No browser 390/1440 or Firefox run was performed in this correction step.

## Storage and privacy

- No new persistence was introduced. CV files and profile lists remain session-only; a full reload clears them.
- No model/API request is caused by navigation or selection alone.

## Git state

- Scoped changes are committed in `841ab85`; unrelated untracked user files remain untouched and unstaged.
- No push or deployment, per instruction.

## Resume point

- No further action in this correction step. Push/deploy requires separate explicit approval.
