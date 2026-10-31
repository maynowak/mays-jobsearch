# JM-PROFILE-AUTH-BOUNDARY-07A — Execution Log

## Status

- **Overall:** IMPLEMENTED / VERIFIED — session-only identity contract
- **RIS / AWS / persistence / deployment:** NOT TOUCHED
- **Baseline:** `e4cff42` (`main`, `origin/main` synchronized)

## Confirmed finding

`deriveAuthProfileKey()` accepted an empty issuer. A token with `sub` but no
`iss` therefore produced `iss:|sub:<value>` and was treated as a verified
identity. This contradicted the documented `iss + sub` contract.

## Trusted issuer source

- The OIDC client validates the ID token against the configured Cognito
  authority in `src/lib/oidcConfig.ts`.
- `authIdentity.ts` trusts only the validated `iss` claim from the user profile.
- It deliberately does **not** substitute the configured authority when the
  claim is absent: a missing claim cannot be assumed to belong to that issuer.
- Email remains excluded as an identity fallback.

## Correction

- Both `iss` and `sub` are required and trimmed.
- Missing or blank issuer → `auth:unverified`.
- Missing subject → `auth:unverified`.
- Verified key uses `JSON.stringify([iss, sub])` to avoid delimiter ambiguity.
- Guests remain `null`.
- `App` continues to hide the saved-profile dropdown when the identity is
  unverified, and clears temporary profile stores on identity transitions.
- No change to OIDC configuration, Cognito, ATS detach semantics, TTL,
  capacities, persistence, API routes or model calls.

## Tests

| Case | Result |
|---|---|
| `iss` + `sub` → verified | VERIFIED — PASS |
| Missing `iss` → unverified | VERIFIED — PASS |
| Blank `iss` → unverified | VERIFIED — PASS |
| Missing `sub` → unverified | VERIFIED — PASS |
| Same `sub`, different issuer → different keys | VERIFIED — PASS |
| Same email, different subjects → different keys | VERIFIED — PASS |
| Delimiter ambiguity (`issuer|one` / `one|user`) | VERIFIED — PASS |
| Guest → `null` | VERIFIED — PASS |
| Issuer disappearance clears temporary profiles | VERIFIED — PASS |
| Old repository `list`/`get` after session end | VERIFIED — PASS |
| Delayed manual/CV operations after switch | VERIFIED — PASS |
| Full `npm test -- --run` | VERIFIED — 956 passed, 5 skipped; 91 passed, 3 skipped files |
| `npx tsc --noEmit -p tsconfig.app.json` | VERIFIED — PASS |
| `npm run build` | VERIFIED — PASS |
| `git diff --check` | VERIFIED — PASS |
| Authenticated browser login/logout | NOT VERIFIED |

## Remaining limits

- No authorized authenticated browser environment was available.
- `auth:unverified` cannot distinguish two unverified identities in the same
  mounted page; Cognito `sub` + `iss` is the expected stable claim pair.
- ATS unassigned-child UX and remote adapter behavior remain unchanged/open.

## Files changed

- `src/lib/authIdentity.ts`
- `src/lib/authIdentity.test.ts`
- `src/ManualSearchProfiles.authRace.test.tsx`
- `src/ManualSearchProfiles.integration.test.tsx`
- this report
- `docs/AI_AUDITLOG.md`

## Git

- Commit and push are recorded after final validation.
- No production deployment was performed.
