# JM-COOKIELESS-QUOTA-ARCHITECTURE-01

**Art:** Architecture review and implementation planning
**Baseline:** `aec3ef9`
**Status:** ANALYSIS COMPLETE — no product code, API, cookie, Redis, AWS or deployment change

## 1. Executive summary

The guest job search currently issues a one-year `mj_session` cookie from
`/api/jobs`, `/api/match` and `/api/job-details`. That cookie is used for
per-session source credits and Apify detail quotas, not for authentication.
The cookie is shape-validated only and is not a trustworthy identity.

A cookie-free guest search is feasible by:

- removing guest `Set-Cookie` from the search path,
- replacing per-session source quotas with short-lived **HMAC-derived IP
  counters** plus existing **global monthly budgets**,
- making paid-provider budgets **atomic reservations** (not read-then-count),
- failing closed for paid providers when Redis is unavailable,
- adding a short-window IP rate limit and single-flight cache locks.

Free sources (Arbeitnow, Greenhouse) can continue without quotas. Paid sources
(TheirStack, JobsPipe, Apify details) need the stronger controls. AI model
budgets are part of the CV workflow, not guest job search, but are included in
the cost inventory.

The existing `cv-profile:<hash>` cache and its 30-day TTL are untouched.

## 2. Git baseline

- Branch: `main`
- HEAD: `aec3ef9`
- `origin/main`: synchronized at preflight (`0 0`)
- Working tree: only pre-existing unrelated untracked files
- No code, API, cookie, Redis, AWS, Terraform, Cognito or deployment change

## 3. Cookie inventory

| Cookie | Issued by | Attributes | Purpose | Quota dependency | If removed |
|---|---|---|---|---|---|
| `mj_session` | `/api/jobs`, `/api/match`, `/api/job-details` | `Path=/`, `HttpOnly`, `SameSite=Lax`, `Max-Age=1 year`, `Secure` in production | Opaque anonymous ID for source credits and Apify detail quotas | TheirStack/JobsPipe per-user credits; Apify detail per-session 30/day | Per-session quotas must move to IP/global; no auth impact |
| OIDC session | `react-oidc-context` (client) | Library-managed | Authenticated user identity | Not used by the quota code | No change; auth remains separate |
| No other cookies | — | — | `mj-lang` is localStorage, not a cookie | — | — |

Findings:

- Only `mj_session` is a guest cookie. It is not authentication.
- Its value is accepted if it matches 32 hex; no server registry/signature.
- Session fixation is possible: a client-chosen valid-format value is adopted.
- Cookie lifetime (1 year) is long for a quota identifier.
- `Set-Cookie` is sent even on a free `/api/jobs` search.

## 4. Existing quota architecture

| Provider | Cost model | Global limit (configured) | Individual limit | Cache | Atomic? | Risk |
|---|---|---|---|---|---|---|
| TheirStack | credits per returned record | `THEIRSTACK_MONTHLY_MAX_CREDITS` default 200 | `THEIRSTACK_MAX_CREDITS_PER_USER` default 20/month (session) | `job-source:*` 600 s | **No**: read limit → call → count after | parallel overspend; Redis outage bypasses limit |
| JobsPipe | credits per returned record | `JOBSPIPE_MONTHLY_MAX_CREDITS` default 200 | `JOBSPIPE_MAX_CREDITS_PER_USER` default 20/month (session) | `job-source:*` 600 s | **No** | same |
| Apify (Arbeitsagentur details) | run/usage USD | `APIFY_MONTHLY_MAX_RUNS` default 100 | per-session 30/day; per-IP 100/day | detail cache 7 days | **Yes** for run slot + quotas via Lua reserve; refunds on failure | best current control; Redis outage fails closed |
| Adzuna | free tier/rate-limited | none configured | none | 600 s | n/a | provider 429; no budget cap |
| Arbeitnow | free | none | none | 600 s | n/a | low |
| Greenhouse | free | none | none | 600 s | n/a | low |
| Public ATS feeds | free | none | none | source cache | n/a | low |
| OpenRouter AI | requests + USD | 1000 requests/month; soft 0.8 USD | none per user | `cv-profile` 30 d | **No**: check → count → call | parallel overshoot; soft USD is advisory |
| EdenAI AI | requests + USD | 200 requests/month; soft 1.0 USD | none per user | `cv-profile` 30 d | **No** | same |

