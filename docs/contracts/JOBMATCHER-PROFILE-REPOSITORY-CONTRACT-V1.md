# Job Matcher Profile Repository Contract v1

**Status:** SPECIFIED / PROPOSED — interfaces only; no production code added
**Date:** 2026-10-31

## 1. Purpose

React components must not know whether a profile lives in the current browser
session or behind a remote RIS-backed API. Domain services depend on resource-
specific repository contracts. The existing `cvProfileStore` and
`manualSearchProfiles` implementations remain session adapters until a remote
adapter is explicitly introduced.

## 2. Shared result and error types

```typescript
type RepositoryErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation_error'
  | 'conflict'
  | 'capacity_exceeded'
  | 'aborted'
  | 'unavailable';

interface RepositoryError extends Error {
  code: RepositoryErrorCode;
  status?: number;
  details?: Record<string, unknown>;
}

interface VersionedResource {
  schemaVersion: 1;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface ListOptions {
  cursor?: string;
  limit?: number;
  signal?: AbortSignal;
}

interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

interface UpdateOptions {
  expectedVersion: number;
  signal?: AbortSignal;
}
```

An update with a stale `expectedVersion` returns `conflict`; it never silently
overwrites a newer resource. Deletes are also conditional where the remote
backend supports it.

## 3. Resource-specific interfaces

```typescript
interface UserProfileRepository {
  get(options?: { signal?: AbortSignal }): Promise<UserProfileV1>;
  patch(input: UserProfilePatchV1, options?: UpdateOptions): Promise<UserProfileV1>;
}

interface CVRepository {
  list(options?: ListOptions): Promise<Page<CVDocumentV1>>;
  get(cvId: string, options?: { signal?: AbortSignal }): Promise<CVDocumentV1>;
  create(input: CreateCVInputV1, options?: { signal?: AbortSignal }): Promise<CVDocumentV1>;
  update(cvId: string, input: UpdateCVInputV1, options: UpdateOptions): Promise<CVDocumentV1>;
  delete(cvId: string, options: UpdateOptions): Promise<void>;
}

interface CVSearchProfileRepository {
  list(cvId: string, options?: ListOptions): Promise<Page<CVSearchProfileV1>>;
  get(cvId: string, searchProfileId: string, options?: { signal?: AbortSignal }): Promise<CVSearchProfileV1>;
  create(cvId: string, input: CreateCVSearchProfileInputV1, options?: { signal?: AbortSignal }): Promise<CVSearchProfileV1>;
  update(cvId: string, searchProfileId: string, input: UpdateCVSearchProfileInputV1, options: UpdateOptions): Promise<CVSearchProfileV1>;
  delete(cvId: string, searchProfileId: string, options: UpdateOptions): Promise<void>;
}

interface ATSProfileRepository {
  list(searchProfileId: string, options?: ListOptions): Promise<Page<ATSSearchProfileV1>>;
  get(searchProfileId: string, atsSearchProfileId: string, options?: { signal?: AbortSignal }): Promise<ATSSearchProfileV1>;
  create(searchProfileId: string, input: CreateATSProfileInputV1, options?: { signal?: AbortSignal }): Promise<ATSSearchProfileV1>;
  update(searchProfileId: string, atsSearchProfileId: string, input: UpdateATSProfileInputV1, options: UpdateOptions): Promise<ATSSearchProfileV1>;
  delete(searchProfileId: string, atsSearchProfileId: string, options: UpdateOptions): Promise<void>;
}

interface ManualSearchProfileRepositoryV1 {
  list(options?: ListOptions): Promise<Page<ManualSearchProfileV1>>;
  get(id: string, options?: { signal?: AbortSignal }): Promise<ManualSearchProfileV1>;
  create(input: CreateManualSearchProfileInputV1, options?: { signal?: AbortSignal }): Promise<ManualSearchProfileV1>;
  update(id: string, input: UpdateManualSearchProfileInputV1, options: UpdateOptions): Promise<ManualSearchProfileV1>;
  delete(id: string, options: UpdateOptions): Promise<void>;
}
```

## 3a. Concrete input contracts

The following payloads are the only client-writable fields in V1. Resource IDs,
parent IDs, `userId`, `tenantId`, timestamps and `version` are server-owned.

