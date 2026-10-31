# JM-COOKIELESS-QUOTA-02B-02B-PREFLIGHT-01 — Execution Log

## Status

- **Overall:** PREFLIGHT COMPLETE — cutover NOT approved
- **Cookie removal:** NOT IMPLEMENTED
- **IP quota default:** disabled
- **Production deployment:** NOT DEPLOYED
- **Baseline:** `4ca3f7c` (actual HEAD at preflight)

## 1. Git baseline

- Branch: `main`
- HEAD: `4ca3f7c`
- `origin/main`: synchronized (`0 0`)
- Working tree: only pre-existing unrelated untracked files

## 2. Actual architecture

- `api/_lib/ip.mjs`: trusted-IP resolver + IPv4/IPv6 normalization + HMAC scope.
- `api/_lib/ipQuota.mjs`: atomic window/day counters with receipt-bound release.
- `api/_lib/lock.mjs`: Redis single-flight (`SET NX PX`, owner token,
  compare-and-delete, cache-first `runPaidOnce`).
- `api/_lib/usage.mjs`: atomic global provider budgets.
- `api/_lib/sources/*`: paid sources use cache → lock → cache re-check →
  IP quota → global budget → provider.
- `api/_lib/detailEnrich.mjs`: detail batch lock after missing-ref computation.
- `mj_session` still issued by `/api/jobs`, `/api/match`, `/api/job-details`.

## 3. Active IP-flag tests

Added to `tests/api/theirstack-source.test.mjs` with
`IP_QUOTA_ENABLED=true` and synthetic `ipScope`:

| Case | Result |
|---|---|
| Trusted IP + active quota → provider called and settled | VERIFIED |
| Missing trusted IP → `quota_unavailable`, no provider call | VERIFIED |
| IP quota Redis unavailable → `quota_unavailable`, no provider call | VERIFIED |
| IP limit reached → no provider call | VERIFIED |
| Free source remains available | VERIFIED (existing tests) |
| Missing HMAC secret → no `ipScope` → `quota_unavailable` | VERIFIED (unit resolver/quota) |

These tests use mocks for the provider and Redis REST responses. They prove the
control flow, not real distributed concurrency.

## 4. Concurrency / single-flight

- Lock primitives are verified against an isolated `redis:7-alpine` container:
  parallel acquisition, owner-only release, TTL expiry.
- `runPaidOnce` unit tests verify cache-first behavior, cache re-check after
  lock acquisition, and busy callers never running a second paid call.
- **Ten parallel full API requests against an isolated Redis instance:
  NOT VERIFIED.** The application uses Upstash REST, and no isolated REST
  Redis endpoint is available. A mock-based ten-request test would not prove
  real distributed atomicity and was not substituted as PASS.
- Lock TTLs: 20 s for TheirStack/JobsPipe, 55 s for Apify.
- If a provider call outlives the TTL, a second call can start; there is no
  exactly-once guarantee. Global atomic budgets remain the hard cost ceiling.
- Busy followers return `busy` after a bounded wait; they do not start a paid
  call. A retry can use the cache.

## 5. Session dependency inventory

| Dependency | Current use | Replacement | Cutover possible? | Precondition |
|---|---|---|---|---|
| `mj_session` cookie | Issued by jobs/match/job-details | None for guest search | Yes | IP live verification + product approval |
| TheirStack per-session credits | `identity.sessionId` | IP-HMAC + global budget | Yes | IP flag enabled/approved |
| JobsPipe per-session credits | `identity.sessionId` | IP-HMAC + global budget | Yes | IP flag enabled/approved |
| Apify detail per-session 30/day | `sessionId` | IP-HMAC + global budget | Yes | IP flag enabled/approved |
| Apify legacy per-IP 100/day | `clientIp` from untrusted header | Trusted-IP HMAC | Yes | Use `ipScope`; retire `clientIp` |
| `/api/jobs` `Set-Cookie` | Guest quota identity | Remove after migration | Yes | 02B-02B |
| `/api/match` cookie | Detail enrichment | IP scope | Yes | 02B-02B |
| `/api/job-details` cookie | Detail quota | IP scope | Yes | 02B-02B |
| OIDC/Cognito login | Authenticated users | Unchanged | No change | — |
| CV profile cache | No session cookie | Unchanged | No change | — |

Frontend: no explicit cookie API usage; same-origin fetches send cookies by
default. Removing `Set-Cookie` does not require a frontend change.

## 6. Fairness / proposed IP limits

Current proposal (not product-approved):

- 30 requests / 10 minutes / IP scope
- 300 requests / day / IP scope

These count **requests**, while TheirStack/JobsPipe session limits count
**credits** (returned records). They are not semantically equivalent and must
not be presented as such.

Recommendation:

- TheirStack: IP limit should be expressed in requests but paired with the
  existing global credit budget; per-IP request cap 10/10 min, 100/day as a
  starting point for a household.
- JobsPipe: same shape; 10/10 min, 100/day.
- Apify details: 5 batches/10 min, 30/day per IP (batches can contain up to
  the configured detail cap).
