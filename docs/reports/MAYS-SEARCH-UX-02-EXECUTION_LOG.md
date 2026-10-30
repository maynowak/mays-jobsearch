# MAYS-SEARCH-UX-02 — Execution Log

- Status: IMPLEMENTED — validation green; no production deployment
- Date: 2026-10-30
- Branch: `main`
- Preflight baseline: `151f2db` (`origin/main` was in sync)
- Commit: `7cbc988` (`feat: improve search profile and source visibility UX`)
- Documentation follow-up: `bcd9fc4` (commit/push status)
- Final report record: `fc54f0d` (latest `origin/main`)
- Pre-existing untracked files: left untouched and unstaged

## 1. Saved search profile selection

`SearchForm` now accepts the existing `ManualSearchProfile[]` session collection and an explicit authenticated flag. `App` passes the existing App-level repository state; no second repository, storage mechanism or API was introduced.

- The dropdown is rendered only when `isAuthenticated` is true and the current session has manual profiles.
- Selecting a profile copies its existing `searchConfig` into the controlled `Profile` value. It does not call `onSubmit`, `fetchJobs`, a model endpoint, CV processing, or ATS analysis.
- The existing quoted/multi-word skills contract is preserved by handing through the stored `skills` string. `Cloud Architecture` remains quoted and intact.
- The user can edit every copied field. Any edit clears the selected-profile marker, so the UI does not claim that modified values are still unchanged saved-profile values.
- Dashboard "Damit suchen" remains unchanged: it still explicitly starts one existing search through `handleSubmit`/`runSearch`.
- An auth identity transition (login, logout, or user switch) clears the in-memory manual profile repository and resets the active search profile. The dropdown also clears its selection if the profile disappears.
- The session-only wording remains in the Dashboard manual-profile section.

## 2. Optional search fields

Target role, city/ZIP and radius are now inside an accessible disclosure region:

- Default state is closed when no optional value exists.
- `aria-expanded`, `aria-controls`, keyboard-accessible button and visible focus styling are present.
- Existing values remain in the controlled `Profile` while closed; active values show the `Filter aktiv` indicator.
- Opening/closing does not clear values, add required validation, or alter work-model/employment defaults.
- Existing `useCityAutocomplete` and OpenPLZ behavior is reused. OpenPLZ numeric ZIP queries are resolved to the selected locality name before submission; no second geocoder was added. A raw, unselected ZIP continues to follow the existing API contract and is not claimed as an exact-radius guarantee.
- Desktop and mobile smoke checks showed no horizontal overflow and no clipping of the disclosure fields or suggestions.

## 3. Public job-source visibility

Public `JobSources` now renders only sources represented by returned jobs and counts those public jobs. It no longer renders:

- disabled/inactive sources,
- provider limits or configuration reasons,
- delivered-but-not-displayed technical cut rows.

The public `/api/jobs` handler now strips `sourceReasons`, `disabledSources`, `sourceDetails` and `apify` diagnostic metadata before JSON serialization. The internal `fetchAllJobs` registry contract remains intact for existing server-side source tests and operational code; the public boundary is where diagnostics are removed.

## 4. Admin authorization and security boundary

Preflight found no server-verified admin/group/role contract in the existing Cognito/OIDC integration. The available client claims are `sub`, email, name and standard profile claims; authentication alone is not an admin authorization signal.

Therefore no admin UI or frontend-only `isAdmin` flag was added. No email allowlist, hardcoded user, localStorage flag or client secret was introduced. The operational source diagnostics are currently not exposed by the public API. A future admin view requires a separate server-verified authorization contract and protected endpoint; this work package deliberately leaves that as an open implementation point rather than making an unsafe visibility-only claim.

## 5. Tests and browser findings

| Check | Result |
| --- | --- |
| `npm test -- --run` | PASS — 86 files passed, 3 skipped; 928 passed, 5 skipped |
| `npx tsc --noEmit -p tsconfig.app.json` | PASS |
| `npm run build` | PASS |
| API `node --check` for all `api/**/*.mjs` | PASS |
| `git diff --check` | PASS |
| SearchForm profile/disclosure tests | PASS — authenticated dropdown, guest hidden, no submit on selection, multi-word preservation, collapsed/expanded state, active-filter indicator |
| JobSources tests | PASS — only public delivered sources/counts; diagnostics hidden |
| Chromium 1440 px | PASS — compact disclosure, active indicator, no console errors/overflow |
| Chromium 390 px | PASS — same checks, no horizontal overflow |
| Firefox | NOT VERIFIED (not run) |
| Live authenticated provider/API flow | NOT VERIFIED |

Existing CV, ATS and model pathways were not architecturally changed. The full regression suite remains green.

## 6. Git and deployment

- Relevant files are the only intended commit scope; unrelated pre-existing untracked files remain untouched and are not staged.
- Commits `7cbc988` and `bcd9fc4` were pushed to `origin/main`; final synchronization was `0 0`.
- No `vercel --prod` was run. No production deployment was performed.
