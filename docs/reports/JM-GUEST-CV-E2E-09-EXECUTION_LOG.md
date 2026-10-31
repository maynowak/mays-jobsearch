# JM-GUEST-CV-E2E-09 — Execution Log

## Status

- **GUEST CV WORKFLOW:** VERIFIED — mocked-backend Chromium E2E (1440/390)
- **SYNTHETIC PDF EXTRACTION:** VERIFIED — fixture + pdfjs unit test
- **CONSENT BOUNDARY:** VERIFIED — no profile request before consent
- **ATS UNASSIGNED RECOVERY:** VERIFIED via repository/UI tests; browser overlay with seeded CV **NOT VERIFIED**
- **AUTHENTICATED BROWSER FLOW:** NOT VERIFIED
- **REMOTE RIS PERSISTENCE:** NOT IMPLEMENTED
- **PRODUCTION DEPLOYMENT:** NOT DEPLOYED
- **Baseline:** `65b184d` (`main`, `origin/main` synchronized)

## Test infrastructure

- New synthetic, text-based PDF:
  - `tests/fixtures/cv/synthetic-cv.pdf`
  - source: `synthetic-cv.ps`
  - generator: `tests/fixtures/cv/generate.sh`
  - content: synthetic title, role, experience, skills and location only.
- New extraction test: `src/lib/pdfFixture.test.ts` (pdfjs legacy build) verifies
  the text is actually extractable and contains no email/phone-like data.
- New standalone browser E2E: `tests/e2e/guest-cv-workflow.mjs`.
  - starts Vite on port 5199 and stops it afterwards,
  - intercepts `/api/models`, `/api/profile`, `/api/jobs`, `/api/match`,
  - no real provider or production CV endpoint is contacted,
  - writes screenshots to `docs/reports/assets/JM-GUEST-CV-E2E-09/`.
- `package.json`: `npm run test:e2e:guest-cv`.

## Browser flow actually executed

Both Chromium 1440×900 and 390×844:

1. Guest opens `/search` (no login).
2. Opens the CV tab and uploads the synthetic PDF.
3. Consent dialog appears; **0 profile requests** before consent.
4. Accepts consent, selects anonymization, continues.
5. Selects the mocked model, starts generation.
6. Exactly **1** `/api/profile` request; captured body contains
   `Synthetic Test CV` and `Terraform`, proving real PDF text extraction.
7. Saves the CV search profile.
8. Executes the ATS goal and saves an ATS variant.
9. Selects search profile + ATS variant and starts the job search.
10. Exactly **1** `/api/jobs` request; **0** `/api/match` requests.
11. Request contains ATS skills (`Java`, `Terraform`), ATS target role
    (`Cloud Engineer`) and the parent city (`Frankfurt`).
12. No login redirect, no console errors, no horizontal overflow.

Mocked endpoints:

- `GET /api/models` → deterministic single model
- `POST /api/profile` → deterministic suggested profile
- `GET /api/jobs` → one synthetic job
- `POST /api/match` → deliberately not expected; counted and failed if called

## ATS unassigned recovery

- Repository tests verify: parent deletion retains children, `listUnassigned`,
  valid reassignment with stable ID/content, foreign hash/target/full parent/
  already-assigned rejection, old generation rejection.
- Overlay tests verify the unassigned section, successful assignment, capacity
  error, missing-parent hint and disabled action when no callback exists.
- Dashboard parity is covered by `DashboardV2CvSection.test.tsx`.
- **Browser verification with a seeded CV session is NOT VERIFIED**: the app has
  no delete-parent UI and no test-data injection into production routes was
  added. This is intentionally covered by integration/UI tests instead.

## Capacity note

Documented product target remains 10 CVs / 2 search profiles per CV / 5 ATS per
search profile. The current session store still allows up to 50 CV search
profiles per hash bucket; the 2-profile target is not implemented and was not
changed here.

## Regression notes

- Guest CV tab and upload are available without authentication.
- Two-CV isolation, hash separation, TTL and session generation remain covered
  by existing tests and unchanged.
- No automatic login, profile migration, job search or model call is triggered
  by profile assignment.
- ATS override semantics are asserted in the browser request and existing
  `cvSearchConfig` tests.

## Validation

| Check | Result |
|---|---|
| `node tests/e2e/guest-cv-workflow.mjs` (1440/390) | VERIFIED — PASS |
| PDF fixture extraction test | VERIFIED — PASS |
| Unassigned/overlay/dashboard tests | VERIFIED — PASS |
| Full `npm test -- --run` | VERIFIED — 967 passed, 5 skipped; 93 passed, 3 skipped files |
| `npx tsc --noEmit -p tsconfig.app.json` | VERIFIED — PASS |
| `npm run build` | VERIFIED — PASS |
| `git diff --check` | VERIFIED — PASS |
| Authenticated browser flow | NOT VERIFIED |
| Live model/job provider | NOT VERIFIED — intentionally mocked |

Note: running the browser E2E in parallel with the full unit suite can cause
timing flakiness; run them sequentially.

## Privacy boundaries

- The PDF contains only synthetic data.
- The browser E2E uses mocked backends; it is not a live-provider E2E.
- No real credentials, CVs or user data were used.
- Screenshots contain only the synthetic flow.

## Files changed

- `tests/fixtures/cv/synthetic-cv.pdf`, `synthetic-cv.ps`, `generate.sh`, `README.md`
- `tests/e2e/guest-cv-workflow.mjs`
- `src/lib/pdfFixture.test.ts`
- `src/components/CvProfilesOverlay.tsx`
- `src/components/CvProfilesOverlay.test.tsx`
- `package.json`
- `docs/reports/assets/JM-GUEST-CV-E2E-09/*.png`
- this report
- `docs/AI_AUDITLOG.md`

## Git

- Implementation commit: `68cbc44`
- Remote: pushed to `origin/main`, synchronized (`0 0`)
- No production deployment was performed.
