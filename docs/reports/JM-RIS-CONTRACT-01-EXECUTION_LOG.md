# JM-RIS-CONTRACT-01 — CVDocumentV1 Size Alignment

**Date:** 2026-11-01  
**Repository:** Jobsearch (`mays-jobsearch`)  
**Branch:** `feature/arbeit`  
**Baseline:** local `c7f8eb6`; reference `origin/main@0ef8ee5`  
**Status:** COMPLETE — Jobsearch contract side

## Contract decision

`CVDocumentV1.sizeBytes` is status-dependent:

| Status | `sizeBytes` | Rule |
|---|---|---|
| `pending` | optional | Omitted until an authoritative object size exists |
| `ready` | required | Positive integer from verified object metadata |
| `failed` / `deleted` | optional | No fabricated value; omission is valid |

The JSON Schema uses a conditional requirement: `ready` requires
`sizeBytes`; all statuses still reject zero/negative/non-integer values when a
value is supplied.

`CreateCVInputV1.sizeBytes` remains required and positive for compatibility. It
is explicitly documented and validated as a client-declared upload hint, not as
the authoritative `CVDocumentV1` size. The adapter must not promote that hint
to a verified ready value.

## Changes

- Updated `docs/contracts/schemas/JOBMATCHER-PROFILE-V1.schema.json` with the
  status-dependent `CVDocumentV1` rule and input-hint documentation.
- Updated TypeScript `CVDocumentV1` discriminated type and runtime validation
  in `src/lib/profiles/contractTypes.ts` and `profileValidation.ts`.
- Added pending, failed, deleted and ready-without-size fixtures.
- Updated data/repository contract documentation and fixture README.
- No API route, AI function, session repository, auth, Redis, Vercel, AWS or
  RIS code was changed.

## Tests

PASS:

- Targeted contract validation: **7 passed**.
- `npm run build`: **PASS**.
- `node --check api/profile.mjs`: **PASS**.
- Existing profile fixtures remain in the contract fixture set.

The full available Vitest run reported **825 passed, 5 skipped, 3 failed**.
The three failures are pre-existing environment/build-identity assumptions in
`Imprint.test.tsx` and `appInfo.test.ts` (`VITE_CONTACT_EMAIL` and
`__APP_COMMIT_SHA__` are not set in this local test invocation). No contract
test failed. No automatic fix was made outside scope.

JSON Schema syntax was checked as JSON. The repository has no local
`jsonschema`/Ajv validator dependency, and no dependency was installed; the
status semantics are covered by the TypeScript runtime validation tests.

## Handoff

**RIS size-contract handoff: READY.** RIS already implements the matching safe
semantics: pending/terminal responses omit unverified sizes and ready responses
expose only S3-verified positive sizes. No RIS change is required.

The prior RIS integration gate remains separately blocked by its unavailable
39-test DynamoDB Local environment. This Jobsearch commit does not claim that
database verification.
