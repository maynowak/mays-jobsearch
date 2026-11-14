# JM-CV-BUILDER-PDF-RIS-STORAGE-03 — PRIVACY DECISION

**Status:** `PRIVACY DECISION PENDING`

**Date:** 2026-11-14
**Repository:** `maynowak/mays-jobsearch`
**Feature:** `JM-CV-BUILDER-PDF-RIS-STORAGE-01/02`
**Feature HEAD:** `318870864af2840bdf91ae90ee80f07a54405a15`

## 1. Existing approved contract

The existing `cv-storage` contract remains the only storage basis:

| Field | Value |
|---|---|
| Purpose | `cv-storage` |
| Jobsearch text version | `cv-storage-consent-2026-11-08-v1` |
| Jobsearch text SHA-256 | `2fe65fd158a3a2953cf3869ff864aae626971012d68cfb8849db84e04579d036` |
| RIS notice | `cv-storage/1.0` |
| Notice state | `APPROVED` for limited beta pilot |
| `legalApprovalRef` | `JM-CV-STORAGE-V1-BETA-2026-11-08` |
| Approval date | 2026-11-08 |
| Approval body | Betreiberin May's Job Matcher |
| Privacy policy reference | `/datenschutz`, version 1.1, 2026-11-07 |
| Pilot scope | Existing allowlist/pilot remains in force |

The approved text says, in the relevant parts:

> „… meinen **hochgeladenen** Lebenslauf als PDF-Datei … dauerhaft in meinem angemeldeten Konto speichert …“

and for Art. 9:

> „… besondere Kategorien personenbezogener Daten, die in dem von mir **hochgeladenen** Lebenslauf enthalten sind …“

No consent text was changed in this task.

## 2. Actual data flow of the new function

The builder path is:

```text
Builder draft
  → PDF generated locally with createCvBuilderPdf
  → explicit click "In RIS speichern"
  → File(..., application/pdf)
  → existing validateCvFile
  → existing usePersistentCvStorage.upload
  → existing /api/ris/cvs
  → existing private RIS document storage
  → existing "Meine Lebensläufe" list
```

Processed data:

- the generated PDF bytes;
- the existing document metadata: filename, size, content type, checksum/status as handled by the
  existing storage path;
- no structured builder profile;
- no new AI processing;
- no new consent purpose;
- no new storage destination;
- same deletion, withdrawal, retention and pilot rules as the existing CV-document storage.

## 3. Scope assessment

### What is unchanged

- Purpose: durable storage of one CV PDF.
- Recipient/processor: existing RIS/AWS document storage.
- Data categories: same PDF content and document metadata; potential Art. 9 content remains
  possible.
- Retention, deletion, withdrawal: existing CV-storage behavior.
- Pilot/allowlist: remains effective.
- No structured-CV profile storage.

### What differs

Only the **origin** of the PDF differs:

- existing consent wording: a CV **uploaded** by the user;
- new function: a CV **generated in the browser** and then saved/uploaded by explicit user action.

Whether “hochgeladener Lebenslauf” includes a locally generated PDF that the application uploads
to RIS is a legal/textual question, not a technical one. This decision package does not answer it
autonomously.

## 4. Option A — existing consent is sufficient

If Privacy/Legal confirms that a generated PDF, explicitly saved through the same RIS storage,
is covered by the existing wording:

- keep `cv-storage-consent-2026-11-08-v1` and its hash unchanged;
- keep RIS notice `cv-storage/1.0` and `legalApprovalRef=JM-CV-STORAGE-V1-BETA-2026-11-08`;
- keep the pilot/allowlist restriction;
- document the approval and prepare a separate controlled live-E2E.

**Status: NOT DECIDED. No approval is inferred.**

### Required human confirmation

> „Im CV-Builder erzeugte und durch ausdrückliche Nutzeraktion in der bestehenden RIS-CV-Ablage
> gespeicherte PDFs sind vom genehmigten Zweck und Wortlaut der `cv-storage`-Einwilligung
> `cv-storage-consent-2026-11-08-v1` einschließlich der Art.-9-Regelung umfasst.“

Approver: Privacy/Legal + operator release owner. Date/signature: pending.

## 5. Option B — minimal text amendment required

If the wording is not sufficient, use a new notice version; do not edit v1 in place.

### Prepared draft (not active, not legally approved)

Proposed version identifier:

`cv-storage-consent-2026-11-14-v2`

Minimal wording change in two paragraphs:

- „meinen **hochgeladenen** Lebenslauf“ → „meinen **hochgeladenen oder im CV-Builder erstellten**
  Lebenslauf“
- „in dem von mir **hochgeladenen** Lebenslauf enthalten“ → „in dem von mir **hochgeladenen oder
  im CV-Builder erstellten** Lebenslauf enthalten“

Prepared canonical SHA-256 for that draft text:

`7baee3ce544f88c4aa99b2ec5c27ae0277bf0b3b5d7c03b4fe40e894ed888567`

This hash is a technical draft for an **unapproved** v2 text. It must be recomputed and approved
after final legal wording is fixed.

### Required mapping changes (only after approval)

| Layer | Required change |
|---|---|
| Jobsearch client | `CV_STORAGE_CONSENT_TEXT_VERSION` + `CV_STORAGE_CONSENT_TEXT_SHA256` |
| Jobsearch BFF | `CV_CONSENT_TEXT_VERSION` + `CV_CONSENT_TEXT_SHA256` |
| BFF environment | `RIS_CV_CONSENT_TEXT_VERSION` + `RIS_CV_CONSENT_TEXT_SHA256` |
| RIS | new external notice ref and Art. 9 mapping; new notice version (draft, e.g. `1.1` proposed only) |
| Existing v1 | keep approved, do not overwrite; existing grants remain valid |
| Pilot | keep the allowlist restriction; no general rollout |

No new consent purpose is proposed. No automatic activation is allowed.

## 6. Art. 9 assessment

- The existing Art. 9 declaration is limited to special categories contained in the uploaded CV.
- A generated PDF may contain the same categories because the user entered them in the builder.
- Under Option A, Privacy/Legal must confirm that the existing Art. 9 scope covers the generated
  PDF.
- Under Option B, the same two-paragraph amendment covers both the general and Art. 9 wording.
- No automatic categorization or inference is introduced by this feature.

## 7. Decision sheet

| Decision | Result |
|---|---|
| Existing consent sufficient (A) | **PENDING — no human confirmation** |
| Minimal v2 text required (B) | **PENDING — draft prepared only** |
| Current approved v1 unchanged | **YES** |
| Existing notice/hash overwritten | **NO** |
| New consent purpose | **NO** |
| Pilot/allowlist remains | **YES** |
| Live user processing authorized | **NO** |

## 8. Recommended next step

Request a written Privacy/Legal decision on the exact sentence in Section 4.

If approved: Option A, no text/version change; proceed with a separately authorized synthetic
pilot E2E.

If not approved: Option B, separately authorize the v2 notice, mapping, tests and deployment.
Until then, the new save action remains technically ready but **not approved for real-user
processing**.

## 9. Result

**`PRIVACY DECISION PENDING`**

No product code, RIS, Terraform, AWS, consent text, notice version, purpose or pilot setting was
changed. No live E2E or production deployment was performed.

**No AI decision substitutes for the responsible human Privacy/Legal approval.**
