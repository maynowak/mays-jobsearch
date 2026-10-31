# JM-PROFILE-CACHE-DELETE-03-DESIGN-GATE

**Art:** Security Architecture / Design Gate
**Baseline:** `0129559`
**Status:** SPECIFIED — implementation NOT STARTED, no production change

## 1. Executive summary

The current server cache (`cv-profile:<sha256(text)>`, 30 days) is
content-addressed and shared across requests. It has no owner, no session
binding and no deletion path. The existing `mj_session` cookie is only
shape-validated and is not cryptographically authenticated; it is suitable for
coarse quota accounting but **not** as proof of cache ownership.

This gate specifies a V2 design:

- a server-issued, signed guest session cookie for cache ownership,
- `cv-profile:v2:<ownerScope>:<contentDigest>` keys with an HMAC-derived owner,
- no V1 fallback; old keys expire by TTL (or are administratively purged),
- an explicit, idempotent, session-authorized deletion API,
- strict Redis result semantics (never report success on failure),
- a session-generation CAS rule so an in-flight model response cannot recreate
  a deleted cache entry,
- same-origin/CSRF rules for deletion,
- honest local-vs-server deletion wording.

No implementation is approved by this document. Every decision below is
`RECOMMENDED` unless explicitly marked `APPROVED` (none are).

## 2. Git baseline

- Branch: `main`
- Baseline HEAD: `0129559`
- `origin/main`: synchronized at preflight (`0 0`)
- Working tree: only pre-existing unrelated untracked files
- No code, API, Redis, AWS, Terraform, Cognito or deployment change in this gate

## 3. Current architecture (verified from code)

- `api/profile.mjs` computes `sha256(text)` server-side and ignores the
  client-supplied hash for key selection/authority.
- `cacheGet`/`cacheSet` use Upstash REST; TTL is 30 days.
- `cacheDel` returns no reliable status (void on success/failure).
- `api/_lib/identity.mjs` accepts any 32-hex `mj_session` value without a
  server registry or signature; it issues a new random value only when the
  format is invalid. The comment itself states the IP backstop is the real
  anti-abuse guarantee.
- Cookie attributes: `Path=/`, `HttpOnly`, `SameSite=Lax`, `Max-Age=1 year`,
  `Secure` only in production.
- All public handlers set `Access-Control-Allow-Origin: *`; no credentials
  header is set.
- `handleCvRemoveData` clears local state and 12h session lists; no cache
  deletion exists.
- The server cache stores derived profile fields, including location; it does
  not store the raw PDF.

## 4. Threat model

| Threat | Current state | Target control |
|---|---|---|
| Guessing another session's cookie | Any 32-hex value accepted | Signed v2 cookie; unsigned values rejected for ownership |
| Session fixation | Attacker-chosen 32-hex value accepted | Server always issues its own signed value; never adopt client values |
| Deleting another user's cache by hash | No delete API today | Owner scope from verified session; digest alone insufficient |
| Shared-entry deletion side effects | Content-addressed shared entries | Per-owner keys; no cross-user entry |
| Redis outage reported as success | `cacheDel` void | Strict result + 503 on failure |
| In-flight model response recreates deleted data | No protection | Session generation CAS / tombstone |
| Cross-site delete request | `SameSite=Lax`, but `ACAO: *` | Same-origin + Origin/Sec-Fetch-Site + CSRF header |
| Stolen valid session cookie | n/a | Still a risk; document and use short lifetime/rotation |
| Provider-side retention | Unknown | Out of local control; must be stated honestly |

## 5. Guest session identity contract

### 5.1 Comparison

| Criterion | A. Signed cookie | B. Opaque token + server register | C. Separate CV-cache cookie |
|---|---|---|---|
| Server-verifiable | yes (HMAC) | yes (Redis lookup) | yes if signed/registered |
| Redis dependency | none for verification | every request | depends on construction |
| Complexity | low–medium | medium | high (two identities) |
| Revocation | via key rotation/expiry | immediate delete | separate lifecycle |
| Session fixation | prevented if server ignores client values | prevented | prevented |
| Quota impact | none if separate from quota semantics | none | none |
| Browser restart | cookie persists per Max-Age | cookie + register TTL | same |
| Guest compatibility | full | full | full but fragmented |
| Recommendation | **preferred** | acceptable fallback | not preferred |

### 5.2 Preferred design (A)

- New cookie value format:
  `v2.<keyId>.<random32hex>.<hmac>` where HMAC-SHA256 covers
  `v2.<keyId>.<random32hex>` with a server secret.
