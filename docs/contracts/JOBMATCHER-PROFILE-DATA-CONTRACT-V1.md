# Job Matcher Profile Data Contract v1

**Status:** SPECIFIED / PROPOSED — not implemented, not deployed
**Owner:** Job Matcher product contract
**Date:** 2026-10-31

This document defines the Job Matcher-owned, persistence-neutral profile
contract. It does not expose React state, browser `File` objects, CV hashes as
identifiers, S3 keys, or RIS/DynamoDB fields.

## 1. Boundaries

```text
User
├── UserProfile
├── CVDocument [0..10]
│   └── CVSearchProfile [0..2 per CV]
│       └── ATSSearchProfile [0..5 per CVSearchProfile]
└── ManualSearchProfile [0..N, product limit OPEN]
```

- `UserProfile` describes the person/account; it is not a search profile.
- `CVDocument` is persistent metadata and a document reference; file content
  is not embedded in profile JSON.
- `CVSearchProfile` belongs to exactly one `CVDocument`.
- `ATSSearchProfile` belongs to exactly one `CVSearchProfile`.
- `ManualSearchProfile` has no `cvId`, no CV hash and no artificial CV parent.
- Matching results, AI scores, explanations and ATS analysis results are not
  persistence objects in v1.

The stated capacities are product targets. Current frontend enforcement is
different: CV state is capped at 10, CV profile buckets currently allow up to
50 entries, and ATS assignment enforces 5 per parent. The target of 2 CV
search profiles is **not implemented**.

## 2. Common value types

```typescript
type SchemaVersion = 1;
type ISODateTime = string; // RFC 3339 UTC, e.g. 2026-10-31T12:00:00Z
type UUID = string;         // server-generated opaque identifier

type WorkMode = 'remote' | 'hybrid' | 'onsite';
type EmploymentType = 'full_time' | 'part_time';

interface SearchConfigurationV1 {
  skills: string;             // existing quoted/phrase-preserving contract
  targetRoles: string[];
  city: string;
  radiusKm: number | null;
  workModes: WorkMode[];
  employmentTypes: EmploymentType[];
}

interface MatchingPreferencesV1 {
  requiredSkills: string[];
  preferredSkills: string[];
  excludedTerms: string[];
}
```

Rules:

- Empty `skills` is valid only when `targetRoles` is non-empty; the search
  operation, not persistence, decides whether a query is executable.
- `targetRoles`, `workModes`, `employmentTypes` and preference arrays preserve
  order in transport and are deduplicated case-insensitively by the domain
  adapter.
- A phrase containing spaces is one phrase. The existing quoted skills
  encoding must not be split on whitespace.
- `radiusKm: null` means no radius constraint. It must not become `0` or an
  implicit city filter.
- `city` is the resolved locality string when an OpenPLZ suggestion was
  selected. A raw ZIP must not be silently represented as a city name without
  a defined resolution policy.
- Unknown future fields may be ignored by a v1 reader but must not overwrite
  known values on update.

## 3. Resource schemas

### UserProfileV1

```typescript
interface UserProfileV1 {
  schemaVersion: 1;
  userId: string;       // response only; derived from verified identity
  tenantId?: string;    // response only where the platform contract exposes it
  nickname?: string;
  firstName?: string;
  lastName?: string;
  email?: string;       // server-authoritative; not a lookup key from client
  status: 'active' | 'disabled' | 'pending';
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  version: number;      // optimistic concurrency token
}
```

The client must never submit `userId` or `tenantId` as authorization input.

### CVDocumentV1 / CVMetadataV1

```typescript
interface CVDocumentV1 {
  schemaVersion: 1;
  cvId: UUID;                 // domain ID, server-generated
  documentId: string;         // existing secure-document ID, if linked
  filename: string;
  contentType: 'application/pdf';
  sizeBytes: number;
  processingStatus: 'pending' | 'ready' | 'failed' | 'deleted';
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  version: number;
  metadata?: {
    pageCount?: number;
    language?: string;
  };
}
```

