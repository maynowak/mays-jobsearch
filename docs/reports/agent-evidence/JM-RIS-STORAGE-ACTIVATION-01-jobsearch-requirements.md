# JM-RIS-STORAGE-ACTIVATION-01 — Jobsearch requirements & evidence (A → B handoff)

**Date:** 2026-11-07
**Repository:** `mays-jobsearch` (Jobsearch / A side)
**Worktree:** `worktrees/jobsearch-storage-activation-01`
**Branch:** `feature/jm-ris-storage-activation-01`
**Status:** LOCAL IMPLEMENTED — NOT PUSHED, NOT DEPLOYED, NO LIVE PERSISTENCE EVIDENCE

## 1. Scope

Harden the Jobsearch BFF so a durable `application-storage` consent grant can
only be written when the RIS consent notice is actually approved and active.
No RIS repository, AWS, environment, secret or deployment change was made.

## 2. Current gap (before this change)

`api/_lib/ris/consentsHandler.mjs` did:

```js
grantAllowed: Boolean(cfg.noticeVersion)   // GET
// POST: require cfg.noticeVersion, then POST { purpose, noticeVersion }
```

`RIS_CONSENT_NOTICE_VERSION` is a mapping, not an approval. Setting it to `1.0`
made the UI grantable and forwarded `1.0` to RIS even though the RIS
`application-storage` notice `1.0` is currently `DRAFT` with
`legalApprovalRef: null`. The Jobsearch side never read the RIS notice state.

## 3. RIS contract this side relies on (to be confirmed by the RIS agent)

`GET /v1/partner/me/consents?purpose=application-storage` (partner surface,
`Authorization: Bearer <access token>`, `X-Api-Credential`) must return, for
the authenticated user:

```jsonc
{
  "items": [
    { "purpose": "application-storage", "status": "NOT_GRANTED",
      "noticeVersion": null, "version": 0 }
  ],
  "catalog": [
    {
      "purpose": "application-storage",     // optional here; if present it must match
      "noticeVersion": "1.0",
      "noticeState": "DRAFT",               // "ACTIVE" when grantable
      "noticeApproved": false,              // strict boolean
      "acceptedForNewGrant": false          // strict boolean
    }
  ]
}
```

Rules implemented by Jobsearch:

1. The catalogue entry is matched by `noticeVersion` equal to the
   server-configured `RIS_CONSENT_NOTICE_VERSION`. A `purpose` on the entry, if
   present, must equal `application-storage`.
2. `grantAllowed` requires all of: entry exists, `noticeState === "ACTIVE"`,
   `noticeApproved === true`, `acceptedForNewGrant === true`.
3. Missing/non-array catalogue, `null`, unknown version, non-boolean flags,
   conflicting duplicate entries, RIS non-2xx, timeout or network error all
   fail closed.
4. The browser response exposes only `noticeVersion`, `noticeState`,
   `noticeApproved`, `acceptedForNewGrant`, `grantAllowed`, `noticeReason`.
   Internal legal approval references are never returned (test-asserted).

## 4. Implemented behaviour

- New helper `api/_lib/ris/consentNotice.mjs`
  - `evaluateNoticeGrant(data, { noticeVersion, purpose })` — pure, fail-closed.
  - `loadNoticeGrant(cfg, token, { purpose })` — loads the live catalogue via the
    existing `risRequest` client, returns `{ ok, status, code, evaluation }`.
  - `noticeRejectionStatus()` / `noticeMessage()` — HTTP mapping.
- `api/_lib/ris/consentsHandler.mjs`
  - `GET` reuses the same RIS response (`items` + `catalog`) and returns the
    notice state and `noticeReason`.
  - `POST` grant re-loads the catalogue immediately before writing. A blocked
    notice returns a 4xx/5xx and **never** calls the RIS grant endpoint.
  - `POST ?action=withdraw` is unchanged and allowed regardless of notice state.
  - The notice version stays server-owned; a body-supplied version is ignored.
- `src/lib/risConsentApi.ts` — types extended for the notice state.
- `src/components/StorageConsentLive.tsx` — shows the RIS notice state and the
  block reason; the existing fail-closed message and version display remain.

