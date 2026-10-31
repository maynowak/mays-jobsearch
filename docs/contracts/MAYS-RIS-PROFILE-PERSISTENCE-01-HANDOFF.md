# Mays-RIS Profile Persistence Handoff

**Status:** PROPOSED handoff / RIS evidence NOT VERIFIED
**Consumer contract:** Job Matcher Profile Data Contract v1
**Date:** 2026-10-31

This handoff is intentionally explicit about the verification boundary. The RIS
repository was not inspected in this Job Matcher-only phase. Names below are
integration targets supplied by the work request, not claims of reachable,
deployed or production-ready RIS APIs.

## 1. Required RIS capabilities

| Job Matcher object | RIS foundation named for investigation | Status | Required decision |
|---|---|---|---|
| `UserProfile` | `/me/profile`, Cognito/OIDC | NOT VERIFIED | Confirm claims, tenant derivation, patch/version semantics |
| `CVDocument` | `/me/documents`, private S3, presigned URLs | NOT VERIFIED | Add/confirm CV metadata aggregate and document link |
| `CVSearchProfile` | `JobSearch` / `SearchConfiguration` | NOT VERIFIED | Confirm multiple children per CV and stable parent IDs |
| `ATSSearchProfile` | nested `ATSSearchProfile` in JobSearch | NOT VERIFIED | Confirm up to 5 independently addressable variants |
| `ManualSearchProfile` | no confirmed foundation | OPEN | Add independent user-owned resource without CV parent |
| `MatchingPreferences` | no confirmed foundation | OPEN | Persist configuration only; not scores/results |
| Erasure | privacy erasure lifecycle | NOT VERIFIED | Include CV, descendants, cache references and document versions |

The documented OPEN-5 concern about `/me/jobsearches` being code-only/unreachable
must remain open until handler, API Gateway/Terraform, canonical OpenAPI,
deployment and an authenticated HTTP smoke test all agree.

## 2. Required ownership contract

For every request RIS must derive `userId` and tenant from verified Cognito/OIDC
claims. Request-body IDs are selectors, never authority. The service must:

- reject cross-user and cross-tenant parent chains with `403` or an approved
  not-found privacy response;
- validate `cvId → searchProfileId → atsSearchProfileId` atomically enough to
  prevent orphan children;
- enforce capacities on the corresponding parent (`10`, `2`, `5`) with
  conditional writes, not read-then-write races;
- use keyed queries and pagination for user lists, not full-table scans;
- use optimistic version checks for update/delete;
- define behavior for delete-vs-update races and partial descendant deletion.

None of these guarantees is verified against RIS by this document.

## 3. Document and CV separation

The secure document ID and the domain `cvId` should remain separate unless RIS
proves that a single ID can safely serve both roles. A presigned URL, S3 key,
credential, or upload token must never be returned as durable profile metadata.

The expected lifecycle is:

```text
create CV metadata → prepare existing document upload → upload file
→ explicit completion/processing state → link search profiles
→ logical delete → governed S3/version/cache cleanup
```

An upload failure must leave no silently “ready” CV. Orphan detection and
cleanup ownership are RIS decisions that require verification.

## 4. SearchConfiguration mapping questions

The Job Matcher contract uses `skills` (phrase-preserving string),
`targetRoles[]`, `city`, nullable numeric `radiusKm`, `workModes[]` and
`employmentTypes[]`. RIS is reported as having `query`, `location`,
`locationRadius`, `remoteOnly`, `employmentTypes` and `sources`, but this mapping
was not verified.

RIS must explicitly decide:

- whether `query` accepts a structured phrase array or needs a lossless encoded
  field;
- whether `locationRadius` is numeric or textual and how null is represented;
- how `remote`, `hybrid` and `onsite` map without collapsing multiple values into
  `remoteOnly`;
- whether RIS `sources` is user configuration or operational metadata;
- which employment type values are canonical;
- whether unknown Job Matcher fields round-trip without loss.

## 5. Proposed endpoint handoff

The Job Matcher proposal uses `/api/v1/me/...` resources. RIS may implement
these directly or expose an adapter-compatible equivalent, but must not make the
frontend depend on internal DynamoDB keys.

Required operations are listed in
`JOBMATCHER-API-SESSION-BOUNDARY-01.md`. Every operation needs an authenticated
contract test covering success, foreign parent, stale version, capacity limit,
pagination and delete semantics. No route is marked LIVE or IMPLEMENTED here.

## 6. Erasure requirements

The future RIS erasure workflow must include:

1. user-owned CV metadata;
2. secure document references and all applicable object versions;
3. CV search profiles;
4. ATS children;
5. independent manual profiles;
6. derived profile-cache references and approved retained data;
7. audit records without raw CV content or tokens.

Logical deletion, physical deletion, retention, restoration and partial failure
must be distinguishable. A successful metadata delete is not proof that all S3
versions or external/provider data have been erased.

## 7. RIS verification checklist

Before any adapter implementation, the RIS team must provide evidence for:

- actual local HEAD and clean/dirty state;
- handler and gateway route correspondence;
- canonical OpenAPI inclusion;
- deployed stage/domain and authenticated HTTP test;
- repository key schema and GSI/query patterns;
- conditional write/version behavior;
- tenant/owner derivation;
- document metadata and upload completion;
- erasure tests including versioned S3 behavior;
- response/error envelope compatibility.

Until then every RIS mapping in this handoff remains **NOT VERIFIED** or
**OPEN**.
