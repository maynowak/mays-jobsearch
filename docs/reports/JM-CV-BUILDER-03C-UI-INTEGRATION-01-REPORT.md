# JM-CV-BUILDER-03C-UI-INTEGRATION-01

**Status:** `JM-CV-BUILDER-03C-UI-INTEGRATION-01 — VERIFIED LOCAL / PRODUCTION ACTIVATION BLOCKED`

**Date:** 2026-11-13

**Branch:** `feature/jm-cv-builder-03c-ui-integration-01`

## 1. Git baseline

- Jobsearch remote `main`: `b3b8525dc5373d111801ca3af987bdbda9b95827`.
- Structured-CV BFF: `feature/jm-ris-structured-cv-bff-01 @ f7080f3`.
- CV-BUILDER-03B reference: `feature/cv-builder-03b-real-world-import-quality @ c4c2cde`.
- RIS contract/backend reference: `feature/ris-structured-cv-backend-hardening-02 @ 0e08822`; RIS was not modified.
- New branch was created from the BFF HEAD in an isolated worktree.

## 2. 03B consolidation

Merge commit: `6247d66`.

The only conflict was the append-only `docs/AI_AUDITLOG.md`. Both the current
SEO/BFF entries and the 03B entries were retained; no side was blindly copied.
All other 03B changes merged automatically, including:

- improved PDF parsing and section/timeline handling;
- review provenance and session-only review store;
- idempotent review application and duplicate-apply protection;
- skill selection and review backlog;
- 03A full-page handoff regression updates;
- 03B focused tests and reports.

The current `b3b8525` SEO/marketing state is preserved. Focused 03B/CV/API
tests after the merge: 159 passed. Production build passed.

## 3. Existing CV management integration

The existing `CvBuilderProfileList` under `Profil → Lebenslauf → Meine
Lebensläufe` is reused. No second profile overview or new page was added.

Per profile the list now exposes:

| State | Display |
|---|---|
| `session-only` | Nur diese Sitzung |
| `saving` | Wird gespeichert… |
| `durable` | Im Konto gespeichert |
| `unsaved-changes` | Ungespeicherte Änderungen |
| `save-error` | Speichern fehlgeschlagen |
| `conflict` | Versionskonflikt |

Existing create, edit, duplicate, rename, PDF download and delete actions remain
in the same card. A separate explicit **Dauerhaft speichern** action appears
only when structured storage is enabled and the profile is not already durable.
When the server/client flag is off, session management remains unchanged and no
active durable-save button is shown.

## 4. DurableProfileRef

`src/lib/cvBuilder/durableProfileRef.ts` defines the session-only mapping:

- local `cvId` remains the local identity;
- server `profileId` is kept separately;
- version and ETag are held with the ref;
- status is session-bound;
- the mapping contains no CV content and is never written to
  `localStorage`/`sessionStorage`.

A durable profile loaded from RIS uses a local `cvId` with the `durable-`
prefix plus the server `profileId`. Session profiles and durable profiles
therefore cannot accidentally share an id.

## 5. Save, load and update

- Durable listing uses `listStructuredCvProfiles()` with pagination and loads
  only the current authenticated user's profiles.
- Opening a profile uses `getStructuredCvProfile()` and restores full `cvData`,
  template, review sidecar, version and ETag.
- A dirty local draft is not silently replaced by a saved profile; the user gets
  an explicit warning and can save/discard first.
- **Dauerhaft speichern** uses `createStructuredCvProfile()` with a stable
  per-profile idempotency key. A failed/timeout create keeps the local draft
  and key for a deliberate retry; there is no automatic second create.
- Editing a durable profile uses `updateStructuredCvProfile()` with
  `If-Match`/version. A 409 becomes a visible conflict and never overwrites.
- Session profiles with a durable ref show `unsaved-changes` after a
  session-only edit; synchronization only occurs after an explicit durable
  action.
- Rename and duplicate use the same RIS update/create contracts. Duplicate
  creates a new server id.
- Delete asks for confirmation and uses the documented 404-after-delete
  semantics. A 404 is treated as already deleted.
- PDF export continues to use the existing local CV-builder PDF pipeline; a
  read of the durable profile does not create another server profile.

## 6. Review preservation

The existing 03B import review is retained:

- `accepted` and `applied` stay separate;
- review items, corrections, page/section provenance and status are passed to
  the durable create/update;
- a 44-item roundtrip is covered by the typed client and BFF tests;
- counts-only reviews with items pending are rejected rather than marked
  complete;