- `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=180 days` (lifetime is a
  `DECISION REQUIRED`; 180 days is a recommendation, shorter than the current
  year).
- Server always issues a fresh signed value when the incoming value is absent,
  malformed, unsigned, or fails HMAC. It never adopts a client-chosen value as
  authenticated.
- Key rotation: current + previous key IDs accepted; new issuance uses current.
- Legacy 32-hex cookies are **unverified** for cache ownership. They may remain
  accepted for legacy quota accounting during a transition, but they must not
  authorize cache reads/deletes; a v2 cookie is issued alongside.
- The session ID is never logged; logs may contain a short hash prefix only.
- `mj_session` is not renamed or changed in this gate; implementation needs a
  separate approval.

A stolen valid v2 cookie remains a bearer credential and can access that
guest's cache. This is inherent to cookie-based guests; mitigate with short
lifetime, rotation and no cross-site exposure.

## 6. Cache key V2

```text
cv-profile:v2:<ownerScope>:<contentDigest>
```

- `ownerScope = HMAC-SHA256(serverSecret, "owner:v2:" + sessionId)` truncated to
  32 hex chars. Raw session IDs never appear in Redis keys.
- `contentDigest = SHA256(normalizedProcessedText)` computed server-side only.
- Client-supplied owner or digest is never trusted for authorization. A digest
  may be supplied as a *selector* for deletion, but only within the verified
  owner scope.
- No model/mode suffix is required because the processed text already differs
  by anonymization mode. Model-agnostic reuse remains an accepted product
  trade-off; if per-model caching is desired later, add an explicit versioned
  component.
- Add `cv-profile:v2:gen:<ownerScope>` as a session generation counter and
  `cv-profile:v2:index:<ownerScope>` as a bounded SET of content digests for
  bulk deletion.

## 7. V1 transition strategy

- **No migration and no fallback.** New reads/writes use V2 only.
- Existing `cv-profile:<hash>` keys have no owner and must not be adopted or
  attributed to a user.
- Recommended: stop reading V1 immediately; let old keys expire via the
  30-day TTL. Optionally perform an administrative purge after a documented
  cutoff if legal/privacy requires faster removal (separate approval).
- Consequence: cache hit rate drops and model calls increase during the
  transition; this must be accepted explicitly.
- Tests must prove that no V1 key is read or written after the switch.

## 8. Proposed deletion API (not implemented)

### 8.1 Single result

```http
POST /api/profile/cache/delete
Content-Type: application/json
Cookie: mj_session=<signed v2>
X-MJ-CSRF: <same-origin token>
Origin: https://<app-origin>

{ "contentDigest": "<64 hex>" }
```

- Auth: signed guest session only; no login required.
- Owner scope is derived server-side.
- Success/missing: `204 No Content` (idempotent, no existence leak).
- Invalid digest: `400 validation_error`.
- Unsigned/invalid session: `401 unauthorized` (no deletion).
- Redis unavailable: `503 cache_unavailable` with `retryable: true`.
- Rate limit: per session and IP (e.g. 10/min); `429 rate_limited`.

### 8.2 All results of the current guest session

```http
DELETE /api/profile/cache
Cookie: mj_session=<signed v2>
X-MJ-CSRF: <token>
```

- Deletes all digests in `cv-profile:v2:index:<ownerScope>`, then the index and
  increments the generation counter.
- Index iteration is bounded (e.g. 100 entries); no Redis `SCAN`.
- If any key fails, return `503` and do **not** claim completion; the index
  remains for retry.
- Idempotent: repeated calls return `204` even if the index is empty.

Deletion never accepts a raw CV text or a client-provided owner scope.

## 9. Redis error semantics

Introduce a strict cache operation result:

```text
cacheDelStrict(key) -> "deleted" | "missing" | "unavailable"
```

- `deleted`: key removed.
- `missing`: key absent; for idempotent deletion this is success-equivalent.
- `unavailable`: network/config/Redis error; must never be reported as success.
- The API returns `204` for `deleted`/`missing`, `503` for `unavailable`.
- Retries are safe; the client may retry on `503` with backoff.
- Logs may include endpoint, status class, owner-scope hash prefix and a
  request id; never CV text, raw session IDs, cookies or digests in full.
- `cacheSet` should return success/failure so generation CAS can decide whether
  to surface a cache-write failure (non-fatal for profile generation).

## 10. Concurrent delete and race strategy

Target sequence:

```text
T1 request starts, captures generation G
T2 model runs
T3 user deletes all -> generation becomes G+1
T4 deletion confirmed
T5 model response arrives
T6 write checks generation; G != G+1 -> do not cache
```

Mechanism (recommended):

- `cv-profile:v2:gen:<ownerScope>` integer, created with the session's first
  cache write and refreshed with the cache TTL.
- On any delete-all, `INCR` the generation **before** deleting keys.
- Cache write uses a Lua script:
  `if GET(gen) == capturedGen then SET key ... else return 0`.
- Single-result deletion also increments the generation (coarse but safe): it
  invalidates in-flight writes for the session. A later explicit regeneration
  captures the new generation and may cache again.
- Concurrent deletes: generation increments are atomic; repeated deletion is
  idempotent.
- Concurrent cache hits: reads include the owner scope; a hit after delete
  simply misses.
- Session end during processing: the client aborts where possible; server-side
  writes with an old generation are rejected. Already-sent provider requests
  cannot be recalled.
- A confirmed deletion is therefore not undone by an older in-flight request.

## 11. Browser, CORS and CSRF

- Deletion endpoints must be same-origin. Do not add `Access-Control-Allow-Origin: *`
  to them; no cross-origin credentialed access.
- Require `Origin` (or `Sec-Fetch-Site: same-origin`) and reject mismatches.
- Cookie: `HttpOnly`, `Secure` in production, `SameSite=Lax` or `Strict`.
- Require a CSRF header (`X-MJ-CSRF`) whose value is derived from a
  same-origin-readable token or double-submit cookie; a custom header alone
  already forces a CORS preflight cross-origin.
- Allow only `POST`/`DELETE`; reject `GET` for mutation.
- Rate limit by session and IP; log only metadata.
- Existing public read endpoints may keep `ACAO: *`; deletion must not.

## 12. Privacy and UX

Current labels “CV-Daten entfernen” and “Endgültig entfernen” imply more than
the code does. Separate the scopes:

- **Local:** CV files, React state, 12h search/ATS lists, transient results.
- **Server (new):** only cache entries whose deletion returned `204`.
- **Not deleted automatically:** external model-provider data, quota counters,
  unrelated retention, future RIS account data.

Proposed DE hint:

> „Entfernt die CV-Dateien und gespeicherten Profile aus diesem Browser.
> Serverseitig zwischengespeicherte Profilergebnisse werden erst mit der
> separaten Aktion ‚Server-Cache löschen‘ entfernt und laufen sonst nach 30
> Tagen automatisch ab.“

Proposed EN hint:

> “Removes CV files and saved profiles from this browser. Server-side cached
> profile results are only removed by the separate ‘Delete server cache’ action
> and otherwise expire automatically after 30 days.”

The 30-day retention remains the current factual state until an approved
implementation changes it. Legal review is a separate step; do not silently
edit the public privacy policy.

## 13. Test matrix

| Test | Expected | Environment |
|---|---|---|
| Guest without cookie starts generation | Server issues signed session; cache write scoped | mocked Redis + unit |
| Verified guest session | Own cache read works | mocked Redis |
| Tampered signed cookie | Rejected; no foreign access | unit |
| Foreign session cookie | No access/delete | unit |
| Foreign digest | No foreign deletion | unit |
| Missing owner proof | 401, no deletion | unit |
| Repeated deletion | 204 idempotent | mocked Redis |
| Already expired cache | 204, no leak | mocked Redis |
| Redis unavailable | 503, never success | mocked Redis error |
| Multiple CVs in one session | Bulk delete removes only own keys | isolated Redis |
| Two guests, same CV text | Separate entries; no mutual deletion | isolated Redis |
| Delete during generation | Old generation cannot write | isolated Redis + Lua |
| CSRF attempt | Rejected | unit/browser |
| CORS scenario | No credentialed cross-origin delete | browser/unit |
| Old V1 keys | No read/write fallback | mocked Redis |
| Regeneration after delete | Allowed under new generation | isolated Redis |
| Guest CV E2E | Still PASS | Chromium mocked |
| 10/2/5 hierarchy | Unchanged | existing tests |
| RIS account storage | Untouched | not run |

Mocked Redis is sufficient for contract/error tests. Atomic Lua/CAS, index
consistency and race tests require an isolated Redis test instance (no
production access).

## 14. Decision matrix

