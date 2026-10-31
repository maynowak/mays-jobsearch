# JM-COOKIELESS-QUOTA-02B-01 — Execution Log

## Status

- **Trusted-IP resolver:** IMPLEMENTED / VERIFIED (unit)
- **IP-HMAC quotas:** IMPLEMENTED / VERIFIED (unit + isolated Redis Lua)
- **Atomic IP rate limits:** IMPLEMENTED / VERIFIED (isolated Redis)
- **Existing provider budgets:** UNCHANGED
- **Cookie removal:** NOT IMPLEMENTED
- **Single-flight:** NOT IMPLEMENTED
- **RIS integration:** NOT IMPLEMENTED
- **Production deployment:** NOT DEPLOYED
- **Baseline:** `ce12e26`

## 1. Trusted IP resolver

New `api/_lib/ip.mjs`:

```ts
resolveTrustedClientIp(req, env) ->
  { status: "trusted-ip", family, address, group }
  | { status: "unavailable" }
  | { status: "invalid" }
```

Trust model:

- On Vercel (`VERCEL=1`), platform headers are trusted in this order:
  `x-vercel-forwarded-for`, `x-real-ip`, `x-forwarded-for` (first hop).
- Outside Vercel, forwarded headers are ignored unless
  `MJ_TRUST_PROXY_IP=1` is set for a controlled test proxy.
- The first available trusted header is authoritative; an invalid value
  returns `invalid` and is not replaced by a more spoofable header.
- No IP is returned to the client or logged.

Normalization:

- IPv4 validated with `node:net.isIP`.
- IPv6 validated and lower-cased; grouped by `/64`.
- IPv4-mapped IPv6 (`::ffff:a.b.c.d`) normalized to IPv4.
- Bracketed IPv6 and IPv4:port forms handled.
- Missing/untrusted header → `unavailable`.

**Live Vercel header behavior is NOT VERIFIED** in this environment. The code
assumes `VERCEL=1` and platform-set forwarded headers; this must be confirmed in
a preview deployment before enabling paid-path enforcement.

## 2. IP HMAC quotas

New `api/_lib/ipQuota.mjs`:

```text
mj-quota:ip:<version>:<provider>:w:<windowId>:<hmacScope>
mj-quota:ip:<version>:<provider>:d:<UTC-date>:<hmacScope>
```

- `hmacScope = HMAC-SHA256(MJ_IP_QUOTA_SECRET, "ip:v1:" + group)` truncated to
  32 hex; no plaintext IP in Redis keys.
- No simple SHA-256; the secret is required.
- Secret read from server env only; no secret committed.
- Version from `MJ_IP_QUOTA_VERSION` (default `v1`).
- Window TTL = window + 60 s; daily TTL = 24 h + 60 s.
- UTC window/day calculation; no local timezone influence.

### Configuration and activation

- `IP_QUOTA_ENABLED` default **false**.
- `IP_QUOTA_WINDOW_SEC` default 600.
- `IP_QUOTA_MAX_PER_WINDOW` default 30.
- `IP_QUOTA_DAILY_MAX` default 300.

These are proposal values, **not product-approved** and not active by default.
If enabled without `MJ_IP_QUOTA_SECRET` or without a trusted IP, paid calls
fail closed (`quota_unavailable`).

### Rotation

- Increment `MJ_IP_QUOTA_VERSION` (e.g. `v2`) at a UTC window/day boundary.
- Old keys carry the old version and expire by TTL; they are not read by the
  new version.
- Because windows are short, rotation at the boundary does not silently reset a
  long-running quota; document the exact rotation window in the deployment
  runbook.
- No production env change was made.

## 3. Atomic operations

`reserveIpQuota(provider, scope, nowSec, env)`:

- Single Lua `EVAL` checks window and daily counters and increments both.
- Returns `allowed | limit_reached | quota_unavailable | invalid_scope`.
- No read-then-count race.
- Disabled mode returns `allowed` without Redis access.

`releaseIpQuota(...)`:

- Single Lua `EVAL` decrements both counters only when > 0.
- Idempotent; no negative counters.

No settlement is needed because IP quota counts requests, not credits; credit
cost remains in the existing global budget ledger.

## 4. Integration order

Paid cache-miss path:

1. Resolve trusted IP in the handler and attach `identity.ipScope`.
2. `reserveIpQuota` (if enabled).
3. `reserveProviderBudget` / Apify run slot.
4. Provider call.
5. Settle/refund existing ledger.
6. Release IP quota only when the provider was provably not called.

