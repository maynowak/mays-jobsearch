# JM-CV-SEARCH-LOGIN-AUTOHYDRATION-04

**Status:** `READY FOR CONTROLLED MERGE — SEARCH LOGIN AUTOHYDRATION VERIFIED`

**Branch:** `feature/jm-cv-search-login-autohydration-04`

**Implementation commit:** `9638ed8`

**Base:** `origin/main` `795b38d`

## 1. Goal

After login, the existing search area must expose permanently stored RIS CVs,
their CV search profiles and ATS profiles without visiting the profile
management and without processing a CV first.

## 2. Implementation

Only the missing search-page entry point was added; existing hydration,
storage and dropdown logic is reused:

- `usePersistentCvStorage` remains the source of the stored CV list.
- `useCvProfileHydration` and `cvProfileHydration.byCvId` remain the profile
  source.
- The existing `selectedDurableCvId` context and search components are reused.
- The saved-profile region on `/search` now includes a durable CV selector
  whenever an authenticated user has granted the relevant storage consent and
  there is no active session-CV profile context.
- The selector lists all ready stored RIS CVs. Labels include a short cvId
  suffix, so same-named CVs remain distinguishable.
- Selecting a CV sets `selectedDurableCvId`; the existing CV search-profile
  dropdown and ATS child dropdown then use `byCvId[cvId]`.
- Changing the CV or profile parent clears invalid child selections.
- Loading, empty, storage error/retry and hydration error/retry states are
  shown in the existing saved-profile region.
- Session-CV/hash selection is unchanged and still takes precedence while a
  session CV profile context is active.
- No new hydration, profile manager, storage namespace or persistence was
  added.

## 3. Browser Acceptance

`tests/e2e/cv-search-login-autohydration-04.mjs` starts a fresh synthetic
browser session, logs in, and opens `/search` directly. It never visits
`/profil`.

Verified:

1. Stored RIS CVs are visible in the existing search-area selector.
2. Two stored CVs are distinguishable and selectable.
3. Selecting a CV exposes its stored CV search profiles.
4. Selecting a CV search profile exposes only its ATS children.
5. The search route uses the selected ATS skills and target role while
   preserving the parent city, radius and work modes.
6. “Jobs Finden” starts exactly one `/api/jobs` request.
7. Browser reload restores the picker and allows a new direct selection.
8. Missing search-profile consent hides the picker and causes zero profile
   list calls.
9. A synthetic hydration failure shows the error and a retry that recovers the
   profile dropdowns.
10. Identity switch exposes only the new user's profiles.
11. 1440px and 390px layouts have no horizontal overflow.
12. No profile-management route is requested (`profileRouteVisits = 0`).

Before the explicit search start:

| Call | Count |
|---|---:|
| `/api/profile` | **0** |
| `/api/jobs` | **0** |
| CV download/parser | **0** |
| AI/ATS calls | **0** |
| RIS writes | **0** |

E2E result:

```json
{
  "status": "PASS",
  "results": [
    { "scenario": "main", "width": 1440, "searchCalls": 1, "profileCalls": 0, "cvDownloads": 0, "risWrites": 0, "unexpected": 0, "profileRouteVisits": 0 },
    { "scenario": "mobile", "width": 390, "profileRouteVisits": 0 },
    { "scenario": "consent-denied", "cvLists": 0, "atsLists": 0 },
    { "scenario": "load-error-retry", "cvLists": 4 },
    { "scenario": "identity-isolation", "options": ["— auswählen —", "token-b Direkt Frontend", "token-b Direkt Backend"] }
  ]
}
```

## 4. Verification

| Check | Result |
|---|---|
| Focused tests | **139 PASS** |
| Full Vitest suite, serial | **2029 PASS / 11 skipped** |
| Production build (`tsc -b && vite build`) | PASS |
| New autohydration E2E | PASS |
| Existing hydration E2E | PASS |
| Existing hydration release-gate E2E | PASS |
| Existing direct-select E2E | PASS |
| `git diff --check` | PASS |
| Secret scan of changed files | PASS |

Existing session-CV and hash-bound search tests remain green.

## 5. Boundaries

- No Main merge or Production deployment.
- No RIS/AWS/Terraform/Cognito/Consent/Storage contract change.
- No UX-08A or ATS-save fix change.
- Only synthetic OIDC, mocked RIS/BFF and synthetic profile data.
- No real applicant data and no RIS write was performed.

`READY FOR CONTROLLED MERGE — SEARCH LOGIN AUTOHYDRATION VERIFIED`
