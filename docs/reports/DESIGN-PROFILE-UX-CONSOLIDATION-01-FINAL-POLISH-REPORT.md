# DESIGN-PROFILE-UX-CONSOLIDATION-01 — FINAL POLISH

**Status:** `DESIGN-PROFILE-UX-CONSOLIDATION-01 — FINAL POLISH VERIFIED LOCAL / MERGED TO MAIN`
**Branch:** `main` (merged from `design/jm-ris-profile-ux-final-polish-01`)
**Base:** `3fb65bb`
**Commits:** `389eb36` (persistent profiles), `14b4597` (session profiles), `1cd0eae` (main merge), `8ff4c4b` (portal fix + browser E2E)

## Changes

### One profile hierarchy

- CV search profiles remain the primary cards.
- Associated ATS profiles are now nested and expandable directly under each
  CV search profile via `aria-expanded` / `aria-controls`.
- The former separate ATS list with repeated empty states is removed.
- ATS creation can be started per CV search profile; the parent ID is fixed by
  that action and still sent to RIS as the real parent ID.
- Empty ATS state appears once per expanded parent.
- The read-only session profile overlay now uses the same hierarchy: ATS
  profiles are nested under their search profile instead of a separate table.

### Duplicate names

- Duplicate CV search profile names and duplicate ATS names under the same
  parent show an explicit warning.
- Saving is not blocked or silently rewritten: the existing API creates a new
  record with its own stable ID.
- No automatic rename, overwrite or deletion.
- ATS assignment remains ID-based.

### Skills

- New reusable `SkillChips` component renders skills as chips.
- Long lists show a bounded number and offer **Weitere anzeigen** /
  **Weniger anzeigen**.
- Display-only quote cleanup handles straight/typographic quotation marks.
- Stored strings, order and duplicates are not modified.

### Design / accessibility

- Consistent card spacing, active selection, buttons and warning styles.
- Expandable ATS sections have visible focus and 44px actions.
- Profile forms remain hidden until the explicit create/edit action.
- May help remains collapsed by default; contextual profile hints remain.
- No new UI library or API.
- Both profile overlays render through a React portal into `document.body`. This
  fixes the fixed-position modal being clipped by the CV section `backdrop-filter`.

### Status boundary

- PDF state, profile presence and processing status remain separate.
- No completed CV-processing claim is made without proof.
- Profile counts still come only from RIS for durable cards.

## Screenshots

Assets: `docs/reports/assets/DESIGN-PROFILE-UX-CONSOLIDATION-01-FINAL/` and `docs/reports/assets/DESIGN-PROFILE-UX-CONSOLIDATION-01-FINAL-E2E/`

- Component hierarchy: `hierarchy-{320,390,430,768,1024,1440}.png`
- Browser E2E: `profile-hierarchy-{320,390,430,768,1024,1440}.png`
- Before reference: `before-profiles-{390,1024}.png`

No horizontal overflow at any tested width. ATS cards expand below the correct
CV profile; long skills wrap as chips.

## Tests

| Check | Result |
| --- | --- |
| Focused profile/skill/App tests | **104 passed** |
| Full suite, serial | **1678 passed**, 5 skipped |
| Production build | **PASS** |
| Browser E2E, synthetic session + mocked RIS | **PASS** |
| Browser E2E widths 320/390/430/768/1024/1440 | **no overflow**, 44px toggle |
| Real RIS/Cognito calls during E2E | **none** |
| Diff/secret audit | **clean** |

## Browser E2E

Script: `tests/e2e/profile-ux-final-polish.mjs`  
Command: `npm run test:e2e:profile-ux-final`

The test uses a synthetic OIDC session and mocked `/api/ris/*` responses. It
verifies two distinct same-named CV cards, bounded skill chips with show
more/less, CV and ATS duplicate-name warnings, nested ATS expansion, one empty
ATS state per parent, and responsive rendering at 320–1440 px. No real RIS,
Cognito, AWS or user data is touched.

## Open points

- Authenticated live RIS E2E remains open: no approved synthetic account was
  available, so no real `createCv`/`createAts`/reload run is claimed.
- `main` was pushed on explicit operator request. No production deployment was
  performed in this step.
- No RIS/AWS/Terraform/Cognito change and no real user/CV data.

## Recommendation

**GO for PR review.**  
**NO-GO for production** until PR checks and authenticated synthetic RIS
read/write/reload verification pass.