Compensation:

- Global budget failure after IP reservation → release IP quota.
- Apify run-slot failure after IP reservation → release IP quota.
- Apify definite 4xx start rejection → refund run slot and release IP quota.
- Network/5xx/unreadable/unknown start → keep both reservations.
- TheirStack/JobsPipe thrown provider errors → keep both (unknown billing).

Integration points:

- `api/jobs.mjs`, `api/match.mjs`, `api/job-details.mjs` attach `ipScope`.
- `theirstack.mjs`, `jobspipe.mjs`, `apify/index.mjs`, `detailEnrich.mjs`
  consume it.

## 5. Cookie status

- `mj_session`, `sessionCookieHeader()` and `anonymousIdentity()` are unchanged.
- `Set-Cookie` is still emitted by the existing endpoints.
- No new cookies, localStorage or sessionStorage IDs.
- Cookie removal is explicitly deferred to 02B-02.

## 6. Tests

| Test | Result |
|---|---|
| Vercel header normalization | VERIFIED — PASS |
| Untrusted forwarded header ignored | VERIFIED — PASS |
| Invalid header rejected without fallback | VERIFIED — PASS |
| IPv4 / IPv4-mapped / IPv6 /64 grouping | VERIFIED — PASS |
| Missing secret → no HMAC scope | VERIFIED — PASS |
| HMAC deterministic and non-reversible | VERIFIED — PASS |
| Quota disabled by default | VERIFIED — PASS |
| Reserve window+daily keys/TTLs | VERIFIED — PASS |
| Limit / Redis failure mapping | VERIFIED — PASS |
| Invalid provider/scope | VERIFIED — PASS |
| Release idempotent | VERIFIED — PASS |
| IP limit blocks TheirStack paid call | VERIFIED — PASS |
| Real Lua reserve/release/parallel/TTL | VERIFIED — isolated Redis |
| Full `npm test -- --run` | VERIFIED — 1004 passed, 5 skipped |
| `npx tsc --noEmit -p tsconfig.app.json` | VERIFIED — PASS |
| `npm run build` | VERIFIED — PASS |
| `git diff --check` | VERIFIED — PASS |
| `npm run test:e2e:guest-cv` | VERIFIED — PASS, 1440/390 |
| `npm run test:budget:redis` | VERIFIED — PASS |
| `npm run test:ip-quota:redis` | VERIFIED — PASS |
| Live Vercel IP headers | NOT VERIFIED |
| Production provider calls | NOT RUN |

The isolated Redis scripts use `redis:7-alpine` Docker containers and synthetic
keys only; no production Redis or credentials.

## 7. Privacy

- Purpose: abuse/cost protection for paid job sources.
- IP is processed only transiently; only an HMAC scope is stored, with short
  TTLs (10 min window, 24 h daily).
- No raw IP in Redis keys or logs.
- Shared IPs (NAT/mobile/VPN) share a quota; limits are deliberately generous
  proposals and are not active by default.
- Missing/untrusted IP → paid path fails closed; free sources remain available.
- No public privacy text was changed. Cookie-free guest search is **not**
  claimed while `mj_session` is still issued.

## 8. Remaining risks

- Vercel header trust must be verified in a preview/production environment.
- Product approval of IP limits and window sizes is pending.
- Secret provisioning/rotation runbook is pending; without the secret, enabling
  the flag blocks paid calls.
- No single-flight protection for identical concurrent provider calls yet.
- Existing `identity.ip` (legacy, untrusted) still feeds Apify detail quotas;
  the new `ipScope` is additive.
- Cookie removal and per-user quotas for registered users remain future work.

## 9. Files changed

- `api/_lib/ip.mjs` (new)
- `api/_lib/ipQuota.mjs` (new)
- `api/jobs.mjs`, `api/match.mjs`, `api/job-details.mjs`
- `api/_lib/sources/theirstack.mjs`, `jobspipe.mjs`, `apify/index.mjs`
- `api/_lib/detailEnrich.mjs`
- `tests/api/ip-resolver.test.mjs` (new)
- `tests/api/ip-quota.test.mjs` (new)
- `tests/api/theirstack-source.test.mjs`
- `tests/tools/verify-ip-quota-lua.mjs` (new)
- `package.json`
- this report
- `docs/AI_AUDITLOG.md`

## 10. Git

- Implementation commit: `4904e71`
- Remote: pushed to `origin/main`, synchronized (`0 0`)
- Production deployment: NOT DEPLOYED.
