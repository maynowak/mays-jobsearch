# JM-PROFILE-V1-CONSOLIDATION-10 — Execution Log

## A. Executive summary

Profile V1 is currently a **session-only frontend domain layer** plus a
**specified persistence contract**:

- The Job Matcher has typed V1 DTOs, mappers, runtime validation and
  session repositories for CV search profiles, ATS variants and independent
  manual search profiles.
- All profile data remains in memory for the current browser session. There is
  no account-backed profile persistence and no RIS integration.
- The guest CV workflow is fully functional without login and was re-verified
  in Chromium at 1440 px and 390 px with mocked APIs.
- ATS variants override skills/target roles while parent city, radius, work
  mode and employment type remain.
- ATS children whose parent search profile was deleted are retained as
  `unassigned` and can be reassigned through the existing session adapter.
- Identity isolation uses verified `iss + sub`, a session generation and a UI
  epoch. A full authenticated browser login/logout flow is still NOT VERIFIED.

## B. Architecture

```text
Guest / authenticated browser session
│
├── App React state
│   ├── CV documents (File, hash, selection)        max 10 in App state
│   ├── active search/ATS selections, consent state
│   └── manual profile repository (in-memory Map)
│
├── cvProfileStore (module Map, keyed by CV hash)
│   ├── CVSearchProfile entries                     up to 50 per hash bucket
│   └── ATSSearchProfile entries                    max 5 per parent; unassigned allowed
│
└── profiles/sessionRepositories
    ├── CV search profile adapter
    ├── ATS adapter (+ listUnassigned / assignUnassigned)
    └── manual adapter (independent of CV)
```

The future remote adapter is specified only. React components do not depend on
RIS/DynamoDB/S3 structures.

## C. Implementation matrix

| Component | Status | Code | Tests | Remaining limitation |
|---|---|---|---|---|
| V1 contract types | IMPLEMENTED / SPECIFIED | `src/lib/profiles/contractTypes.ts` | `profileMappers.test.ts`, `profileValidation.test.ts` | Hand-maintained alongside JSON Schema |
| Profile ↔ SearchConfiguration mapper | IMPLEMENTED / VERIFIED | `profileMappers.ts` | mapper tests | Remote/RIS roundtrip NOT VERIFIED |
| Runtime validation | IMPLEMENTED / VERIFIED | `profileValidation.ts` | validation tests | Not a full JSON Schema engine |
| CV search session repository | IMPLEMENTED / VERIFIED | `sessionRepositories.ts` | repository tests | 2-per-CV target not enforced |
| ATS session repository | IMPLEMENTED / VERIFIED | `sessionRepositories.ts` | repository tests | 5-per-parent enforced locally |
| Unassigned ATS recovery | IMPLEMENTED / VERIFIED | `sessionRepositories.ts`, `CvProfilesOverlay.tsx` | repository/overlay/dashboard tests | Browser overlay with seeded CV NOT VERIFIED |
| Manual search profiles | IMPLEMENTED / VERIFIED | `manualSearchProfiles.ts`, adapter | manual unit/integration tests | No account persistence |
| Search-page UI wiring | IMPLEMENTED / VERIFIED | `App.tsx` | integration tests | — |
| Dashboard UI parity | IMPLEMENTED / VERIFIED | `DashboardV2CvSection.tsx` | dashboard tests | Full browser overlay NOT VERIFIED |
| Session generation / late-write guard | IMPLEMENTED / VERIFIED | `sessionRepositories.ts`, `App.tsx` | isolation/race tests | Remote cancellation NOT IMPLEMENTED |
| Identity boundary | IMPLEMENTED / VERIFIED | `authIdentity.ts`, `App.tsx` | identity/race tests | Authenticated browser flow NOT VERIFIED |
| Guest CV workflow | IMPLEMENTED / VERIFIED | `App.tsx`, CV components | Chromium E2E 1440/390 | Mocked backend only |
| PDF extraction | IMPLEMENTED / VERIFIED | `src/lib/pdf.ts`, fixture | `pdfFixture.test.ts`, E2E | — |
| RIS persistence | SPECIFIED only | `docs/contracts/*` | none | NOT IMPLEMENTED / NOT VERIFIED |
| Remote adapter | SPECIFIED only | repository contract docs | none | NOT IMPLEMENTED |

## D. Product contract and capacities

| Object | Product target | Actual limit | Deviation |
|---|---|---|---|
| CV | 10 per user/session | 10 in `App` state (`slice(0, 10)`) | none in guest state |
| CVSearchProfile | 2 per CV | 50 per CV hash bucket (`MAX_ENTRIES_PER_LIST`) | **OPEN deviation** |
| ATSSearchProfile | 5 per parent | 5 enforced in store and adapter | none locally |
| ManualSearchProfile | OPEN | unbounded in-memory `Map` | product limit still OPEN |
| Unassigned ATS | temporary special case | retained with `searchProfileId = null`; assignable | must not be migrated without a parent |

