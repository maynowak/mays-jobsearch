# Job Matcher Application Management Contract v1

**Status:** SPECIFIED / PROPOSED — no UI, API, persistence, RIS, AWS or Cognito implementation
**Date:** 2026-11-02
**Scope:** `maynowak/mays-jobsearch`
**Handoff:** APP-02

## 1. Boundary

This contract describes a future, account-backed application tracker. It does
not introduce a second profile manager, a browser database, a new server cache,
or a second persistence architecture.

```text
Verified user identity
└── ApplicationV1 [0..N]
    ├── JobReferenceV1
    ├── ApplicationDocumentsV1
    │   ├── CoverLetterVersionV1 [0..N]
    │   └── optional CVReferenceV1
    ├── statusHistory [1..N]
    └── history [0..N]
```

`ApplicationV1` is owned by exactly one verified identity. The owner is derived
server-side from the existing verified auth contract (`iss + sub`); email,
nickname or an unverified browser value must never become the owner key.

## 2. Common types

```typescript
type SchemaVersion = 1;
type ISODateTime = string; // RFC 3339
type OpaqueId = string;

type ApplicationStatus =
  | "draft"
  | "submitted"
  | "feedback"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn";

type ApplicationChannel = "online" | "email" | "portal" | "postal" | "other";
type SalaryPeriod = "year" | "month" | "hour";
type DocumentStatus = "missing" | "draft" | "ready";
```

## 3. ApplicationV1

```typescript
interface ApplicationV1 {
  schemaVersion: 1;
  applicationId: string;       // server-generated
  ownerId: string;             // server-derived verified identity
  job: ApplicationJobReferenceV1;
  documents: ApplicationDocumentsV1;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  applicationDate?: ISODateTime;
  applicationChannel?: ApplicationChannel;
  contact?: ApplicationContactV1;
  notes?: string;
  salary?: ApplicationSalaryContextV1;
  followUp?: ApplicationFollowUpV1;
  status: ApplicationStatus;
  statusHistory: ApplicationStatusHistoryEntryV1[];
  history: ApplicationHistoryEntryV1[];
  version: number;             // optimistic concurrency
}
```

### 3.1 Job reference

```typescript
interface ApplicationJobReferenceV1 {
  jobId: string;       // stable source-specific or session-local key, not application ID
  title: string;
  companyName: string;
  location: string[];
  source: string[];
  originalUrl?: string; // required for source jobs; optional for manual jobs
  jobOrigin?: "source" | "manual"; // missing means "source" for compatibility
}
```

Manual jobs use `source: ["manual"]`, a session-local
`manual:<opaque-id>` key and a neutral title/company fallback. They must not
invent an external job ID or URL. A user-supplied manual URL is optional and,
when present, must be http(s). Imported source jobs keep the existing required
URL rule.

### 3.2 Documents

```typescript
interface ApplicationDocumentsV1 {
  coverLetterDraft: string;
  coverLetterVersions: CoverLetterVersionV1[];
  cvReference?: {
    cvId: string;          // existing CV domain/document reference
    documentId?: string;   // existing secure document reference
    label?: string;
  };
  documentStatus: "missing" | "draft" | "ready";
}

interface CoverLetterVersionV1 {
  versionId: string;
  jobId: string;           // must equal application.job.jobId
  createdAt: ISODateTime;
  content: string;
  source: "generated" | "revised" | "manual";
  language?: "de" | "en";
  model?: string;
}
```

No PDF bytes, CV hash, S3 key or browser `File` object is part of the
application record. A CV reference is a reference, never a copied document.

### 3.3 Application information and salary

```typescript
interface ApplicationContactV1 {
  name?: string;
  email?: string; // contact person, not identity
  phone?: string;
}

interface ApplicationSalaryV1 {
  amount: number;
  currency: string; // ISO 4217, e.g. EUR
  period: "year" | "month" | "hour";
}

interface ApplicationSalaryContextV1 {
  expectation?: ApplicationSalaryV1;
  offer?: ApplicationSalaryV1;
}

interface ApplicationFollowUpV1 {
  dueOn: string;              // calendar date YYYY-MM-DD, no UTC timestamp
  note?: string;              // optional reason / planned action, max 2000
  status: "open" | "completed";
  completedAt?: ISODateTime;  // required when status is completed
}
```

`followUp` is optional and independent of the application status. A completed
follow-up is never considered overdue. Removing it means omitting the optional
property from the persisted resource. Follow-up mutations use the existing
versioned update input; update input may carry `followUp`, and `null` in the
client session update removes the optional value.

### 3.4 Status history and timeline

```typescript
interface ApplicationStatusHistoryEntryV1 {
  at: ISODateTime;
  from: ApplicationStatus | null;
  to: ApplicationStatus;
  note?: string;
}

type ApplicationHistoryEntryV1 =
  | { kind: "feedback"; id: string; at: ISODateTime; text: string }
  | { kind: "interview"; id: string; at: ISODateTime; scheduledAt: ISODateTime; note?: string }
  | { kind: "note"; id: string; at: ISODateTime; text: string };
```

