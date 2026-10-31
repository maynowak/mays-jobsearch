# JM-GUEST-MODEL-A-RELEASE-PREFLIGHT-01

**Art:** Release readiness / audit (no deployment)
**Baseline:** `44648f1` (actual HEAD at preflight)
**Status:** PREFLIGHT COMPLETE — deployment NOT approved

## 1. Git state

- Branch: `main`
- HEAD: `44648f1`
- `origin/main`: synchronized (`0 0`)
- Working tree: only pre-existing unrelated untracked files

## 2. Confirmed access matrix

| Source | Guest access |
|---|---|
| Arbeitnow | ALLOWED |
| Greenhouse | ALLOWED |
| Public ATS feeds (greenhouse/lever/ashby/workable/recruitee/personio prefix) | ALLOWED |
| Adzuna | ALLOWED |
| Arbeitsagentur search via Apify | ALLOWED |
| Arbeitsagentur details via Apify | ALLOWED |
| TheirStack | BLOCKED |
| JobsPipe | BLOCKED |
| Other Apify actors | BLOCKED |
| Unknown `job-api` / future paid `ats` / `direct-api` classes | BLOCKED |

### Hardening found during preflight

The previous policy allowed any `provider === "ats"` or
`provider === "direct-api"`. That would implicitly allow a future paid source if
it reused those provider classes. The policy now allows only explicit free IDs
and explicit public-ATS adapter prefixes
(`greenhouse:`, `lever:`, `ashby:`, `workable:`, `recruitee:`, `personio:`).

Policy-hardening commit: recorded in the Git section.

Unbekannte **Stellenanzeigen** werden nicht gefiltert; die Policy betrifft nur
API-Anbieter.

## 3. Apify cost protection

Both Arbeitsagentur paths (search + detail enrichment):

1. Cache-first; cache hit does not reserve or run.
2. Single-flight lock; busy followers never start a second paid run.
3. Atomic global run reservation before any Apify call.
4. Redis outage → `quota_unavailable`, no run.
5. Unknown provider billing is conservative; no blind refund.
6. No guest cookie is issued.
7. Monthly limit → `limit_reached` / `apify_limit_reached` without a run.
8. No uncontrolled retries; busy is bounded.

### Limits (code defaults)

| Limit | Default | Nature |
|---|---|---|
| `APIFY_MONTHLY_MAX_RUNS` | 100 | hard atomic run backstop (`reserveApifyRunSlot`) |
| `APIFY_MONTHLY_SOFT_LIMIT_USD` | 4.00 | advisory only, shown in `/api/usage`, does not block |
| `APIFY_DETAIL_MAX_PER_USER_PER_DAY` | 30 | only when a session ID exists; guests have none |
| `APIFY_DETAIL_MAX_PER_IP_PER_DAY` | 100 | only when legacy `clientIp` is supplied; guests use optional IP-HMAC |
| `IP_QUOTA_*` | disabled | optional additional IP brake |

**Production environment values: NOT VERIFIED** — no read-only production
connection was used. Defaults are code values, not production evidence.

## 4. Guest/frontend behavior

- Arbeitsagentur jobs are returned by the guest search.
- Detail enrichment loads Arbeitsagentur descriptions for guests.
- Matching of existing jobs works; paid detail enrichment is limited to the
  approved Arbeitsagentur path.
- A reached Apify budget produces a friendly `limit_reached`/source reason; no
  crash.
- `busy` is a bounded source state; the client may retry manually, no automatic
  loop.
- Legacy `mj_session` is deleted with `Max-Age=0`; new guests receive none.
- No UI change was required.

## 5. Privacy alignment

Actual current behavior:

- No persistent guest session cookie for the job API.
- Redis caches (job/source/detail/CV profile) remain.
- Optional IP-HMAC quotas remain disabled by default.
- Arbeitsagentur requests go through Apify (external processor).
- AI matching uses OpenRouter/EdenAI when the user triggers it.
- OIDC/Cognito login and profile functions unchanged.

Not covered by the current public privacy text:

- The exact cookie removal / no-new-guest-cookie behavior.
- The optional IP-HMAC abuse protection (if enabled).
- The Arbeitsagentur Apify processing and retention.

Proposed DE addition (not published):

> „Für die kostenlose Jobsuche wird keine dauerhafte Gast-Session-Kennung
> gespeichert. Die Suche nutzt weiterhin serverseitige Caches. Zur
> Missbrauchs- und Kostenbegrenzung können gekürzte, HMAC-basierte
> IP-Kennungen für kurze Zeitfenster verarbeitet werden. Arbeitsagentur-
> Stellen und -Details werden über den Dienst Apify abgerufen; dabei können
> Suchbegriffe und Stellenreferenzen an Apify übermittelt werden. KI-Funktionen
> nutzen separate externe Anbieter.“

Proposed EN addition (not published):

> “The free job search does not store a persistent guest session identifier.
> Search results continue to use server-side caches. To limit abuse and cost,
> shortened HMAC-based IP identifiers may be processed for short time windows.
> Arbeitsagentur jobs and details are retrieved via Apify; search terms and job
> references may be sent to Apify. AI features use separate external
> providers.”

No public privacy text was changed. Legal review is required. Full-site
cookieless operation is not claimed.

## 6. Preview verification plan (no deployment)

1. Obtain explicit preview approval.
2. Deploy the candidate commit to Preview only (`vercel deploy`, no `--prod`).
3. Verify:
   - guest search returns free sources + Arbeitsagentur,
   - TheirStack/JobsPipe produce no provider calls,
   - Arbeitsagentur details load,
   - browser cookie jar has no `mj_session`,
   - legacy cookie is deleted on first contact,
   - Apify cache hit/miss behaves as expected,
   - global limit path is friendly.
4. Test Vercel IP headers only if IP quotas will be enabled:
   - IPv4/IPv6, spoofed `x-forwarded-for`/`x-real-ip`, missing IP.
   - Log only pass/fail, never raw IPs.
5. Do not run real paid provider calls beyond the approved preview budget.
6. Remove diagnostics before production.
7. No preview or production deployment in this package.

## 7. Rollback

- Revert to the pre-cutover commit (`823b715`) or revert the Model A commits.
- Rollback restores the previous cookie/paid-source behavior and must be a
  conscious security decision.
- Redis keys and budgets are additive; no deletion required.
- No new secrets or production env changes.
- A rollback must not silently re-enable TheirStack/JobsPipe for guests; those
  remain blocked by the source policy unless explicitly reverted.

## 8. Regression results

| Check | Result |
|---|---|
| `npm test -- --run` | PASS — 1030 passed, 5 skipped |
| `npx tsc --noEmit -p tsconfig.app.json` | PASS |
| `npm run build` | PASS |
| `git diff --check` | PASS |
| `npm run test:budget:redis` | PASS |
| `npm run test:ip-quota:redis` | PASS |
| `npm run test:lock:redis` | PASS |
| `npm run test:ip-quota:rest` | PASS (6 tests) |
| `npm run test:e2e:guest-cv` | PASS — 1440/390 |
| Live Vercel / production Apify | NOT VERIFIED |
| Production config values | NOT VERIFIED |

## 9. Open approvals

- Preview deployment approval.
- Production config verification (Apify limits, Upstash, env).
- Legal/privacy text approval.
- Optional IP quota activation approval (not required for Model A).
- Final production deployment approval.

## 10. Git

- Policy hardening + documentation commit: `2661da2`
- Remote: pushed to `origin/main`, synchronized (`0 0`)
- Production deployment: NOT DEPLOYED.
