# JM-CV-BUILDER-03C-HARDENING-02

**Status:** `JM-CV-BUILDER-03C-HARDENING-02 — VERIFIED LOCAL / READY FOR RELEASE GATE REVIEW`

**Date:** 2026-11-13

**Branch:** `feature/jm-cv-builder-03c-hardening-02`

**Baseline:** `ace901c` (03C UI integration)

## 1. Git baseline

- Jobsearch remote `main`: `b3b8525`.
- 03C baseline: `feature/jm-cv-builder-03c-ui-integration-01 @ ace901c`.
- RIS reference: `0e08822`; RIS was not modified.
- New branch created from `ace901c` in an isolated worktree.
- No existing dirty files or unrelated assets were overwritten. Temporary PDF
  E2E assets were restored to their committed baseline.

## 2. Corrected findings

### A. Consent-aware durable UI

- Added a read-only `getStructuredCvConsentStatus()` load after authenticated
  startup.
- The list distinguishes loading, load error, not-granted, DRAFT/not-approved
  and ready states.
- A durable save action appears only when an existing **GRANTED** consent is
  combined with an **approved** notice. Client feature flags alone never enable
  writes.
- DRAFT remains treated as not approved. No consent grant or withdrawal is
  performed by the UI.
- Session-only CV management remains available when storage is disabled,
  consent is absent, notice is DRAFT, or the status cannot be loaded.
- The decision is isolated in `isDurableConsentReady()` so a future legally
  approved notice can enable the same UI without restructuring.

### B. Correct profile content state

- Durable list rows are metadata-only. They now show **„Inhalt noch nicht
  geladen“** instead of **„Leerer Lebenslauf“**.
- Content is evaluated only after a full `getStructuredCvProfile()` load.
- No GET request is made for each profile during list/pagination; the existing
  metadata list remains one paginated call sequence.
- A loaded profile is marked as loaded after edit/update/duplicate, and its
  normal empty/filled state is then evaluated.

### C. Idempotent duplicate retry

- Duplicate operations keep a stable idempotency key per source profile and
  version.
- A timeout does not generate a new key or automatically retry.
- If the create result is uncertain, the BFF profile list is queried for a
  controlled matching candidate (`name` + template); if found, the existing
  server profile is adopted instead of creating another.
- A changed source version produces a new operation scope/key.
- Existing `409` handling remains; no automatic overwrite.

## 3. Profile states and UX

| State | Behavior |
|---|---|
| `session-only` | Session profile; no account write |
| `not-loaded` | Durable metadata row; no content claim |
| `saving` | Save in progress; no false success |
| `durable` | Server-confirmed profile with version/ETag |
| `unsaved-changes` | Local edits not synchronized |
| `save-error` | Save failed; local draft preserved |
| `conflict` | Server version changed; reload/decision required |

Failed and conflicted saves keep local data. The list exposes the state in the
existing profile card; no second management page was added.

## 4. Review preservation and 03B regression

- Existing 03B import/review/backlog and handoff code remains from the
  consolidated branch.
- 03B browser reference PASS: **71 skills, 0 preselected, 58 selected, 34
  review entries**, backlog and return preservation.
- 03C durable browser fixture PASS: a seeded **71-skill / 44-review** profile
  was loaded from the durable list, showing all 71 skills and the review
  backlog with 44 items. Screenshot:
  `docs/reports/assets/JM-CV-BUILDER-03C-UI-INTEGRATION-01/review-44-restored.png`.
- Client/BFF tests preserve 44 items including `original`, corrected `text`,
  `edited`, `status`, `applied`, page and section heading.
- Counts-only reviews are still rejected as incomplete; no silent truncation.

The combined import→review→durable→reload browser path and the separate seeded
44-item durable reload are both covered. A single end-to-end browser run that
combines the imported 71/44 fixture with durable save is still a release-gate
item because it requires the deployed test identity/flag combination.

## 5. Authentication, privacy and session isolation

- Durable consent/status/list calls require the verified auth profile and use
  the existing access token.
- No owner, tenant, partner or credential value is accepted from the browser.
- No CV content is logged.
- No personal CV data is written to browser persistence.
- On logout/user switch, the existing reset clears durable refs, loaded state,
  consent status, review maps and drafts; session generation rejects late
  responses.
- No automatic AI request or consent mutation was added.

## 6. Test evidence

- API group: **609 passed / 5 skipped**.
- Frontend suite (`--maxWorkers=2`): **1916 passed / 5 skipped**.
- Focused consent/status/client/list tests: PASS.
- 03C durable synthetic E2E: PASS — create/save/reload/update/409/
  timeout-duplicate reconciliation/delete, 320/390/768/1440 px.
- 03B import E2E: PASS (71 skills, 58 selected, 34 review).
- 03A full-page handoff E2E: PASS.
- PDF export E2E: PASS.
- Production build, TypeScript, API syntax, `git diff --check`: PASS.
- Secret/privacy scan: no credentials or private CV data in changed files.

## 7. Verification boundaries

- No real RIS/AWS/Consent request, account or production flag.
- No main merge or production deployment.
- The previews remain default-off and fail closed; no authenticated 403/503/428/
  timeout/logout browser run is claimed.
- No physical purge, backup/PITR, legal approval or notice activation claim.

## 8. Open release gates

`REVIEW_REQUIRED`: legal notice/Art. 9 approval, consent UX copy approval,
retention/withdrawal policy, backup/PITR reconciliation, approved RIS
deployment, and authenticated combined 71/44 browser E2E.

## 9. Commits

- `4c87748` — consent/not-loaded/idempotent duplicate hardening and E2E
  expansion.
- Documentation/report commit follows this file.

**STOP before main integration and production release.**
