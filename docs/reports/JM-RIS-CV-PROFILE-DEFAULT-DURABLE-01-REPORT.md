# JM-RIS-CV-PROFILE-DEFAULT-DURABLE-01

**Status:** `IMPLEMENTED / VERIFIED LOCAL`
**Branch:** `fix/jm-ris-cv-profile-default-durable-01`
**Base:** `7ba90dd`
**Commit:** `b52f3f4`

## Corrected understanding

The user's observation was about **default behavior**, not a server storage
failure:

- A durable RIS CV is processed.
- The derived search/ATS profiles were saved under **session** because session
  was the preselected storage choice.
- Therefore they appeared under **Nur für diese Sitzung** and disappeared after
  logout/login.

The durable API paths and `risCvId` mapping were already correct. The missing
piece was that a **stored RIS CV** did not default to **Dauerhaft**.

## Fix

- For a processed CV with a valid RIS `risCvId` **and** the separate
  `search-profile-storage` consent `GRANTED`, the storage choice now defaults
  to **Dauerhaft in meinem RIS-Konto**.
- The user can still explicitly select **Nur für diese Sitzung**; that choice is
  never silently migrated or persisted.
- Session-only CVs (without `risCvId`) remain session-only.
- If the separate consent is missing, the persistent option stays disabled and
  the choice now offers **Dauerhafte Suchprofil-Speicherung aktivieren**
  directly in the mask. On success it selects durable.
- After a durable save, the existing one-shot profile focus opens the matching
  stored-CV profile view and reloads `listCv`/`listAts` from RIS.
- May help remains collapsed by default and retains its local UI preference.

## Tests

| Check | Result |
| --- | --- |
| New default/consent tests | **7 passed** (storage choice/guard selection) |
| Full suite, serial | **1675 passed**, 5 skipped |
| Production build | **PASS** |

## Boundaries

- No RIS/AWS/Terraform/consent-text change.
- No automatic session→durable migration.
- No real user/CV data.
- Authenticated synthetic RIS E2E remains the deployment-time verification.
