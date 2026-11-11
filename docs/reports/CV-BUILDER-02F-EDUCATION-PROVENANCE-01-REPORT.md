# CV-BUILDER-02F-EDUCATION-PROVENANCE-01

**Status:** `CV-BUILDER-02F — EDUCATION PROVENANCE VERIFIED / READY FOR MAIN RELEASE`
**Date:** 2026-11-11
**Feature:** `feature/cv-builder-02f-correction-01`
**Code-HEAD:** `c67883a`
**Main / origin/main:** `e894229`
**Production:** `e894229` — unchanged
**Decision:** **STOP before main integration / production release.**

## 1. Reproduced defect

`parseEducation()` previously found one institution in a multi-qualification
block and assigned that same institution to every degree entry:

```ts
const institution = lines.find((line) => educationInstitutionLike(line)) ?? "";
```

The existing regression test explicitly expected both the Bachelor and the
vocational qualification to receive `Hochschule Darmstadt, Germany`. That test
confirmed the defect instead of proving provenance. It has been corrected.

## 2. Correction

- Each degree is assigned an institution only when the block provides evidence
  for that association.
- A single institution before all degree lines is treated as an explicitly
  shared institution.
- An institution between degrees is assigned to its nearest degree; when the
  distance is tied, only one degree receives it and the other remains empty.
- With multiple institutions, each institution is assigned to a distinct,
  nearest degree; no institution is copied to an unrelated entry.
- Missing institutions remain empty and set `uncertain.education = true`.
- Descriptions exclude all recognized degree and institution lines.
- One qualification period is attached only to the nearest degree. A tied
  period is not copied; it remains empty and reviewable.
- No degree, institution or date is invented.

Focused fixtures cover:

1. Bachelor with its institution.
2. Vocational qualification without institution.
3. Two qualifications with different institutions.
4. Two qualifications with an explicitly shared institution.
5. Training without a degree.
6. Unclear education block.

## 3. Private reference acceptance

The private three-page reference was re-parsed locally; no private file or
contact data was written to the repository.

| Entry | Institution | Degree | Start/End |
|---|---|---|---|
| Bachelor | `Hochschule Darmstadt, Germany` | `Bachelor of Science (B.Sc.) – Computer Science` | empty |
| Vocational qualification | **empty** | `Industrial Mechanic – Vocational Qualification` | empty |
| Additional AWS training | `ADDITIONAL AWS HANDS-ON PRACTICE` | **empty** | empty |

The vocational institution is no longer inferred from the adjacent Bachelor
institution. `uncertain.education` is `true` for the private import.

Regression of unchanged areas:

- Personal fields: 4/4 present.
- Experience: 5 field-correct entries.
- Skills: 71 candidates, 0 preselected.
- Project technologies: 7 / 4 / 5, block-local.
- Review: 34 items preserved
  (8 training, 14 incomplete experience, 5 project reference, 2 document notes,
  2 ambiguous, 3 certification goals).
- Certification goals: 3 in review, 0 acquired.
- Editor/preview scroll: independent.
- Private PDF export: 3 pages, real download (from the preceding acceptance).

## 4. Verification

| Check | Result |
|---|---|
| Parser test file | **42 PASS** |
| Focused parser/structure/editor tests | **71 PASS** |
| Serial full suite | **1777 PASS / 5 skipped** |
| Production build | **PASS** |
| 02B / 02C / 02D / PDF-Fix-01 / 02E E2E | **PASS** |
| `git diff --check` | **PASS** |
| Secret/privacy scan of diff | **PASS**; no private PDF, contact data or secret |
| Private reference parse | **PASS** |

No RIS/AWS/Cognito/Terraform/consent change. No PDF upload or RIS write.

## 5. Git evidence

At review start GitHub reported **4 ahead / 0 behind / 7 changed files**.

| Point | Left/right vs origin/main | Changed files |
|---|---:|---:|
| Before provenance correction (`45bebe6`) | 4 ahead / 0 behind | 7 |
| After code commit `c67883a` | 5 ahead / 0 behind | 7 |
| After this documentation commit | 6 ahead / 0 behind | 8 |

`origin/main` remains `e894229`; the feature branch remains fast-forwardable.
The documentation commit contains this report and the audit entry; it does not
change product code.

## 6. Remaining boundaries

- Missing institutions are intentionally empty; the user must complete them.
- The AWS training entry has no degree and is not represented as a university
  degree or employment.
- 34 review items remain for training, incomplete experience/project
  references, document notes, ambiguity and certification goals.
- Two-column PDFs remain bounded by PDF.js reading order.
- No merge, no production deployment, no force-push.

**GO for separate main-release approval.**
**NO-GO for merge or production without explicit approval.**
