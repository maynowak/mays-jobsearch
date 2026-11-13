# CV-BUILDER-03B-REVIEW-INTEGRITY-01

**Status:** `CV-BUILDER-03B — REVIEW INTEGRITY VERIFIED / READY FOR MAIN REVIEW`
**Date:** 2026-11-12
**Branch:** `feature/cv-builder-03b-real-world-import-quality`
**Starting HEAD:** `ebf896f`
**Integrity code HEAD:** `0eefecc`
**Main:** `a0dc1ec`
**Decision:** **STOP before main integration and production release.**

## 1. Idempotent review application

Each review item now carries a separate `applied` flag in addition to its
decision `status`.

- `accepted` means the user accepted the item decision.
- `applied` means the item was actually written into the draft.
- A successful apply sets both.
- The apply button changes to **„Bereits übernommen“** and is disabled.
- Duplicate detection covers experience, education, skills, projects and
  certificates.
- Editing an item's text resets `applied` and records `edited`.
- Invalid/incomplete experience, education and link mappings return an error
  without changing the draft or claiming success.
- The item remains in the backlog and can be corrected and retried.

Unit coverage:

- repeated skill/project/certificate apply;
- repeated experience/education apply;
- edited-after-applied state reset;
- invalid experience/education/link;
- complete experience/education split.

## 2. Session/profile review isolation

Added a session-only `CvBuilderImportReviewStore` mapping `cvId → quality
report` inside `App`. It is never persisted.

Lifecycle behavior:

- saving a new imported CV stores the report under the created profile;
- saving an existing profile updates its report;
- reopening a profile restores its own report;
- switching profiles restores the matching report;
- duplicating a profile copies its report;
- deleting a profile removes its report;
- logout/identity reset clears the entire store;
- a returned full-page editor report is stored with the returned profile.

No `CvBuilderDraftV1` or `CvBuilderProfileV1` schema field was added. No
`localStorage` or RIS persistence was introduced.

Store unit coverage verifies isolation between two profile IDs, deletion of
one profile, and session clear.

## 3. Status semantics and failure handling

The editor backlog now distinguishes:

- decision status: `pending`, `accepted`, `ignored`;
- actual application: `applied`.

The UI cannot show “success” merely because an item is marked accepted.
Invalid mappings produce a visible alert and preserve the item text. A failed
apply does not mark the item applied.

Required edit shapes for explicit backlog application:

- experience: position + employer separated by `|`, `–` or `—`;
- education: degree + institution separated by `|`, `–` or `—`;
- links: valid `http(s)` URL.

## 4. Regression

| Check | Result |
|---|---|
| Focused tests | **116 PASS** |
| Serial full suite | **1806 PASS / 5 skipped** |
| TypeScript / production build | **PASS** |
| 03A full-page/handoff E2E | **PASS** |
| 03B 71-skill/review E2E | **PASS** |
| 02A–02F/PDF E2E | **PASS** |
| PDF export real download | **PASS** |
| Screenshot 320–1920 px | **PASS**, 0 overflow |
| `git diff --check` | **PASS** |
| Secret/privacy scan | **PASS** |

The 03B E2E still verifies 71 candidates, 58 selected, skill preservation,
review backlog, applied return and no RIS/non-GET writes.

## 5. Privacy and boundaries

- No private PDFs or contact data committed.
- Review store is session-only and memory-only.
- No localStorage persistence, external AI/OCR call, RIS write, consent change
  or AWS/Cognito/Terraform change.
- Existing handoff origin/window/UUID/schema, timeout, conflict and identity
  checks remain intact.
- Authenticated logout/user-switch remains a test-identity boundary inherited
  from 03A; the store has explicit identity-reset cleanup.

## 6. Git

- Integrity code/tests: `0eefecc`
- Documentation commit follows on the same feature branch.
- No main merge, no production deployment, no force-push, no history rewrite.
- Automatic Vercel preview builds remain enabled.

## 7. Known limits

- Review reports are session-only; reloading the page does not restore them by
  design.
- The profile-store lifecycle is unit-covered at store level; a full interactive
  authenticated multi-profile browser flow remains a UI verification boundary.
- Complex two-column PDFs still depend on PDF.js reading order.
- No production deployment was performed.

**STOP before main integration and production release.**
