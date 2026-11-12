# CV-BUILDER-03B-REAL-WORLD-IMPORT-QUALITY-01

**Status:** `CV-BUILDER-03B — IMPORT QUALITY IMPROVED / REVIEW PRESERVED / VERIFIED LOCAL / READY FOR MAIN REVIEW`
**Date:** 2026-11-12
**Branch:** `feature/cv-builder-03b-real-world-import-quality`
**Code HEAD:** `6c2572c`
**Main baseline:** `a0dc1ec`
**Decision:** **STOP before main integration and production release.**

## 1. Baseline and reproduction

Local private references were used only for count-only manual measurement; no
private PDF, raw text, contact data, screenshots or exports were committed.
The ATS reference and two-column reference were parsed before and after the
changes.

| Reference | Experience | Projects | Education | Skills | Review |
|---|---:|---:|---:|---:|---:|
| ATS before | 0 | 3 | 1 | 58 | 44 |
| ATS after | **8** | 3 | 1 | 58 | **18** |
| Two-column before | 5 | 3 | 3 | 71 | 34 |
| Two-column after | **5** | 3 | 3 | 71 | 34 |

ATS personal fields improved from incomplete to **4/4 present**. The
two-column reference remains stable; its existing review reasons are preserved.

## 2. Agent findings

Read-only analyses were performed for:

- parser/document structure and experience timeline;
- education/contact provenance;
- review/skills/quality UX and handoff;
- tests and regression gaps.

The main confirmed gaps were:

- page headers without a page number became sections and swallowed contact
  and experience blocks;
- month-name and date-last station formats were not segmented;
- education lines could be used as both degree and institution;
- review decisions were reduced to counts on apply;
- large skill sets could be checked with zero selected skills and no warning;
- the return action did not activate the source window after an applied result.

## 3. Experience parsing

Implemented safe rules for:

- month-name ranges (`Januar 2020 – Dezember 2021`);
- single month/year station dates (`03/2021`);
- date-last headers (`Position | Employer | 03/2021`);
- date-first multi-line headers (`date → Position → Employer`);
- station separation when a header is followed by a date;
- filtering the section heading out of the timeline;
- broader freelance and role vocabulary;
- avoiding the project classification for `Projektmanager`/`Projektleiter`;
- preserving incomplete entries in review rather than inventing fields.

The ATS reference now produces eight structured experience entries; remaining
incomplete/partial entries are retained in the review list. No employer or
position is fabricated.

## 4. Education and provenance

- A single line containing degree + institution is split into separate fields
  when the institution is recognizable.
- Institution abbreviations such as TU/RWTH/KIT/ETH/FH/HS/DHBW are recognized.
- Additional degree forms (`B.Eng`, `M.Eng`, `Dipl.-Ing`, `Realschulabschluss`,
  etc.) are recognized conservatively.
- Missing fields remain empty or uncertain; existing 02F institution
  provenance and period-isolation rules remain intact.
- Certification goals remain `in preparation`/planned and are not converted to
  acquired certificates.

## 5. Personal fields

- Repeated profile headers with `•`, `|`, `·` or page markers are treated as
  page furniture, not sections.
- All-caps role lines no longer create unknown sections.
- Phone detection rejects birth dates and year ranges.
- Location handles `·` and comma+phone contact lines.
- Academic titles are stripped from name candidates; comma/digit names are
  rejected.
- Contact data is never inferred from unrelated sections.

The ATS reference now fills all four personal fields.

## 6. Review preservation

The import result is now converted into a session-only quality report:

- stable item id, original/corrected text, page, section, suggested target,
  reason and pending/accepted/ignored status;
- total/pending/accepted/ignored counts;
- selected skill count and total;
- page count, source name and selected sections.

No field was added to `CvBuilderDraftV1` or the profile schema. The editor shows
**„Importprüfung fortsetzen“** with filters, text editing, target/status
selection and explicit **„In Lebenslauf übernehmen“**. Pending and ignored
items are not silently inserted. The report survives import → full-page
editor → source return through the existing handoff payload.

## 7. Skills and quality UX

- Large skill lists still default to **0 selected** as a protection.
- The UI now shows the selected/total count in the section header.
- A zero-selection warning explains that no skills will be imported.
- Added filtered select/clear actions while preserving all/clear/reset.
- Large-list behavior remains performant and selection survives the handoff.
- The summary warns when no experience or no skills are included.

## 8. Quality summary

The existing overview now reports actual parsed counts; the review count and
per-item reasons remain visible. The editor shows the report counts, selected
skills and the review backlog. Numbers come from the current import, not from
static constants.

## 9. Return behavior

The full-page action is now:

**„Änderungen übernehmen & zurück“**

It transfers the draft, waits for `applied`, only then shows success, attempts
to focus the source window, and keeps the workspace/data on conflict, timeout
or unreachable opener. Existing handoff safety checks are unchanged.

## 10. Tests and E2E

| Check | Result |
|---|---|
| Focused tests | **112 PASS** |
| Serial full suite | **1800 PASS / 5 skipped** |
| TypeScript / production build | **PASS** |
| Existing 02A–02F/PDF E2E | **PASS** |
| 03A full-page/handoff E2E | **PASS** |
| New 03B 71-skill/review handoff E2E | **PASS** |
| Screenshot 320–1920 px | **PASS**, 0 px overflow |
| Real PDF download | **PASS** |
| `git diff --check` | **PASS** |
| Secret/privacy scan | **PASS** |

The 03B E2E verifies:

- 71 recognized skills, 0 initially selected and zero warning;
- selecting 58, handoff with 58 preserved;
- apply to editor, 58 skills retained;
- individual review backlog visible;
- return to source with backlog and 58 skills preserved;
- only `GET /api/models`, no RIS/non-GET writes.

## 11. Privacy and session isolation

- Private references remain local only; no content or screenshots committed.
- No external AI/OCR call for PDF analysis.
- Review report is session-only and is not written to RIS or localStorage.
- Identity reset clears the native CV state and quality report; existing
  handoff identity/session checks remain active.
- No RIS/AWS/Cognito/Terraform/consent change.
- No new persistence.

## 12. Git

- Code/test commit: `6c2572c`
- Documentation commit follows on the same feature branch.
- No main merge, no production deployment, no force-push, no history rewrite.
- Automatic Vercel preview builds remain enabled.

## 13. Known limits

- Two-column extraction still depends on PDF.js reading order; the local
  two-column reference remains stable at 5/3/3/71/34, but complex same-row
  layouts may still need review.
- Review backlog is session-only; a reload does not restore it by design.
- The ATS reference still leaves partial experience/project/training candidates
  in review (18 items); these are intentionally retained rather than invented.
- Authenticated logout/user-switch live E2E remains a test-identity boundary
  inherited from 03A; component/unit isolation checks cover the transition.
- No real production deployment was performed.

**STOP before main integration and production release.**
