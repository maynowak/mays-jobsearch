# JM-PROFILE-CACHE-DELETE-03-SECURITY-DECISION-04

**Art:** Security decision preparation (design-only)
**Baseline:** `d428527`
**Status:** SPECIFIED — implementation NOT APPROVED, no code/API/Redis/AWS change

## 1. Executive summary

This decision gate resolves the open security-architecture questions from
`JM-PROFILE-CACHE-DELETE-03-DESIGN-GATE` to the level needed for a separate
implementation approval:

- use a **separate signed cache-session cookie** instead of changing the
  existing quota cookie,
- use **separate HMAC keys** for cookie signing and owner-scope derivation,
- define a **two-key ring** with explicit rotation windows so deletion rights
  survive rotation,
- define **atomic deletion semantics** with a generation counter as the
  linearization point,
- keep the guest workflow unchanged and require no login,
- keep 30-day cache TTL and the 10/2/5 hierarchy unchanged in this gate.

Nothing here is approved. Recommendations remain `RECOMMENDED` until an
explicit approval is recorded.

## 2. Cookie security contract

### 2.1 Separate cache cookie (recommended)

Use a new cookie, e.g. `mj_cache_session`, instead of changing `mj_session`.

| Aspect | Contract |
|---|---|
| Purpose | Cache ownership and cache deletion only |
| Value | `v1.<kid>.<32-byte-random-hex>.<hmac-sha256-base64url>` |
| Scope | `Path=/api/profile` (narrow; only profile/cache endpoints) |
| Flags | `HttpOnly; Secure (production); SameSite=Lax; Max-Age=90 days` |
| Issue | Server issues only when absent/invalid/unsigned |
| Verification | HMAC over `v1.<kid>.<random>` with the key for `kid` |
| Invalid/old cookie | Reject for cache ownership, issue a fresh signed value |
| Client-supplied value | Never adopted as authenticated; no fixation |
| Logging | Never log the value or HMAC; optional short hash prefix |
| Logout | Guest cache cookie is not a login session; it may be cleared client-side or expire |

Why not modify `mj_session`:

- `mj_session` also drives quota accounting and has a one-year lifetime.
- Changing its format risks quota regressions and forces a migration of
  existing anonymous identities.
- Cache ownership needs a shorter, narrowly scoped credential.
- Two cookies are a small complexity cost compared with quota regression risk.

A stolen valid cache cookie is still a bearer credential for that guest cache.
Mitigations: 90-day lifetime, `HttpOnly`, `Secure`, narrow path, no
cross-origin credentialed access, rotation, and no inclusion in URLs/logs.

### 2.2 Session issuance and fixation

- If the cookie is missing, malformed, has an unknown `kid`, or fails HMAC, the
  server generates a new random value and signs it.
- The server never accepts a client-chosen value as authenticated, even if it
  looks valid.
- A client that presents an old valid cookie keeps access until expiry; a new
  cookie is only issued when verification fails.
- Cache identity is **not** an authenticated user identity and must never be
  used for account/profile ownership.

## 3. HMAC key rotation contract

### 3.1 Separate keys

| Key | Env var (proposal) | Purpose | Rotation impact |
|---|---|---|---|
| Cookie signing | `MJ_CACHE_COOKIE_KEYS` + `MJ_CACHE_COOKIE_ACTIVE_KID` | Sign/verify `mj_cache_session` | Old cookies invalid after grace |
| Owner derivation | `MJ_CACHE_OWNER_KEYS` + `MJ_CACHE_OWNER_ACTIVE_KID` | Derive `ownerScope` | Old cache keys become unreachable unless dual-derived |

Secrets live only in the existing server-side secret store (Vercel env). No
secret is committed, logged or returned to the browser. The concrete store and
rotation operator are `DECISION REQUIRED`.

### 3.2 Key ring and windows

- Keyring format: JSON map `{ "<kid>": "<secret>" }`, active kid separate.
- Cookie signing: accept active + previous kid. Keep the previous key for at
  least the cookie lifetime (90 days) after rotation; otherwise live cookies
  become invalid and users lose cache-deletion access.
- Owner derivation: accept active + previous kid. Cache writes use the active
  kid; reads use active only (old entries expire by TTL). Deletion attempts
  both kids (bounded to 2) so a session can still delete entries created before
  owner-key rotation.
- Rotation cadence: at most once per 90 days unless compromise; emergency
  rotation may invalidate cookies and orphan cache entries (documented
  incident procedure).
- Owner key rotation must never silently remove the ability to delete still
  live entries. The two-kid deletion attempt is the required mitigation.
