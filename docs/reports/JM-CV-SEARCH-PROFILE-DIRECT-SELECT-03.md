# JM-CV-SEARCH-PROFILE-DIRECT-SELECT-03

**Status:** `READY FOR CONTROLLED MERGE — DIRECT LOGIN SELECTION VERIFIED`

**Branch:** `feature/jm-cv-search-profile-hydration-01`

**PR:** [#56](https://github.com/maynowak/mays-jobsearch/pull/56)

**Implementation commit:** `ac0779c`

**Previous release-gate head:** `dec6757`

**Base:** `origin/main` `8f26a69`

## 1. Goal

Remove the remaining session-hash dependency for durable RIS CVs. After login
and consent, a stored RIS CV can be selected directly in the CV upload area;
its already hydrated CV-search and ATS profiles are available in the existing
dropdowns without upload, parsing, AI processing or RIS writes.

## 2. Implementation

### 2.1 Direct durable CV selection

- `PersistentCvList` gets an explicit **Profile auswählen** action per ready
  durable CV and a selected state. The action is disabled without the separate
  search-profile consent.
- `App` keeps `selectedDurableCvId` as an independent context. Selecting a CV
  resets an old CV/search-profile/ATS selection; selecting a session CV or
  switching back to session mode clears the durable context.
- No session document, hash, upload or parser call is required.

### 2.2 Existing dropdowns

For the selected durable CV, the Dashboard renders the existing CV/ATS
dropdown component pattern with the hydrated lists:

```
cvId -> searchProfileId -> atsSearchProfileId
```

The ATS dropdown is restricted to children of the selected CV-search profile.
Changing the parent or CV clears an invalid child. The existing search route
(saved-profile box) also uses the same durable context after client-side
navigation.

Loading, no-profile and load-error states are shown in the durable panel; a
failed hydration can be retried through the existing refresh token. Durable
profiles remain managed in the existing durable profile overlay, not in a new
manager.

### 2.3 Search flow

The existing `buildCvSearchProfile` / `handleSubmit` flow is reused. The saved
parent configuration is used, and an optional ATS child overrides skills and
target roles while preserving city, radius, work modes and employment types.
Exactly one search request is started.

### 2.4 Security boundaries

- Search-profile consent remains required before hydration or direct selection.
- Authenticated identity change clears the durable context and hydrated lists.
- Session IDs and RIS IDs are kept in separate contexts; no lookup crosses the
  two stores.
- Selecting a different CV or parent resets invalid child selections.
- Direct selection performs no RIS writes, no profile creation, no CV download,
  no parser run and no AI call.
- Session CV and hash-bound selection behavior remains unchanged.

## 3. Browser E2E

`tests/e2e/cv-search-profile-direct-select-03.mjs` uses synthetic OIDC, mocked
RIS/BFF endpoints, one stored CV with two CV-search profiles and one ATS child
per parent (plus a second CV for the CV-switch check).

Verified:

1. Login and CV upload area;
2. stored RIS CV selected directly;
3. both CV-search profiles visible in the existing dropdown;
4. ATS dropdown limited to the selected parent;
5. parent switch clears the invalid ATS child;
6. CV switch clears both selections and exposes only the new CV profiles;
7. search route shows the same durable profiles;
8. exactly one `/api/jobs` request with parent location/radius/work modes and
   ATS skills/target role;
9. browser reload requires a new direct selection and then works again;
10. consent denied: direct selection disabled and zero profile list calls;
11. load error: visible error + retry succeeds;
12. identity switch: only the new user's profiles are selectable;
13. 1440px and 390px layouts have no horizontal overflow.

Before the explicit search start:

| Call | Count |
|---|---:|
| `/api/profile` | **0** |
| `/api/jobs` | **0** |
| CV parser / AI | **0** |
| RIS writes | **0** |

E2E result:

```json
{
  "status": "PASS",
  "results": [
    { "scenario": "granted", "width": 1440, "searchCalls": 1, "profileCalls": 0, "cvDownloads": 0, "risWrites": 0, "unexpected": 0 },
    { "scenario": "granted", "width": 390, "searchCalls": 0, "profileCalls": 0, "cvDownloads": 0, "risWrites": 0, "unexpected": 0 },
    { "scenario": "consent-denied", "cvLists": 0, "atsLists": 0 },
    { "scenario": "load-error-retry", "cvLists": 4 },
    { "scenario": "identity-isolation", "options": ["— auswählen —", "token-b Frontend Berlin", "token-b Backend Hamburg"] }
  ]
}
```

## 4. Local Verification

| Check | Result |
|---|---|
| Focused tests | **156 PASS** |
| Full Vitest suite, serial | **2029 PASS / 11 skipped** |
| Production build (`tsc -b && vite build`) | PASS |
| Existing hydration E2E | PASS |
| Hydration release-gate E2E | PASS |
| Direct-select E2E | PASS |
| `git diff --check` | PASS |
| Secret scan of changed files | PASS |

## 5. PR Gates

PR **#56**, reported head `ac0779c`:

| Gate | Result |
|---|---|
| Mergeability | `MERGEABLE` / `CLEAN` |
| CodeQL Analysis | PASS |
| Vercel – mays-job-matcher | PASS |
| Vercel – mays-jobsearch | PASS |
| Vercel Deployments / Preview Comments | PASS |

No separate `ci.yml` exists in the repository; configured automated checks are
CodeQL and the Vercel integration.

## 6. Boundaries

- No Main merge or Production deployment during implementation.
- No RIS/AWS/Terraform/Cognito/Consent/Storage mutation.
- No real applicant data; E2E uses synthetic identities and mocked RIS data.
- Production login verification remains a separate post-merge step.

`READY FOR CONTROLLED MERGE — DIRECT LOGIN SELECTION VERIFIED`
