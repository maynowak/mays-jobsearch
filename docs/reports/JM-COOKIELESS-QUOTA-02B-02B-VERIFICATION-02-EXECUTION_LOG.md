# JM-COOKIELESS-QUOTA-02B-02B-VERIFICATION-02 — Execution Log

## Status

- **Distributed 10-request test:** VERIFIED against a local Upstash-REST emulation + isolated `redis:7-alpine`
- **Upstash REST compatibility:** PARTIAL — local REST emulation, not a real Upstash instance
- **Cookie cutover:** BLOCKED
- **Cookie removal:** NOT IMPLEMENTED
- **Production deployment:** NOT DEPLOYED
- **Baseline:** `00690b5`

## 1. Git baseline

- Branch: `main`
- HEAD at preflight: `00690b5`
- `origin/main`: synchronized (`0 0`)
- Working tree: only pre-existing unrelated untracked files

## 2. Local Redis-REST test environment

New `tests/integration/ip-quota-parallel.test.mjs`:

```text
test → local HTTP REST adapter (loopback) → minimal RESP client → redis:7-alpine
```

- The adapter accepts the Upstash JSON command array and returns `{result}`.
- Supported through generic Redis commands: GET, SET (NX/PX), SETEX, DEL,
  INCR/INCRBY, DECR/DECRBY, EXPIRE, HGET/HSET/HDEL/HGETALL, EVAL, KEYS, PING.
- `cache.mjs` runs unchanged; only `UPSTASH_REDIS_REST_URL` points to the local
  adapter.
- The Redis container is bound to `127.0.0.1` and removed after the test.
- Synthetic HMAC secret, API key and IPs only.
- No production Upstash, provider credentials or AWS resources.

**Boundary:** this is a local REST emulation, not a real Upstash integration.
Upstash-specific behavior (network, auth, clustering) remains NOT VERIFIED.

## 3. Ten parallel full source requests

`IP_QUOTA_ENABLED=true`, `VERCEL=1`, synthetic `MJ_IP_QUOTA_SECRET`, synthetic
TheirStack key and provider mock.

| Scenario | Result |
|---|---|
| Ten identical requests | VERIFIED — exactly 1 provider call |
| IP window counter | VERIFIED — 1 |
| Global credit usage | VERIFIED — 1 |
| All ten responses contain the job | VERIFIED |
| Different queries (python/rust) | VERIFIED — 2 provider calls, separate locks |
| Cache hit | VERIFIED — no additional provider call |
| IP window limit reached | VERIFIED — second query `limit_reached`, no provider call |
| Global credit budget reached | VERIFIED — `limit_reached`, no provider call |
| Redis outage (container stopped) | VERIFIED — `quota_unavailable`, no provider call |

The test exercises the actual `fetchTheirstackJobs` source with the real
`cache.mjs`, lock, IP quota and global budget code. It does not invoke the
`api/jobs.mjs` HTTP handler itself; that handler is a thin wrapper around
`fetchAllJobs` and remains covered by existing API tests.

## 4. Single-flight limits

- 20 s lock TTL for TheirStack/JobsPipe, 55 s for Apify.
- Followers wait up to 3 s, then return `busy`; they do not start a paid call.
- Cache is checked before the lock and again after acquisition.
- A provider call outliving the lock TTL can be duplicated; no exactly-once
  guarantee. Global atomic budgets remain the hard cost cap.
- Cache-write failure allows a later retry to call again.
- Valid empty results are not negatively cached.

## 5. Session dependency matrix

| Dependency | Current use | Replacement | Cutover possible? | Precondition |
|---|---|---|---|---|
| `mj_session` | jobs/match/job-details | none for guest search | yes | Vercel IP live + approval |
| TheirStack session credits | `identity.sessionId` | IP-HMAC + global budget | yes | flag enabled/approved |
| JobsPipe session credits | `identity.sessionId` | IP-HMAC + global budget | yes | flag enabled/approved |
| Apify detail session quota | `sessionId` | IP-HMAC + global budget | yes | flag enabled/approved |
| Apify legacy IP quota | untrusted `clientIp` | trusted `ipScope` | yes | replace resolver |
| `Set-Cookie` | guest identity | none | yes | 02B-02B |
| OIDC/Cognito | authenticated users | unchanged | no change | — |
| CV profile cache | no cookie | unchanged | no change | — |

## 6. Product decision options

**Model A — free sources for guests only**
- Lowest cost risk.
- Paid sources become a registered-user feature.
- Highest fairness for shared IPs; no paid-call dependency for guests.

**Model B — limited paid sources for guests**
- Better availability.
- Requires IP/global budgets and Vercel IP trust.
- Shared NAT/VPN fairness risk; higher cost exposure.

