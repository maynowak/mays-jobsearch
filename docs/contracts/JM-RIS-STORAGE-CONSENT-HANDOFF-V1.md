# JM-RIS-STORAGE-CONSENT-HANDOFF-V1

**Status:** PROPOSED / NOT IMPLEMENTED / RIS EVIDENCE NOT VERIFIED  
**Date:** 2026-11-04  
**Scope:** Server-side, purpose-specific consent for future durable application data storage.

> This document is a handoff contract. It does not claim that a consent API, RIS
> route, database table, retention job or erasure workflow exists. No productive
> consent persistence is implemented in the Job Matcher repository.

## 1. Identity boundary

Every consent operation must be derived server-side from a verified OIDC token:

- issuer: verified `iss`
- subject: verified `sub`
- tenant: server-side mapping if RIS requires one
- email is never an identity substitute
- browser-provided `ownerId`, `userId`, timestamps or consent status are not authoritative

The client may send the selected purpose, status and consent-text version, but the
server must derive the owner and issue the decision timestamp.

## 2. Required purposes

| Purpose | Data category | Required for account? |
|---|---|---|
| `cv_storage` | CVs and CV versions | No |
| `application_storage` | Applications, cover letters, document versions | No |
| `search_profile_storage` | Search and ATS profiles | No |

Purposes are independent. A decision for one purpose must never imply another.

## 3. Consent states

| State | Meaning |
|---|---|
| `not_requested` | No decision recorded |
| `granted` | Current consent text accepted |
| `declined` | Optional storage declined |
| `withdrawn` | Previously granted consent revoked |
| `reconsent_required` | Text/notice version changed or policy requires a new decision |

A missing record is not equivalent to consent. A declined/withdrawn state must not
block required account functionality.

## 4. Versioned record

```json
{
  "schemaVersion": 1,
  "owner": {
    "issuer": "verified OIDC issuer",
    "subject": "verified OIDC subject"
  },
  "decisions": [
    {
      "purpose": "application_storage",
      "status": "granted",
      "decidedAt": "server-issued ISO timestamp",
      "consentTextVersion": "string",
      "privacyNoticeVersion": "string",
      "withdrawnAt": "optional server-issued ISO timestamp"
    }
  ]
}
```

Rules:

- `decidedAt` and `withdrawnAt` are server-issued.
- The browser must not supply authoritative timestamps.
- Consent audit events must not contain CV text, cover-letter text or other
  document contents.
- Historical decisions/audit events must be append-only or otherwise
  tamper-evident; current state can be derived or stored separately.
- A consent text or privacy notice version change must be able to trigger
  `reconsent_required`.

## 5. Proposed API surface

These routes are a proposal only. They are not implemented in Job Matcher.

### `GET /api/v1/me/storage-consents`

Response:

```json
{
  "schemaVersion": 1,
  "decisions": [],
  "consentTextVersion": "string",
  "privacyNoticeVersion": "string",
  "backendAvailable": true
}
```

### `PUT /api/v1/me/storage-consents/{purpose}`

Request:

```json
{
  "status": "granted",
  "consentTextVersion": "string",
  "privacyNoticeVersion": "string",
  "idempotencyKey": "client-generated opaque key"
}
```

Server requirements:

- derive owner from verified token,
- validate purpose and status,
- validate the currently released text/notice versions,
- write the decision and append an audit event,
- issue the decision timestamp,
- return the persisted state,
- reject stale or mismatched text versions,
- support idempotency for retries,
- never store document contents in the consent record.

### `POST /api/v1/me/storage-consents/{purpose}/withdraw`

Server requirements:

- derive owner from verified token,
- record `withdrawn` and a server timestamp,
- append an audit event,
- stop dependent optional processing,
- return current state,
- do not claim immediate deletion unless the separate erasure workflow has
  completed.

## 6. Required backend gate

Productive consent confirmation is allowed only when all are true:

1. consent service is available and authenticated,
2. owner is derived from verified `iss + sub`,
3. released consent text and privacy notice versions are known,
4. decision and audit event are persisted server-side,
5. persisted success is returned to the client,
6. withdrawal is functional,
7. retention and erasure rules are approved.

Until then the Job Matcher UI must remain preparation-only.

## 7. Retention, withdrawal and erasure

Withdrawal and deletion are separate operations:

- withdrawal stops future optional processing,
- already stored data may remain subject to legal retention,
- erasure must follow an approved retention/erasure policy,
- CV, application, cover-letter versions, search/ATS profiles, caches and
  document references must be covered by the erasure inventory,
- the exact retention periods, legal bases and exceptions require privacy/legal
  approval.

## 8. RIS privacy capabilities to verify

No RIS capability is considered available until evidence is supplied:

- inspect stored data,
- export owned data,
- erasure request/lifecycle,
- resumable deletion and orphan cleanup,
- ownership/tenant enforcement,
- append-only consent audit,
- server timestamp authority,
- idempotent consent writes,
- retention enforcement.

## 9. Legal review required

For each purpose document and approve:

- purpose and data categories,
- legal basis (optional consent vs. account necessity),
- necessity and proportionality,
- recipients/processors,
- storage location and transfer safeguards,
- retention period,
- withdrawal consequences,
- erasure procedure,
- data-subject rights,
- wording of consent and privacy notices.

The Job Matcher implementation does not provide a legal opinion or a production
consent basis.

## 10. Client integration contract

The client may later:

- read current decisions,
- show each purpose independently,
- send an explicit decision,
- display server-confirmed status and timestamp,
- request withdrawal,
- link to export/erasure.

The client must not:

- use email as owner,
- create local durable consent records,
- show an active checkbox before the backend gate passes,
- bundle storage consent with AI-provider consent,
- treat session-only state as durable consent,
- claim that withdrawal equals immediate erasure.