### Error codes

| Situation | Status | `code` |
| --- | --- | --- |
| No `RIS_CONSENT_NOTICE_VERSION` | 503 | `notice_version_not_mapped` |
| Catalogue missing / malformed / conflicting duplicates | 503 | `notice_catalog_invalid` |
| RIS error, timeout, network failure | 4xx/5xx (else 503) | `notice_catalog_unavailable` |
| Version not in catalogue (unknown/changed) | 409 | `notice_version_unknown` |
| State is `DRAFT` (or anything not `ACTIVE`) | 409 | `notice_not_active` |
| `noticeApproved !== true` | 409 | `notice_not_approved` |
| `acceptedForNewGrant !== true` | 409 | `notice_not_accepted` |

## 5. Verification (real command output)

```
$ npx vitest run tests/api/ris-consents.test.mjs tests/api/ris-routing.test.mjs tests/api/ris-config-separation.test.mjs
 Test Files  3 passed (3)
      Tests  43 passed (43)

$ npx vitest run src/components/StorageConsentLive.test.tsx src/lib/applications/risRemoteRepository.test.ts src/lib/applications/remoteSessionRepository.test.ts
 Test Files  3 passed (3)
      Tests  36 passed (36)

$ npx vitest run tests/api
 Test Files  40 passed | 3 skipped (43)
      Tests  546 passed | 5 skipped (551)

$ node --check api/_lib/ris/consentNotice.mjs && node --check api/_lib/ris/consentsHandler.mjs
node --check OK

$ npm run build
✓ built in 1.23s   (tsc -b && vite build, PASS)

$ git diff --check
(no output)
```

Covered cases: DRAFT catalogue blocks GET and POST without a grant call;
ACTIVE + approved + accepted allows GET and sends the server version on POST;
missing/malformed catalogue fails closed; RIS 500 and network failure fail
closed; withdraw still works while grant is blocked; unknown/changed version
fails closed; DRAFT with contradictory approval flags is still blocked;
non-boolean flags are rejected; purpose mismatch is rejected.

## 6. Activation blockers / open questions for the RIS agent

1. **Confirm the catalogue location and shape.** Is the catalogue always
   returned by `GET /v1/partner/me/consents` (top-level `catalog` array), or is
   there a dedicated endpoint? Jobsearch currently requires a top-level
   `catalog` array on that response.
2. **Confirm `noticeState` values.** Jobsearch treats only `ACTIVE` as
   grantable. Please confirm the exact enum (`DRAFT`, `ACTIVE`, ...) and
   whether any other state may legitimately be grantable (for example a
   `PUBLISHED`/`APPROVED` alias). Until confirmed, anything other than `ACTIVE`
   stays blocked.
3. **Confirm the authoritative flags.** Are `noticeApproved` and
   `acceptedForNewGrant` strict booleans and independent of `noticeState`?
   Jobsearch requires all three and does not infer approval from
   `legalApprovalRef`.
4. **Confirm per-purpose scoping.** Does the catalogue contain entries for all
   purposes, and is `purpose` present on each entry? Jobsearch filters by
   `purpose` when the field is present.
5. **Confirm that DRAFT notice `1.0` currently reports
   `noticeApproved: false` and `acceptedForNewGrant: false`.** This is the
   current blocker; Jobsearch will reject grants until RIS flips these and sets
   the state to `ACTIVE`.
6. **Confirm whether the grant endpoint itself also rejects a non-active
   notice** (defence in depth). Jobsearch must not be the only gate.
7. **Confirm consent notice version vs. privacy policy version.** Jobsearch
   treats `RIS_CONSENT_NOTICE_VERSION` (`1.0`) independently of the published
   privacy policy `v1.1`; publication of v1.1 does not activate notice `1.0`.

## 7. Explicit non-claims

- No live RIS call, no grant/withdraw, no persistence evidence.
- No push, merge, deployment, environment change, secret or flag activation.
- No RIS file, AWS, Cognito, Terraform or privacy-policy content change.
