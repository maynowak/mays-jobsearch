# JM-RIS-CV-PERSISTENT-PROFILES-01

**Status:** `IMPLEMENTED / VERIFIED LOCAL — NO PUSH, MERGE OR DEPLOY`
**Branch:** `fix/jm-ris-cv-persistent-profiles-01`
**Base:** `6d0a719` (production)
**Commit:** `770a96f`

## Root cause

Stored RIS CVs already had durable CV-search and ATS profiles, but the
**Suchprofile** entry in the persistent CV list was rendered only when
`persistentSearchProfiles.persistentView` was already true. If the separate
search-profile consent had not been granted, the entry disappeared entirely.
The overlay also only showed a static consent note, with no way to grant the
required consent from the stored-CV workflow.

## Fix

- Persistent CV rows always show **Suchprofile** when the persistent profile
  API is present, regardless of the current consent state.
- `PersistentCvProfilesOverlay` now handles the missing state explicitly:
  - shows the separate consent requirement;
  - offers **Dauerhafte Suchprofil-Speicherung aktivieren** when available;
  - shows an explicit unavailable state if search-profile storage is not
    configured for the account;
  - shows grant loading/error feedback.
- After granting, the existing hook refresh makes `persistentView` true and the
  overlay loads the stored CV’s durable search profiles and ATS profiles.
- Session CV management and the existing durable profile forms are unchanged.

## Why this matters

A user with a stored CV and CV-storage consent but no search-profile consent
previously could not reach the durable profile area for that CV. The profiles
were not lost; the entry point was hidden. The fix makes the same
CV → search profile → ATS profile management reachable for stored CVs and gives
the user the missing consent action in context.

## Tests

| Check | Result |
| --- | --- |
| New overlay/manager tests | **2 PASS** |
| Stored-CV reachability test | **1 PASS** |
| Full suite, serial | **1670 PASS**, 5 skipped |
| Production build | **PASS** |

## Boundaries

- No push, merge or deployment.
- No RIS/AWS/Terraform or consent-text change.
- No real user/CV data.
- Authenticated live RIS write/reload remains the deployment-time verification.
