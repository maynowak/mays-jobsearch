# PROFILE-HIERARCHY — Final Verification Report

## 1. Verification metadata

- Verified commit: `ef10bd8` (`fix: use ATS profiles for saved searches`)
- Verification date: 2026-10-30
- Branch: `main`
- Remote parity at preflight: `HEAD == origin/main == ef10bd8`
- Working tree: only pre-existing unrelated untracked user files; no tracked modifications
- Test environment: Node 22, Vitest 4.1.10, Vite 8.2.1, Playwright 1.63.0, system Google Chrome 155.0.8059.84, system Firefox 158.0
- No production/preview deployment and no real CV/provider data used

## 2. Tested hierarchy and data flow

`CV document ID → anonymized normalized-text hash → session profile bucket → SearchProfile ID → parent ATS profile ID`

- `App.tsx` owns the in-memory CV inventory and active IDs.
- `cvProfileStore.ts` owns the session-only hash buckets.
- Profile → Searchpage navigation uses `history.pushState`/`popstate`, preserving the mounted App state.
- `/search?cv=upload` activates the existing CV upload tab without processing.
- SearchProfile-only search uses the stored `Profile` unchanged.
- SearchProfile + ATS uses ATS `skills` and `targetRoles`, while retaining parent `city`, `radiusKm`, `workModes`, and `employmentTypes`.
- Exactly one `handleSubmit`/`fetchJobs` path is used; no second parent search is started.

## 3. Field-priority evidence

| Configuration | `skills` | `targetRoles` | city/radius/work mode/employment type |
|---|---|---|---|
| SearchProfile only | Parent | Parent | Parent |
| SearchProfile + child ATS | ATS child | ATS child | Parent |

Synthetic fixture: parent `AWS, Python` / `Cloud Engineer` / Berlin / 25 km / remote / full-time; ATS `Terraform, Docker` / `DevOps Engineer`. The pure fixture verifies the resulting payload contains the ATS content and all parent filters.

## 4. Verification matrix

| Area | Result | Evidence |
|---|---|---|
| TypeScript/build | PASS | `npm run build` |
| Full frontend/API tests | PASS | `npm test -- --run`: 852 passed, 5 skipped |
| API syntax | PASS | `find api -name '*.mjs' ... node --check` |
| Diff hygiene | PASS | `git diff --check` |
| Session store hash isolation/TTL | PASS | `src/lib/cvProfileStore.test.ts`, targeted 39-pass run |
| SearchProfile-only field preservation | PASS | `src/lib/cvSearchConfig.test.ts` |
| ATS field override + parent filters | PASS | `src/lib/cvSearchConfig.test.ts` |
| No duplicate search path in code | PASS | one saved-profile `handleSubmit` path; no second `fetchJobs` call in handler |
| Profile ↔ CV upload with synthetic data in unit fixtures | PASS | `DashboardV2CvSection.test.tsx`, `App.test.tsx`, `cvProfileStore.test.ts` |
| Chromium route smoke at 390 px | PASS | local Vite: `/search`, `/dev/dashboard-v2` → CV tab; no console errors; no unexpected selection request |
| Chromium route smoke at 1440 px | PASS | same route smoke; no console errors |
| Full two-CV browser workflow with uploaded synthetic PDFs | NOT VERIFIED | no committed synthetic PDF fixture and authenticated Profile route was unavailable in guest browser session |
| Profile → upload → profile browser journey | NOT VERIFIED | authenticated runtime/session not available in browser smoke; code path and unit fixtures verified |
| Firefox full matrix | NOT VERIFIED | Playwright Firefox binary/juggler could not launch; system Firefox is not compatible with this Playwright run |
| DE/EN full browser workflow | NOT VERIFIED | route smoke used existing default language; no full language matrix run |
| Mobile/desktop full CV workflow | NOT VERIFIED | viewport route smoke only; no uploaded-CV workflow run |
| Live external API/provider verification | NOT VERIFIED | intentionally not performed; mocks/fixtures are reported separately |

The Chrome smoke observed two `/api/` requests while loading the page (model/catalogue initialization), not as a consequence of changing CV/profile selections. No real CV text was sent.

## 5. Capacity and storage findings

| Object | Current enforcement | Product target |
|---|---|---|
| CVs | maximum 10 in App state and UI | 10 per User |
| SearchProfiles | up to 50 per hash bucket (`MAX_ENTRIES_PER_LIST`) | 2 per CV |
| ATS profiles | up to 5 assigned to one SearchProfile; bucket list is capped at 50 | 5 per SearchProfile |

The target SearchProfile capacity of 2 is **not implemented**. Data is session-only: CV `File` objects live in React state; profile lists live in a module `Map` with lazy 12-hour TTL expiry. Reload clears both. This is not durable user persistence.

## 6. ATS boundaries

- Implemented: ATS parent filtering, parent validation, exclusive ATS field override for general saved-profile search, per-job ATS analysis.
- Separate: `api/ats-analysis`/`AtsOverlay` remains per-job analysis and was not replaced.
- Not implemented: tag ontology, tag ranking, weighting, variants comparison, explanation attribution, multi-ATS simultaneous scoring.

## 7. Historical documentation reconciliation

- Older hierarchy reports describing ATS as only a per-job override are historical and were superseded for the minimal saved-profile search path by `ef10bd8`.
- `PROFILE-HIERARCHY-06` correctly remains a concept/gate report for tag ranking and variants comparison; those features are not claimed here.
- `PROFILE-HIERARCHY-05` correctly records the 2/5 target, while current code still enforces 50 SearchProfile list capacity and 5 ATS assignments per parent.

## 8. Open limitations and next steps

- Run an authenticated browser session with two generated synthetic PDFs in Chromium at 390/1440 and Firefox after installing a compatible Playwright Firefox binary.
- Add a committed synthetic PDF/browser fixture if full upload-flow automation is required.
- Decide whether and how to reduce SearchProfile capacity from 50 to the target 2; do not infer this from the concept report.
- Keep tag ranking/weighting and variants comparison behind a separate product/scoring gate.

## AI / privacy audit

- No real CV, external provider, or production endpoint was used.
- No AI-/privacy-/data-flow change was introduced by this verification; the existing audit entry for `ef10bd8` is extended by this report.
- The report itself contains only synthetic values and code-derived facts.
