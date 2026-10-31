# JM-GUEST-MODEL-A-APIFY-EXCEPTION-REPAIR-01 — Execution Log

## Status

- **Arbeitsagentur via Apify for guests:** RESTORED
- **TheirStack / JobsPipe for guests:** BLOCKED (unchanged)
- **`mj_session`:** REMOVED for guest job API (not reintroduced)
- **Redis caches / global budgets / IP quotas / single-flight:** UNCHANGED
- **Deployment:** NOT DEPLOYED
- **Baseline:** `6545d34`

## 1. Corrected policy

`api/_lib/sourcePolicy.mjs`:

- `GUEST_FREE_SOURCE_IDS`: `arbeitnow`, `greenhouse`, `adzuna`
- `GUEST_APIFY_SOURCE_IDS`: `arbeitsagentur` (explicit product exception)
- `isGuestAllowedSource`: free ids, public/direct ATS, and `arbeitsagentur`
- Other Apify actors, TheirStack and JobsPipe remain blocked
- `guestPaidSourceAllowed(sourceId)` only true for `arbeitsagentur`

No request field, header, frontend flag or old cookie can widen this.

## 2. Restored guest paths

- `api/_lib/sources/index.mjs` includes `arbeitsagentur` in the guest source set.
- `/api/job-details` no longer returns `403`; it performs cookie-free
  Arbeitsagentur detail enrichment.
- `/api/match` performs Arbeitsagentur detail enrichment again, without a
  session identity.
- Existing 7-day detail cache, global Apify run budget, single-flight and
  optional IP quota are reused.
- No `Set-Cookie` is issued; a legacy `mj_session` is still cleared once.

## 3. Cookie-free cost protection

`api/_lib/detailEnrich.mjs`:

- Session quota is used only when a `sessionId` is supplied (legacy/registered
  path). Guests have none, so no shared `hash(undefined)` key is used.
- Legacy per-IP quota is used only when `clientIp` is supplied. Guests use
  `ipScope` (trusted-IP HMAC) when IP quotas are enabled.
- The atomic global Apify run slot is always reserved before a run.
- Redis failure on the paid path → `quota_unavailable`, no run.
- Cache-first behavior and the detail single-flight lock remain.
- No new cookie, secret or environment change.

## 4. Tests

| Test | Result |
|---|---|
| Arbeitsagentur allowed for guests | VERIFIED |
| TheirStack/JobsPipe still blocked | VERIFIED |
| Other Apify actors blocked | VERIFIED |
| `/api/job-details` guest enrichment without session | VERIFIED |
| `/api/match` guest Arbeitsagentur enrichment | VERIFIED |
| No `Set-Cookie`; legacy cookie cleared | VERIFIED |
| Cookie-free detail run uses global Apify budget | VERIFIED |
| No per-session quota reserve without session | VERIFIED |
| Redis outage blocks paid detail | VERIFIED (existing detail tests) |
| Cache hit does not run Apify | VERIFIED (existing tests) |
| Global Apify limit blocks runs | VERIFIED (existing tests) |
| Free ATS jobs remain visible | VERIFIED |
| Full `npm test -- --run` | VERIFIED — 1030 passed, 5 skipped |
| `npx tsc --noEmit -p tsconfig.app.json` | PASS |
| `npm run build` | PASS |
| `git diff --check` | PASS |
| `npm run test:budget:redis` | PASS |
| `npm run test:ip-quota:redis` | PASS |
| `npm run test:lock:redis` | PASS |
| `npm run test:ip-quota:rest` | PASS (6 tests) |
| `npm run test:e2e:guest-cv` | PASS — 1440/390 |
| Live Vercel / production Apify | NOT VERIFIED |

## 5. Unchanged

- CV profile cache, consent, anonymization, 10/2/5, ATS, search profiles
- AI matching / profile generation / ATS analysis
- Global provider budgets, IP quotas, single-flight, Redis schemas
- OIDC/Cognito/RIS/AWS
- TheirStack/JobsPipe adapters remain for future registered use
- No provider disabled

## 6. Risks

- Guests can consume the global Apify run budget up to its monthly cap; there is
  no per-guest session quota by design.
- Without `IP_QUOTA_ENABLED`, there is no per-IP brake; the global atomic budget
  is the hard cost ceiling.
- Detail enrichment at the IP quota boundary may return `quota_exceeded`.
- Live Vercel IP headers and production Apify behavior remain unverified.

## 7. Changed files

- `api/_lib/sourcePolicy.mjs`
- `api/match.mjs`
- `api/job-details.mjs`
- `api/_lib/detailEnrich.mjs`
- `tests/api/guest-source-policy.test.mjs`
- `tests/api/job-details.test.mjs`
- `tests/api/match-enrich.test.mjs`
- `tests/api/guest-model-a-cookie.test.mjs`
- `tests/api/detail-enrich.test.mjs`
- this report
- `docs/AI_AUDITLOG.md`

## 8. Git

- Implementation commit: `4ab97e3`
- Remote: pushed to `origin/main`, synchronized (`0 0`)
- Production deployment: NOT DEPLOYED.