- Keep global budgets as the hard cap.
- Shared NAT/mobile/VPN traffic will share a quota; generous limits and clear
  retry messages are required.
- Final values require product approval and live traffic observation.

## 7. Privacy

- Guest search would use no persistent cookie and no browser quota ID.
- IP is processed transiently; only HMAC scope is stored.
- Redis TTLs: 10-minute window + 60 s; 24 h daily + 60 s; receipts one window.
- No raw IP in keys/logs.
- Shared IPs share a quota; this is a cost/abuse limitation, not identity.
- Existing privacy text still describes `mj_session`; no public text was
  changed. A DE/EN update is required before cutover and legal review.

Proposed DE hint (not published):

> „Für die kostenlose Jobsuche speichern wir keine dauerhafte Gastkennung.
> Zur Missbrauchs- und Kostenbegrenzung verarbeiten wir eine gekürzte,
> gehashte IP-Kennung für kurze Zeitfenster.“

Proposed EN hint:

> “The free job search does not store a persistent guest identifier. To limit
> abuse and cost, we process a shortened, hashed IP identifier for short time
> windows.”

## 8. Vercel verification plan (no deployment)

1. Obtain approval for a preview deployment.
2. In preview, log only a boolean/status, never raw IP/header values.
3. Send requests with:
   - normal IPv4 and IPv6 clients,
   - spoofed `x-forwarded-for`/`x-real-ip` headers,
   - no forwarding header.
4. Verify `VERCEL=1`, which header wins, and that spoofed values do not change
   the derived scope.
5. Confirm IPv4-mapped and `/64` grouping.
6. Remove any temporary diagnostics before production.
7. No preview/production deployment in this package.

Local verification already covers header parsing and spoof rejection with
synthetic headers. Live Vercel behavior is **NOT VERIFIED**.

## 9. Cutover plan (`JM-COOKIELESS-QUOTA-02B-02B-CUTOVER-02`)

1. Product approval of IP limits and windows.
2. Provision `MJ_IP_QUOTA_SECRET` and rotation runbook.
3. Confirm Vercel IP behavior in preview.
4. Enable `IP_QUOTA_ENABLED=true` in a controlled preview.
5. Replace TheirStack/JobsPipe session limits with IP scope; keep global
   budgets.
6. Replace Apify detail session quota and legacy `clientIp` backstop with
   `ipScope`.
7. Remove `Set-Cookie` from guest endpoints; keep OIDC auth untouched.
8. Run API/browser tests without guest cookies.
9. Update privacy text after legal approval.
10. Deploy with a rollback plan.

## 10. Rollback concept

- Keep the cookie-issuing code path behind a reversible flag/commit until the
  new quota is proven.
- Rollback restores `Set-Cookie` and session quotas; IP quota can remain
  disabled.
- Redis keys are additive (`mj-quota:ip:*`, `mj-lock:*`); no cache schema
  migration.
- Old session counters remain until TTL; no data deletion during rollback.
- Global budgets are unaffected by rollback.

## 11. Regression results

| Check | Result |
|---|---|
| `npm test -- --run` | PASS — 1014 passed, 5 skipped |
| `npx tsc --noEmit -p tsconfig.app.json` | PASS |
| `npm run build` | PASS |
| `npm run test:budget:redis` | PASS |
| `npm run test:ip-quota:redis` | PASS |
| `npm run test:lock:redis` | PASS |
| `npm run test:e2e:guest-cv` | PASS — 1440/390 |
| `git diff --check` | PASS |
| Ten parallel full API requests vs isolated Redis | NOT VERIFIED |
| Live Vercel IP headers | NOT VERIFIED |
| Product IP limits | DECISION REQUIRED |

## 12. Remaining risks

- No real distributed ten-request test against Upstash REST.
- Lock expiry during a slow provider allows a duplicate paid call; budgets cap
  cost.
- Busy followers return `busy`; clients may need a retry.
- Empty results are not negatively cached; retries may repeat a paid call.
- Session quotas count credits; IP quotas count requests — not equivalent.
- Privacy text and legal review are pending.

## 13. Release decision

| Criterion | Status |
|---|---|
| Atomic global budgets | VERIFIED |
| IP quotas tested with active flag | VERIFIED (mocked API flow) |
| Single-flight tested with parallelism | PARTIAL — Redis primitives VERIFIED; ten-request API test NOT VERIFIED |
| Guest session dependencies inventoried | VERIFIED |
| Vercel IP live verified | NOT VERIFIED |
| IP limits product-approved | DECISION REQUIRED |
| HMAC secret/rotation prepared | DECISION REQUIRED |
| Privacy review complete | DECISION REQUIRED |
| Rollback prepared | SPECIFIED |
| Cookie cutover ready | BLOCKED |

**Recommendation:** do not remove `mj_session` yet. Complete the Vercel preview
verification, product approval, secret provisioning and privacy review first.

## 14. Changed files

- `tests/api/theirstack-source.test.mjs` (active IP-flag cases)
- this report
- `docs/AI_AUDITLOG.md`

No product code, cookie, provider, Redis or deployment change.

## 15. Git

- Commit and remote synchronization are recorded after final validation.
- No deployment.
