# JM-ATS-PROFILE-SAVE-FIX-02 — ATS Save Regression Hotfix

**Status:** `FIXED / VERIFIED LOCAL`

**Branch:** `fix/jm-ats-profile-save-02`

**Implementation commit:** `40ff657`

**Baseline:** `origin/main` `c1cb1f8`

## 1. Confirmed Root Cause

The failure was in the **session storage path**, not the RIS path:

- `handleSkillSelectionConfirm` passed the selected skill strings unchanged to
  `repositories.atsSearchProfiles.create(...)`.
- `sessionRepositories.create()` called `validateCreateATSProfile()` directly.
- `validatePhraseList()` rejects duplicate phrases.
- The RIS client already called `normalizeCreateATSProfileInput()` before
  sending its request.

A repeated selected skill therefore produced a `ProfileValidationError`
(`Duplicate phrase: skills`) before the session profile could be created. The
session update path had the same missing normalization.

## 2. Fix

Before validation/storage, both session create and update now use the same
normalization as the RIS path:

- trim leading/trailing whitespace;
- remove exact duplicate skills and target roles;
- preserve the order of remaining entries;
- preserve different spellings/casing (no case-folding or merging);
- trim the ATS profile name.

The shared validation now rejects only **exact** duplicate phrases, matching
the normalization and the BFF/RIS behavior. No mapping between CV, search
profile and ATS profile was changed. Existing session and RIS capacity limits
remain in force; the session create path now reports a real
`capacity_exceeded` error for a sixth ATS profile.

## 3. Error Mapping

A focused helper maps known errors to actionable messages:

- invalid skills/target roles or ATS profile → `cv.atsProfileValidation`;
- missing parent search profile → `cv.errorNoSearchProfileSelected` (session)
  / `cv.atsNoDurableParent` (durable path);
- ATS capacity → `cv.errorTooManyAtsProfiles`;
- missing storage consent → `searchProfiles.searchConsentRequired`;
- unknown RIS/network failures → generic fallback.

No payload, token, CV text or profile content is logged.

## 4. Regression Evidence

New tests cover:

1. session create with duplicate/whitespace skills, duplicate target roles and
   a padded name;
2. reload of the normalized ATS profile;
3. session update with duplicate/whitespace skills and target roles;
4. invalid parent rejection;
5. sixth-ATS-profile capacity rejection;
6. RIS client create/update normalization with duplicate payloads;
7. exact-duplicate normalization while preserving casing variants;
8. known session/RIS error mapping versus generic network errors.

The existing session isolation, consent and ATS capacity tests remain green.
No production writes were performed.

## 5. Tests and Build

| Check | Result |
|---|---|
| Focused profile/session/API tests | **29 PASS** |
| RIS search-profile API tests | **11 PASS** |
| Full Vitest suite, serial | **2018 PASS / 11 skipped** |
| Production build | PASS |
| `git diff --check` | PASS |

## 6. Git

- Branch: `fix/jm-ats-profile-save-02`
- Implementation: `40ff657`
- No Main merge and no Production deployment.
- No UX-08A, login-hydration or unrelated workspace changes.

`FIXED / VERIFIED LOCAL`
