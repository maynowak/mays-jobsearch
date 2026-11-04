# MAYS-RIS Application Persistence Handoff v1

**Status:** SPECIFIED / PROPOSED — no RIS implementation, no verified RIS route, no deployment
**Owner of UI/contract/domain:** Mays-Jobsearch
**Owner of backend API, persistence, identity, authorization and lifecycle:** RIS
**Date:** 2026-11-02

This document is a requirements and integration contract for a future RIS
application-persistence backend. The endpoints below are **proposals**, not
claims about an existing RIS API.

## 1. Resources

### Application (server-backed)

The server resource is `ApplicationV1` from
`src/lib/applications/contractTypes.ts`:

- `schemaVersion: 1`
- server-generated `applicationId`
- server-derived `ownerId`
- `job` reference (source jobs with required URL, or manual jobs with optional
  `originalUrl` and `jobOrigin: "manual"`)
- `documents` (cover-letter draft/versions, optional CV reference, document status)
- application information, salary, optional follow-up, status, status history,
  timeline
- `createdAt`, `updatedAt`, `version`

`followUp` is optional (`dueOn` as `YYYY-MM-DD`, optional note, `open` or
`completed`, `completedAt` for completed). It is independent of the
application status and must be validated as a real calendar date, not a
synthetic UTC timestamp.

The browser-local `SessionApplicationV1.localId` is not a server ID and must
never be accepted as `applicationId`.

Jobsearch-side boundaries in `src/lib/applications/repositoryTypes.ts`:

- `ApplicationRepository` — current synchronous-in-memory session contract.
- `ApplicationPersistencePort` — future asynchronous RIS-owned contract for
  `ApplicationV1`. It is a type-only interface; no implementation, HTTP client,
  route assumption or credential storage exists in APP-03.
- `ApplicationMigrationPortV1` — future, explicit, preview-and-confirm transfer
  contract for local session drafts. It is not called by the UI.

## 2. Ownership and identity

- `ownerId` is derived server-side from the existing verified OIDC identity
  (`iss + sub`); email is never an owner key.
- `ownerId` is never writable by the client.
- Every read/write/export/delete checks ownership on the server.
- A client cannot adopt another session's `ownerId`, local ID or records.
- No partner/client credentials belong in the browser.
- Unauthenticated requests must not receive application resources.

## 3. Proposed API surface

| Method | Path | Semantics |
|---|---|---|
| `GET` | `/applications` | List owned applications; pagination |
| `GET` | `/applications/{applicationId}` | Read one owned application |
| `POST` | `/applications` | Create a draft; server creates ID/owner/timestamps |
| `PATCH` | `/applications/{applicationId}` | Update mutable draft fields |
| `POST` | `/applications/{applicationId}/status` | Explicit status transition |
| `POST` | `/applications/{applicationId}/history` | Add feedback/interview/note |
| `POST` | `/applications/{applicationId}/cover-letter-versions` | Append version |
| `GET` | `/applications/{applicationId}/export` | Export owned resource |
| `DELETE` | `/applications/{applicationId}` | Delete owned resource |

Exact route prefixes remain OPEN until RIS confirms its gateway convention.

## 4. Versioning and conflicts

- Every mutable resource carries `version`.
- Mutations send `expectedVersion` or `If-Match` mapped to `version`.
- Stale versions return `409 version_conflict`.
- Successful mutations increment `version` and `updatedAt`.
- Server must not silently overwrite local edits.
- `create` should be idempotent for a client idempotency key, but the server
  still generates `applicationId`.

## 5. Status rules

Use the APP-01 transitions only:

```text
draft -> submitted
submitted -> feedback | interview | rejected | withdrawn
feedback -> interview | offer | rejected | withdrawn
interview -> offer | rejected | withdrawn
offer -> withdrawn
rejected / withdrawn -> terminal
```

- `draft -> submitted` requires `confirmed: true` / explicit submit action.
- Generating or saving a cover letter must not mark an application submitted.
- Status history is append-only and starts with `from: null -> draft`.
- History events (feedback/interview/note) do not change status by themselves.

## 6. Cover letters and CV references

- Cover-letter versions are bound to both application and job (`jobId`).
- Server validates `version.jobId === application.job.jobId`.
- Version creation should be an explicit client action; no invisible
  auto-versioning.
- CV references contain only `cvId`/`documentId`/label.
- No PDF bytes, CV hash, presigned URL or S3 key are stored in ApplicationV1.
- RIS must verify CV ownership separately; Jobsearch cannot prove it from a
  reference alone.

