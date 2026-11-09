# JM-RIS-CV-DERIVED-PROFILE-STORAGE-01

**Status:** `IMPLEMENTED / VERIFIED LOCAL — NO PUSH, MERGE OR DEPLOY`
**Branch:** `feature/jm-ris-cv-derived-profile-storage-01`
**Commit:** `cef8b7e`

## Scope

Conscious storage choice for CV-search and ATS profiles derived from a durable
RIS CV. No new backend, RIS/AWS/Terraform change or automatic persistence.

## Mapping and privacy boundary

- A durable CV downloaded through **Verarbeiten** gets a session-only
  `risCvId` on the session `CvDocument`.
- The mapping is cleared by the existing identity/session reset.
- CV storage consent is not treated as search-profile consent or AI consent.
- Persistent writes require the separate `search-profile-storage` status
  `GRANTED`; otherwise the persistent option is disabled and no write occurs.
- Session profiles remain in the existing session repository and are never
  silently migrated.

## UI and save behavior

### CV search profile

`CvProfileResult` now shows:

- **Nur für diese Sitzung** (default)
- **Dauerhaft in meinem RIS-Konto**

The durable option is only available for a session copy with `risCvId` and an
active search-profile consent. A durable save uses the existing
`persistentSearchProfiles.createCv(cvId, input)`; a session save keeps the
existing session repository path unchanged. Success and failure messages are
explicit; a failed RIS write does not advance as if it succeeded.

### ATS profile

The ATS skill/confirmation step now shows the same storage choice. For a
durable ATS profile:

- an existing durable parent search profile of the same RIS CV is selectable;
- the parent list is loaded through `persistentSearchProfiles.listCv(cvId)`;
- a locally created durable parent is preselected after the search-profile save;
- invalid/missing parents are rejected before any write, preventing orphaned
  ATS profiles;
- writes use `persistentSearchProfiles.createAts(searchProfileId, input)`.

After saving, the persistent profile is available through the existing
persistent CV profile overlay and is reloaded from RIS; no re-upload is needed.

## May help

The storage choice includes a May hint explaining the difference between
temporary session profiles and durable RIS storage, and that CV storage consent
alone is not profile-storage or AI consent.

## Verification

| Check | Result |
| --- | --- |
| New storage-choice/guard tests | **5 passed** |
| Focused regression (selection, CV, profile APIs) | **72 passed** |
| Full suite, serial | **1667 passed**, 5 skipped |
| Production build | **PASS** |

The full suite includes the existing account-erasure, search-profile, CV and
consent tests. Test data are synthetic; no real CV was downloaded or written.

## Remaining risk / open verification

- No authenticated live RIS write was executed in this local run. The actual
  `createCv`/`createAts` contract remains covered by the existing mocked API
  tests; a signed-in synthetic E2E remains the deployment-time check.
- Parent list loading and write success are scoped to the verified session;
  late results are ignored after identity/session changes.
- Mobile/desktop layout of the storage choice is responsive (44 px targets,
  single-column at narrow widths) and covered by component/CSS tests; no live
  authenticated screenshot was produced.

## Boundaries

- No push, merge or deployment.
- No RIS/AWS/Terraform mutation.
- No real user or CV data.
- Existing session storage, consent, anonymisation and model selection remain
  unchanged.