### Impact analysis for a future 2-search-profile limit

Affected areas if the target is enforced later:

- `saveCvSearchProfile()` upsert-by-name logic (must allow updating an existing
  entry while blocking a third new entry),
- `sessionRepositories.cvSearchProfiles.create`,
- user-facing capacity message,
- existing buckets with more than two entries (keep until deleted vs. trim
  policy),
- ATS parent integrity when a search profile is removed (children become
  unassigned),
- tests and guest/account parity,
- future remote capacity enforcement must be atomic on the server.

**Not changed in this package.** Recommended separate package:
`JM-PROFILE-CAPACITY-02-LIMIT` with an explicit retention policy for existing
entries.

## E. Privacy and storage boundaries

| Layer | Content | Lifetime | Delete path |
|---|---|---|---|
| Browser CV/profile state | `File`, hash, selections, generated profile | until reload/remove | “CV data remove”/reload |
| Session CV lists | CV search + ATS entries per hash | 12h lazy TTL, no extension | reset/expiry/reload |
| Manual profiles | independent entries | until reload/auth change | delete/reload |
| Server CV profile cache | derived `SuggestedProfile` under `cv-profile:<hash>` | 30-day TTL | no client delete route (OPEN) |
| Future account storage | V1 resources via RIS | not implemented | not implemented |

The server cache is **not** user-profile persistence. No automatic guest→account
transfer exists or is specified as automatic.

## F. Open points (prioritized)

1. **Security/privacy:** authenticated browser login/logout flow is NOT
   VERIFIED; server cache has no client delete path; no complete erasure claim.
2. **Product capacity:** 2 CV search profiles per CV not enforced; manual limit
   OPEN.
3. **Persistence:** stable server IDs, ownership, parent-chain authorization,
   atomic capacities, versioning, idempotency, pagination, error contract,
   deletion/retention and explicit storage consent are all still required.
4. **Testing:** browser overlay with seeded CV, full guest PDF workflow in
   Firefox/WebKit, and live authenticated E2E.
5. **ATS:** distinct ATS target-role editor does not exist; distinct-role
   override is proven only by unit test.

## G. Next development packages

1. `JM-PROFILE-CAPACITY-02` — enforce 2 CV search profiles with an explicit
   existing-entry policy and UI messaging.
2. `JM-PROFILE-CACHE-DELETE-03` — decide and implement deletion/retention for
   `cv-profile:<hash>`.
3. `RIS-PROFILE-FOUNDATION-04` — RIS evidence package (routes, ownership,
   DynamoDB access, conditional writes, erasure). Blocked on RIS scope.
4. `JM-PROFILE-REMOTE-ADAPTER-05` — only after the RIS contract is verified.
5. `JM-PROFILE-MIGRATION-06` — explicit, previewed, idempotent guest→account
   save.
6. `JM-AUTH-E2E-07` — authenticated browser matrix.
7. `JM-ATS-ROLE-EDITOR-08` — optional product decision for a distinct ATS role
   editor.

## H. Tests, Git and evidence

Freshly executed on baseline `c6137b3`:

| Check | Result |
|---|---|
| `npm test -- --run` | PASS — 93 files passed, 3 skipped; 967 tests passed, 5 skipped |
| `npx tsc --noEmit -p tsconfig.app.json` | PASS |
| `npm run build` | PASS |
| `git diff --check` | PASS |
| `npm run test:e2e:guest-cv` | PASS — Chromium 1440 and 390 |
| Authenticated browser flow | NOT VERIFIED |
| RIS / remote persistence | NOT IMPLEMENTED / NOT VERIFIED |
| Production deployment | NOT DEPLOYED |

Browser E2E evidence: exactly one `/api/profile` after consent, exactly one
`/api/jobs`, zero `/api/match`, ATS skills override, parent city/radius/
employment retained, no login redirect, no console errors, no overflow.
Backends are mocked; this is not a live-provider E2E.

Key test files:

- `src/lib/profiles/sessionRepositories.test.ts`
- `src/lib/profiles/profileMappers.test.ts`
- `src/lib/profiles/profileValidation.test.ts`
- `src/lib/authIdentity.test.ts`
- `src/ManualSearchProfiles.authRace.test.tsx`
- `src/ManualSearchProfiles.integration.test.tsx`
- `src/components/CvProfilesOverlay.test.tsx`
- `src/components/DashboardV2CvSection.test.tsx`
- `src/lib/cvSearchConfig.test.ts`
- `src/lib/pdfFixture.test.ts`
- `tests/e2e/guest-cv-workflow.mjs`

No product code was changed in this consolidation package. No RIS, AWS,
Cognito, API route, session capacity or ATS deletion semantics were changed.
