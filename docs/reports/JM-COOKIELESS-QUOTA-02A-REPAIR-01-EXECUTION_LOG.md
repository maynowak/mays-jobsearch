# JM-COOKIELESS-QUOTA-02A-REPAIR-01 — Execution Log

## Status

- **Repairs:** IMPLEMENTED / VERIFIED with mocked Redis
- **Real Redis/Lua atomicity and TTL boundary:** NOT VERIFIED (no isolated
  Redis instance available)
- **Existing cookies:** UNCHANGED
- **CV cache / 10/2/5 / ATS:** UNCHANGED
- **Production deployment:** NOT DEPLOYED
- **Baseline:** `f2d87ec`

## Confirmed findings and causes

1. **TTL unit mismatch:** the reservation expiry was `Date.now()` (ms) plus
   `900` (seconds), so reservations appeared expired after ~0.9 s.
2. **Month rollover:** settlement looked only in the current month's
   reservation hash; a reservation created before midnight could not be found.
3. **Unknown billing:** expired reservations were deleted without charging,
   silently freeing budget for costs that may have occurred.
4. **Apify refund:** every `startApifyRun` error was refunded, including
   network/5xx/unreadable responses where the run may have started.

## Corrections

### Time units

- Reservation timestamps now use `Math.floor(Date.now() / 1000)`.
- Lua stores and compares expiry in seconds.
- `RESERVATION_TTL_SEC = 900` is now a real 15-minute window.
- Expiry comparison uses `<= now`, so a reservation is expired at the
  boundary.

### Month rollover

- Reservation IDs now carry the billing month: `<YYYY-MM>:<random>`.
- Reserve writes to the month-scoped reservation hash captured at reservation
  time.
- Settle parses the month from the ID and uses current/previous month keys
  (both passed to Lua) for the usage counter and reservation hash.
- Release checks both current and previous reservation hashes.
- December→January is handled by `previousMonth()` using UTC.
- Invalid reservation IDs return `invalid_id` without charging.

### Unknown billing (conservative)

- When an expired reservation is encountered during a later reserve, its
  **maximum cost is charged** to the reservation's month before removal.
- A reservation is therefore not silently freed after 15 minutes.
- Explicitly released reservations (provider definitely not called) are still
  free.
- Successful calls settle the actual amount.
- Double/late settlement after expiry returns `missing` and does not charge
  again.
- No unbounded metadata: reservations live in a monthly hash with TTL and are
  removed after settlement/expiry charging.

### Apify refund semantics

- Added `startErrorDefinitelyNotStarted(error)`:
  - `upstream_4xx` except `408` → definitely not started → refund.
  - `408`, `5xx`, `network`, `unreadable`, `unexpected` → unknown → no refund.
- General Apify runs refund only on a definite 4xx start rejection.
- Detail enrichment refunds quota/run slot only on a definite 4xx; wait/read
  failures after a started run no longer refund (billing unknown).

## Tests

| Test | Result |
|---|---|
| Reservation ID contains month | VERIFIED — PASS |
| Reservation timestamp is seconds and TTL is 900 s | VERIFIED — PASS |
| Settle uses current + previous month keys | VERIFIED — PASS |
| Invalid reservation ID | VERIFIED — PASS |
| Missing/duplicate settlement | VERIFIED — PASS |
| Release idempotent | VERIFIED — PASS |
| Redis unavailable → fail closed | VERIFIED — PASS |
| Apify definite 4xx → refund | VERIFIED — PASS |
| Apify network/5xx/408 → no refund | VERIFIED — PASS |
| Detail enrichment refund only on definite 4xx | VERIFIED — PASS |
| Detail enrichment network → no refund | VERIFIED — PASS |
| Full `npm test -- --run` | VERIFIED — 987 passed, 5 skipped; 95 passed, 3 skipped files |
| `npx tsc --noEmit -p tsconfig.app.json` | VERIFIED — PASS |
| `npm run build` | VERIFIED — PASS |
| `git diff --check` | VERIFIED — PASS |
| `npm run test:e2e:guest-cv` | VERIFIED — PASS, 1440/390 |

### Not verified

- **Real Lua atomicity, 15-minute expiry boundary and parallel reservations
  against an isolated Redis instance: NOT VERIFIED.** No `redis-server` is
  available in this environment and no isolated Redis test instance is
  configured.
- Mock tests verify the JavaScript contract and Lua arguments, not actual Redis
  script execution.
- Production provider billing behavior remains NOT VERIFIED.

## Remaining risks

- Expiry charging happens lazily on the next reserve; until then an expired
  reservation is not reflected in the used counter, though it is still counted
  as reserved by the cleanup logic.
- A reservation from more than one month ago (impossible with 15-minute TTL
  under normal clocks) would settle/release only against current/previous
  month keys.
- Provider-side billing on a thrown response remains unknown; the conservative
  charge is the maximum reservation.
- Real Redis performance of `HGETALL` per reserve is bounded by concurrent
  reservations but not load-tested.

## Changed files

- `api/_lib/usage.mjs`
- `api/_lib/sources/theirstack.mjs` (unchanged API, uses fixed ledger)
- `api/_lib/sources/jobspipe.mjs` (unchanged API, uses fixed ledger)
- `api/_lib/sources/apify/index.mjs`
- `api/_lib/sources/apify/client.mjs`
- `api/_lib/detailEnrich.mjs`
- `tests/api/provider-budget.test.mjs`
- `tests/api/apify-actor.test.mjs`
- `tests/api/detail-enrich.test.mjs`
- this report
- `docs/AI_AUDITLOG.md`

## Unchanged semantics

- `mj_session` and cookie issuance unchanged.
- No new cookies.
- CV profile cache, consent, anonymization, 10/2/5, ATS and free sources
  unchanged.
- No provider limits changed externally.
- No deployment.

## Git

- Commit and remote synchronization are recorded after final validation.
