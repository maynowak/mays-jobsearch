# JM-CV-BUILDER-03C-RELEASE-GATE-01

**Status:** `JM-CV-BUILDER-03C — PREVIEW VERIFIED / LOCAL INTEGRITY VERIFIED / PRODUCTION BLOCKED`

**Date:** 2026-11-13

**Branch:** `feature/jm-cv-builder-03c-release-gate-01`

**Baseline:** `414e85e`

## 1. Git baseline

- Jobsearch remote `main`: `b3b8525`.
- 03C hardening baseline: `feature/jm-cv-builder-03c-hardening-02 @ 414e85e`.
- RIS reference: `0e08822`; RIS was not modified.
- New branch created from `414e85e` in an isolated worktree.

## 2. Vercel failure forensic

The failed commit `414e85e` had:

- Vercel Jobsearch: FAILURE (`dpl_HkSmkEUpzpTg5g3kKDxsUQ3p8UPX`)
- Vercel Matcher: FAILURE (`dpl_GcDA1WAc8XqvMKzXx2kADGqz76AX`)
- Vercel Deployments aggregate: FAILURE

The actual build log for **both** projects showed the same TypeScript error:

```text
src/lib/cvBuilderProfilesApi.test.ts(201,52): error TS2345:
Argument of type 'string | number' is not assignable to parameter of type 'number'.
Type 'string' is not assignable to type 'number'.
Error: [BUILD_UTILS_SPAWN_2] Command "npm run build" exited with 2
```

Cause: the status/code test table was inferred as `(string | number)[][]`;
the loop passed `status` to `jsonResponse(status: number, ...)`. This was a
test-only type error, not a runtime/product failure or account block.

Correction (`e9ec185`): typed the table explicitly as
`Array<[number, string]>`. `npm run build` then passed locally. No Vercel project
configuration, pipeline, credentials or environment variables were changed.

### Preview status

- `e9ec185`: Vercel Jobsearch **success**, Vercel Matcher **success**,
  Deployments aggregate **success**.
- `a4efb81` (combined E2E/test evidence): all three Vercel statuses
  **success**.
- Latest READY previews:
  - Jobsearch `dpl_4Jn5ZM7vSm3gSQam2XTcVJULXKv9` at
    `mays-jobsearch-8fn8x59sd-maymilly.vercel.app`.
  - Matcher `dpl_DQYFgakBSffhTrecQUWi5LxRJSS1` at
    `mays-job-matcher-4eqxdnn9x-maymilly.vercel.app`.

Smoke on the latest Jobsearch preview:

- `/profil?tab=cv` → HTTP 200.
- `/api/ris/cv-builder-profiles` → 503
  `cv_builder_profile_storage_disabled`.
- Structured consent status → 503 `consent_disabled`.
- Existing `/api/ris/cvs` and `/api/ris/search-profiles` remained 503 disabled.

No RIS write occurred.

## 3. Idempotent duplicate recovery

The previous recovery adopted a candidate by name + template. That is not a
unique create identity and was removed.

Now:

- Each duplicate operation has a stable key scoped by source profile id +
  source version.
- The payload is regenerated from the same source version; a changed source
  creates a new scope/key.
- On timeout/unknown outcome the UI does **not** adopt a same-name candidate,
  does not auto-retry and does not claim success.
- The local state and key are retained. A deliberate second click replays the
  exact payload and key; the server idempotency contract can return the already
  created profile.
- If the key TTL has expired and the server no longer knows the operation, the
  UI still reports uncertainty instead of treating name/template as proof.
- Existing 409/version conflict behavior is unchanged.

This favors a server-confirmed create response. Without a server operation
lookup endpoint, there is no unsafe client-side ownership inference.

## 4. Combined 03B/03C browser E2E

The synthetic mock-BFF browser test now performs one combined flow:

**Import → Review → Editor → Durable Save → Reload → Load → Review continue →
Update → Export-capable local PDF path.**

Fixture:

- 71 recognized skills;
- 58 selected skills;
- 44 complete review entries;
- original text and corrected text;
- `accepted` and `applied` kept distinct;
- page and section provenance.

Verified after reload:

- 58 selected skills restored;
- 44 review entries/backlog restored;
- no duplicate application;
- review continuation available;
- a versioned `PATCH` update succeeds;
- local PDF export remains available.

Screenshot:
`docs/reports/assets/JM-CV-BUILDER-03C-UI-INTEGRATION-01/combined-71-44-roundtrip.png`.

The test uses synthetic OIDC state and a controlled mock BFF only.

## 5. Regression and quality

- API: **609 passed / 5 skipped**.
- Frontend (`--maxWorkers=2`): **1917 passed / 5 skipped**.
- 03C durable/combined E2E: PASS.
- 03B import E2E: PASS (71 skills, 58 selected, review backlog).
- 03A full-page handoff E2E: PASS.
- PDF export E2E: PASS.
- Production build / TypeScript: PASS.
- API syntax, `git diff --check`, secret/privacy scan: PASS.
- No tests removed or weakened.

## 6. Privacy and security boundaries

- No real RIS/AWS/Consent request or account.
- No partner credential or owner identity in the browser.
- No real CV/PDF data; only synthetic fixtures.
- No localStorage/sessionStorage CV persistence added.
- No consent grant/withdraw mutation; consent remains DRAFT/default-off.
- No main merge, production deployment or production activation.
- Temporary PDF E2E assets were restored to their committed baseline; only
  new synthetic 03C evidence was added.

## 7. Remaining production gates

`REVIEW_REQUIRED`: legal notice/Art. 9 approval, authenticated production
403/503/428/timeout/logout runs, RIS deployment and consent activation, retention
and withdrawal policy, backup/PITR reconciliation.

## 8. Commits

- `e9ec185` — Vercel TypeScript correction and safe duplicate retry.
- `a4efb81` — combined 71/44 browser E2E and screenshots.
- Documentation/report commit follows this file.

**STOP before main integration and production release.**
