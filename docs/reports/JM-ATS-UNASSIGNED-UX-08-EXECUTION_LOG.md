# JM-ATS-UNASSIGNED-UX-08 — Execution Log

## Status

- **Overall:** IMPLEMENTED / VERIFIED (session-only)
- **RIS / persistence / deployment:** NOT IMPLEMENTED / NOT DEPLOYED
- **Baseline:** `7bf6513` (`main`, `origin/main` synchronized)
- **Pre-existing untracked files:** preserved and not staged

## Initial finding

Deleting a CV search profile detaches ATS children (`searchProfileId = null`).
The normal ATS selector only shows assigned children, so those entries were
effectively unreachable. There was no UI or adapter operation to reassign them.

## Repository extensions

Added to the ATS session adapter:

- `listUnassigned(cvHash)` — returns only ATS entries without a parent in that
  CV hash bucket.
- `assignUnassigned(cvHash, atsSessionId, targetSearchProfileId)` — validates
  and assigns.

Enforced rules:

- generation guard for reads and writes,
- ATS entry must exist in the requested CV hash,
- ATS entry must currently be unassigned,
- target search profile must exist in the same CV bucket,
- target parent must have fewer than five ATS children,
- ATS session ID is unchanged,
- name, skills, target roles and criteria are preserved,
- invalid operations throw and do not mutate the store.

The existing store function `assignCvAtsProfileToSearchProfile` is reused via
the adapter; no new storage layer was introduced.

## UI

`CvProfilesOverlay` now renders a “Nicht zugeordnete ATS-Profile” section when
the active CV bucket has such entries:

- name, “Nicht zugeordnet” status, target roles and skills,
- parent search-profile select,
- explicit “Zuordnen” action,
- success only after the awaited adapter call resolves,
- capacity/error messages,
- hint when no parent search profile exists,
- pending state disables further assignment actions,
- session-ended errors are treated as silent cancellation,
- the overlay is keyed by CV document ID so a CV change resets local
  assignment state.

The normal ATS selector still shows only assigned children.

## Parent deletion decision

Variant B is implemented for visibility/recovery: ATS children remain and are
managed as unassigned. No cascade deletion was added. A later remote migration
must require a valid parent before creating `ATSSearchProfileV1`.

## Tests

| Case | Result |
|---|---|
| Parent deletion keeps ATS children | VERIFIED — PASS |
| `listUnassigned` returns only unassigned entries | VERIFIED — PASS |
| Valid reassignment keeps ID/skills/criteria | VERIFIED — PASS |
| Foreign CV hash rejected | VERIFIED — PASS |
| Missing target parent rejected | VERIFIED — PASS |
| Full target parent rejected (`capacity_exceeded`) | VERIFIED — PASS |
| Already assigned ATS rejected | VERIFIED — PASS |
| Old session generation read/write rejected | VERIFIED — PASS |
| UI lists unassigned and assigns successfully | VERIFIED — PASS |
| UI capacity error remains visible | VERIFIED — PASS |
| UI hint when no parent exists | VERIFIED — PASS |
| Full `npm test -- --run` | VERIFIED — 963 passed, 5 skipped; 92 passed, 3 skipped files |
| `npx tsc --noEmit -p tsconfig.app.json` | VERIFIED — PASS |
| `npm run build` | VERIFIED — PASS |
| `git diff --check` | VERIFIED — PASS |
| Chromium 1440/390 route smoke | VERIFIED — no overflow/console errors |
| Chromium overlay smoke with seeded CV session | NOT VERIFIED — no synthetic CV fixture/session available in browser |
| Authenticated browser flow | NOT VERIFIED |

## Session safety

- Adapter calls are awaited; UI updates only after success.
- `ProfileSessionEndedError` is treated as a silent session cancellation.
- Pending assignment blocks duplicate clicks.
- Old generations cannot list or write.
- No job search, model call, network request, localStorage or IndexedDB use
  was added.
- 12-hour TTL and existing capacities are unchanged.

## Open points

- The browser overlay flow needs a committed synthetic CV fixture/session for
  automated Chromium verification.
- Unassigned ATS entries must not be migrated to persistent V1 resources until
  a parent is assigned.
- Remote/RIS persistence remains outside this package.

## Files changed

- `src/lib/profiles/repositoryTypes.ts`
- `src/lib/profiles/sessionRepositories.ts`
- `src/lib/profiles/profileValidation.ts`
- `src/lib/profiles/sessionRepositories.test.ts`
- `src/components/CvProfilesOverlay.tsx`
- `src/components/CvProfilesOverlay.test.tsx` (new)
- `src/App.tsx`
- `src/i18n.tsx`
- `src/styles.css`
- this report
- `docs/AI_AUDITLOG.md`

## Git

- Commit and push are recorded after final validation.
- No production deployment was performed.
