# JM-COOKIELESS-QUOTA-02B-01-REPAIR-01 — Execution Log

## Status

- **Receipt-bound IP quota release:** IMPLEMENTED / VERIFIED
- **Window/day-boundary safety:** IMPLEMENTED / VERIFIED (isolated Redis)
- **Idempotent release:** VERIFIED
- **Existing provider budgets:** UNCHANGED
- **Cookie removal:** NOT IMPLEMENTED
- **Production deployment:** NOT DEPLOYED
- **Baseline:** `9e8d1a2`

## Confirmed findings

1. `releaseIpQuota()` decremented whichever counters existed at the current
   time. A double release or a release after a window/day rollover could
   remove a slot from a different request or a newer window.
2. Release keys were recomputed from the current timestamp, so a release after
   a 10-minute window or UTC midnight targeted the new counter.
3. `keysFor()` read the version from the ambient environment rather than the
   supplied config in all paths.

## Chosen solution

**A — reservation-bound, idempotent release with a short-lived receipt.**

- `reserveIpQuota()` now returns `{ status: "allowed", receipt }`.
- The receipt is stored server-side in
  `mj-quota:ip:<version>:<provider>:r:<receipt>` with value
  `<windowId>|<UTC-date>` and a TTL equal to the window length.
- `releaseIpQuota(provider, scope, receipt, nowSec, env)` requires the receipt.
  - Missing/already-used receipt → `missing`, no counter change.
  - Invalid receipt shape → `invalid_scope`.
  - Receipt pins the original window/day; release uses current and previous
    window keys plus current and previous day keys and selects the original.
  - Counters never go below zero.
  - Redis failure → `quota_unavailable` (no refund).
- The receipt is server-only; it is never returned to the client.
- After the receipt TTL (one window), a release is a safe no-op. This is
  conservative: an abandoned attempt remains counted rather than risking a
  wrong refund.

Why not Option B: counting all attempts would change the product semantics of
the IP quota (attempts vs. started provider calls). Option A is the smaller
change and preserves the intent.

## Integration updates

- TheirStack, JobsPipe, Apify general runs and Apify detail enrichment now
  carry the receipt and release only that reservation.
- Compensation on global-budget/run-slot failure uses the receipt.
- Unknown provider billing keeps the IP reservation (no refund).
- `keysFor()` receives the resolved `version` explicitly; `ipQuotaVersion(env)`
  is used consistently in reserve and release.

## Tests

| Test | Result |
|---|---|
| One reservation, one release | VERIFIED — isolated Redis |
| Receipt stored with window/day | VERIFIED — isolated Redis |
| Double release is a no-op | VERIFIED — isolated Redis |
| Release after window change decrements old window | VERIFIED — isolated Redis |
| New window untouched | VERIFIED — isolated Redis |
| Release after UTC midnight decrements old day | VERIFIED — isolated Redis |
| New day untouched | VERIFIED — isolated Redis |
| Parallel releases: exactly one succeeds | VERIFIED — isolated Redis |
| No over-refund | VERIFIED — isolated Redis |
| Release without receipt | VERIFIED — unit |
| Invalid receipt | VERIFIED — unit |
| Redis unavailable | VERIFIED — unit |
| IP limit still blocks paid call | VERIFIED — source test |
| Global budget unchanged | VERIFIED — existing tests |
| Full `npm test -- --run` | VERIFIED — 1004 passed, 5 skipped |
| `npx tsc --noEmit -p tsconfig.app.json` | VERIFIED — PASS |
| `npm run build` | VERIFIED — PASS |
| `git diff --check` | VERIFIED — PASS |
| `npm run test:budget:redis` | VERIFIED — PASS |
| `npm run test:ip-quota:redis` | VERIFIED — PASS |
| `npm run test:e2e:guest-cv` | VERIFIED — PASS, 1440/390 |
| Live Vercel IP headers | NOT VERIFIED |

The isolated Redis tests use a `redis:7-alpine` Docker container with synthetic
keys; no production Redis was used.

## Remaining risks

- Receipt TTL equals one window: a release after the window is a no-op and the
  attempt stays counted (conservative, documented).
- The release script supports current/previous window and current/previous day;
  a release older than one window cannot occur because the receipt expires.
- Live Vercel header behavior and product IP limits remain unverified/unapproved.
- No single-flight protection for identical concurrent provider calls.
- `mj_session` remains; cookie removal is deferred.

## Changed files

- `api/_lib/ipQuota.mjs`
- `api/_lib/sources/theirstack.mjs`
- `api/_lib/sources/jobspipe.mjs`
- `api/_lib/sources/apify/index.mjs`
- `api/_lib/detailEnrich.mjs`
- `tests/api/ip-quota.test.mjs`
- `tests/tools/verify-ip-quota-lua.mjs`
- this report
- `docs/AI_AUDITLOG.md`

## Git

- Commit and remote synchronization are recorded after final validation.
- No deployment.
