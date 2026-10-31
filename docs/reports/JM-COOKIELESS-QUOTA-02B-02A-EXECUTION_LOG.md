# JM-COOKIELESS-QUOTA-02B-02A — Execution Log

## Status

- **Redis single-flight:** IMPLEMENTED / VERIFIED (unit + isolated Redis primitives)
- **Paid source deduplication:** IMPLEMENTED (central lock for paid sources)
- **Receipt scope binding:** IMPLEMENTED / VERIFIED
- **Cookie removal:** NOT IMPLEMENTED (deferred to 02B-02B)
- **RIS integration:** NOT IMPLEMENTED
- **Production deployment:** NOT DEPLOYED
- **Baseline:** `d89ce03`

## 1. Single-flight implementation

New `api/_lib/lock.mjs`:

- `singleFlightKey(namespace, payload)` — SHA-256 of a normalized payload,
  truncated; no CV text or PII in the key.
- `acquireSingleFlight(key, ttlMs)` — `SET key token NX PX ttl`; returns
  `acquired | busy | unavailable`.
- `releaseSingleFlight(key, token)` — Lua compare-and-delete; only the owner
  token can release.
- `waitForLockRelease(key, waitMs)` — bounded polling.
- `withSourceLock(key, ttlMs, run, waitMs)` — owner runs; busy callers wait
  briefly and return `busy` **without** starting a second paid call.

Central integration in `api/_lib/sources/index.mjs` for:

- TheirStack (TTL 20 s)
- JobsPipe (TTL 20 s)
- Apify general runs (TTL 55 s)

Apify detail batches use a wrapper in `detailEnrich.mjs` keyed by the sorted
reference numbers (TTL 55 s). Busy callers return `busy` after a bounded wait;
they never start a duplicate paid run.

Cache hits are checked before the lock, so they trigger no reservation and no
provider call.

## 2. Lock safety

- Atomic acquisition via `SET NX PX`.
- Unique 128-bit token per owner.
- Release checks the token atomically; a stale owner cannot delete a new lock.
- TTL covers the serverless provider window (20 s for HTTP sources, 55 s for
  Apify, below the 60 s function limit).
- Redis unavailable → `unavailable` → paid source returns
  `quota_unavailable`; free sources continue.
- Provider timeout: the owner keeps the lock until TTL; waiters return `busy`.
- Cache-write failure: the owner releases the lock; a retry may call the
  provider again (documented remaining risk).
- No client-visible lock IDs.

## 3. Empty results

Valid empty provider responses are not negatively cached today. A waiter never
starts a second paid call because busy callers return `busy`; a later explicit
retry may call the provider again. A short negative cache is a future option
and was not added to avoid masking provider failures as empty results.

## 4. Receipt scope binding

IP-quota receipts now store `<windowId>|<UTC-date>|<hmacScope>`.
`releaseIpQuota` passes the caller's scope and the Lua script rejects a
mismatching receipt (`invalid_scope`, receipt deleted). This prevents a
server-internal receipt from refunding another IP scope. Existing receipts
created before this change lack the scope field and become non-refundable
(safe no-op); the feature is disabled by default, so no production impact.

## 5. Redis verification

| Test | Result |
|---|---|
| Two parallel identical lock acquisitions | VERIFIED — exactly one owner |
| Ten parallel acquisitions (primitive) | VERIFIED by the same NX semantics |
| Stale owner release | VERIFIED — rejected |
| Owner release | VERIFIED — removed |
| TTL expiry | VERIFIED |
| IP receipt scope mismatch | VERIFIED — isolated Redis |
| Receipt double release | VERIFIED — no over-refund |
| Window/day rollover release | VERIFIED — original counter only |
| Parallel IP releases | VERIFIED — exactly one |
| Budget reserve/settle/parallel | VERIFIED (existing script) |

Commands:

- `npm run test:budget:redis` — PASS
- `npm run test:ip-quota:redis` — PASS
- `npm run test:lock:redis` — PASS

All use isolated `redis:7-alpine` containers; no production Redis.

## 6. Cookie dependency matrix

| Area | Session dependency | Planned replacement | Status |
|---|---|---|---|
| `/api/jobs` | Sets `mj_session`; passes `sessionId` to sources | Trusted IP + global budgets; remove `Set-Cookie` | READY after IP live verification |
| `/api/match` | Sets cookie; session used only for BA detail enrichment | IP scope for detail; remove cookie | READY after 02B-02B |
| `/api/job-details` | Sets cookie; session + IP for Apify detail quota | IP scope + IP backstop; remove cookie | READY after 02B-02B |
| TheirStack | Per-session credit guard | IP quota + global budget | IP path implemented, flag off |
| JobsPipe | Per-session credit guard | IP quota + global budget | IP path implemented, flag off |
| Apify details | Per-session 30/day + per-IP 100/day | IP quota + IP backstop | IP path implemented, flag off |
| Other sources | None | None | No change |

`mj_session` remains issued in this package. It must not be removed until:

1. Vercel IP headers are verified in a preview/production environment.
2. `IP_QUOTA_ENABLED` and limits are product-approved and configured.
3. `MJ_IP_QUOTA_SECRET` is provisioned and rotated per runbook.
4. Guest E2E and rate-limit tests pass with the flag enabled.
5. A rollback plan exists for the cookie removal.

## 7. Tests and validation

| Check | Result |
|---|---|
| `npm test -- --run` | PASS — 1008 passed, 5 skipped |
| `npx tsc --noEmit -p tsconfig.app.json` | PASS |
| `npm run build` | PASS |
| `git diff --check` | PASS |
| `npm run test:budget:redis` | PASS |
| `npm run test:ip-quota:redis` | PASS |
| `npm run test:lock:redis` | PASS |
| `npm run test:e2e:guest-cv` | PASS — 1440/390 |
| Live Vercel IP headers | NOT VERIFIED |
| Ten-request browser concurrency | NOT VERIFIED (unit/Redis primitives only) |
| Provider timeout with real provider | NOT VERIFIED (mocked) |

## 8. Remaining risks

- Busy callers return `busy` rather than waiting for the cache; a retry is
  needed. This avoids duplicate cost but can show an empty source result.
- Empty results are not negatively cached; a later retry may call the provider.
- Cache-write failure after a paid call allows a later retry to call again.
- Lock TTL must remain below the serverless timeout; changing function limits
  requires reviewing the TTL.
- Live Vercel IP behavior and product IP limits remain unverified.
- Cookie removal remains blocked by the above.

## 9. Changed files

- `api/_lib/cache.mjs` (`cacheSetNx`, `cacheGetRaw`)
- `api/_lib/lock.mjs` (new)
- `api/_lib/sources/index.mjs`
- `api/_lib/detailEnrich.mjs`
- `api/_lib/ipQuota.mjs` (receipt scope)
- `tests/api/lock.test.mjs` (new)
- `tests/api/ip-quota.test.mjs`
- `tests/tools/verify-lock-lua.mjs` (new)
- `tests/tools/verify-ip-quota-lua.mjs`
- source test cache mocks
- `package.json` (`test:lock:redis`)
- this report
- `docs/AI_AUDITLOG.md`

## 10. Git

- Commit and remote synchronization are recorded after final validation.
- No deployment.
