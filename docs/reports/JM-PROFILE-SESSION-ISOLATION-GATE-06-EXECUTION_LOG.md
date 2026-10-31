# JM-PROFILE-SESSION-ISOLATION-GATE-06 — Execution Log

## Status

- **Overall:** IMPLEMENTED / VERIFIED — session-only isolation hardening
- **RIS / remote adapter / persistence:** NOT IMPLEMENTED
- **AWS / deployment:** NOT RUN / NOT DEPLOYED
- **Baseline:** `52e5437` (`main`, `origin/main` synchronized)
- **Pre-existing untracked files:** preserved and not staged

## Findings

### A. Late repository writes (reproduced)

The previous epoch guard prevented a late UI refresh, but the delayed operation
still wrote into the same in-memory repository instance. A profile created by
user A could therefore exist in the repository after user B started, even though
the UI did not show it.

The same risk applied to delayed CV search-profile and ATS writes because
`cvProfileStore` is a module-global `Map`.

### B. CV processing after identity change (reproduced)

`createProfileFromPdf()` only checked `cvOperationRef`. An auth change did not
invalidate that token, so a delayed PDF extraction/hash/model continuation could
publish results into the next user's session.

### C. Silent cancellation looked like success

Manual handlers returned normally when the epoch changed. The section therefore
closed the form and showed “saved” even though nothing had been persisted.

### D. Identity fallback

`sub ?? "authenticated"` would treat two authenticated users without a `sub`
claim as the same identity. The key now uses `sub`, then `email`, and otherwise
an explicit `auth:unverified` marker. A verified stable claim remains required
for reliable multi-user isolation.

## Corrections

- Added a module-level profile session generation in
  `sessionRepositories.ts`. Every repository instance captures the generation at
  creation and rejects create/update/delete after `beginNewProfileSession()`.
- Added `ProfileSessionEndedError` (`code: "session_ended"`).
- On auth identity change the app now:
  - increments the UI session epoch,
  - starts a new profile-session generation,
  - creates a fresh manual repository and a fresh adapter set,
  - nulls `cvOperationRef`,
  - clears CV hash buckets, CV state, selections, consent flags and status.
- `createProfileFromPdf()` checks both the operation token and the session epoch
  before every state publication.
- Manual handlers throw `ProfileSessionEndedError` on epoch mismatch. The section
  treats that as a silent cancellation: form/pending state is closed without a
  success or error notice.
- CV/ATS save handlers ignore session-ended errors and keep no false status.
- ATS pending state is reset only for real failures; an identity change already
  resets the workflow.
- Existing 12-hour TTL, session list capacity, 5-ATS-parent limit, ATS override
  semantics and ATS detach-on-parent-delete behavior are unchanged.
- No network, model, localStorage, IndexedDB, RIS or persistence path was added.

## Session lifecycle

| Event | Behavior |
|---|---|
| Logout / identity change | epoch++, new generation, fresh stores, CV operation invalidated, CV/manual state cleared |
| Late manual create/update/delete | rejected by the old adapter generation; no write into new session |
| Late CV/ATS create/update/delete | rejected by generation before the store write |
| Late CV extraction/hash/model result | ignored by operation token + epoch |
| A → B → A | each transition creates a new generation; old instances stay invalid |
| Reload | still clears all in-memory state |
| 12h TTL | unchanged |

### Explicit limitation

An external request already sent before logout cannot be recalled. Local results
are discarded and cannot be published into the next session, but provider-side
processing is outside this repository's control. This is not a claim of
retroactive deletion.

## Tests

| Gate | Result |
|---|---|
| Repository generation rejection (manual/CV/ATS) | VERIFIED — PASS |
| Delayed manual create after user switch (UI + repository content) | VERIFIED — PASS |
| Delayed CV extraction after user switch | VERIFIED — PASS |
| No late success notice after session end | VERIFIED — PASS |
| Full `npm test -- --run` | VERIFIED — 945 passed, 5 skipped; 90 passed, 3 skipped files |
| `npx tsc --noEmit -p tsconfig.app.json` | VERIFIED — PASS |
| `npm run build` | VERIFIED — PASS |
| `git diff --check` | VERIFIED — PASS |
| Chromium 1440 px manual CRUD smoke | VERIFIED — create/edit/delete, no overflow/console errors |
| Chromium 390 px manual CRUD smoke | VERIFIED — same |
| Network during CRUD | Only `GET /api/models` on mount |
| Authenticated browser logout/switch flow | NOT VERIFIED |
| RIS / API / AWS | NOT RUN / NOT VERIFIED |

## Remaining limits

- No live authenticated identity-switch browser test was possible.
- The `auth:unverified` fallback cannot distinguish two different users in the
  same mounted session if no stable claim is available; Cognito `sub` is the
  expected stable claim.
- ATS unassigned-child UX remains an open product decision; deletion semantics
  were not changed.
- Remote adapter latency/cancellation remains untested until such an adapter
  exists.

## Files changed

- `src/App.tsx`
- `src/components/ManualSearchProfilesSection.tsx`
- `src/lib/profiles/sessionRepositories.ts`
- `src/lib/profiles/sessionRepositories.test.ts`
- `src/ManualSearchProfiles.authRace.test.tsx`
- this report
- `docs/AI_AUDITLOG.md`

## Git

- Implementation commit: `dadf8fb`
- Remote: pushed to `origin/main`, synchronized (`0 0`)
- No production deployment was performed.
