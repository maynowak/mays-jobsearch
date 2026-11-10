# DESIGN-PROFILE-UX-CONSOLIDATION-01 — FINAL POLISH

**Status:** `DESIGN-PROFILE-UX-CONSOLIDATION-01 — FINAL POLISH VERIFIED LOCAL`
**Branch:** `design/jm-ris-profile-ux-final-polish-01`
**Base:** `3fb65bb`
**Commit:** `389eb36`

## Changes

### One profile hierarchy

- CV search profiles remain the primary cards.
- Associated ATS profiles are now nested and expandable directly under each
  CV search profile via `aria-expanded` / `aria-controls`.
- The former separate ATS list with repeated empty states is removed.
- ATS creation can be started per CV search profile; the parent ID is fixed by
  that action and still sent to RIS as the real parent ID.
- Empty ATS state appears once per expanded parent.

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

### Status boundary

- PDF state, profile presence and processing status remain separate.
- No completed CV-processing claim is made without proof.
- Profile counts still come only from RIS for durable cards.

## Screenshots

Assets: `docs/reports/assets/DESIGN-PROFILE-UX-CONSOLIDATION-01-FINAL/`

- After: `hierarchy-{320,390,430,768,1024,1440}.png`
- Before reference: `before-profiles-{390,1024}.png`

No horizontal overflow at any tested width. ATS cards expand below the correct
CV profile; long skills wrap as chips.

## Tests

| Check | Result |
| --- | --- |
| Focused profile/skill tests | **4 passed** |
| Full suite, serial | **1678 passed**, 5 skipped |
| Production build | **PASS** |
| Screenshot overflow | **none** |
| Diff/secret audit | **clean** |

## Open points

- Authenticated live RIS E2E remains deployment-time; no approved synthetic
  account was used here.
- No push, merge or deployment.
- No RIS/AWS/Terraform/Cognito change and no real user/CV data.

## Recommendation

**GO for PR review.**  
**NO-GO for production** until PR checks and authenticated synthetic RIS
read/write/reload verification pass.
