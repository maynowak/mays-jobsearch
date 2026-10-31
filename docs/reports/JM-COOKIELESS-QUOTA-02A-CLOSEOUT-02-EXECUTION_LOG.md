# JM-COOKIELESS-QUOTA-02A-CLOSEOUT-02 — Execution Log

## Status

- **UTC month logic:** FIXED / VERIFIED
- **Real Redis Lua verification:** VERIFIED against isolated `redis:7-alpine` container
- **Budget conservative behavior:** VERIFIED (mock + real Lua)
- **Cookie removal:** NOT IMPLEMENTED
- **02B:** PLANNED, NOT STARTED
- **Production deployment:** NOT DEPLOYED
- **Baseline:** `f2524f4`

## 1. UTC month consistency

`currentMonth()` used local server time while `previousMonth()` used UTC. Both
now use exported UTC helpers:

```ts
budgetMonth(date = new Date())          // YYYY-MM from getUTC*
previousBudgetMonth(date = new Date())  // UTC previous month
```

- Reservation IDs still carry `<YYYY-MM>:<random>`.
- All usage counters (`monthScoped`) now follow UTC, so server timezone cannot
  move budget allocation.
- December→January and January→December covered by deterministic tests with
  explicit UTC instants.

Tests: `tests/api/budget-month.test.mjs` (4 cases) — PASS.

## 2. Real Redis/Lua verification

Added `tests/tools/verify-budget-lua.mjs` and
`npm run test:budget:redis`. It starts an isolated `redis:7-alpine` Docker
container, copies the three Lua scripts, executes them via `redis-cli --eval`,
and removes the container. No production Redis or credentials are used.

| Scenario | Result |
|---|---|
| Reserve within budget | PASS |
| Reserve exceeding budget | PASS |
| Settle actual cost | PASS |
| Double settle is a no-op | PASS |
| Release without charge | PASS |
| 900 s expiry: expired reservation charged at max | PASS |
| Expired reservation blocks over-budget | PASS |
| Expired reservation removed | PASS |
| December reservation settled from January | PASS |
| December usage updated, January untouched | PASS |
| Two parallel reservations: exactly one succeeds | PASS |
| Redis unavailable | verified by mocked tests only (no container outage simulation) |

The parallel test runs two `redis-cli --eval` processes concurrently and
confirms exactly one reservation succeeds under a 200 limit with two 150
reservations. This is real Lua atomicity, not a mock.

## 3. Conservative budget behavior

- Expired unknown reservations are charged at their **maximum** before removal.
- Known non-started provider calls can be released explicitly.
- Successful calls settle actual usage.
- Duplicate/late settlement returns `missing`; no double charge.
- Redis failure on reserve → `unavailable` → paid call is not started.
- Old reservations across a month boundary settle/release against the
  reservation's month (current + previous keys); older-than-previous is
  impossible under the 15-minute TTL.

## 4. Tests and validation

| Check | Result |
|---|---|
| `npm test -- --run` | PASS — 991 passed, 5 skipped; 96 passed, 3 skipped files |
| `npx tsc --noEmit -p tsconfig.app.json` | PASS |
| `npm run build` | PASS |
| `git diff --check` | PASS |
| `npm run test:e2e:guest-cv` | PASS — 1440/390 |
| `npm run test:budget:redis` | PASS (isolated Docker Redis) |

Note: running the browser E2E in parallel with the unit suite can cause timing
flakiness; run them sequentially.

## 5. 02B readiness plan (not started)

`JM-COOKIELESS-QUOTA-IMPLEMENTATION-02B`:

1. **Trusted IP source** — verify Vercel-provided IP header behavior; reject
   client-controlled values; validate IPv4/IPv6.
2. **IP HMAC quotas** — `HMAC(secret, ip + period)`, IPv6 /64, short TTL, no
   plaintext IP; daily/monthly counters.
3. **Atomic short-window rate limits** — Lua counters per IP/provider/window.
4. **Single-flight paid calls** — Redis lock on cache miss; re-check cache.
5. **Replace guest session quotas** — TheirStack/JobsPipe per-user session
   guards → IP scope; keep global budgets.
6. **Remove `Set-Cookie: mj_session` from guest search** — jobs first, then
   match/job-details after migration.
7. **Regression** — guest CV E2E, no-cookie browser check, parallel/rate-limit
   tests, free-source availability.
8. **Privacy review** — IP HMAC purpose, TTLs, legal basis, DE/EN wording.

Each step needs its own acceptance criteria and explicit approval. No cookie
may be removed before this closeout is approved and 02B is separately
authorized.

## 6. Unchanged

- `mj_session` and its issuance.
- No new cookies.
- Redis caches, CV profile cache, consent, anonymization, 10/2/5, ATS, free
  sources.
- RIS/Cognito/AWS/Terraform.
- No provider limits changed externally.
- No deployment.

## 7. Files changed

- `api/_lib/usage.mjs` — UTC helpers, exported test-only Lua scripts.
- `tests/api/budget-month.test.mjs` (new).
- `tests/tools/verify-budget-lua.mjs` (new).
- `package.json` — `test:budget:redis`.
- this report.
- `docs/AI_AUDITLOG.md`.

## 8. Git

- Commit and remote synchronization are recorded after final validation.
- Production deployment: NOT DEPLOYED.
