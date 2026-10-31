# JM-PROFILE-CAPACITY-02-LIMIT — Execution Log

## Status

- **Overall:** IMPLEMENTED / VERIFIED (session-only)
- **CVSearchProfile capacity:** max 2 per CV, enforced in store and adapter
- **Retention policy:** grandfathering — no auto-delete, no auto-trim
- **RIS / persistence / deployment:** NOT IMPLEMENTED / NOT DEPLOYED
- **Baseline:** `989a9c0` (`main`, `origin/main` synchronized)

## Implementation

### Store (`src/lib/cvProfileStore.ts`)

- Added `MAX_SEARCH_PROFILES_PER_CV = 2`.
- Added `canCreateCvSearchProfile(existingCount, isExisting)`.
- `saveCvSearchProfile()` now rejects genuinely new entries when the bucket
  already has two, while:
  - same-name upserts still update the existing entry and keep its ID,
  - existing entries remain editable,
  - existing buckets with more than two are never trimmed.
- `MAX_ENTRIES_PER_LIST = 50` remains only as the generic list safety cap for
  ATS entries; it is no longer the search-profile product limit.

### Session adapter (`sessionRepositories.ts`)

- `cvSearchProfiles.create` pre-checks the same rule and throws the typed
  `capacity_exceeded` error before any store mutation.
- `update` and delete are unaffected.
- ATS operations are unaffected.

### UI

- `CvProfileResult` accepts an inline `error` and renders it as an alert.
- On a capacity failure the CV workflow stays on the profile-ready step; it is
  neither closed nor reset, and no success message is shown.
- New DE/EN message:
  - DE: „Für diesen CV können maximal zwei Suchprofile gespeichert werden. Du
    kannst ein vorhandenes Profil bearbeiten oder eines löschen.“
  - EN: “You can save at most two search profiles for this CV. Edit or delete
    an existing profile.”

## Grandfathering behavior

| Bucket state | New profile | Existing update/upsert | Auto-delete |
|---|---|---|---|
| 0 or 1 | allowed | allowed | no |
| 2 | rejected (`capacity_exceeded`) | allowed | no |
| >2 (pre-existing) | rejected | allowed | no |

Deleting an entry frees capacity; the next create is allowed again.

## Tests

| Case | Result |
|---|---|
| First and second search profile | VERIFIED — PASS |
| Third search profile → `capacity_exceeded` | VERIFIED — PASS |
| Existing update at limit | VERIFIED — PASS |
| Same-name upsert keeps ID | VERIFIED — PASS |
| Delete frees capacity | VERIFIED — PASS |
| Two CV hashes each allow two | VERIFIED — PASS |
| Bucket >2: grandfather helper allows update, blocks create | VERIFIED — PASS |
| ATS entries are not limited to 2 | VERIFIED — PASS |
| Parent deletion detaches ATS children | VERIFIED — PASS |
| ATS reassignment | VERIFIED — PASS |
| Session generation / isolation | VERIFIED — PASS (existing tests) |
| Manual profiles unchanged | VERIFIED — PASS |
| 12-hour TTL unchanged | VERIFIED — PASS |
| Inline capacity UI message | VERIFIED — PASS |
| Full `npm test -- --run` | VERIFIED — 975 passed, 5 skipped; 94 passed, 3 skipped files |
| `npx tsc --noEmit -p tsconfig.app.json` | VERIFIED — PASS |
| `npm run build` | VERIFIED — PASS |
| `git diff --check` | VERIFIED — PASS |
| `npm run test:e2e:guest-cv` | VERIFIED — PASS, 1440/390 |
| Authenticated browser flow | NOT VERIFIED |

## Contract docs updated

- `JOBMATCHER-PROFILE-DATA-CONTRACT-V1.md`: session enforcement now states
  10/2/5 with grandfathering.
- `JOBMATCHER-PROFILE-REPOSITORY-CONTRACT-V1.md`: session adapter capacity
  description updated.

Historical reports were not rewritten; they remain evidence of their time.

## Remaining limits

- No server-side atomic capacity enforcement (RIS not implemented).
- Manual profile limit remains OPEN.
- Authenticated browser flow remains NOT VERIFIED.
- Existing in-memory buckets with more than two entries cannot be produced by
  the new code; the grandfather rule is covered by the pure helper test and the
  absence of any trimming logic.

## Files changed

- `src/lib/cvProfileStore.ts`
- `src/lib/profiles/sessionRepositories.ts`
- `src/components/CvProfileResult.tsx`
- `src/App.tsx`
- `src/i18n.tsx`
- `src/lib/cvProfileStore.test.ts`
- `src/lib/profiles/sessionRepositories.test.ts`
- `src/components/CvProfileResult.test.tsx` (new)
- contract docs above
- this report
- `docs/AI_AUDITLOG.md`

## Git

- Commit and push are recorded after final validation.
- No production deployment was performed.