## 7. Export and deletion

Export:

- Owner-scoped, authorized `GET /applications/{id}/export`.
- Returns the APP-01 `ApplicationExportV1` envelope or an equivalent signed
  export document.
- Must not expose another owner's data.
- Local session exports remain labelled `localDraft: true`; they are not server
  resources.

Deletion:

- Owner-scoped `DELETE`.
- Confirm intent in UI.
- Define hard delete vs. tombstone/retention before implementation.
- Return a deletion receipt or explicit idempotent result.
- Local UI deletion must not fabricate a server deletion receipt.

## 8. Pagination and error contract

- Cursor-based pagination recommended: `limit`, `cursor`, `nextCursor`.
- Stable sort by `updatedAt` or a documented server order.
- Standard errors:
  - `400 validation_error`
  - `401 unauthenticated`
  - `403 forbidden`
  - `404 not_found`
  - `409 version_conflict`
  - `409 idempotency_conflict`
  - `429 rate_limited`
  - `503 unavailable`
- Abort/cancellation is a client concern; server must not half-write on timeout.

## 9. Session-to-RIS transfer contract

Future flow only:

```text
Local SessionApplicationV1
  → user explicitly selects "transfer to account"
  → preview of fields/documents to transfer
  → explicit confirmation
  → server create (server IDs)
  → server-confirmed ApplicationV1
  → receipt / local reference mapping
```

Rules:

- No automatic migration.
- `localId` is never used as `applicationId`.
- Duplicate detection by `jobId` + owner + active application; define whether
  duplicates are rejected or linked.
- Partial transfer must be reported per item, never silently discarded.
- On success, local item may be marked migrated/replaced only after server
  confirmation.
- On failure, local item remains intact.
- No external AI calls or Apify runs during transfer.

## 10. Existing RIS dependencies and local read-only check

A local RIS checkout was inspected only read-only during APP-03. The checkout
was on `main` at `c49eb2b`; the package-referenced branch
`feature/ris-partner-profile-persistence-v1` and commit `b76adfa` were not
present in that checkout. The referenced documents
`RIS-JOBSEARCH-V1-CONTRACT-MATRIX.md`,
`RIS-PARTNER-PROFILE-R07-G0-INTEGRATION-READINESS.md` and
`RIS-R08-POLICY-01-PRIVACY-DECISION-GATE.md` were also not present locally.
Those references therefore remain **NOT VERIFIED** here.

No application CRUD endpoint was verified in RIS. The only safe statement is
that Jobsearch has a consumer-side contract and a local session implementation;
RIS persistence, authentication delegation, server ownership and retention
remain backend dependencies.

Risk handling:

- No RIS partner credential or `X-Api-Credential` may be placed in the browser.
- A browser/BFF or authorized delegation boundary must be selected jointly
  before any remote call.
- A disclosed S3 key or document-output mismatch in RIS is a separate security
  finding and is not fixed by APP-03.

## 11. Privacy and lifecycle

- Application data is personal and must not appear in technical logs.
- No storage without explicit account decision.
- No CV file content in application resources.
- Define retention, export, deletion and audit rules with legal/privacy review.
- Guest/session data is not account data and must not be mixed.
- RIS handles backend encryption, authorization, backups, retention and
  erasure; Jobsearch must not claim those controls without evidence.

## 12. Open / unverified items

1. RIS route prefix, authentication handshake and gateway ownership.
2. Whether RIS supports cursor pagination and conditional writes.
3. Server-generated ID format and idempotency key handling.
4. Hard delete vs. tombstone and retention periods.
5. CV ownership verification.
6. Export format/signing/download delivery.
7. Migration/idempotency semantics and local-record replacement.
8. Rate limits and error mapping.
9. Legal/privacy approval for account-backed application storage.
10. Local RIS read-only check: `main` @ `c49eb2b`; the referenced branch
    `feature/ris-partner-profile-persistence-v1` @ `b76adfa` and the three
    referenced RIS reports were not present locally. They remain **NOT
    VERIFIED** here.
11. Browser-safe delegation/BFF boundary and exact request/response envelope.
12. Application-level retention, physical erasure, backup and restore policy.
13. Whether a local-to-account transfer can be resumed safely after a partial
    failure.

## 13. Non-goals

- No RIS backend implementation in this repository.
- No AWS/Cognito/RIS change.
- No production API calls or deployment.
- No browser credential storage.
- No second profile/auth architecture.
