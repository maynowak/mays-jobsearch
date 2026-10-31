# JM-COOKIELESS-GUEST-MODEL-A-CUTOVER-01 — Execution Log

## Status

- **Modell A:** APPROVED (product decision)
- **Guest source policy:** IMPLEMENTED / VERIFIED
- **Paid sources for guests:** BLOCKED
- **`mj_session` for guest job search:** REMOVED
- **Guest session quotas:** RETIRED for the public job path
- **Redis caches / budgets / IP quotas / single-flight:** UNCHANGED
- **Datenschutz-Veröffentlichung:** NOT APPROVED
- **Deployment:** NOT DEPLOYED
- **Baseline:** `823b715`

## 1. Git baseline

- Branch: `main`
- HEAD at preflight: `823b715`
- `origin/main`: synchronized (`0 0`)
- Working tree: only pre-existing unrelated untracked files

## 2. Source access matrix (Model A)

| Source | Provider | Guest access | Reason |
|---|---|---|---|
| Arbeitnow | direct-api | ALLOWED | free API |
| Greenhouse | ats | ALLOWED | free public board |
| Public ATS feeds | ats | ALLOWED | free public feeds |
| Adzuna | job-api | ALLOWED | existing free/rate-limited integration, no local credit budget |
| TheirStack | job-api | **BLOCKED** | paid credits |
| JobsPipe | job-api | **BLOCKED** | paid credits |
| Arbeitsagentur (Apify) | apify | **BLOCKED** | paid run |
| Any unknown job-api source | job-api | **BLOCKED** | cost risk not proven free |

The policy is centralized in `api/_lib/sourcePolicy.mjs` and applied in
`fetchAllJobs` before any source call. A paid source is not called, cannot hit
its cache through the public path, and cannot be enabled by request body,
headers, `mj_session`, or frontend flags.

## 3. Phase A — server-side source policy

- `api/_lib/sourcePolicy.mjs`:
  - `isGuestAllowedSource(source)`
  - `guestAllowedSources(sources)`
  - `paidSourcesAllowedForGuest()` → `false`
- `api/_lib/sources/index.mjs`: default path uses `guestAllowedSources`;
  `paidSourcesAllowed: true` exists only for isolated adapter tests and is never
  set by a public handler.
- `/api/match`: paid Arbeitsagentur detail enrichment is skipped for guests.
  Normal matching of already-fetched jobs and AI scoring are unchanged.
- `/api/job-details`: returns `403 { code: "paid_source_blocked" }` for guests.
- Free sources remain available.

Phase A commit: `8f04af8`.

## 4. Phase B — cookie removal

- `/api/jobs`: no `Set-Cookie`, no `anonymousIdentity`, no `sessionId` passed
  to sources. A present legacy `mj_session` is cleared once.
- `/api/match`: no guest cookie; paid detail enrichment skipped.
- `/api/job-details`: guest request blocked before identity creation; a present
  legacy cookie is cleared with the 403.
- `clearSessionCookieHeader()`:
  `mj_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` (+ `Secure` in
  production).
- No new cookie or browser identifier is issued.
- OIDC/Cognito login state is untouched.

Phase B commit: `21609f3`.

## 5. Removed / retired dependencies

| Dependency | Status |
|---|---|
| `Set-Cookie: mj_session` on guest job endpoints | REMOVED |
| `anonymousIdentity` on guest job endpoints | REMOVED |
| TheirStack per-session credits | UNREACHABLE for guests (retired) |
| JobsPipe per-session credits | UNREACHABLE for guests (retired) |
| Apify detail session quota | UNREACHABLE for guests (retired) |
| Legacy IP detail quota | UNREACHABLE for guests |
| OIDC/Cognito auth | UNCHANGED |

Provider adapters, global budgets, IP quotas and single-flight remain in the
codebase for a future verified registered-user path. They are not reachable by
public guests.

## 6. Tests

| Test | Result |
|---|---|
| Guest free-source policy | VERIFIED |
| Paid sources excluded from guest registry | VERIFIED |
| TheirStack/JobsPipe/Apify guest calls blocked | VERIFIED |
| `/api/job-details` guest → 403 `paid_source_blocked` | VERIFIED |
| `/api/match` no paid detail enrichment | VERIFIED |
| No cookie for fresh guest search | VERIFIED |
| Legacy cookie cleared exactly once | VERIFIED |
| No cookie on match/job-details/OPTIONS | VERIFIED |
| Ten parallel guest searches cookie-free | VERIFIED |
| Free sources still work (adapter tests with paidSourcesAllowed) | VERIFIED |
| AI matching unchanged | VERIFIED |
| Full `npm test -- --run` | VERIFIED — 1026 passed, 5 skipped |
| `npx tsc --noEmit -p tsconfig.app.json` | PASS |
| `npm run build` | PASS |
| `git diff --check` | PASS |
| `npm run test:budget:redis` | PASS |
| `npm run test:ip-quota:redis` | PASS |
| `npm run test:lock:redis` | PASS |
| `npm run test:ip-quota:rest` | PASS (6 tests) |
| `npm run test:e2e:guest-cv` | PASS — 1440/390, no `mj_session` cookie |
| Live Vercel / production provider | NOT VERIFIED |

## 7. AI cost boundary

Unchanged and explicitly outside Model A:

- `/api/match` AI scoring (OpenRouter/EdenAI) still runs when the user requests
  it.
- `/api/profile`, ATS analysis and CV improvement are unchanged.
- Their cost/quota controls are not affected by guest source blocking.
- No AI provider was disabled.

## 8. Redis / cost protection preserved

- `cache.mjs`, `usage.mjs`, `ip.mjs`, `ipQuota.mjs`, `lock.mjs` unchanged.
- Global provider budgets, IP quotas and single-flight remain.
- No Redis data deletion or migration.
- CV profile cache and 30-day TTL unchanged.
- Paid source policy is independent of `IP_QUOTA_ENABLED` (true or false).

## 9. Privacy status

- Guest job search no longer issues a persistent guest cookie.
- IP-based abuse protection remains available but is disabled by default; when
  enabled it uses only an HMAC scope for short windows.
- Redis caching remains.
- Existing public privacy texts were **not** changed. A separate DE/EN update
  and legal review are required before claiming cookie-free operation publicly.
- Full-site cookieless operation is not claimed: OIDC/auth and other features
  may use their own storage.

## 10. Rollback

- Revert commits `8f04af8` and `21609f3` to restore the previous behavior.
- Rollback restores the cookie and paid guest path; it must be treated as a
  security decision, not an automatic operational toggle.
- Redis keys and budgets are additive; no data deletion is required.
- No new secrets or production env changes are involved.
- A rollback must not silently re-enable paid sources without the previous
  budget controls.

## 11. Changed files

- `api/_lib/sourcePolicy.mjs` (new)
- `api/_lib/sources/index.mjs`
- `api/jobs.mjs`, `api/match.mjs`, `api/job-details.mjs`
- `api/_lib/identity.mjs` (legacy cookie clear helper)
- `tests/api/guest-source-policy.test.mjs` (new)
- `tests/api/guest-model-a-cookie.test.mjs` (new)
- `tests/api/job-details.test.mjs`, `tests/api/match-enrich.test.mjs`
- provider/registry tests updated to opt into paid adapters explicitly
- `tests/e2e/guest-cv-workflow.mjs` (asserts no `mj_session`)
- this report
- `docs/AI_AUDITLOG.md`

## 12. Git

- Phase A: `8f04af8`
- Phase B: `21609f3`
- Remote: pushed to `origin/main`, synchronized (`0 0`)
- No deployment.