```typescript
interface UserProfilePatchV1 {
  nickname?: string;
  firstName?: string;
  lastName?: string;
}

interface CreateCVInputV1 {
  documentId: string;
  filename: string;
  contentType: 'application/pdf';
  sizeBytes: number;
}

interface UpdateCVInputV1 {
  filename?: string;
}

interface CreateCVSearchProfileInputV1 {
  name: string;
  description?: string;
  searchConfig: SearchConfigurationV1;
}

interface UpdateCVSearchProfileInputV1 {
  name?: string;
  description?: string;
  searchConfig?: SearchConfigurationV1;
}

interface CreateATSProfileInputV1 {
  name: string;
  targetRoles: string[];
  skills: string[];
  criteria?: ATSCriteriaV1;
}

interface UpdateATSProfileInputV1 {
  name?: string;
  targetRoles?: string[];
  skills?: string[];
  criteria?: ATSCriteriaV1;
}

interface CreateManualSearchProfileInputV1 {
  name: string;
  description?: string;
  searchConfig: SearchConfigurationV1;
  matchingPreferences: MatchingPreferencesV1;
}

interface UpdateManualSearchProfileInputV1 {
  name?: string;
  description?: string;
  searchConfig?: SearchConfigurationV1;
  matchingPreferences?: MatchingPreferencesV1;
}
```

The JSON Schema bundle in `schemas/JOBMATCHER-PROFILE-V1.schema.json` is the
machine-readable form of these types. `PUT` updates are represented by the
complete update input plus `expectedVersion`; `PATCH` is reserved for the
partial `UserProfile` operation in this V1 contract.

`UserProfileV1`, `CVDocumentV1`, `CVSearchProfileV1`,
`ATSSearchProfileV1`, `ManualSearchProfileV1` and input types are defined in
`JOBMATCHER-PROFILE-DATA-CONTRACT-V1.md`. Inputs exclude server-owned IDs,
timestamps, tenant IDs and versions.

## 4. Session adapter

The session adapter wraps current behavior without pretending it is remote
persistence:

- `cvProfileStore.ts`: hash-keyed module `Map`, 12-hour lazy TTL, current
  frontend capacity up to 50 search entries and 5 ATS assignments per parent.
- `manualSearchProfiles.ts`: App-owned in-memory `Map`, defensive copies,
  cleared on reload and auth identity change.
- CV `File` objects and the active CV workflow remain React state.

The session adapter may implement `get/list/create/update/delete` locally, but
its **session record type must remain explicit** and must not be presented as a
persistent V1 DTO. It must not invent a durable `cvId` from the CV hash, a
`documentId` for a browser `File`, or a persistent `version`. The remote
adapter is the boundary that returns normalized V1 DTOs; session IDs are
explicitly marked ephemeral.

## 5. Remote adapter behavior

The proposed remote adapter uses relative `/api/v1/...` URLs and the existing
`apiFetch` error normalization only after the contract envelope is agreed.
It must:

1. obtain identity from the configured OIDC session, never from request body;
2. send `If-Match` or an equivalent expected-version field on updates/deletes;
3. map `401`, `403`, `404`, `409`, `422`, `429`, `5xx` to typed errors;
4. pass `AbortSignal` through fetch;
5. avoid retrying non-idempotent creates unless an idempotency key is used;
6. never log CV text, tokens, presigned URLs or authorization headers.

## 6. Session-to-remote migration boundary

There is no automatic synchronization. A future explicit action such as “In
meinem Konto speichern” should use a migration service, not UI-level calls:

```typescript
interface ProfileMigrationService {
  preview(selection: MigrationSelection, signal?: AbortSignal): Promise<MigrationPreview>;
  commit(selection: MigrationSelection, idempotencyKey: string, signal?: AbortSignal): Promise<MigrationResult>;
}
```

The preview lists the selected CV metadata, search profiles and ATS variants;
raw `File` content is not implicitly included. Commit receives server IDs and
parent IDs from each successful operation, supports resumable partial failure,
and records no model operation. Repeating the same idempotency key returns the
same result instead of duplicating resources.

## 7. Direct RIS client versus Job Matcher facade

| Criterion | Direct authenticated RIS adapter | Job Matcher HTTP facade |
|---|---|---|
| Coupling | high unless RIS implements this contract | low for UI/mobile clients |
| Cost | lowest if routes already exist | extra server/runtime boundary |
| Security | browser must use supported OIDC/API contract; no RIS secret | server can mediate, but needs secure token exchange |
| Versioning | RIS contract becomes consumer contract | Job Matcher owns stable v1 and maps RIS versions |
| Mobile reuse | good only with stable RIS API | good with one product API |
| Testability | contract tests against RIS | facade tests plus RIS adapter tests |
| Recommendation | preferred if RIS can serve v1 directly | use only if translation/auth mediation is necessary |

**Proposal:** start with Variant A at the domain boundary, but require a
Job-Matcher-owned `ProfileRepository` contract and a thin remote client. Do not
create a facade merely to reproduce RIS endpoints. Re-evaluate Variant B only
if RIS cannot expose the required ownership-safe contract or if mobile clients
need a materially different representation.