Configured values are code defaults; production env values are **NOT VERIFIED**.

### Critical observations

- TheirStack/JobsPipe count credits **after** the provider response. Two
  parallel requests can both pass the limit check and overspend.
- A Redis outage makes `readCount` return `0`, so TheirStack/JobsPipe/AI limits
  appear unreached and paid calls proceed. Only Apify fails closed.
- Identical concurrent requests can both miss the cache and call the provider;
  there is no single-flight lock.
- Provider failures: Apify refunds run/quota on several failures; TheirStack/
  JobsPipe only count on success, so failed calls cost 0 in the local counter
  but may still cost at the provider.
- Monthly request limits are hard counters but not atomic; USD soft limits are
  not enforced as hard stops.

## 5. Cookie-free guest model

### 5.1 Target

- No `Set-Cookie` for guest job search, match or job-details.
- No new guest cookie, no localStorage quota key.
- Server-side cost control via IP HMAC + global budgets.
- Authenticated users may later receive higher limits via verified OIDC.
- Free sources remain available; paid sources may be limited for guests.

### 5.2 Request flow

```text
Guest request
  → verify/derive IP scope server-side (HMAC)
  → short-window IP rate limit
  → cache lookup (single-flight lock on miss)
  → global/IP budget reservation (atomic)
  → provider call
  → settle actual cost; refund unused reservation
  → cache result
```

No identity cookie is required.

### 5.3 Removing the cookie safely

- Remove `Set-Cookie` from `/api/jobs` first (free search).
- `/api/match` and `/api/job-details` also set it today; they must stop using
  session IDs for quotas before removal.
- `anonymousIdentity`/`sessionCookieHeader` remain for compatibility until all
  dependent quotas are migrated, then can be retired for guests.
- Authenticated OIDC flows are unaffected.

## 6. Redis protection mechanisms

### 6.1 Keys (proposed)

```text
mj-quota:ip:<hmac(ip, salt, day)>:<provider>     short-window IP counter
mj-budget:<provider>:<month>                     global monthly budget
mj-budget:reserved:<provider>:<month>            reserved amount
mj-lock:<source>:<query-hash>                    single-flight lock
```

- IP is never stored in plaintext; HMAC with a server secret and a rotating
  salt (daily or monthly). IPv6 is aggregated to /64 before hashing.
- Short TTLs: IP counters 24 h or 1 h windows; global budgets 62 days.
- No `SCAN`; all keys are direct.

### 6.2 Atomic reservation

Before a paid call, reserve the **maximum expected cost**:

```text
reserve(provider, maxCost) -> ok | exceeded | unavailable
```

Lua checks `used + reserved + maxCost <= limit`, increments `reserved`.
After the call, settle actual cost: move actual from reserved to used and
refund the difference. On provider failure, refund the full reservation where
the provider did not bill. If billing is unclear, keep the reservation and log
an "unknown settlement" event for reconciliation.

### 6.3 Failure behavior

- Redis unavailable on a **paid** path → fail closed (`quota_unavailable`),
  no provider call.
- Redis unavailable on a **free** path → continue without cache/limits.
- Cache set failure after a successful paid call is non-fatal but logged.
- Never report a reservation as used if the provider call never started.

### 6.4 Single-flight

Use `SET lock NX EX 30` around a cache miss; concurrent identical requests wait
briefly and re-check the cache. Prevents duplicate paid calls for identical
queries. Lock timeout must be shorter than the function timeout.

## 7. IP abuse protection

### 7.1 IP source

- Prefer platform-provided request metadata. On Vercel, verify whether
  `x-forwarded-for`/`x-real-ip` are overwritten and trustworthy; do not accept
  arbitrary client headers blindly.