| Decision | Options | Recommendation | Rationale | Risk | Status |
|---|---|---|---|---|---|
| Guest session proof | signed / register / separate cookie | signed v2 cookie | no per-request Redis dependency, fixation-resistant | secret management | RECOMMENDED |
| Cache owner | session-bound / global | session-bound | enables safe deletion | lower hit rate/cost | RECOMMENDED |
| Cache key V2 | HMAC owner + digest / raw session | HMAC owner + digest | no raw session IDs in keys | secret rotation | RECOMMENDED |
| V1 transition | TTL / admin purge | TTL, no fallback | no invented ownership | old data up to 30d | RECOMMENDED |
| Delete scope | single / whole session | both, separate endpoints | matches user intent | index complexity | RECOMMENDED |
| Redis failure | retry / explicit error | explicit 503, retryable | no false success | user retry | RECOMMENDED |
| Delete race | generation / tombstone / CAS | generation + Lua CAS | simple, atomic | Lua dependency | RECOMMENDED |
| Retention | 30 days / shorter | 30 days unchanged, review later | product/legal decision | privacy expectation | DECISION REQUIRED |
| Non-anonymized mode | cache / no cache | no cache (proposal) | higher sensitivity | more model calls | DECISION REQUIRED |
| Session lifetime | 1 year / 180 days | 180 days | reduces stolen-cookie window | user re-issuance | DECISION REQUIRED |
| Public privacy text change | now / after legal review | after legal review | legal governance | none | DECISION REQUIRED |
| Implementation | — | — | — | — | NOT STARTED |

No row is `APPROVED`.

## 15. Open questions

1. Which server secret store and rotation process is acceptable for HMAC?
2. Is a 180-day guest session lifetime acceptable, or shorter?
3. Should “not anonymized” results be excluded from caching?
4. Should the 30-day TTL be reduced?
5. Is an administrative V1 purge required, or is TTL sufficient?
6. How should provider-side retention be communicated?
7. Does the legal team require a specific deletion confirmation text?
8. Should quota identity and cache identity remain one cookie or be separated?
9. What is the maximum index size per guest session (CV count × retries)?

## 16. Approval criteria

- Security review of the signed-cookie construction and key rotation.
- Privacy/legal approval of retention and user-facing wording.
- Product approval of the cost impact from session-scoped caching.
- Confirmed Redis test environment for Lua/CAS tests.
- No implementation until this gate is explicitly approved.

## 17. Follow-up implementation scope

`JM-PROFILE-CACHE-DELETE-03-IMPLEMENTATION` (not started):

1. **Session verification** — signed v2 cookie, legacy fallback rules, tests.
2. **Cache key V2** — HMAC owner scope, generation/index keys, V1 no-fallback.
3. **Strict Redis operations** — result-returning delete/set, Lua CAS, tests.
4. **Deletion API** — single + session-wide, auth/CSRF/rate limit/idempotency.
5. **Race protection** — generation CAS, in-flight write rejection.
6. **Frontend integration** — separate server-cache action, honest result UI.
7. **Privacy text** — DE/EN, legal review, no silent policy change.
8. **Regression** — guest E2E, 10/2/5, TTL, session isolation.
9. **Rollout** — dark launch, V2-only reads, observe hit rate, rollback by
   reverting to V1 reads only if no V2 writes have occurred (explicit plan).

Each step needs its own acceptance criteria and must not deploy to production
without approval.

## 18. Sources checked

- `api/profile.mjs`, `api/_lib/cache.mjs`, `api/_lib/identity.mjs`
- `api/jobs.mjs`, `api/match.mjs` (CORS/cookie behavior)
- `src/App.tsx`, `src/api.ts`
- `src/components/CvDocumentList.tsx`, `src/components/CvConsentGate.tsx`
- `public/legal/datenschutz.md`, `docs/mays_job_matcher_datenschutzerklaerung_1.0.md`
- `docs/reports/JM-PROFILE-CACHE-DELETE-03-AUDIT.md`
- `docs/reports/PERSISTENCE-BOUNDARY-01-EXECUTION_LOG.md`
- `docs/contracts/JOBMATCHER-API-SESSION-BOUNDARY-01.md`
- `docs/reports/JM-PROFILE-V1-CONSOLIDATION-10-EXECUTION_LOG.md`
- `docs/reports/JM-PROFILE-CAPACITY-02-LIMIT-EXECUTION_LOG.md`

No code, API, Redis, AWS, Terraform, Cognito or deployment change was made.

- Design-gate commit: `481218b`
- Remote: `origin/main`, synchronized (`0 0`)
- Production deployment: NOT DEPLOYED
