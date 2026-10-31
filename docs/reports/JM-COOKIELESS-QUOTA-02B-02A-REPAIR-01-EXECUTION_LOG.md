# JM-COOKIELESS-QUOTA-02B-02A-REPAIR-01 — Execution Log

## Status

- **Cache-first single-flight:** IMPLEMENTED / VERIFIED
- **Paid source deduplication:** IMPLEMENTED (per-source lock after cache check)
- **Receipt scope binding:** UNCHANGED (verified by existing tests)
- **Cookie removal:** NOT IMPLEMENTED
- **Production deployment:** NOT DEPLOYED
- **Baseline:** `243f68d`

## Confirmed causes

1. `sources/index.mjs` acquired the single-flight lock **before** the source's
   internal cache lookup. A cache hit could therefore be blocked by an existing
   lock, contradicting the documented behavior.
2. The lock TTLs (20 s HTTP, 55 s Apify) can be shorter than a slow provider
   call; an expired lock can be re-acquired while the first call still runs.
3. Empty provider results are not negatively cached; concurrent duplicates are
   prevented by the lock, but a later retry may call again.

## Corrections

### Cache-first `runPaidOnce`

New helper in `api/_lib/lock.mjs`:

```text
cache check → lock acquire → cache re-check → run paid operation
busy → bounded wait → cache re-check → cached or busy
```

- Cache hits return before any lock or reservation.
- After acquiring the lock, the cache is checked again (another request may
  have filled it).
- Busy callers wait briefly and return the cached value if available; otherwise
  `busy`. They never start a second paid call.
- The lock is released in `finally`.

### Per-source integration

The central pre-cache lock in `sources/index.mjs` was removed. TheirStack,
JobsPipe and Apify general runs now call `runPaidOnce` inside their existing
cache-miss branch, after their own cache lookup.

Apify detail batches lock only after computing the missing reference numbers,
so a full cache hit bypasses the lock. A busy caller waits, re-checks the
individual detail caches, and returns cached data if available; otherwise
`busy`.

### Lock TTL / timeout semantics

- TheirStack/JobsPipe: 20 s lock TTL, 3 s busy wait.
- Apify: 55 s lock TTL, 3 s busy wait.
- A slow provider can outlive the TTL; a second request may acquire the lock
  after expiry. This is a documented limitation. There is no exactly-once
  guarantee across an expired lock.
- The global atomic provider budgets remain the hard cost ceiling, so even an
  expired-lock duplicate cannot exceed the monthly budget.
- No lock extension, no endless retry loop, no background process.

### Empty results and errors

- Valid empty results are not negatively cached (unchanged).
- Provider errors are returned as errors, not as empty successes.
- Concurrent identical requests do not duplicate the paid call while the lock
  is held.
- A later retry after an empty/failed result may call the provider again;
  documented residual risk.
- Redis failure → `quota_unavailable` for paid sources; free sources remain
  available.

## Tests

| Scenario | Result |
|---|---|
| Cache hit before lock | VERIFIED — no lock/reservation/run |
| Cache filled after lock acquisition | VERIFIED — cached value used |
| Busy caller | VERIFIED — `busy`, no second run |
| Lock primitive: parallel acquire | VERIFIED — isolated Redis |
| Stale owner release | VERIFIED — rejected |
| TTL expiry | VERIFIED — isolated Redis |
| Receipt scope/window/day/parallel | VERIFIED — existing isolated Redis tests |
| Full `npm test -- --run` | VERIFIED — 1011 passed, 5 skipped |
| `npx tsc --noEmit -p tsconfig.app.json` | VERIFIED — PASS |
| `npm run build` | VERIFIED — PASS |
| `git diff --check` | VERIFIED — PASS |
| `npm run test:budget:redis` | VERIFIED — PASS |
| `npm run test:ip-quota:redis` | VERIFIED — PASS |
| `npm run test:lock:redis` | VERIFIED — PASS |
| `npm run test:e2e:guest-cv` | VERIFIED — PASS, 1440/390 |
| Ten-request real browser concurrency | NOT VERIFIED |
| Slow provider beyond lock TTL with real provider | NOT VERIFIED |
| Live Vercel IP headers | NOT VERIFIED |

## Cost invariants

- No paid call without a successful global budget reservation.
- IP quota (when enabled) is reserved before the global budget and released only
  with a valid receipt when the provider was provably not called.
- Busy callers do not reserve budgets or IP quotas.
- Cache hits do not reserve anything.
- Global monthly budgets remain the hard upper bound.

## Cookie migration readiness

Unchanged and still blocked:

1. Live verification of Vercel IP headers.
2. Product approval of IP limits/windows.
3. HMAC secret provisioning/rotation.
4. Tests with `IP_QUOTA_ENABLED=true`.
5. Removal of remaining `sessionId` dependencies.
6. Privacy review.
7. Rollback plan.

`mj_session` remains; no cookie was removed.

## Remaining risks

- Lock expiry during a slow provider allows a duplicate paid call; budgets cap
  the cost.
- Empty results are not negatively cached; retries can repeat a paid call.
- Cache-write failure allows a retry to call again.
- Busy callers return `busy` rather than waiting for the cache; clients may need
  a retry.
- Live Vercel IP behavior remains unverified.

## Changed files

- `api/_lib/lock.mjs`
- `api/_lib/sources/index.mjs`
- `api/_lib/sources/theirstack.mjs`
- `api/_lib/sources/jobspipe.mjs`
- `api/_lib/sources/apify/index.mjs`
- `api/_lib/detailEnrich.mjs`
- `tests/api/lock.test.mjs`
- `tests/api/theirstack-source.test.mjs`
- `tests/api/jobspipe-source.test.mjs`
- test cache mocks
- this report
- `docs/AI_AUDITLOG.md`

## Git

- Commit and remote synchronization are recorded after final validation.
- No deployment.