- Validate IP format; reject malformed values.
- If no trusted IP is available: use global budgets only and apply a stricter
  global rate limit; do not invent an identity.

### 7.2 Privacy-preserving derivation

- `ipScope = HMAC-SHA256(serverSecret, "ip:" + normalizedIp + ":" + period)`.
- Store only the truncated HMAC, never the raw IP.
- IPv4: exact address. IPv6: aggregate to /64 to avoid trivial rotation.
- Rotate the HMAC salt monthly; old counters expire.

### 7.3 Limits and NAT

- IP limits are an abuse brake, not a user identity.
- Shared NAT/mobile/VPN traffic must not be blocked aggressively; choose
  generous per-IP limits and rely on global budgets as the hard backstop.
- Suggested starting points (RECOMMENDED, not approved):
  - 30 paid source calls per IP per 10 minutes,
  - 300 per IP per day,
  - global monthly budgets unchanged.
- Multiple concurrent requests from one IP share the counter atomically.

## 8. Registered users — target architecture

| User state | Free sources | Paid sources | Quota |
|---|---|---|---|
| Guest | available | restricted/product-gated | IP + global |
| Registered (verified OIDC `iss`+`sub`) | available | after product release | server-side per-user quota |
| Pro (future) | available | expanded | plan-based |

- Identity for registered users must come from verified OIDC claims, never a
  client-supplied user ID.
- The future quota check should live behind a policy function, e.g.
  `resolveQuotaScope(req) -> {kind: "guest-ip" | "user", key}`; RIS can later
  supply entitlements without changing source adapters.
- No source is disabled and no Pro feature is implemented now.
- No RIS change is made; the integration point is documented only.

## 9. Privacy boundaries

| Data | Purpose | Storage | Retention | Notes |
|---|---|---|---|---|
| IP HMAC counter | abuse/cost protection | Redis | 24 h / monthly | no raw IP |
| Global provider budget | cost cap | Redis | 62 days | no personal data |
| Cache entries | performance/cost | Redis | 600 s / 7 d / 30 d | CV cache unchanged |
| `mj_session` (current) | quota identity | cookie + Redis | 1 year | to be removed for guests |
| OIDC identity | account/auth | Cognito | account policy | unchanged |
| Future RIS quotas | entitlements | RIS | TBD | not implemented |

Cookie-free does not automatically mean consent-free. IP-based abuse
prevention and short-lived counters still require a legal basis and transparent
notice. Public privacy text changes require separate approval.

## 10. Impact on existing endpoints

| Endpoint | Current cookie | Target |
|---|---|---|
| `GET /api/jobs` | sets `mj_session` | no cookie; IP/global budgets |
| `POST /api/match` | sets `mj_session`; uses it for detail enrichment | no guest cookie; IP/global |
| `POST /api/job-details` | sets `mj_session`; session+IP detail quotas | IP/global only |
| `POST /api/profile` | no cookie; separate CV cache | unchanged |
| `/api/alerts` | email-based, no cookie | unchanged |
| Auth/OIDC | separate | unchanged |

No endpoint is changed in this audit.

## 11. Test matrix

| Test | Expected | Environment |
|---|---|---|
| Guest without cookie searches | No `Set-Cookie`; search works | mocked provider + unit |
| Multiple guests behind one IP | Shared IP counter; global budget respected | isolated Redis |
| IP change | New IP scope; old counter expires | unit |
| Parallel requests | No budget overshoot | isolated Redis + Lua |
| Identical concurrent searches | One provider call via single-flight | isolated Redis |
| Cache hit | No provider call | mocked provider |
| Global budget reached | Friendly limit, no provider call | mocked Redis |
| IP limit reached | Rate-limit response | mocked Redis |
| Redis outage, paid source | Fail closed, no call | mocked Redis error |
| Redis outage, free source | Search continues | mocked Redis error |
| Provider failure | Reservation refunded or logged unknown | mocked provider |
| Unknown billing | Reservation retained + reconciliation log | mocked |
| Registered user | Verified OIDC quota path | unit (future) |
| Guest CV workflow | Still PASS | existing E2E |
| Search profiles / ATS | Unchanged | existing tests |
| No additional cookies | Browser cookie jar check | Chromium |
| CV profile cache | Untouched, 30-day TTL | existing tests |