- After the old owner key is retired, old cache entries are unreachable and
  expire by TTL; this is documented, not silent.

### 3.3 Key ID rules

- `kid` is a short opaque label (e.g. `2026-10`), never a secret.
- Unknown kid → cookie invalid; issue a new cookie.
- A keyring with no active kid is a configuration error: fail closed for cache
  ownership (no reads/deletes), while the guest CV workflow continues without
  caching.

## 4. Deletion and race semantics

### 4.1 Keys

```text
cv-profile:v2:<ownerScope>:<contentDigest>     cache entry
cv-profile:v2:gen:<ownerScope>                 generation counter
cv-profile:v2:index:<ownerScope>               SET of content digests
```

`ownerScope` = HMAC-SHA256(owner secret, `"owner:v2:" + sessionId`) truncated;
`contentDigest` = SHA256(server-normalized text). Neither raw session IDs nor
CV text appear in Redis keys.

### 4.2 Linearization point

The **generation increment is the deletion linearization point**:

1. `INCR cv-profile:v2:gen:<ownerScope>` (atomic).
2. Delete the requested key(s).
3. Update/delete the index.
4. Return success only if every Redis operation succeeded.

A profile-generation request captures the generation at start. Its cache write
uses Lua:

```text
if GET(gen) == capturedGen then
  SET cacheKey value EX ttl
  SADD index digest
  EXPIRE index ttl
  return 1
else
  return 0
end
```

Therefore an in-flight model response with an old generation cannot recreate a
deleted entry. New requests after deletion capture the new generation and are
allowed — they represent new user data created after the deletion point.

### 4.3 Single delete

- Body: `{ "contentDigest": "<64 hex>" }`, owner from verified cookie.
- `INCR` generation, `DEL` the key, `SREM` the digest.
- `deleted`/`missing` → `204`; Redis error → `503`, no success claim.
- Repeated calls are idempotent; generation may increment again (harmless).

### 4.4 Session-wide delete

- `INCR` generation first.
- `SMEMBERS index` (bounded, e.g. 100; no `SCAN`).
- `DEL` each key; then `DEL index`.
- If any step fails, return `503` and keep the index for retry; never claim
  completion.
- Entries written with the new generation after the increment are not part of
  the confirmed deletion; they are new data. This boundary is documented.

### 4.5 Concurrent generation during delete

- Writes that captured the old generation fail the CAS and are not cached.
- Writes that start after the increment capture the new generation and may
  cache; they are outside the deletion's linearization scope.
- Two concurrent deletes: both increments are atomic; each delete is
  idempotent. The index may be empty for the second call.
- A cache hit racing with delete either returns an entry before the delete or
  misses after it; it never resurrects data.

### 4.6 Redis failure and retry

- `cacheDelStrict` returns `deleted | missing | unavailable`.
- `unavailable` → HTTP `503` with `retryable: true`; the client must not show a
  success confirmation.
- Retries are safe because the generation increment and deletes are
  idempotent.
- Logs: endpoint, status class, owner-scope hash prefix, request id. Never CV
  text, raw session ID, cookie, HMAC or full digest.

### 4.7 Guarantee and limits

**Guarantee:** after a `204`, no cache entry that existed at the generation
increment can be read by that owner, and an older in-flight request cannot
recreate it.

**Limits:** data sent to the external model provider before deletion cannot be
recalled; new requests started after the deletion point may create new cache
data; Redis failure means no confirmed deletion.

## 5. Product and privacy decision matrix

| Topic | Options | Recommendation | Status |
|---|---|---|---|
| Guest session lifetime | 180 / 90 / 30 days | 90 days for cache cookie | RECOMMENDED |
| Cache TTL | 30 / 14 / 7 days | keep 30 days for now | DECISION REQUIRED |
| Not-anonymized mode | cache / no cache | do not cache | RECOMMENDED |
| V1 cache | TTL / admin purge | stop reads, let TTL expire; admin purge only if legal requires | RECOMMENDED |
| Secret management | existing env keyring / new store | existing server-side env keyring, two kids | DECISION REQUIRED |
| Cache isolation cost | session-isolated / shared | session-isolated; accept lower hit rate | RECOMMENDED |
| Privacy text | change now / after legal review | after legal review | DECISION REQUIRED |
| Cookie name | new `mj_cache_session` / reuse `mj_session` | new cookie | RECOMMENDED |
| Owner key rotation | dual-kid deletion / single kid | dual-kid | RECOMMENDED |
| Delete-all scope | indexed session entries only | indexed entries, bounded | RECOMMENDED |

