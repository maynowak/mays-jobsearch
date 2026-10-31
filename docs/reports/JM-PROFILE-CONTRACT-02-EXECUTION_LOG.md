# JM-PROFILE-CONTRACT-02 — Execution Log

## Status

- **Overall:** SPECIFIED / VERIFIED (contract artifacts and local fixture validation)
- **Application implementation:** NOT IMPLEMENTED
- **RIS integration:** NOT VERIFIED / outside scope
- **AWS/deployment/migration:** NOT RUN / NOT DEPLOYED
- **Date:** 2026-10-31
- **Baseline:** `3a74c4c`

## Scope completed

The V1 contract foundation was consolidated without changing `src/`, `api/`,
authentication, storage, infrastructure or existing session behavior.

1. Concrete create/update/patch input contracts were added to the repository
   contract.
2. A strict Draft 2020-12 JSON Schema bundle was added for resource and input
   definitions.
3. Synthetic valid, negative and backend-semantic fixtures were added.
4. ATS `criteria` was restricted to versioned required/preferred/excluded phrase
   lists; scores, explanations, evidence, prompts and model output are rejected.
5. Product capacities were made explicit: 10 CVs/user, 2 search profiles/CV,
   5 ATS profiles/search profile, and manual-profile capacity OPEN.
6. The lossless `Profile ↔ SearchConfigurationV1` roundtrip requirements were
   documented for phrases, null radius, work modes and employment types.

## Machine validation

No new npm dependency was installed. The environment's existing Python
`jsonschema` package was used with the repository's Draft 2020-12 schema and
`FormatChecker`. The full runtime adapter roundtrip is not implemented in this
phase; only the schema/JSON transport shape and lossless-field fixture are
locally verified.

| Validation | Result |
|---|---|
| JSON parse of schema and all fixtures | VERIFIED — PASS |
| `UserProfileV1` fixture | VERIFIED — PASS |
| `CVDocumentV1` fixture | VERIFIED — PASS |
| `CVSearchProfileV1` fixture | VERIFIED — PASS |
| `ATSSearchProfileV1` fixture | VERIFIED — PASS |
| `ManualSearchProfileV1` fixture | VERIFIED — PASS |
| All create/update/patch fixture shapes | VERIFIED — PASS — 9 payload fixtures |
| `SearchConfigurationV1` roundtrip fixture shape | VERIFIED — PASS |
| Unknown persisted field negative fixture | VERIFIED — rejected as `validation_error` |
| ATS score/model-output negative fixture | VERIFIED — rejected as `validation_error` |
| Orphan parent fixture | NOT LOCALLY VERIFIABLE — structurally valid; requires backend ownership/parent lookup |
| Stale-version fixture | NOT LOCALLY VERIFIABLE — structurally valid; requires persisted version and concurrency test |
| `git diff --check` | VERIFIED — PASS |
| Application tests/build/API syntax | NOT RUN — no application code changed |
| RIS tests/reachability | NOT RUN / NOT VERIFIED |

## Contract decisions

- Server-owned `userId`, `tenantId`, resource IDs, timestamps and `version` are
  not writable input fields.
- `additionalProperties: false` is used on V1 resources and payloads.
- `ATSCriteriaV1` requires `schemaVersion: 1` and permits only three phrase
  lists. It cannot contain matching results or AI output.
- `expectedVersion` is transport/concurrency metadata (`If-Match` or equivalent)
  rather than part of the domain resource body.
- JSON Schema verifies shape and field rules only. Parent existence, ownership,
  capacity enforcement, atomicity and stale-version conflicts remain backend
  contract tests.
- `Profile → SearchConfigurationV1 → Profile` must preserve all supported
  fields. No `remoteOnly` lossy reduction is allowed in the Job Matcher
  contract.

## Artifacts

- `docs/contracts/JOBMATCHER-PROFILE-DATA-CONTRACT-V1.md`
- `docs/contracts/JOBMATCHER-PROFILE-REPOSITORY-CONTRACT-V1.md`
- `docs/contracts/schemas/JOBMATCHER-PROFILE-V1.schema.json`
- `docs/contracts/fixtures/profile-v1/README.md`
- `docs/contracts/fixtures/profile-v1/*.json`
- this report
- `docs/AI_AUDITLOG.md` (phase entry)

## Boundaries and open points

- No RIS access or modification occurred; RIS mapping remains NOT VERIFIED.
- No remote adapter, persistence API, migration flow or backend capacity check
  was implemented.
- The schema's `x-capacity-contract` annotation records product targets; it does
  not claim that a JSON validator can enforce cross-resource cardinality.
- The next implementation package is a separate backend/adapter contract gate;
  it must add ownership, parent-chain, atomic capacity, idempotency and
  deletion integration tests before persistence code is considered ready.

## Git and deployment

- Existing unrelated untracked files were not touched.
- Commit and push are performed only for the scoped contract artifacts.
- No production deployment or AWS operation was performed.
