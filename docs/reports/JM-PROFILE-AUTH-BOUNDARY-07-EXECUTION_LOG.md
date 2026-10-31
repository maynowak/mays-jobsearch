# JM-PROFILE-AUTH-BOUNDARY-07 — Execution Log

## Status

- **Overall:** IMPLEMENTED / VERIFIED — session-only auth boundary
- **RIS / remote adapter / persistence:** NOT IMPLEMENTED
- **AWS / deployment:** NOT RUN / NOT DEPLOYED
- **Baseline:** `ad9b5ed` (`main`, `origin/main` synchronized)
- **Pre-existing untracked files:** preserved and not staged

## Identity review

- `iss` + `sub` is now the only accepted stable identity combination.
- Email is **not** used as an identity fallback. The same address can exist for
  different identities and must not merge their temporary profile contexts.
- An authenticated session without `sub` gets the explicit
  `auth:unverified` key.
- Guests remain `null` and continue to use normal, non-account session
  behavior.
- Auth loading/callback behavior was not changed.
- A → B → A produces distinct keys per `sub`; returning to A starts a fresh
  session generation, so old A data is not restored.

### Unverified identity behavior

When `auth:unverified` is active:

- the saved-profile dropdown in the search form is hidden
  (`authenticated={isAuth && identityVerified}`),
- temporary profile stores are cleared on every auth-key transition,
- no persistent storage or network path is added.

Limitation: without a stable claim, two different users inside the same mounted
page cannot be distinguished. This is explicitly not a verified multi-user
identity and is documented rather than silently treated as one shared user.

## Repository read guards

Previously only create/update/delete checked the session generation. `list()`
and `get()` on an old repository instance could still read the module-global
CV store or the retained manual repository.

Now every CV, ATS and manual `list`/`get` also asserts the captured generation
and throws `ProfileSessionEndedError` after `beginNewProfileSession()`.

## Tests

| Gate | Result |
|---|---|
| `iss`+`sub` key derivation | VERIFIED — PASS |
| Different `sub`, identical email | VERIFIED — PASS |
| Same `sub`, different issuer | VERIFIED — PASS |
| Missing `sub` → unverified, email not trusted | VERIFIED — PASS |
| Guest → `null` | VERIFIED — PASS |
| Old repository `list`/`get` after session end | VERIFIED — PASS |
| Delayed manual create after user switch (UI + store) | VERIFIED — PASS |
| Delayed CV extraction after user switch | VERIFIED — PASS |
| Missing-`sub` identity change clears profiles | VERIFIED — PASS |
| Full `npm test -- --run` | VERIFIED — 952 passed, 5 skipped; 91 passed, 3 skipped files |
| `npx tsc --noEmit -p tsconfig.app.json` | VERIFIED — PASS |
| `npm run build` | VERIFIED — PASS |
| `git diff --check` | VERIFIED — PASS |
| Chromium 1440 px manual profile smoke | VERIFIED — create, no overflow/console errors |
| Chromium 390 px manual profile smoke | VERIFIED — create, no overflow/console errors |
| Authenticated browser login/logout flow | NOT VERIFIED |
| RIS / API / AWS | NOT RUN / NOT VERIFIED |

## Remaining limits

- No authorized authenticated browser environment was available.
- `auth:unverified` cannot distinguish two simultaneous unverified identities
  in the same mounted page; Cognito `sub` is the expected stable claim.
- ATS unassigned-child semantics remain unchanged.
- Remote adapter cancellation/latency remains untested.

## Files changed

- `src/lib/authIdentity.ts` (new)
- `src/lib/authIdentity.test.ts` (new)
- `src/App.tsx`
- `src/lib/profiles/sessionRepositories.ts`
- `src/lib/profiles/sessionRepositories.test.ts`
- `src/ManualSearchProfiles.authRace.test.tsx`
- this report
- `docs/AI_AUDITLOG.md`

## Git

- Commit and push are recorded after final validation.
- No production deployment was performed.
