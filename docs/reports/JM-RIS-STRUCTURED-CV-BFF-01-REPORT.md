# JM-RIS-STRUCTURED-CV-BFF-01 — Secure Structured CV BFF

**Status:** `JM-RIS-STRUCTURED-CV-BFF-01 — VERIFIED LOCAL / READY FOR UI INTEGRATION PLANNING`

**Date:** 2026-11-13

**Branch:** `feature/jm-ris-structured-cv-bff-01`

**Baseline:** `b3b8525dc5373d111801ca3af987bdbda9b95827` (remote `main`)

**RIS reference:** `feature/ris-structured-cv-backend-hardening-02` at `0e08822`

## 1. Git baseline

- Jobsearch local `origin/main` was initially stale at `a0dc1ec`; verifying
  the remote showed `refs/heads/main = b3b8525`. The local remote reference was
  refreshed and the branch was created from `b3b8525`.
- Branch is isolated in
  `/home/dci-student/projects/mays-xrepo-orchestration/worktrees/jobsearch-structured-cv-bff-01`.
- RIS was not modified, read internally or deployed. The BFF references only
  the agreed HTTP contract and the RIS branch/HEAD supplied in the mandate.

## 2. Router extension

Added exactly one public RIS rewrite:

```text
/api/ris/cv-builder-profiles
  -> /api/ris/router?__ris_cv_builder_profiles=1
```

Router changes:

- one handler map entry;
- one path-to-route entry;
- one `__ris_cv_builder_profiles` flag entry;
- same path/flag mismatch rejection and direct-router redirect behavior as
  existing routes;
- no nested arbitrary path is accepted. Profile ids are query values and are
  strictly validated before the fixed upstream path is built.

Existing rewrites and handlers are unchanged.

## 3. Transport headers

`api/_lib/ris/client.mjs` was extended backward-compatibly:

- `risRequest` returns `{status, data, etag}`; existing callers continue to
  use `status`/`data`.
- Only two server-selected request headers can be forwarded:
  `Idempotency-Key` and `If-Match`.
- Browser headers are never bulk-forwarded. In particular, a browser-supplied
  `X-Api-Credential`, tenant or owner header cannot replace the server
  credential.
- RIS `ETag` is returned by the BFF for item/get/create/update responses and
  preserved by the typed client.

## 4. Authentication boundary

The new handler reuses `verifyAccessToken`, the configured issuer/client and
the existing `RIS_TEST_USER_ALLOWLIST` gate. It does not create a second auth
system. The server credential remains server-only.

`POST` requires a valid `Idempotency-Key` (16–128 safe characters). `PATCH`
requires a valid `If-Match: "vN"` and returns `428` without calling RIS if it
is absent. `DELETE` accepts optional `If-Match`. Profile ids must match
`^cvp-[A-Za-z0-9-]{8,80}$`.

## 5. Consent boundary

- Purpose: `cv-builder-profile-storage`.
- The RIS notice remains DRAFT with no legal approval. The BFF does not change
  it to APPROVED/ACTIVE.
- The BFF exposes **read-only** status via the existing
  `/api/ris/consents?purpose=cv-builder-profile-storage` route.
- It blocks consent POST/withdraw mutations for this purpose with
  `403 consent_grant_not_available` before any upstream call.
- No PDF, ApplicationV1 or search-profile consent is reused.
- No automatic grant or client-selected notice version exists.

The typed client includes `getStructuredCvConsentStatus` for the later UI
integration; it does not grant or withdraw.

## 6. Typed browser client

Created `src/lib/cvBuilderProfilesApi.ts` with:

- `listStructuredCvProfiles`
- `getStructuredCvProfile`
- `createStructuredCvProfile`
- `updateStructuredCvProfile`
- `deleteStructuredCvProfile`
- `exportStructuredCvProfile`
- `getStructuredCvConsentStatus`

Safety properties:

- Uses the RIS `profileId`; the local `cvId` is not sent as the server key.
- Preserves `version` and `ETag`.
- No automatic retry. A caller must reuse its idempotency key after a timeout.
- A `409` becomes a typed error; no overwrite retry.
- No `localStorage`/`sessionStorage` writes.
- Import review normalization adds only the agreed `schemaVersion:1` and
  defaults missing `applied` to `false`; accepted and applied remain distinct.
- Counts-only reviews with pending items throw `import_review_incomplete`.
- Reviews retain up to 500 items and all 44-item test data without truncation.
- Client flag `VITE_RIS_CV_BUILDER_PROFILE_STORAGE_ENABLED` defaults off and
  blocks every request before fetch when absent.

## 7. Error semantics

| HTTP | BFF behavior |
| --- | --- |
| 401 | authentication required/invalid |
| 403 | access or consent denied |
| 404 | missing or foreign profile |
| 409 | version/idempotency/capacity conflict |
| 413 | payload too large |
| 422 | invalid data/action/id/cursor |
| 428 | required `If-Match` missing |
| 503 | disabled/missing configuration/unavailable |

Upstream error codes are preserved when safe. Internal expressions, CV content,
credentials and tokens are not returned in errors or logs.

## 8. Tests and gates

Focused result:

```text
tests/api/ris-cv-builder-profiles.test.mjs      19 passed
tests/api/ris-routing.test.mjs                  (included)
tests/api/ris-config-separation.test.mjs        (included)
src/lib/cvBuilderProfilesApi.test.ts            12 passed
combined focused run                            54 passed
```

Coverage includes feature-off/no-fetch, missing/invalid JWT, foreign identity,
missing config, POST idempotency/replay, PATCH If-Match/428/409, DELETE and
repeated DELETE, export, pagination, 300-KB and oversize bodies, credential
leak prevention, identity spoof rejection, router flag mismatch, ETag/version,
timeout without retry, 44 review items, accepted/applied separation, consent status and no grant mutation.

Full repository checks:

- API test group: **609 passed / 5 skipped**.
- Frontend/vitest suite with `--maxWorkers=2`: **1898 passed / 5 skipped**.
- Production build: `npm run build` PASS.
- API syntax `node --check` for all `api/**/*.mjs`: PASS.
- `git diff --check`: PASS.
- Secret/privacy scan: no credentials or private CV data in changed files.

The one full-suite timeout observed in `CvBuilderEditorPdf.test.tsx` under
parallel load passed in isolation (4/4) and in the serialized two-worker run;
it is an existing test-environment flake, not a product failure.

## 9. Verification boundaries

- No real RIS request was made; all RIS responses came from a controlled mock.
- No production/account authentication or real CV data was used.
- The local BFF route is default-off and Vercel preview must remain fail-closed
  because the server flag is absent/false.
- RIS deployment, Terraform/AWS, Cognito, CloudFront, DNS and consent
  activation were not touched.
- Vercel preview deployment, if produced, is not production; its build identity
  and disabled BFF response require separate verification.

## 10. Open privacy decisions

`REVIEW_REQUIRED`: notice/legal approval and Art. 9 text, post-withdrawal
read/export policy, retention/grace period, backup/PITR reconciliation,
capacity 20 vs. 10, and real RIS/DynamoDB transaction verification.

## 11. Follow-up tasks

1. UI integration in “Meine Lebensläufe” only after legal/notice approval.
2. Map local `cvId` to the durable RIS `profileId` in a session-only sidecar;
   no migration of session profiles.
3. Build conflict/ETag UX and explicit save/load/delete actions.
4. Authenticated synthetic end-to-end test after flags and notice approval.
5. No main merge or production release in this task.

## 12. Commits

- `3e29bdc` — disabled structured CV BFF, transport, consent status and typed
  client.
- `a4c6d09` — fixed-path structured CV profile handler (included before the
  final tests/documentation).
- Documentation/report commit follows and is recorded by branch history.

## 13. Expected status

`JM-RIS-STRUCTURED-CV-BFF-01 — VERIFIED LOCAL / READY FOR UI INTEGRATION PLANNING`

**STOP before main integration and production release.**
