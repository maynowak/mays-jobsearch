# JM-CV-SEARCH-PROFILE-HYDRATION-01 — Durable CV/ATS Profiles in Existing Dropdowns

**Status:** `IMPLEMENTED / VERIFIED LOCAL`

**Branch:** `feature/jm-cv-search-profile-hydration-01`

**Implementation commit:** `3b58518`

**Base:** `origin/main` `8f26a69`

## 1. Scope

After login, durable RIS CV-search profiles and their ATS children are made
available in the **existing** CV search-profile and ATS dropdowns. The work
reuses the current RIS list endpoints, the current profile contract, and the
current `DashboardV2CvSection` / saved-profile dropdown components.

Explicit non-goals, all retained:

- no second profile-management UI;
- no profile creation on login;
- no job search, matching, ATS analysis or AI call on login;
- no RIS/AWS/Terraform/Cognito/consent/storage mutation;
- no Main merge or Production deployment.

## 2. Implementation

### 2.1 Consent-gated hydration

`src/lib/useCvProfileHydration.ts` loads profiles only when the existing
`search-profile-storage` consent is `GRANTED`:

1. use the ready persistent CV list already loaded by `usePersistentCvStorage`;
2. also include the active session CV's durable `risCvId`, if present;
3. call the existing `listCv(cvId)` and `listAts(searchProfileId)` RIS
   interfaces;
4. keep search profiles if an individual ATS child list fails;
5. clear the cache on identity change and reload on the existing
   `persistentProfilesVersion` refresh token.

The hook performs list reads only. It never calls `createCv`, `createAts`,
`/api/profile`, `/api/jobs` or an AI endpoint. A failed refresh keeps the
previously hydrated data rather than exposing a partial cross-identity state.

### 2.2 Mapping without a second store

`src/lib/cvProfileHydration.ts` maps `CVSearchProfileV1` and
`ATSSearchProfileV1` into the existing `CvSearchProfileEntry` /
`CvAtsProfileEntry` shape. Hydrated entries carry
`origin: "persistent"`; session entries remain unchanged.

`mergeCvProfileLists()` combines both sources for the existing dropdowns:

- durable entries are shown first;
- a session entry with the same name is hidden behind the canonical durable
  copy;
- the session store is not written or mutated by hydration.

### 2.3 Existing dropdowns

- `src/App.tsx` passes the combined lists to the existing saved-profile box
  and to `DashboardV2CvSection`.
- `src/components/DashboardV2CvSection.tsx` accepts an optional `profileLists`
  prop; without it, the component keeps its previous session-store behavior.
- Search start uses the same mapped profile through the existing
  `buildCvSearchProfile()` path.
- The session-only edit action is hidden for durable entries. Durable profiles
  remain managed by the existing `PersistentCvProfilesOverlay`.
- If a durable search profile is selected while the CV storage choice is
  session, a newly confirmed ATS child is written through the existing
  durable RIS path, because a durable parent cannot be stored in the session
  repository.
- Create/update/delete in the durable overlay increments the existing refresh
  token, so the dropdown hydration follows the canonical account data.

## 3. Tests

New unit coverage:

- mapping of durable CV/ATS profiles into the existing dropdown shape;
- foreign-CV and orphan-ATS rejection;
- durable-over-session same-name merge without mutating session data;
- consent-gated list calls, no calls without consent, identity clearing, and
  partial ATS failure;
- `DashboardV2CvSection` rendering and selection of hydrated durable entries.

New browser E2E:
`tests/e2e/cv-search-profile-hydration-01.mjs` (also exposed as
`npm run test:e2e:cv-search-profile-hydration-01`). It uses synthetic OIDC,
mocked RIS/BFF endpoints and the repository's synthetic CV fixture.

Verified sequence:

1. login hydration performs `GET /api/ris/search-profiles?type=cv` and
   `?type=ats`;
2. no `/api/profile` or `/api/jobs` call before the user starts processing;
3. the stored CV is processed through the existing workflow;
4. after closing the workflow, the existing saved-profile dropdowns expose
   the durable search profile and ATS child;
5. selecting both starts exactly one search with the ATS skills, parent
   location/radius and work modes;
6. no RIS write and no unexpected ATS/AI call occurs.

| Check | Result |
|---|---|
| New focused tests | **14 PASS** |
| Focused App/Profile suite | **115 PASS** |
| Full Vitest suite, serial | **2026 PASS / 11 skipped** |
| Production build (`tsc -b && vite build`) | PASS |
| Browser E2E `cv-search-profile-hydration-01` | PASS |
| `git diff --check` | PASS |
| Secret scan of product/test diff | PASS |

E2E result:

```json
{
  "status": "PASS",
  "hydration": { "cv": 2, "ats": 2 },
  "profileRequests": 1,
  "jobsRequests": 1,
  "risWrites": 0,
  "unexpectedCalls": 0,
  "overflow": 0
}
```

## 4. Privacy and AI Impact

- Hydration is gated by the existing `search-profile-storage` consent and the
  existing authenticated identity.
- No new storage namespace, browser persistence or RIS write was added.
- No CV text, token, profile payload or personal data is logged.
- Login performs no AI processing, search or matching.
- The E2E used only synthetic identities, synthetic profiles and a synthetic
  CV fixture; no real applicant data or RIS account was touched.

## 5. Boundaries and Follow-ups

- Authenticated live RIS hydration was **not** executed; verification used
  mocked BFF responses. Live E2E remains separately gated.
- No Main merge, Production deployment or Vercel change was made.
- Durable profiles are read-only in the dropdowns; editing continues in the
  existing durable profile overlay.
- Same-name durable profiles take precedence over session copies by design.
- No AWS/Terraform/Cognito/consent/Storage or UX-08A change.

`IMPLEMENTED / VERIFIED LOCAL`
