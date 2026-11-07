# JM-RIS-STORAGE-ACTIVATION-01 — Jobsearch requirements & evidence (A → B handoff)

**Date:** 2026-11-07 (rework after RIS contract verification)
**Repository:** `mays-jobsearch` (Jobsearch / A side)
**Worktree:** `worktrees/jobsearch-storage-activation-01`
**Branch:** `feature/jm-ris-storage-activation-01`
**Status:** LOCAL IMPLEMENTED / REWORKED — NOT PUSHED, NOT DEPLOYED, NO LIVE PERSISTENCE EVIDENCE

**RIS counterpart evidence:**
`worktrees/ris-storage-activation-01/docs/reports/agent-evidence/JM-RIS-STORAGE-ACTIVATION-01-ris-contract-verification.md`
(verdict `REWORK_REQUIRED`, findings R1/R2/R3). This document is the corrected
A-side answer; R1 (code) and R2 (documentation) are addressed, R3 is recorded as
a coordination blocker.

## 1. Scope

Harden the Jobsearch BFF so a durable `application-storage` consent grant can
only be written when the RIS consent notice is actually grantable. No RIS
repository, AWS, environment, secret, Terraform or flag change was made.

## 2. Current gap (before the change)

`api/_lib/ris/consentsHandler.mjs` did:

```js
grantAllowed: Boolean(cfg.noticeVersion)   // GET
// POST: require cfg.noticeVersion, then POST { purpose, noticeVersion }
```

`RIS_CONSENT_NOTICE_VERSION` is a mapping, not an approval. Setting it to `1.0`
made the UI grantable and forwarded `1.0` to RIS even though the RIS
`application-storage` notice `1.0` is currently `DRAFT` with
`legalApprovalRef: null`. The Jobsearch side never read the RIS notice state.

## 3. RIS contract this side relies on (confirmed by RIS)

`GET /v1/partner/me/consents?purpose=application-storage` (partner surface,
`Authorization: Bearer <access token>`, `X-Api-Credential`) returns:

```jsonc
{
  "items":        [ /* per-purpose status row */ ],
  "catalog":      [ /* per-purpose notice entries */ ],
  "externalRefs": [ /* known-but-not-equivalent partner refs */ ]
}
```

`catalog` is always a top-level array on a 200 GET and is scoped to the
requested purpose; an unknown purpose is a 404, never an empty catalogue. The
POST grant response is `{"consent": {...}}` only — there is no catalogue on
POST, so the BFF must re-read GET before writing (it does).

Exact state enum (`GRANTABLE_NOTICE_STATES = {APPROVED, ACTIVE}`):

| `noticeState` | Meaning | Grantable |
| --- | --- | --- |
| `DRAFT` | text exists, no legal approval | **no** |
| `APPROVED` | legally approved, not yet rolled out | **yes** |
| `ACTIVE` | approved and offered to new users | **yes** |
| `SUPERSEDED` | replaced; existing grants stay valid | **no** |

There is no `PUBLISHED`/`APPROVED_ACTIVE` alias. Only these four uppercase
values exist; anything else is treated as non-grantable.

### Flag semantics and why the state check is load-bearing

`noticeApproved` and `acceptedForNewGrant` are strict server-owned booleans:

```python
"noticeApproved": entry.approved,
"acceptedForNewGrant": entry.grantable or not notice_state_enforced(),
```

| `noticeState` | `noticeApproved` | `acceptedForNewGrant` (enforcement **off**, current deployment) | Grantable |
| --- | --- | --- | --- |
| `DRAFT` | `false` | **`true`** (technical grant) | no |
| `APPROVED` | `true` | `true` | yes |
| `ACTIVE` | `true` | `true` | yes |
| `SUPERSEDED` | **`true`** | **`true`** | no |

Consequences that this implementation and document must state explicitly (R2):

- With `CONSENT_NOTICE_STATE_ENFORCED=false` (current deployment), **`DRAFT`
  reports `acceptedForNewGrant: true`**, not `false`.
- **`SUPERSEDED` reports `noticeApproved: true` and `acceptedForNewGrant: true`**
  while enforcement is off. A gate using only the two flags would accept a
  superseded notice.
- Therefore the **`noticeState` check is the load-bearing barrier**; the flags
  are additional defence in depth and are never upgraded client-side.
- `noticeState` must be `APPROVED` or `ACTIVE`; `DRAFT` and `SUPERSEDED` are
  blocked regardless of the flags.

## 4. Implemented behaviour

Rules implemented by Jobsearch:

1. The catalogue entry is matched by `noticeVersion` equal to the
   server-configured `RIS_CONSENT_NOTICE_VERSION`. A `purpose` on the entry, if
   present, must equal `application-storage`.
2. `grantAllowed` requires all of: entry exists, `noticeState` is `APPROVED`
   **or** `ACTIVE`, `noticeApproved === true`, `acceptedForNewGrant === true`.
