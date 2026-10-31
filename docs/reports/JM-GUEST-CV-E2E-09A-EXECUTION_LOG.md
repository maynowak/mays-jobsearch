# JM-GUEST-CV-E2E-09A — Execution Log

## Status

- **Overall:** VERIFIED — strengthened browser evidence
- **GUEST CV WORKFLOW:** VERIFIED (mocked backend, 1440/390)
- **ATS SKILLS OVERRIDE:** VERIFIED in browser
- **ATS DISTINCT TARGET ROLE:** NOT VERIFIED in browser — no UI to set a
  different ATS role; proven by unit test only
- **PARENT FILTER PROPAGATION:** VERIFIED in browser (city, radius, employment)
- **AUTHENTICATED BROWSER FLOW:** NOT VERIFIED
- **REMOTE RIS PERSISTENCE:** NOT IMPLEMENTED
- **PRODUCTION DEPLOYMENT:** NOT DEPLOYED
- **Baseline:** `a47a957` (`main`, `origin/main` synchronized)

## Change

`tests/e2e/guest-cv-workflow.mjs` now configures the parent CV search profile
with a deliberately smaller skill set than the ATS variant:

- parent: `Java, AWS`
- parent target role: `Platform Engineer`
- parent radius: `50 km`
- parent city: `Frankfurt`
- ATS variant: selected CV skills `Java, AWS, Terraform, Docker`

The browser test then asserts the real `/api/jobs` query:

- `skills` contains `Terraform` and `Docker` → ATS skills override is applied;
- `skills` still contains `Java` and `AWS` → selected ATS skills are complete;
- `targetRole=Platform Engineer` → ATS inherits the parent role (the workflow
  has no separate ATS role editor);
- `city=Frankfurt`, `radiusKm=50`, `employmentType=full_time` → parent filters
  are retained.

## Evidence split

| Property | Browser E2E | Unit/integration |
|---|---|---|
| ATS skills override parent skills | VERIFIED | existing `cvSearchConfig` tests |
| ATS distinct target role override | NOT VERIFIED (no UI path) | VERIFIED in `src/lib/cvSearchConfig.test.ts` (parent `Cloud Engineer`, ATS `DevOps Engineer`) |
| Parent city/radius/employment retained | VERIFIED | existing tests |
| Consent before profile request | VERIFIED | existing App tests |
| PDF text extraction | VERIFIED (request body contains fixture text) | `pdfFixture.test.ts` |
| Exactly one job search, no match call | VERIFIED | existing App tests |
| No login required | VERIFIED | guest App tests |

No product function was added to edit a separate ATS target role. The browser
test documents that limitation instead of inventing UI.

## Validation

| Check | Result |
|---|---|
| `node tests/e2e/guest-cv-workflow.mjs` (1440/390) | VERIFIED — PASS |
| Full `npm test -- --run` | VERIFIED — 967 passed, 5 skipped; 93 passed, 3 skipped files |
| `npx tsc --noEmit -p tsconfig.app.json` | VERIFIED — PASS |
| `npm run build` | VERIFIED — PASS |
| `git diff --check` | VERIFIED — PASS |
| Authenticated browser flow | NOT VERIFIED |

The E2E uses the existing synthetic PDF fixture and mocked `/api/models`,
`/api/profile`, `/api/jobs`; `/api/match` remains counted and must stay at 0.
Screenshots are updated under
`docs/reports/assets/JM-GUEST-CV-E2E-09/`.

## Files changed

- `tests/e2e/guest-cv-workflow.mjs`
- updated screenshots
- this report
- `docs/AI_AUDITLOG.md`

No RIS, AWS, Cognito, API route, persistence or production change.

## Git

- Implementation commit: `da5ef76`
- Remote: pushed to `origin/main`, synchronized (`0 0`)
- No production deployment was performed.