Mocked Redis covers contract/error behavior. Atomicity, Lua, single-flight and
parallel-budget tests require an isolated Redis test instance; no production
Redis access.

## 12. Implementation plan

`JM-COOKIELESS-QUOTA-IMPLEMENTATION` (not started):

1. **Trusted IP scope** — validate platform IP, HMAC, IPv6 /64, tests.
2. **IP rate limit** — short-window counters, 429 contract.
3. **Atomic budgets** — Lua reserve/settle/refund for TheirStack/JobsPipe/AI;
   fail closed on Redis errors.
4. **Single-flight cache** — lock on miss, re-check, tests.
5. **Remove guest cookie** — jobs first, then match/job-details after quota
   migration; browser test asserts no `Set-Cookie`.
6. **Policy scope** — `guest-ip` now, `user` hook for future OIDC/RIS.
7. **Privacy text** — DE/EN, legal review.
8. **Rollout** — dark launch counters, compare spend, rollback plan.
9. **Regression** — guest E2E, 10/2/5, CV cache, search profiles.

Each step needs its own acceptance criteria and approval.

## 13. Open product decisions

- Exact IP limits and window sizes.
- Whether paid sources remain available to guests at all.
- Whether to add a paid-source toggle for guests.
- Global monthly budget values (current defaults are code defaults, not
  verified production values).
- How to handle unknown provider billing.
- Legal basis and wording for IP-based abuse prevention.
- Future registered/Pro quota ownership in RIS.

## 14. Approval criteria

- Security review of IP HMAC, trusted header source and IPv6 handling.
- Cost review of atomic reservations and fail-closed behavior.
- Privacy/legal review of IP counters and cookie removal.
- Isolated Redis test environment.
- Explicit product approval before removing cookies or changing provider access.

## 15. Status summary

| Area | Status |
|---|---|
| Cookie inventory | VERIFIED |
| Existing quota architecture | VERIFIED (code); production env values NOT VERIFIED |
| Atomic Apify reservation | IMPLEMENTED / VERIFIED by code inspection |
| Atomic TheirStack/JobsPipe/AI reservation | NOT IMPLEMENTED |
| Redis fail-closed for paid sources | NOT IMPLEMENTED (except Apify) |
| Single-flight cache | NOT IMPLEMENTED |
| Cookie-free guest search | NOT IMPLEMENTED |
| IP HMAC quota | NOT IMPLEMENTED |
| Registered/Pro quota model | SPECIFIED only |
| CV profile cache | Unchanged / NOT touched |
| RIS integration | NOT IMPLEMENTED |

## 16. Sources checked

- `api/_lib/identity.mjs`, `api/jobs.mjs`, `api/match.mjs`,
  `api/job-details.mjs`
- `api/_lib/cache.mjs`, `api/_lib/usage.mjs`, `api/_lib/config.mjs`,
  `api/_lib/detailEnrich.mjs`
- `api/_lib/sources/theirstack.mjs`, `jobspipe.mjs`, `apify/index.mjs`,
  `sources/index.mjs`, `adzuna.mjs`, `arbeitnow.mjs`, `greenhouse.mjs`
- `api/_lib/providers/index.mjs`, `openrouter.mjs`, `edenai.mjs`
- `src/App.tsx`, `src/api.ts`
- `docs/reports/PERSISTENCE-BOUNDARY-01-EXECUTION_LOG.md`
- `docs/contracts/JOBMATCHER-API-SESSION-BOUNDARY-01.md`

No real provider calls, cookies, Redis data or user data were used.

- Analysis commit: `37c315a`
- Remote: `origin/main`, synchronized (`0 0`)
- Production deployment: NOT DEPLOYED