Recommendation for decision: start with Model A for guests, Model B only after
IP live verification and product-approved limits. No provider was disabled.

## 7. Proposed per-provider limits

These count **requests**, while TheirStack/JobsPipe session limits count
**credits**; they are not equivalent.

- TheirStack: 10 requests/10 min, 100/day per IP scope; global credit budget
  remains authoritative.
- JobsPipe: same.
- Apify details: 5 batches/10 min, 30/day per IP scope.
- Global budgets unchanged.
- Shared NAT/mobile/VPN traffic shares a quota; messages must be clear.

All values are `DECISION REQUIRED`, not active.

## 8. HMAC secret / rotation runbook (draft)

- `MJ_IP_QUOTA_SECRET`: 32+ random bytes, server env only.
- `MJ_IP_QUOTA_VERSION`: e.g. `v1`.
- Rotation: increment version only at a UTC day boundary; old keys expire by
  their TTL. Do not rotate mid-window without accepting a one-window reset.
- No secret in repo/logs/browser.
- Rollback: restore previous version and secret; old counters remain until TTL.
- No production env change in this package.

## 9. Vercel preview verification plan

1. Deploy a preview only after explicit approval.
2. Send IPv4 and IPv6 requests; record only pass/fail, never raw IP/header.
3. Send spoofed `x-forwarded-for`/`x-real-ip`; verify the derived scope does
   not change.
4. Verify `VERCEL=1` and which header wins.
5. Test missing IP and IPv4-mapped IPv6.
6. Remove diagnostics before production.
7. No preview deployment was performed.

Live Vercel IP behavior: **NOT VERIFIED**.

## 10. Privacy draft (not published)

DE:
> „Für die kostenlose Jobsuche speichern wir keine dauerhafte Gastkennung. Zur
> Missbrauchs- und Kostenbegrenzung verarbeiten wir eine gekürzte,
> HMAC-basierte IP-Kennung für kurze Zeitfenster (10 Minuten bzw. 24 Stunden).
> Gemeinsam genutzte IP-Adressen teilen sich dieses Kontingent. Die Kennung ist
> pseudonym, nicht vollständig anonym.“

EN:
> “The free job search does not store a persistent guest identifier. To limit
> abuse and cost, we process a shortened HMAC-based IP identifier for short
> windows (10 minutes and 24 hours). Shared IP addresses share the quota. The
> identifier is pseudonymous, not fully anonymous.”

Legal review and public text change remain separate.

## 11. Cutover plan / rollback

Cutover (02B-02B-CUTOVER-02):

1. Approve IP limits/windows.
2. Provision HMAC secret + rotation.
3. Verify Vercel IP headers in preview.
4. Enable IP quota in preview; run 10-request test.
5. Replace session credits with IP scope.
6. Replace Apify detail session/legacy-IP quotas.
7. Remove `Set-Cookie` from guest endpoints.
8. Test without guest cookies.
9. Update privacy text after legal approval.
10. Deploy separately.

Rollback: restore `Set-Cookie` and session quotas, disable `IP_QUOTA_ENABLED`,
keep additive Redis keys until TTL; global budgets unaffected.

## 12. Decision matrix

| Criterion | Status |
|---|---|
| Atomic global budgets | VERIFIED |
| Active IP quotas | VERIFIED (local REST + isolated Redis) |
| Ten full parallel requests | VERIFIED |
| Redis-REST compatibility | PARTIAL (local emulation) |
| Single-flight safety | VERIFIED for lock-lease window; no exactly-once across TTL |
| Vercel IP live | NOT VERIFIED |
| Guest quotas product-approved | DECISION REQUIRED |
| HMAC secret/rotation approved | DECISION REQUIRED |
| Privacy review | DECISION REQUIRED |
| Cookie cutover | BLOCKED |

## 13. Remaining risks

- Local REST emulation ≠ real Upstash.
- Lock expiry during a slow provider can duplicate a paid call; budgets cap it.
- Followers may receive `busy` instead of waiting for the cache.
- Empty results are not negatively cached.
- Vercel header trust and product limits remain unverified/unapproved.
- Privacy text/legal review pending.

## 14. Changed files

- `tests/integration/ip-quota-parallel.test.mjs` (new)
- `package.json` (`test:ip-quota:rest`)
- this report
- `docs/AI_AUDITLOG.md`

No product code, cookie, provider, Redis or deployment change.

## 15. Git

- Implementation/test commit: `1fbf871`
- Remote: pushed to `origin/main`, synchronized (`0 0`)
- Production deployment: NOT DEPLOYED.
