# Job Matcher API and Session Boundary

**Status:** VERIFIED for Job Matcher code; RIS side NOT VERIFIED
**Date:** 2026-10-31

## 1. API inventory

The current Job Matcher serverless API is unversioned and relative to the same
origin. `src/api.ts` calls `/api/jobs`, `/api/match`, `/api/profile`,
`/api/ats-analysis`, `/api/models`, `/api/job-details`, `/api/alerts` and
related routes. `POST /api/profile` is CV-derived AI profile generation/cache;
it is not a user-profile persistence endpoint and must not be repurposed.

The repository documentation defines `/api/v1/` URL versioning and a future
`{ data, meta }` envelope, but the current routes are predominantly flat and
unversioned. New persistence contracts are therefore **PROPOSED** under
`/api/v1/`; no legacy route is renamed in this phase.

## 2. Current storage inventory

| Data object | Current location | Reload | Logout/user change | Durable? |
|---|---|---|---|---|
| Uploaded CV | `App` React state, `CvDocument.file: File` | lost | removed/reset; auth reset does not upload | no |
| CV hash | React state; derived SHA-256 key | lost | removed with CV state | no, but used as server cache key |
| CV search profiles | module `Map` in `cvProfileStore.ts`, keyed by hash | lost | explicit CV removal resets all; no account ownership | no; 12h lazy TTL while page lives |
| ATS profiles | same CV hash bucket | lost | same as CV profiles | no; 12h lazy TTL |
| Manual profiles | App `useRef` repository / `Map` | lost | cleared on auth identity transition | no |
| Profile extraction result | Upstash Redis `cv-profile:<sha256>` from `api/profile.mjs` | survives | not removed by client “CV data remove” | yes, 30-day TTL |
| Jobs/source caches | Upstash Redis source caches | client lost | unrelated to account profile | temporary |
| Anonymous quota identity | HttpOnly `mj_session` + Redis counters | cookie may survive | no product delete path | durable session metadata, no CV content |

This table reconciles the current code with `PERSISTENCE-BOUNDARY-01`. The
browser profile lists are not durable persistence, but the server-side
CV-derived profile cache is persistent for its TTL and currently has no client
delete call.

## 3. Privacy and processing boundaries

1. PDF extraction is local in the browser.
2. Anonymization is local and selectable; “not anonymized” is an explicit
   current workflow mode and is not a claim of complete privacy.
3. Consent gates AI processing, not a separate durable-storage consent.
4. `POST /api/profile` sends normalized processed text to the model/cache path.
5. Saving a future persistent profile must be a separate explicit action and
   must not call a model.
6. Manual profiles need no CV, hash or AI operation.
7. The future delete contract must cover persistent metadata, linked
   documents, profile children and the hash-keyed derived-profile cache, or
   document an approved retention exception.

## 4. Proposed persistence API boundary

The following are proposals, not implemented routes:

```text
GET   /api/v1/me/profile
PATCH /api/v1/me/profile

GET    /api/v1/me/cvs
POST   /api/v1/me/cvs
GET    /api/v1/me/cvs/{cvId}
PATCH  /api/v1/me/cvs/{cvId}
DELETE /api/v1/me/cvs/{cvId}

GET    /api/v1/me/cvs/{cvId}/search-profiles
POST   /api/v1/me/cvs/{cvId}/search-profiles
GET    /api/v1/me/cvs/{cvId}/search-profiles/{profileId}
PUT    /api/v1/me/cvs/{cvId}/search-profiles/{profileId}
DELETE /api/v1/me/cvs/{cvId}/search-profiles/{profileId}

GET    /api/v1/me/search-profiles/{profileId}/ats-profiles
POST   /api/v1/me/search-profiles/{profileId}/ats-profiles
GET    /api/v1/me/search-profiles/{profileId}/ats-profiles/{atsId}
PUT    /api/v1/me/search-profiles/{profileId}/ats-profiles/{atsId}
DELETE /api/v1/me/search-profiles/{profileId}/ats-profiles/{atsId}

GET    /api/v1/me/manual-search-profiles
POST   /api/v1/me/manual-search-profiles
GET    /api/v1/me/manual-search-profiles/{id}
PUT    /api/v1/me/manual-search-profiles/{id}
DELETE /api/v1/me/manual-search-profiles/{id}
```

All routes are PROPOSED. Auth must be derived server-side from verified OIDC
claims; client-supplied `userId`, `tenantId` and parent IDs are never sufficient
for authorization. Every child lookup must validate the complete parent chain.

## 5. Common contract behavior

Proposed success:

```json
{"data": {"...": "resource"}, "meta": {"version": "v1", "requestId": "uuid"}}
```

Proposed error:

```json
{"error": {"code": "conflict", "message": "Version conflict"}, "meta": {"requestId": "uuid"}}
```

Required statuses: `400` validation, `401` unauthenticated, `403` ownership or
tenant denial, `404` not found in the authorized scope, `409` stale version or
idempotency conflict, `413` file metadata limit, `422` semantic validation,
`429` rate limit, `5xx` unavailable/internal. List endpoints use opaque cursor
pagination and bounded limits; they must not require a client-visible table
scan.

Create is non-idempotent by default and requires an idempotency key for retry.
Update/delete require an expected version (`If-Match` or equivalent). Delete is
logical at the API boundary; physical document/version deletion requires the
platform retention policy and an auditable asynchronous result.

## 6. Current limits and gaps

- No persistent Job Matcher repository or remote adapter exists in current
  `src/`.
- No authenticated Job Matcher persistence route exists in current `api/`.
- CV list target 10 is represented in frontend state; target search-profile
  limit 2 is not enforced by current store.
- Manual profile count remains open; no artificial limit is proposed here.
- `cv-profile:<hash>` has no client deletion route.
- RIS route reachability, its gateway, its repository and its erase handlers
  are **NOT VERIFIED** in this pass because RIS is outside the permitted
  repository scope.
