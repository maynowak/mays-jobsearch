# CV-BUILDER-02F — REAL PDF ACCEPTANCE

**Status:** `CV-BUILDER-02F — DEFECTS IDENTIFIED / CORRECTION REQUIRED`
**Date:** 2026-11-11
**Production:** `e894229`
**Reference:** private 3-page PDF, used only in a controlled local browser session
**Branch:** `docs/cv-builder-02f-real-pdf-acceptance-01`

## 1. Baseline

Governance documents and audit log were read. The supplied private reference
was located locally and matched the reported structure: 3 pages, 5 experience
entries, 3 projects, 1 education entry, planned certification goals, and
technical sections including `ARCHITECTURE & CLOUD`, `SOFTWARE ARCHITECTURE`
and `TECHNICAL SKILLS`.

No PDF, contact data, raw extracted text or identifiable screenshot was added
to the repository. Only counts, field status and anonymized field examples are
documented here.

## 2. Privacy / transfer check

The PDF was selected through the normal file input in a local Chromium session.
Recorded API traffic:

- only `GET /api/models`
- **no non-GET API request**
- **no PDF upload**
- no RIS request or RIS write

The PDF processing remained local in the browser. The session was not saved
and was discarded after inspection.

## 3. Quality matrix

Reported baseline → current production `e894229`:

| Area | Baseline | Current result | Assessment |
|---|---|---|---|
| Personal details | incomplete | Name, email, phone, location **all empty** | **DEFECT** |
| Experience | 5 entries | 5 entries | **PASS** |
| Education | institution/field swapped | institution `Hochschule Darmstadt, Germany` correct; degree field combines `Industrial Mechanic – Vocational Qualification – Bachelor of Science (B.Sc.) – Computer Science` | **PARTIAL / DEFECT** |
| Skills | 0 | 2 broad candidates (`AI Platform Engineering`, `Enterprise Java DevOps & Automation`), 0 selected by default | **DEFECT** |
| Certificates | 3 planned treated as acquired | 0 acquired certificates; 3 certification-goal items in review | **PASS** |
| Projects | 3 | 3 names correct; all technology fields empty | **PARTIAL / DEFECT** |
| Review list | 83 unverified | 62 unverified | Improved, but still high |
| Editor scroll | coupled | Editor/preview independently scroll; modal/window stay at 0 | **PASS** |
| PDF export | actual download | Private PDF exported locally: valid 2-page PDF, actual download; Berufserfahrung/Ausbildung/Projekte present; Fähigkeiten absent because 0 skills were selected. No private artifact committed. | **PASS (local artifact only)** |

### Experience values verified

Spot checks of actual field values:

- `DevOps` / `1und1`
- `Fullstack Java Developer` / `4Brain`
- `Freelance Software Developer` / `Freelance`
- `Web Services` / `BaFin`
- `E-Commerce` / `Contenido`

All five entries have a position and an employer. Start/end months remain
empty where the source does not make them explicit; no months were invented.
The employee/employer distinction is therefore materially improved and no
swap was observed in these five entries.

### Review reasons (62 items)

| Reason | Count |
|---|---:|
| Unknown section | 22 |
| Incomplete experience | 15 |
| Project reference without parent | 15 |
| Training, not completed certification | 5 |
| Certification goal, not acquired certificate | 3 |
| Ambiguous assignment | 1 |
| Language level missing | 1 |

The reduction from 83 to 62 is not due to silent deletion: all categories
above remain represented in the review list.

### Scroll evidence

At 1440 px:

- editor scroll height/client height: `502 / 450`
- preview scroll height/client height: `1891 / 450`
- editor scroll changed to `52`; preview remained `0`
- preview scroll changed to `1441`; editor remained `52`
- modal and window scroll stayed `0`

## 4. Defect classification

| Defect | Probable cause |
|---|---|
| All personal fields empty | PDF.js two-column reading order + personal/header section recognition |
| Only 2 broad skill candidates | Section/field mapping; skill lists were not extracted into individual technologies |
| Education degree conflates vocational qualification and Bachelor | Field mapping: multiple qualification lines combined into one degree string |
| Project technology fields empty | Field mapping / description evidence extraction; technologies in project prose were not extracted |

These are **observed defects**, not regressions inferred from counts alone.

## 5. Verification scope

- Production footer on both domains: `Version 2.2.0 · production · main · e894229`
- The imported fields were read from the actual production editor after the
  import summary; no backend persistence was used.
- No files were saved to the repository. The private export was written only to
  `/tmp` for verification and is not committed.
- No main, production, RIS, AWS, Cognito, Terraform or consent changes were made.

## 6. Result

The real-PDF acceptance does **not** meet the full quality target because of the
personal-data, skills, education and project-technology defects. The
experience mapping, certificate-goal separation, review preservation and
independent editor scrolling are verified.

**Next required action:** correct the four defect classes on a feature branch,
then repeat this private-reference acceptance. No success status is claimed
for the incomplete areas.

**CV-BUILDER-02F — DEFECTS IDENTIFIED / CORRECTION REQUIRED**
