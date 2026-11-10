# DESIGN-PROFILE-UX-CONSOLIDATION-01

**Status:** `DESIGN-PROFILE-UX-CONSOLIDATION-01 — IMPLEMENTED / VERIFIED LOCAL`
**Branch:** `design/jm-ris-profile-ux-consolidation-01`
**Base:** `702fa20`
**Commit:** `b56d122`

## Design changes

### Stored CV cards

Every persistent RIS CV now renders as one clear card with:

- filename and file size
- storage location: **RIS account**
- PDF status
- CV-search profile count
- ATS-profile count
- a note that RIS PDF/profile state is shown, but no separate processing
  history is stored
- actions: **Verarbeiten**, **Profile anzeigen**, **Herunterladen**
- delete remains a secondary icon action

Profile counts are loaded through the existing RIS APIs
`persistentSearchProfiles.listCv(cvId)` and `listAts(searchProfileId)`.
They are never derived from session profile lists. While loading the cards show
a loading state; on failure they show **Nicht verfügbar** instead of a fake 0.

### CV profile manager

`PersistentCvProfilesOverlay` is now a structured card manager:

- CV search profiles are cards first: name, target roles, skills, durable
  status, ATS count, edit/delete.
- **+ Neues Suchprofil erstellen** appears first; the form is hidden until the
  action is chosen.
- ATS profiles are grouped under their parent CV search profile and show name,
  skills, target roles, parent and durable status.
- **+ Neues ATS-Profil erstellen** requires a valid parent profile; no orphan
  creation path.
- Forms use a two-column responsive grid, then one column on mobile, with
  clearly grouped fields and primary/secondary actions.
- May hints explain CV search profiles, ATS profiles and the session/durable
  distinction.

### May help

The already-collapsed May help remains unchanged in behavior. Additional
contextual hints were added to session and persistent profile management; no
chat infrastructure or new API was introduced.

## Honest status display

The UI distinguishes only states actually backed by existing data:

- PDF stored / PDF pending / PDF failed
- profile counts returned by RIS
- profile presence returned by RIS
- no separate “CV processing completed” history

A stored search profile is **not** presented as proof of a completed CV
processing run. No new server-side status history was added.

## Screenshots

Assets: `docs/reports/assets/DESIGN-PROFILE-UX-CONSOLIDATION-01/`

- After: `cards-{320,390,430,768,1024,1440}.png`
- After: `profiles-{320,390,430,768,1024,1440}.png`
- Before references: `before-session-profiles-{390,1024}.png`,
  `before-storage-choice-1024.png`

All widths show no horizontal overflow. The persistent profile manager is a
full-height mobile sheet below 430px and a centered max-width dialog on larger
screens.

## Verification

| Check | Result |
| --- | --- |
| Focused profile/card/nav tests | **22 passed** |
| Full suite, serial | **1677 passed**, 5 skipped |
| Production build | **PASS** |
| Screenshot overflow | **none at 320/390/430/768/1024/1440** |
| Diff/secret audit | **clean** |

A date-sensitive pre-existing `ApplicationsSection` assertion was made
non-ambiguous (`getAllByText`) so the serial suite stays green when the test
date equals the displayed date. No product behavior changed there.

## Open / boundaries

- No authenticated RIS E2E was executed; no synthetic test account was
  available in this local run. The live read/write/reload path remains
  deployment-time.
- No push, merge or deployment.
- No RIS/AWS/Terraform/Cognito change, no real user/CV data.
- No new profile APIs or storage engines.

## Recommendation

**GO for controlled PR review** of this local branch.  
**NO-GO for production** until the normal PR checks and an authenticated synthetic
RIS read/write/reload verification have passed.