- loaded review data is restored into the existing editor backlog.

No private PDF or real CV is used.

## 7. Authentication and privacy boundaries

- New durable actions require a verified auth profile and the RIS access token.
- No owner/tenant/partner id is accepted from the browser; no RIS partner
  credential is exposed.
- The durable list/refs are cleared on logout/user switch; the existing session
  reset also clears review maps, drafts and requests.
- Session generation is checked before late async results are applied.
- No CV contents are logged.
- No personal CV data is placed in browser persistence.
- No automatic AI request is introduced.

## 8. Consent and feature flags

Server: `RIS_CV_BUILDER_PROFILE_STORAGE_ENABLED=false`.
Client: `VITE_RIS_CV_BUILDER_PROFILE_STORAGE_ENABLED=false`.

`cv-builder-profile-storage` remains DRAFT with no legal approval. The BFF
exposes only read-only consent status and blocks grant/withdraw mutations. The
UI does not enable a productive save path when either flag is off; existing
session-only CV management remains usable.

The local E2E starts Vite with an explicit synthetic client flag and a mock BFF
only. It does not authorize real RIS requests or create a DRAFT grant.

## 9. Synthetic browser E2E

Script: `tests/e2e/cv-builder-03c-durable.mjs`

Synthetic OIDC state + controlled mock BFF; no real RIS/AWS request.

Executed scenarios:

1. create an empty CV profile;
2. edit session-only draft;
3. explicitly save it durably;
4. reload and load it from the durable list;
5. edit and update with If-Match;
6. simulate a 409 conflict and show the conflict message;
7. duplicate a durable profile with a new server id;
8. delete with confirmation;
9. responsive checks at 320, 390, 768 and 1440 px with no horizontal overflow;
10. assert mock RIS received the expected create/load/update calls.

Result: PASS (`ok: true`, 10 mock calls; screenshot
`docs/reports/assets/JM-CV-BUILDER-03C-UI-INTEGRATION-01/durable-conflict-delete.png`).

The BFF/client contract tests separately cover missing auth, 401/403/404/409/
413/422/428/503, idempotency replay, timeout/no-retry, 44-item review, pagination
and flag manipulation. Real authenticated browser/E2E and full 403/503 UI
state screenshots remain deployment-gated because no approved test identity and
no RIS deployment are available in this task.

## 10. Tests and gates

- 03B/CV/API focused after consolidation: **159 passed**.
- API group: **609 passed / 5 skipped**.
- Frontend suite (`--maxWorkers=2`): **1913 passed / 5 skipped**.
- Production build: PASS.
- Synthetic durable E2E: PASS.
- Automatic branch previews are READY:
  - Jobsearch `dpl_9HQouaKtBZ61MF2GVdqhy6BmV892` at
    `mays-jobsearch-4ray7zl6w-maymilly.vercel.app`.
  - Matcher `dpl_H9r2rQ1UdmV88wSwg852yX44MCMC` at
    `mays-job-matcher-513quijwd-maymilly.vercel.app`.
  - Preview `/profil?tab=cv` → 200; `/api/ris/cv-builder-profiles` → 503
    `cv_builder_profile_storage_disabled`; structured consent status → 503
    `consent_disabled`. No RIS write occurred.
- `node --check`/API syntax, TypeScript build, `git diff --check`: PASS.
- Secret/privacy scan: no credentials or private CV data in changed files.

## 11. Verification boundaries

- No real RIS/AWS request or authenticated account.
- No Vercel production deployment or main merge.
- No RIS/Consent/notice activation.
- Real browser 403/503/428/timeout/logout-user-switch variants and the complete
  03B 71-skill browser roundtrip require an approved test identity/deployment
  gate; their client/BFF contract equivalents are covered synthetically.
- No physical purge, backup/PITR or legal approval claim.

## 12. Open release gates

`REVIEW_REQUIRED`: legal notice/Art. 9 approval, retention and withdrawal
policy, backup/PITR reconciliation, capacity decision, disabled flags, approved
RIS deployment and authenticated production E2E.

## 13. Commits

- `6247d66` — 03B consolidation merge with audit-conflict resolution.
- `c24ce18` — durable UI/status integration and synthetic E2E.
- Documentation/report commit follows this file.

## 14. Next steps

- Human review and legal/notice approval.
- Approve RIS deployment and activate server/client flags in a separate gate.
- Run authenticated synthetic production E2E for 403/503/428/timeout/logout.
- Then consider main integration; not part of this task.

**STOP before main integration and production release.**