`statusHistory` contains every status transition, including the initial
`from:null → draft` entry. `history` contains feedback, appointments and notes.
The effective timeline is both arrays ordered by `at`.

## 4. Status model

| Status | Meaning |
|---|---|
| `draft` | Created but not sent. This is not an application submission. |
| `submitted` | Explicitly confirmed as sent / awaiting response. |
| `feedback` | A response/feedback was received. |
| `interview` | Interview stage. |
| `offer` | Offer received. |
| `rejected` | Rejected. |
| `withdrawn` | Withdrawn by the user. |

Allowed transitions:

```text
draft      -> submitted
submitted  -> feedback | interview | rejected | withdrawn
feedback   -> interview | offer | rejected | withdrawn
interview  -> offer | rejected | withdrawn
offer      -> withdrawn
rejected   -> (terminal)
withdrawn  -> (terminal)
```

`draft → submitted` requires `confirmed: true` and is only allowed through the
explicit submit action. Generating, revising or saving a cover letter never
marks an application as submitted.

## 5. API contract

The future API uses the existing authenticated session. The owner is never
accepted from the request body. The following are **contract-only** endpoints;
none are implemented in APP-01.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/applications` | Create a draft from an explicit user action |
| `GET` | `/api/applications` | List applications for the verified owner |
| `GET` | `/api/applications/{id}` | Read one owned application |
| `PATCH` | `/api/applications/{id}` | Update draft data with `expectedVersion` |
| `POST` | `/api/applications/{id}/status` | Explicit status transition |
| `POST` | `/api/applications/{id}/history` | Add feedback, interview or note |
| `POST` | `/api/applications/{id}/cover-letter-versions` | Append an explicit letter version |
| `GET` | `/api/applications/{id}/export` | Export one owned application |
| `DELETE` | `/api/applications/{id}` | Delete one owned application |

Concurrency:

- Every mutable resource carries `version`.
- Requests carry `expectedVersion` (or `If-Match` mapping to it).
- A stale version returns `409` (`version_conflict`).
- The server increments `version` and `updatedAt` after a successful mutation.

Create input must not contain `applicationId`, `ownerId`, `createdAt`,
`updatedAt`, `version` or `status`. Those are server-owned.

## 6. Machine-readable artifacts

- JSON Schema: `docs/contracts/schemas/JOBMATCHER-APPLICATION-V1.schema.json`
- Fixtures: `docs/contracts/fixtures/application-v1/`
- TypeScript contract: `src/lib/applications/contractTypes.ts`
- Runtime validation: `src/lib/applications/applicationValidation.ts`
- Pure domain rules: `src/lib/applications/applicationDomain.ts`

The JSON Schema handles shape and field-level rules. Cross-field rules such as
`coverLetterVersion.jobId === application.job.jobId`, status-history continuity,
ownership and stale-version conflicts are enforced by the domain/API layer.

## 7. RIS and persistence boundary

- No RIS route, gateway, DynamoDB table, S3 bucket or OpenAPI entry is assumed
  or verified here.
- The previous profile contract's RIS handoff remains the reference for future
  account persistence.
- A future RIS adapter must map `ownerId` from the verified auth identity and
  enforce ownership on every read/write/delete.
- No guest-to-account transfer is automatic. A future transfer requires explicit
  user confirmation and a preview.
- No application data is stored by APP-01.
- No application data may be derived from email addresses, unverified browser
  values or another session's data.

## 8. Export and deletion

Export response:

```typescript
interface ApplicationExportV1 {
  schemaVersion: 1;
  exportedAt: ISODateTime;
  application: ApplicationV1;
}
```

Deletion response contract:

```typescript
interface ApplicationDeletionReceiptV1 {
  schemaVersion: 1;
  applicationId: string;
  ownerId: string;
  deletedAt: ISODateTime;
}
```

The export is an owner-scoped copy. Deletion is owner-scoped and idempotent in
the future API. Neither operation is implemented as persistence in APP-01.

## 9. Privacy rules

- Application data is personal and must not be logged.
- Creating an application is an explicit user action.
- Generating/improving a cover letter does not create or submit an application.
- No automatic account persistence.
- No borrowing of another browser/session identity.
- CV references do not copy CV files or hashes into the application record.
- Export and deletion are explicit contract operations.
- Legal retention/erasure text and the final account consent wording remain
  separate decisions.

## 10. Open decisions for APP-02

1. Confirm the RIS ownership claim (`iss + sub`) and tenant mapping.
2. Choose the API authentication/session mechanism; no new client identity.
3. Decide deletion semantics (hard delete vs. tombstone) and retention.
4. Confirm export format/download delivery and authorization.
5. Decide whether a cover-letter version is created automatically on every
   generate/revise or only after explicit user action.
6. Decide application capacity and pagination.
7. Decide how a job reference is invalidated when the source job disappears.
8. Add backend idempotency, conditional writes, audit metadata and migration
   tests.
9. Obtain legal/privacy approval for account-backed application storage.