`documentId` and `cvId` have distinct roles: the former identifies the secure
document-storage record; the latter identifies the user-owned CV aggregate.
The final RIS mapping remains OPEN because the RIS repository was not inspected
in this Job Matcher-only contract pass. Presigned URLs, S3 keys and tokens are
never persisted in this schema.

### CVSearchProfileV1

```typescript
interface CVSearchProfileV1 {
  schemaVersion: 1;
  searchProfileId: UUID;
  cvId: UUID;
  name: string;
  description?: string;
  origin: 'cv';
  searchConfig: SearchConfigurationV1;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  version: number;
}
```

### ATSSearchProfileV1

```typescript
interface ATSSearchProfileV1 {
  schemaVersion: 1;
  atsSearchProfileId: UUID;
  searchProfileId: UUID;
  name: string;
  targetRoles: string[];
  skills: string[];           // structured phrases, not a whitespace string
  criteria?: Record<string, unknown>; // reserved, versioned extension point
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  version: number;
}
```

`criteria` is not an invitation to persist ATS results. It represents
user/profile configuration only; its schema must be versioned before use.

### ManualSearchProfileV1

```typescript
interface ManualSearchProfileV1 {
  schemaVersion: 1;
  manualSearchProfileId: UUID;
  name: string;
  description?: string;
  origin: 'manual';
  searchConfig: SearchConfigurationV1;
  matchingPreferences: MatchingPreferencesV1;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  version: number;
}
```

The frontend currently uses `id`, `createdAt` and `updatedAt` in its
session-only model. The remote contract uses explicit resource IDs and adds a
concurrency `version`; an adapter, not React components, performs this mapping.

## 4. Current-to-contract mapping

| Current Job Matcher value | v1 contract | Status |
|---|---|---|
| `Profile.skills: string` | `SearchConfigurationV1.skills` | direct; phrase-preserving |
| `Profile.targetRoles` | `targetRoles` | direct |
| `Profile.city` | `city` | direct, ZIP resolution policy OPEN |
| `Profile.radiusKm` | `radiusKm` | direct nullable number |
| `Profile.workModes` | `workModes` | direct enum |
| `Profile.employmentTypes` | `employmentTypes` | direct enum |
| `CvDocument.file: File` | not serialized; upload via document API | deliberate boundary |
| `CvDocument.hash` | no v1 field | session/cache key only, not identity |
| `CvSearchProfileEntry.savedAt` | `createdAt`/`updatedAt` | adapter conversion |
| `CvAtsProfileEntry.searchProfileId` | `searchProfileId` | direct parent relation |
| `matchingPreferences` | `MatchingPreferencesV1` | manual-only in v1 |

RIS `SearchConfiguration` compatibility, field loss and round-trip behavior
are **NOT VERIFIED** in this pass. A later RIS mapping must explicitly handle
`query`/structured skills, `location`/city, `locationRadius`/radiusKm,
`remoteOnly`/workModes, and employment types. `remoteOnly=true` must not be
used to represent `['remote', 'hybrid']` without an agreed lossy policy.

## 5. JSON example

```json
{
  "schemaVersion": 1,
  "manualSearchProfileId": "msp_01HEXAMPLE",
  "name": "AWS Cloud Engineer",
  "description": "Remote-first cloud roles",
  "origin": "manual",
  "searchConfig": {
    "skills": "AWS, Terraform, \"Cloud Architecture\"",
    "targetRoles": ["Cloud Engineer", "Solutions Architect"],
    "city": "Darmstadt",
    "radiusKm": 50,
    "workModes": ["remote", "hybrid"],
    "employmentTypes": ["full_time"]
  },
  "matchingPreferences": {
    "requiredSkills": ["AWS", "Terraform"],
    "preferredSkills": ["Python"],
    "excludedTerms": ["Schichtarbeit"]
  },
  "createdAt": "2026-10-31T12:00:00Z",
  "updatedAt": "2026-10-31T12:00:00Z",
  "version": 1
}
```

The identifier in examples is synthetic only. No real user data is included.
