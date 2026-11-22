# JM-CV-SEARCH-PROFILE-HYDRATION-RELEASE-GATE-02

**Status:** `READY FOR CONTROLLED MERGE`

**Branch:** `feature/jm-cv-search-profile-hydration-01`

**PR:** [#56](https://github.com/maynowak/mays-jobsearch/pull/56)

**Verified implementation head:** `0649c5f`

**Base:** `origin/main` `8f26a69`

**Scope:** Final QA and release preparation only. No new product functionality,
no RIS/AWS/Cognito/Storage change, no Main merge and no Production deployment.

## 1. Existing Implementation

The implementation from `JM-CV-SEARCH-PROFILE-HYDRATION-01` was taken over
unchanged:

- `3b58518` — read-only hydration, mapping/merge, existing dropdown integration;
- `017fabf` — implementation report and audit entry.

The release gate added only browser coverage, test scripts and this report.

## 2. Browser E2E — Required Flow

`tests/e2e/cv-search-profile-hydration-01.mjs` verifies:

1. synthetic login on `/profil?tab=cv`;
2. consent-gated hydration through
   `GET /api/ris/search-profiles?type=cv` and `?type=ats`;
3. no `/api/profile` and no `/api/jobs` call on login;
4. the stored RIS CV is loaded once through the existing CV workflow;
5. after closing the workflow, the existing CV search-profile dropdown and
   ATS dropdown show the durable profiles;
6. selecting the durable search profile and its ATS child starts exactly one
   search with the ATS skills, parent location/radius and work modes;
7. dropdown use causes **no further CV processing** (`/api/profile` remains at
   exactly one call) and no second search;
8. no RIS write, no unexpected ATS/AI call and no horizontal overflow.

The existing dropdowns are bound to the session CV hash, so the initial
stored-CV load still uses the existing workflow once. The release-gate
assertion is that **no additional processing occurs when the hydrated
dropdowns are used**, which is the regression this gate protects.

Result:

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

## 3. Browser E2E — Reload, Consent and Identity Isolation

`tests/e2e/cv-search-profile-hydration-release-gate-02.mjs` verifies:

- **Reload:** the granted hydration runs again after a browser reload; the
  RIS token stays stable and no writes/AI/search are triggered.
- **Consent denied:** without `search-profile-storage` consent there are zero
  CV/ATS list calls and no AI/search call.
- **Identity isolation:** after switching the synthetic authenticated identity
  and reloading, hydration requests use the new token and return the new
  user's profile; the old user's profile is not reused as the current view.
- **ATS parent mapping:** the main E2E selects `searchProfileId: sp-1` and its
  ATS child `ats-1`; the search uses the ATS child's skills/target role while
  preserving the durable parent's city, radius and work modes.

Result:

```json
{
  "status": "PASS",
  "results": [
    { "scenario": "reload", "cv": 4, "ats": 4 },
    { "scenario": "consent-denied", "cv": 0, "ats": 0 },
    { "scenario": "identity-isolation", "tokens": ["token-a", "token-a", "token-b", "token-b"] }
  ]
}
```

## 4. Local Verification

| Check | Result |
|---|---|
| Focused App/Profile/RIS tests | **147 PASS** |
| Full Vitest suite, serial | **2026 PASS / 11 skipped** |
| Production build (`tsc -b && vite build`) | PASS |
| E2E `cv-search-profile-hydration-01` | PASS |
| E2E `cv-search-profile-hydration-release-gate-02` | PASS |
| `git diff --check` | PASS |
| Secret scan of changed test/docs files | PASS |

Commands:

```bash
npm run test:e2e:cv-search-profile-hydration-01
npm run test:e2e:cv-search-profile-hydration-release-gate-02
npx vitest run --no-file-parallelism
npm run build
git diff --check
```

## 5. GitHub PR Gates

PR **#56** targets `main`.

| Gate | Result |
|---|---|
| Mergeability | `MERGEABLE` / merge state `CLEAN` |
| CodeQL Analysis (javascript-typescript) | **PASS** |
| CodeQL duplicate/skipped check | neutral/skipped |
| Vercel – mays-job-matcher | **PASS** |
| Vercel – mays-jobsearch | **PASS** |
| Vercel Deployments – Maymilly | **PASS** |
| Vercel Preview Comments | **PASS** |

The repository has no separate `ci.yml` workflow; the configured automated
checks are CodeQL and the Vercel Git integration. No Main merge or Production
deployment was performed.

## 6. Privacy and AI Boundary

- Hydration is consent-gated and uses the existing authenticated RIS list
  endpoints only.
- No profile creation, search, matching, ATS analysis or AI call runs on
  login.
- No token, CV text or profile payload is logged.
- No new storage namespace or browser persistence was added.
- E2E data is synthetic; no real applicant or RIS account was touched.
- No RIS/AWS/Terraform/Cognito/Consent/Storage mutation.

## 7. Conclusion

`READY FOR CONTROLLED MERGE`

The branch is locally verified, pushed, and its PR is clean and mergeable.
Merge and Production deployment remain separate operator decisions.