3. Missing/non-array catalogue, `null`, unknown version, non-boolean flags,
   conflicting duplicate entries, RIS non-2xx, timeout or network error all
   fail closed.
4. The browser response exposes only `noticeVersion`, `noticeState`,
   `noticeApproved`, `acceptedForNewGrant`, `grantAllowed`, `noticeReason`.
   Internal legal approval references are never returned (test-asserted).

Code:

- `api/_lib/ris/consentNotice.mjs`
  - `ACTIVE_STATES = new Set(["APPROVED", "ACTIVE"])` mirrors RIS
    `GRANTABLE_NOTICE_STATES`; `DRAFT`/`SUPERSEDED`/unknown stay blocked.
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
| State is `DRAFT` or `SUPERSEDED` (not `APPROVED`/`ACTIVE`) | 409 | `notice_not_active` |
| `noticeApproved !== true` | 409 | `notice_not_approved` |
| `acceptedForNewGrant !== true` | 409 | `notice_not_accepted` |

## 5. Verification (real command output, rework commit)

```
$ npx vitest run tests/api/ris-consents.test.mjs tests/api/ris-routing.test.mjs tests/api/ris-config-separation.test.mjs
 Test Files  3 passed (3)
      Tests  50 passed (50)

$ npx vitest run src/components/StorageConsentLive.test.tsx src/lib/applications/risRemoteRepository.test.ts src/lib/applications/remoteSessionRepository.test.ts
 Test Files  3 passed (3)
      Tests  36 passed (36)

$ npm run build
✓ built in 1.23s   (tsc -b && vite build, PASS)

$ git diff --check
(no output)
```

Covered cases: DRAFT blocks GET and POST without a grant call; DRAFT with
contradictory/true flags is still blocked; SUPERSEDED with
`noticeApproved=true` + `acceptedForNewGrant=true` is blocked; APPROVED is
allowed and sends the server version on POST; ACTIVE is allowed; missing or
malformed catalogue fails closed; RIS 500 and network failure fail closed;
withdraw still works while grant is blocked; unknown/changed version fails
closed; non-boolean flags are rejected; purpose mismatch is rejected;
conflicting duplicate entries fail closed.

## 6. Activation blockers (R3 and ordering)

1. **RIS notice `application-storage` `1.0` is `DRAFT` with
   `legalApprovalRef: null`.** Nothing may invent an approval; Jobsearch blocks
   all grants for it.
2. **`CONSENT_NOTICE_STATE_ENFORCED` is not wired in Terraform** (RIS sets only
   `APPLICATION_CONSENT_ENFORCED`) and is therefore `false` in deployment. RIS
   server-side notice enforcement is **inactive**; the **Jobsearch BFF is
   currently the only notice barrier**. This is a RIS activation blocker and
   must be fixed before server-side defence in depth can be claimed. This task
   did not change Terraform or any flag.
3. **`APPLICATION_CONSENT_ENFORCED=false`** must stay false until the notice is
   `ACTIVE` and the Jobsearch gate is deployed.
4. **Jobsearch-side flags** `RIS_CONSENT_SERVICE_ENABLED`,
   `RIS_APPLICATION_STORAGE_ENABLED`, `RIS_CONSENT_NOTICE_VERSION`,
   `VITE_RIS_CONSENT_UI_ENABLED` and `VITE_RIS_APPLICATION_STORAGE_ENABLED`
   were not changed.
5. **Ordering:** legal approval for `1.0` (or a mapped successor) →
   registry `APPROVED`/`ACTIVE` with `legalApprovalRef` → wire + enable
   `CONSENT_NOTICE_STATE_ENFORCED` → synthetic live grant/withdraw/regrant →
   `APPLICATION_CONSENT_ENFORCED=true`.
6. **Consent notice version vs. privacy policy version:** the consent registry
   is keyed by `(purpose, noticeVersion)` only; privacy policy `v1.1` publication
   does not activate notice `1.0`. Jobsearch treats them independently.

## 7. Status of the RIS review findings

| Finding | Status |
| --- | --- |
| R1 — accept `APPROVED` as grantable | **FIXED** in `consentNotice.mjs`; `APPROVED` and `ACTIVE` accepted, `DRAFT`/`SUPERSEDED` rejected |
| R2 — correct A→B doc semantics | **FIXED** in §3/§4: flag matrix corrected, state check documented as load-bearing |
| R3 — `CONSENT_NOTICE_STATE_ENFORCED` unwired | **RECORDED** here and in `docs/DEPLOYMENT.md` as an RIS activation blocker; no Terraform/flag change |
| Confirmed correct (catalogue shape, strict booleans, purpose filter, re-read before POST, withdraw, 409/503 mapping, no legal refs) | unchanged |

## 8. Explicit non-claims

- No live RIS call, no grant/withdraw, no persistence evidence.
- No push, merge, deployment, environment change, secret or flag activation.
- No RIS file, AWS, Cognito, Terraform or privacy-policy content change.
