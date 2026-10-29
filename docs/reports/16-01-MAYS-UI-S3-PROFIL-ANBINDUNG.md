# MAYS-UI-S3 — Profil an Dashboard-V2 anbinden

- Status: COMPLETE; COMMIT PENDING
- Date: 2026-10-29
- Branch: `feature/ui-orchestrator-s0`
- Preflight HEAD: `9d9262c` (S2 evidence commit)
- S2 report: `docs/reports/15-01-MAYS-UI-S2-AURORA-DASHBOARD.md`

## Durable evidence

The S2 comparison screenshots were copied from `/tmp/opencode/mays-ui-s2/` to
the committed evidence directory:

`docs/evidence/mays-ui-s2/`

They contain only fixed demo values (`dev@example.com`, `dev-demo-user-123`,
`Dev Demo User`) and no real user data. Twelve old/new DE/EN screenshots are
stored at 390, 768 and 1440 pixels.

## Shared Dashboard-V2 rendering

`DashboardV2` is now presentational and accepts:

- `user: DashboardUser` with optional `sub`, `email`, `name`
- `isDemo: boolean`
- optional `onLogout`

Demo route `/dev/dashboard-v2` still passes the fixed S2 demo user and remains
clearly marked with the translated DEV/demo note. The authenticated rendering
uses the same cards, navigation, status and feature layout with supplied
profile claims. Missing attributes render the neutral `-` marker; long values
use the existing `overflow-wrap` rule.

## Authenticated DEV route

Added `/dev/dashboard-v2-auth`, protected by `import.meta.env.DEV` through the
existing `isDevOnlyRoute()` helper.

The wrapper uses the existing `AuthProvider` context and `auth.user.profile`:

- loading → translated loading status
- auth error → translated alert and existing `signIn(auth)` helper
- signed out → translated login prompt and existing `signIn(auth)` helper
- signed in → profile claims and existing `signOut(auth)` helper

No second session state, token storage, mock injection into OIDC, or API call
was added. Navbar and Footer are each rendered exactly once by the route.

`/profil` remains unchanged and still renders the existing Dashboard branch.

## Verification

- Focused S3 tests: PASS — 9 tests.
- Full suite: PASS — 836 passed, 5 skipped; 77 files passed, 3 skipped.
- `npm run build`: PASS; existing Vite large-chunk warning only.
- `node --check api/**/*.mjs`: PASS.
- `git diff --check`: PASS.
- Controlled auth mocks cover loading, error, signed-out login and signed-in
  claims/logout handler paths.
- Dev browser `/dev/dashboard-v2-auth`: DE/EN at 390, 768 and 1440 pixels;
  no overflow, no raw keys, signed-out state rendered, one Navbar and one
  Footer.
- Production Vite preview: `/dev/dashboard-v2` and `/dev/dashboard-v2-auth`
  expose no demo/auth preview (`.dashboard-v2` and state view absent).
- No API behavior was claimed; Vite preview serves frontend only.
- Real Cognito browser E2E with an authenticated session: **NOT VERIFIED**;
  no real credentials/session were available. Mock results are not presented
  as Cognito logout proof.

## Technical S4 acceptance before `/profil` replacement

The S2 old/new comparison is now durable and ready for selection. Technical
checks for a possible S4 migration are GREEN for the preview: shared UI
components, DE/EN, responsive layout, route protection, auth-state mapping,
focus handling, missing claims and no API/data-flow changes.

Recommendation: **Dashboard-V2 is the candidate for S4**, but `/profil` must
remain unchanged until an explicit visual/product selection is made from the
comparison evidence. The real Cognito E2E remains an acceptance limitation,
not a reason to expose the route in production.

## Scope

- No AWS, Cognito, RIS, DNS, deployment or push.
- Existing user changes in `src/i18n.tsx`, `src/components/SourcesInfo.test.tsx`
  and unrelated untracked files remain untouched and unstaged.
