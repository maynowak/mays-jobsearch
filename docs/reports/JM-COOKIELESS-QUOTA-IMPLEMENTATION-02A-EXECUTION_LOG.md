# JM-COOKIELESS-QUOTA-IMPLEMENTATION-02A — Execution Log

## Status

- **Atomic provider budgets:** IMPLEMENTED (TheirStack, JobsPipe)
- **Apify general runs:** IMPLEMENTED via existing atomic run-slot reservation
- **Fail-closed on Redis outage:** IMPLEMENTED for paid cache-miss paths
- **Existing Redis cache:** UNCHANGED
- **Existing guest cookie:** UNCHANGED
- **IP-HMAC quotas:** NOT IMPLEMENTED
- **Cookie removal:** NOT IMPLEMENTED
- **RIS integration:** NOT IMPLEMENTED
- **Production deployment:** NOT DEPLOYED
- **Baseline:** `0f08b49`

## Changed files

- `api/_lib/cache.mjs` — added `cacheEval` (atomic Lua helper; `null` on
  unavailable/error).
- `api/_lib/usage.mjs` — added atomic provider budget ledger:
  `reserveProviderBudget`, `settleProviderBudget`, `releaseProviderBudget`.
- `api/_lib/sources/theirstack.mjs` — reserve before the paid call, settle
  actual returned records, fail closed on reservation failure.
- `api/_lib/sources/jobspipe.mjs` — same.
- `api/_lib/sources/apify/index.mjs` — general actor runs now use the existing
  atomic `reserveApifyRunSlot`; refund only when the run did not start.
- `tests/api/provider-budget.test.mjs` — new contract tests.
- Updated provider/source mocks in existing API/integration tests.
- this report, `docs/AI_AUDITLOG.md`.

## Budget mechanism

### Keys

```text
mj-usage:<provider>:credits:<YYYY-MM>            settled usage (existing)
mj-budget:<provider>:reservations:<YYYY-MM>      hash: reservationId -> max:expiry:month
```

No raw CV or personal data is stored. Reservations expire after 15 minutes;
the hash expires with the monthly TTL (62 days).

### Operations

- `reserveProviderBudget(provider, maximumCost)`
  - Lua sums `used + active reservations + max` and compares to the configured
    monthly limit.
  - Expired reservations are removed during the same Lua call.
  - Returns `{ok, id}`, `{error:"exceeded"}` or `{error:"unavailable"}`.
- `settleProviderBudget(provider, id, actualCost)`
  - Deletes the reservation, clamps actual to `[0, max]`, increments the
    monthly used counter for the reservation's month.
  - Missing reservation → `{error:"missing"}` (idempotent, no double charge).
  - Redis failure → `{error:"unavailable"}`.
- `releaseProviderBudget(provider, id)`
  - Deletes only the reservation; missing → `{error:"missing"}`.
  - No negative counters.

### Atomicity

- Check-and-reserve and settle are single `EVAL` calls, so parallel requests
  cannot both consume the same remaining budget.
- No read-then-write in application code for the global budget.
- Existing monthly counters are used as the settled usage source; no parallel
  counter is introduced.

## Provider billing behavior

| Case | Behavior |
|---|---|
| Provider not called (reservation failed) | no charge |
| Provider success | settle with actual returned records; unused reservation released by settle |
| Provider throws / unknown billing | reservation is **not** refunded; it expires after 15 min (conservative) |
| Apify run did not start | `refundApifyRunSlot()` |
| Apify timeout/unknown after start | no refund (conservative) |
| Duplicate settle | `missing`, no second charge |
| Actual > reserved max | clamped to max; settlement warning logged |

## Redis outage

- TheirStack/JobsPipe: reservation returns `unavailable` → `quota_unavailable`;
  no provider call.
- Apify: `reserveApifyRunSlot` returns `unavailable` → `quota_unavailable`;
  no run.
- Cache hits remain usable; free sources (Arbeitnow, Greenhouse, Adzuna) are
  unaffected.
- Settlement failure after a successful call is logged and does not undo the
  provider result; the reservation remains until TTL (conservative).

## Tests

| Test | Result |
|---|---|
| Budget sufficient → reservation | VERIFIED — PASS |
| Budget reached → no provider call | VERIFIED — PASS |
| Redis unavailable → fail closed | VERIFIED — PASS |
| Settle actual cost | VERIFIED — PASS |
| Duplicate settle is a no-op | VERIFIED — PASS |
| Release only existing reservation | VERIFIED — PASS |
| Unknown provider / invalid cost | VERIFIED — PASS |
| Monthly key shape | VERIFIED — PASS |
| Apify limit reached → no run | VERIFIED — PASS |
| Apify start failure refunds slot | VERIFIED — PASS |
| Cache hit → no provider call | VERIFIED — PASS |
| Free sources unaffected | VERIFIED — PASS (existing tests) |
| CV profile flow | VERIFIED — PASS (existing tests) |
| Full `npm test -- --run` | VERIFIED — 982 passed, 5 skipped; 95 passed, 3 skipped files |
| `npx tsc --noEmit -p tsconfig.app.json` | VERIFIED — PASS |
| `npm run build` | VERIFIED — PASS |
| `git diff --check` | VERIFIED — PASS |
| `npm run test:e2e:guest-cv` | VERIFIED — PASS, 1440/390 |

### Not verified

- **Redis Lua atomicity against a real isolated Redis instance: NOT VERIFIED.**
  No isolated Redis test instance is available in this environment. The Lua
  scripts are exercised only through mocked `cacheEval` contract tests.
- Parallel-request overspend against real Redis: NOT VERIFIED.
- Production env limits: NOT VERIFIED.

## Unchanged semantics

- `mj_session` is still issued and used; no cookie was added or removed.
- Per-session TheirStack/JobsPipe credit guards remain.
- CV profile cache, consent, anonymization and 10/2/5 hierarchy untouched.
- No source was disabled and no provider limit changed externally.

## Remaining cost risks

- TheirStack/JobsPipe provider-side billing on a thrown response is unknown;
  the conservative reservation may overcount for up to 15 minutes.
- Reservation expiry does not settle unknown billing; reconciliation is manual.
- Free sources still have provider rate limits without local budgets.
- AI provider budgets remain read-then-count (not part of this package).

## Git

- Implementation commit and remote synchronization are recorded after final
  validation.
- No production deployment was performed.
