# JM-RIS-CV-PROFILE-VISIBILITY-AND-MAY-HELP-01

**Status:** `MERGED / PRODUCTION DEPLOYED / AUTHENTICATED E2E PENDING`
**Branch:** `fix/jm-ris-cv-profile-visibility-may-01`
**Base:** `45d169e`
**Commit:** `47a6692`

## Analysis: storage, mapping or visibility?

The code path was traced end to end:

1. `handleProcessPersistentCv()` downloads the RIS CV and sets a session-only
   `risCvId` on the session `CvDocument`.
2. Durable CV-search profile save calls
   `persistentSearchProfiles.createCv(doc.risCvId, input)`.
3. Durable ATS save calls `createAts(durableParentSearchProfileId, input)` and
   validates the parent against profiles loaded for the same RIS CV.
4. The persistent CV row and `PersistentCvProfilesOverlay` use that same
   `cvId` for `listCv(cvId)` / `listAts(searchProfileId)`.

**No second cvId, storage engine or ID mapping defect was found in the client
path.** The concrete gap was navigation/visibility: after a durable save the
app switched to the persistent area but did not select/open/reload the profile
view for the saved CV. The user had to discover and click **Suchprofile**
manually. PR #13 additionally exposed that action when consent was missing.

## Fix

### Stored profile visibility

- After a successful durable CV-search save, the app records the correct
  `risCvId` and switches to persistent mode.
- After a successful durable ATS save, it does the same.
- Once the CV workflow closes, `DashboardV2CvSection` automatically opens the
  matching `PersistentCvProfilesOverlay`.
- The overlay loads `listCv(cvId)` and all associated `listAts()` entries from
  RIS; only API-returned entries are rendered as durable.
- The focus is handed off once, so closing the profile view does not reopen it
  on every render.
- Missing consent, unavailable storage, loading and errors remain explicit.

### May help

- Default is now **collapsed**; a compact **💚 Hilfe von May** button is shown.
- Clicking opens the existing contextual May card; clicking again closes it.
- The preference is stored only as a local UI boolean
  (`mj-may-help-open`), never user/CV data.
- It remains open across dashboard area changes and reload when enabled.
- `aria-expanded`, `aria-controls`, keyboard activation and focus transfer are
  implemented.
- Consent/privacy notices are independent of this toggle.

## Verification

| Check | Result |
| --- | --- |
| Dashboard/May/profile-focus tests | **24 passed** (focused selection) |
| Full suite, serial | **1673 passed**, 5 skipped |
| Production build | **PASS** |
| Screenshots | 320/390/430/768/1024/1440, collapsed + open |
| Horizontal overflow | **none** |

Screenshot assets:
`docs/reports/assets/JM-RIS-CV-PROFILE-VISIBILITY-AND-MAY-HELP-01/`

## Production

- PR #14 merged as `a48fe9a`.
- `www.mays-job-matcher.app` -> `dpl_27ixok4qnRRvC3tY9DDnzaL9S7DW`
- `mays-jobsearch.vercel.app` -> `dpl_eodGYtWVhy1EZ6K82eaN51oJU3ng`
- footer Build SHA `a48fe9a` on both.
- Smoke: `/`, `/profil` 200; search-profile API 401 without token on
  `www.mays-job-matcher.app`; the alternative `mays-jobsearch` project has the
  API disabled (503) and is not suitable for durable-profile testing.

## Remaining verification

Authenticated synthetic RIS E2E (real create/reload/login) was not executed
because no approved synthetic test account was available in this run. It is not
claimed and remains the next verification step.

## Boundaries

- No RIS/AWS/Terraform/consent-text change.
- No real user or CV data.
- No push/merge/deploy at this local stage.
