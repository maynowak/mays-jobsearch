# MAYS-UI-RELEASE-2.2.0 — Klassifizierung und Release

- Status: **RELEASE PREPARATION; FEATURE BRANCH NOT YET MERGED**
- Date: 2026-10-29
- Repository: `/home/dci-student/projects/Mays-Jobsearch`
- Branch: `feature/ui-orchestrator-s0`
- Preflight HEAD: `336f81e`
- Current implementation HEAD: `db49225`
- Version: `2.2.0`

## 1. Classification of the open local files

The working tree was inspected before staging. No `git add .`, reset, clean or
delete operation was used. The following table records the decision for every
open local file at release preparation.

| Path | Content / purpose | Use | Category | Decision |
|---|---|---|---|---|
| `src/components/SourcesInfo.test.tsx` | Default-language test expectation | Test regression | B | Committed in `d53d0e8` |
| `src/components/Imprint.test.tsx` | Test-only contact fixture expectation | Test regression | B | Committed in `d53d0e8` |
| `src/ProfileRoute.test.tsx` | `/profil` Dashboard-V2 auth-state regression | Test regression | B | Committed in `d53d0e8` |
| `vitest.config.ts` | Test-only `VITE_CONTACT_EMAIL` fixture | Reproducible tests | B | Committed in `d53d0e8`, typing fix `db49225` |
| `tests/inference_integrity.ts` | Manual context-inference checks | Manual test, not Vitest-discovered | B | Committed in `d53d0e8`; remains explicitly manual |
| `docs/reports/01-01-AUTH-CALLBACK-DIAGNOSIS-01-EXECUTION_LOG.md` | Auth callback execution log | Project history | C | Committed in `0972cba` |
| `docs/reports/01-01-GIT-LOCAL-CHANGES-AUDIT-EXECUTION_LOG.md` | Local-change audit | Project governance | C | Committed in `0972cba` |
| `docs/reports/01-01-PROFILE-RELEASE-01-EXECUTION_LOG.md` | Earlier profile release evidence | Project history | C | Committed in `0972cba` |
| `docs/reports/01-01-PROFILE-ROUTING-FIX-01-EXECUTION_LOG.md` | Profile routing evidence | Project history | C | Committed in `0972cba` |
| `docs/reports/JOBMATCHER-RIS-COGNITO-INTEGRATION-01-EXECUTION_LOG.md` | Older Cognito/RIS integration log with infrastructure identifiers | Internal security/infrastructure history | F | Retained local; not staged or published |
| `docs/screenshotsfordev/AWS-CodeexampleCognito.md` | AWS/Cognito code and token examples | Sensitive reference material | F | Retained local; not staged or published |
| `main.tsx` | Duplicate/stale root entry; actual entry is `src/main.tsx` | Unused duplicate | E | Retained local; not published |
| `docs/mays_job_matcher_datenschutzerklaerung_1.0.txt` | Duplicate privacy draft containing responsible-person contact/address | Personal-data draft | F | Retained local; not staged or published |
| `privacy_content.txt` | Exact duplicate of the privacy draft | Personal-data duplicate | F | Retained local; not staged or published |
| `docs/mays_job_matcher_datenschutzprinzipien.txt` | Exact duplicate of tracked principles Markdown | Duplicate | E | Retained local; not published |
| `src/assets/images/Datenvielfalt-bgsicht.svg` | Unreferenced decorative SVG | Unused asset | E | Retained local; not published |
| `src/assets/images/Futuristische_Datenautobahn_im_Morgenlicht.png` | Unreferenced decorative image | Unused asset | E | Retained local; not published |
| `src/assets/images/Lupe.svg` | Unreferenced decorative SVG | Unused asset | E | Retained local; not published |

`src/i18n.tsx` was explicitly inspected as requested; it had no open working
tree diff at classification time and required no separate release commit.

No file was silently deleted or reset. F/E files remain available for a later
separately approved decision.

## 2. Release implementation

`776ea4a` promotes Dashboard-V2 to `/profil` using the existing
`DashboardV2AuthenticatedPreview`, `AuthProvider`, `signIn` and `signOut` path.
No demo user is passed to `/profil`. Existing CV state and workflow are passed
to the same dashboard CV section used by the DEV previews. The existing portal
and scroll-lock path is rendered for `/profil` workflow steps.

The DEV routes remain guarded by `isDevOnlyRoute` and are not available as demo
views in a production build. No new persistence, API, AWS, Cognito, RIS or DNS
configuration was introduced.

## 3. Test fixture and version checks

- `package.json` / `package-lock.json`: `2.2.0`.
- Test-only contact value is `test-contact@example.invalid` and is injected
  only when Vite runs in `mode === "test"`.
- Production build does not contain that fixture; production contact remains
  environment-driven.
- Release test command is reproducible without local contact env:

```text
env -u VITE_CONTACT_EMAIL npm test -- --run
```

Result: **842 passed | 5 skipped; 78 files passed | 3 skipped**.

Also passed:

- `env -u VITE_CONTACT_EMAIL npm run build`
- `env -u VITE_CONTACT_EMAIL node --check api/**/*.mjs`
- `git diff --check`

## 4. Verification boundaries

Mocked/automated checks prove the Dashboard-V2 route, auth-state mapping,
profile claims, CV upload/second upload, consent dialog, focus and scroll-lock
behavior. They do not prove a real Cognito session or production API processing.

The R2 Chromium browser evidence covered `/dev/dashboard-v2`, CV processing
dialog, cancel/scroll restoration, 390/1440 px and `/search` scroll regression.
Firefox could not launch in the environment and remains **NOT VERIFIED**.

The actual `/profil` production route requires post-merge deployment checks for
DE/EN, authenticated claims, logout, CV flow and absence of demo data. Until
those checks run against the deployed artifact, production is not claimed as
verified.

## 5. Release commits before main integration

- `d53d0e8` — `test: make release checks environment independent`
- `0972cba` — `docs: preserve reviewed release execution logs`
- `776ea4a` — `feat: promote dashboard v2 to profile route`
- `db49225` — `fix: type test-only Vite definitions`

Feature branch remains intentionally retained. Main integration and Vercel
publication are the next release gates.
