# MAYS-JOBSEARCH-PROFILE-API-01A — Execution Log

## Status

- **Overall:** SPECIFIED / PROPOSED — Job Matcher contract foundation only
- **Application implementation:** NOT IMPLEMENTED
- **RIS implementation/integration:** NOT VERIFIED
- **AWS/deployment/migration:** NOT DEPLOYED / NOT RUN
- **Date:** 2026-10-31
- **Job Matcher baseline:** `f26b4d9` before documentation; remote was synchronized
- **Working tree preflight:** only pre-existing unrelated untracked files; no tracked changes

The RIS repository was not inspected in this pass. Consequently all RIS
capabilities are explicitly marked `NOT VERIFIED` or `OPEN`; no historical RIS
statement is promoted to a live API claim.

## 1. Actual Job Matcher findings

- `Profile` is the existing search contract: `skills: string`, `targetRoles`,
  `city`, nullable `radiusKm`, `workModes`, `employmentTypes`.
- `CvDocument` contains a browser-only `File`, UI metadata and an optional
  session hash. It is not a persistent JSON contract.
- `cvProfileStore.ts` stores CV search and ATS lists in a module `Map` keyed by
  CV hash. It has a 12-hour lazy TTL, clears on reload, currently allows up to
  50 list entries and enforces at most 5 ATS assignments per parent. The
  product target of 2 search profiles per CV is not currently enforced.
- ATS entries retain `searchProfileId` as a parent reference and only store
  skills/roles; parent location and other search settings remain in the parent
  profile through `buildCvSearchProfile`.
- `manualSearchProfiles.ts` stores independent manual profiles in an App-level
  in-memory repository. No CV/hash is created; no account persistence exists.
  Manual profile count remains open.
- `/api/profile` is an existing AI CV-profile generation endpoint with a
  30-day Upstash `cv-profile:<hash>` cache. It must not become a persistence
  endpoint.
- Current API routes are unversioned `/api/*`; repository standards propose
  URL-major versioning `/api/v1/...` and a future response envelope. New
  persistence routes in this report are proposals only.

## 2. Contract decision

Job Matcher owns the product-neutral v1 DTOs and repository interfaces. A
session adapter continues to serve the existing UI. A future remote adapter
implements the same interfaces against an authenticated persistence API. React
components do not depend on RIS/DynamoDB/S3 structures.

The recommended initial integration is a direct authenticated RIS client
adapter **if and only if** RIS can serve the v1 ownership, versioning and error
contract. A separate Job Matcher facade is not automatically required; it is a
fallback when translation or server-side credential mediation is necessary.

## 3. Status matrix

| Component | Implemented in JM | API reachable | Persistence | Gap |
|---|---|---|---|---|
| UserProfile | no | N/A | no | contract + authenticated backend |
| CVDocument metadata | browser `CvDocument` only | no persistence API | no | domain metadata linked to secure document |
| Secure CV upload | local PDF processing and existing upload flow | existing `/api/profile` processing only | derived Redis cache | no durable CV aggregate/delete contract |
| CVSearchProfile | session `Map` | no | no | stable server ID/CRUD/capacity 2 |
| ATSSearchProfile | session child entries | no | no | durable child CRUD and parent ownership |
| ManualSearchProfile | session-only `Map` | no | no | independent user-owned CRUD |
| MatchingPreferences | manual session model | no | no | persistence schema only; no matching execution |
| Session migration | no | no | no | explicit preview/commit/idempotency flow |
| RIS integration | no | NOT VERIFIED | NOT VERIFIED | RIS evidence package required |
| Privacy erasure extension | current client reset only | no cache-delete route | partial | 30-day derived cache and future descendants |

## 4. Required next implementation packages

1. **JM-PROFILE-CONTRACT-02** — freeze v1 DTOs, envelope, error codes and
   synthetic contract fixtures; no network implementation.
2. **RIS-PROFILE-FOUNDATION-03** — RIS team verifies routes, ownership,
   DynamoDB query keys, conditional writes, capacities and OpenAPI. No work
   should begin from this report alone.
3. **RIS-PROFILE-DOCUMENT-04** — CV metadata/document linkage, processing
   state, orphan cleanup and versioned S3 deletion.
4. **RIS-PROFILE-SEARCH-05** — CV search-profile and ATS child CRUD with full
   parent-chain authorization and 2/5 conditional capacity checks.
5. **RIS-PROFILE-MANUAL-06** — independent manual-profile CRUD and matching
   preference persistence; no CV parent and no model call.
6. **JM-PROFILE-REMOTE-ADAPTER-07** — implement remote repository interfaces,
   leaving session adapters available as fallback.
7. **JM-PROFILE-MIGRATION-08** — explicit “save to account” preview/commit,
   server IDs, idempotency and partial-failure recovery.
8. **JM-RIS-AUTH-E2E-09** — authenticated staging tests, ownership negatives,
   concurrency, deletion and release gate.

## 5. RIS handoff boundary

The handoff identifies required capabilities but does not claim that any RIS
handler, Terraform route, OpenAPI entry, DynamoDB GSI, S3 lifecycle or erase
step is reachable or deployed. In particular, the reported OPEN-5 concern for
`/me/jobsearches` remains unresolved here. The RIS team must provide the
evidence package in `MAYS-RIS-PROFILE-PERSISTENCE-01-HANDOFF.md`.

## 6. Validation

- Repository preflight: PASS for Job Matcher (`main`, baseline `f26b4d9`,
  `origin/main` synchronized).
- Documentation paths and internal references: reviewed while writing.
- `git diff --check`: run after document creation — status to be recorded at
  final gate.
- Application tests: **NOT RUN**; this phase intentionally changes no
  application code.
- TypeScript/build/API syntax: **NOT RUN**; no application/API code changed.
- RIS tests, deployment and HTTP reachability: **NOT RUN / NOT VERIFIED**.

## 7. Changed files and side effects

Documentation-only additions:

- `docs/contracts/JOBMATCHER-PROFILE-DATA-CONTRACT-V1.md`
- `docs/contracts/JOBMATCHER-PROFILE-REPOSITORY-CONTRACT-V1.md`
- `docs/contracts/JOBMATCHER-API-SESSION-BOUNDARY-01.md`
- `docs/contracts/MAYS-RIS-PROFILE-PERSISTENCE-01-HANDOFF.md`
- `docs/contracts/MAYS-RIS-PROFILE-INTEGRATION-OPEN-QUESTIONS.md`
- this execution report

No application code, API route, authentication flow, infrastructure, database,
S3 object, model call or user data was changed. No production deployment was
performed. Pre-existing unrelated untracked files remain untouched.