No item is `APPROVED`.

## 6. Risk matrix

| Risk | Likelihood | Impact | Mitigation | Residual |
|---|---|---|---|---|
| Cookie theft | medium | high (own cache) | HttpOnly/Secure, 90d, narrow path, rotation | bearer risk remains |
| Secret leakage | low | high | env-only, no logs, rotation runbook | incident response |
| Owner-key rotation orphans entries | medium | medium | dual-kid deletion, 60d overlap | after retirement TTL only |
| Partial delete | medium | medium | strict results, 503, retry, index retained | temporary inconsistency |
| Index growth | low | low | cap 100, TTL, CV max 10 | fail-closed at cap |
| Redis outage | medium | medium | 503, no false success | user retries |
| CSRF | low | high | same-origin, Origin check, CSRF header, SameSite | defense in depth |
| V1 fallback leak | low | high | no V1 reads/writes after switch | old entries until TTL |
| Cost increase | high | medium | measure hit rate, consider TTL | accepted product trade-off |
| Legal wording mismatch | medium | high | legal review before change | separate gate |

## 7. Acceptance criteria for implementation

1. Signed cache cookie issued/verified; no client value adopted; invalid →
   fresh cookie.
2. Keyring with active + previous kid; cookie and owner keys separated.
3. Cache key V2 contains HMAC owner scope and server digest; no V1 fallback.
4. Cache writes use generation CAS; old in-flight writes rejected.
5. Single and session-wide delete endpoints: same-origin, CSRF, rate limit,
   idempotent, `204` only on confirmed success.
6. Redis failure → `503`, no success UI; strict result API.
7. Index bounded and TTL-managed; no `SCAN`.
8. Deletion attempts both active owner kids during rotation.
9. Logs contain no CV text, cookie, HMAC or full digest.
10. Guest CV E2E still PASS; 10/2/5 unchanged; no login requirement.
11. V1 keys never read/written after switch; transition documented.
12. Privacy text approved before public change.

## 8. Updated implementation plan

`JM-PROFILE-CACHE-DELETE-03-IMPLEMENTATION`:

1. **Cache session cookie** — new `mj_cache_session`, signed format, keyring,
   issue/verify tests. Acceptance: no fixation, invalid → new cookie.
2. **Owner derivation + keyring** — HMAC owner scope, active/previous kids,
   dual-kid deletion helper. Acceptance: rotation test keeps deletion working.
3. **Strict Redis layer** — result-returning set/del, Lua CAS, error mapping.
   Acceptance: mocked + isolated Redis tests.
4. **Cache V2 write/read** — new key, generation capture, index maintenance,
   no V1 fallback. Acceptance: V1 key never touched.
5. **Deletion API** — single + session-wide, auth/CSRF/rate limit/idempotency.
   Acceptance: contract tests and negative tests.
6. **Race tests** — delete during generation, concurrent deletes, retry.
   Acceptance: no resurrection after `204`.
7. **Frontend** — separate “server cache delete” action with honest status.
8. **Privacy text** — DE/EN, legal review, no silent policy change.
9. **Rollout** — dark launch, V2-only reads, measure hit rate, documented
   rollback. Acceptance: guest E2E PASS, no quota regression.

No step is approved to start.

## 9. Open decisions requiring explicit approval

- 90-day cache cookie lifetime.
- 30-day cache TTL (or shorter).
- Disabling cache for “not anonymized”.
- V1 TTL-only vs administrative purge.
- Concrete secret store and rotation operator.
- Accepting lower cache hit rate/cost.
- Legal wording and public privacy policy change.

## 10. Sources

- `docs/reports/JM-PROFILE-CACHE-DELETE-03-DESIGN-GATE.md`
- `docs/reports/JM-PROFILE-CACHE-DELETE-03-AUDIT.md`
- `api/_lib/identity.mjs`, `api/profile.mjs`, `api/_lib/cache.mjs`
- `docs/reports/PERSISTENCE-BOUNDARY-01-EXECUTION_LOG.md`
- `docs/contracts/JOBMATCHER-API-SESSION-BOUNDARY-01.md`
- `docs/reports/JM-PROFILE-V1-CONSOLIDATION-10-EXECUTION_LOG.md`
- `docs/reports/JM-PROFILE-CAPACITY-02-LIMIT-EXECUTION_LOG.md`

No code, API, Redis, AWS, Terraform, Cognito or product change was made.

- Decision-gate commit: `ecdb1e1`
- Remote: `origin/main`, synchronized (`0 0`)
- Production deployment: NOT DEPLOYED
