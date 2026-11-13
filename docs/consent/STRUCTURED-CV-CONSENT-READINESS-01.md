# Structured CV Consent Lifecycle Readiness

**Status:** TECHNICAL SPECIFICATION — **NO PRODUCTION ACTIVATION**

**Purpose:** `cv-builder-profile-storage`

**Notice:** `structured-cv-profile-storage-2026-11-12-draft-1` — DRAFT,
`legalApprovalRef: null`

## 1. Existing implementation

Already present:

- read-only BFF status projection:
  `getStructuredCvConsentStatus()` →
  `GET /api/ris/consents?purpose=cv-builder-profile-storage`;
- server-side consent contract/repository with purpose/version validation,
  GRANTED/WITHDRAWN states and append-only history;
- structured-CV write gate in RIS; DRAFT is rejected in the HTTP adapter;
- BFF blocks grant/withdraw for this purpose (`consent_grant_not_available`);
- UI durable-save action is shown only for granted consent under an approved
  notice.

Not implemented / intentionally absent:

- production grant and withdraw endpoints for `cv-builder-profile-storage`;
- approved notice text/version and legal approval reference;
- a final UI consent dialog and Art. 9 attestation;
- post-withdrawal read/export/deletion policy;
- authenticated production consent E2E.

## 2. Required user flow (future approved notice)

1. Authenticated user opens the existing CV management area.
2. UI reads status (not a client flag) and shows the approved notice with its
   version/hash and a separate Art. 9 acknowledgement if legally required.
3. User explicitly grants consent via a purpose-specific POST.
4. RIS validates purpose, notice version, notice lifecycle, text mapping and
   consent context (subject/tenant/partner/issuer); it writes the grant
   transaction idempotently.
5. BFF re-reads the server status; only `GRANTED` + approved notice enables
   **Dauerhaft speichern**.
6. User can withdraw; RIS records WITHDRAWN and blocks new writes immediately.
7. Read/export/delete after withdrawal follow the approved privacy policy,
   including any grace period.
8. Regrant creates a new explicit grant; it never restores deleted data.

No step may be inferred from a client flag, browser state or an existing
PDF/search/application consent.

## 3. API contract for the later release

Use the existing RIS consent service; do not add a second consent system.

```text
GET  /v1/partner/me/consents?purpose=cv-builder-profile-storage
POST /v1/partner/me/consents
POST /v1/partner/me/consents/withdraw
GET  /v1/partner/me/consents/history?purpose=cv-builder-profile-storage
```

POST body (server-selected purpose/version; client cannot invent them):

```json
{
  "purpose": "cv-builder-profile-storage",
  "noticeVersion": "<server-approved-version>",
  "specialCategoriesConsent": true,
  "specialCategories": ["..."],
  "externalTextVersion": "<server text version>",
  "externalTextSha256": "<server text hash>"
}
```

The final notice version, legal reference and text hash are server-owned. The
BFF must remain the only browser egress and must not expose partner credentials,
JWTs, tenant/user ids or consent history of other users.

## 4. Consent proof and idempotency

- Server returns status, notice version/state, granted/withdrawn timestamps and
  record version.
- Grant is idempotent for the same purpose/version/context; a different version
  while granted is a conflict, not a silent overwrite.
- Withdraw is idempotent for an already withdrawn record; missing/foreign
  ownership returns the same safe 404/403 shape.
- A DRAFT, missing, malformed or unknown notice is rejected with a safe 4xx/5xx
  and no write.
- No automatic grant on login, page load, save, import, PDF upload or AI action.

## 5. UI state model

`classifyStructuredCvConsent()` maps the read-only status to:

| State | UI |
|---|---|
| loading | status check; no write |
| error | retry status; no write |
| missing | consent explanation; no write |
| draft | “not yet legally approved”; no write |
| granted | show durable save |
| withdrawn | consent required; no write |
| unknown | fail closed; no write |

The existing session-only CV list remains available in every state.

## 6. Art. 9 and evidence

If legal review requires an explicit Art. 9 acknowledgement, it must be a
separate affirmative field; it must not be inferred from the purpose consent or
from imported free text. Store only the server evidence reference, not CV text
in logs. The notice text, legal basis, retention and withdrawal policy remain
`REVIEW_REQUIRED` in the privacy package.

## 7. Testing boundary

Synthetic tests cover missing, DRAFT, approved mock, GRANTED, WITHDRAWN,
NOT_GRANTED, unknown, regrant and logout/session reset through mock interfaces.
No real RIS consent mutation, notice approval or production activation is
performed.
