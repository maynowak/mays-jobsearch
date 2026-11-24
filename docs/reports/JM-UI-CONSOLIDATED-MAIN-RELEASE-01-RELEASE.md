# JM-UI-CONSOLIDATED-MAIN-RELEASE-01 — Release

**Status:** `JM-UI-CONSOLIDATED-MAIN-RELEASE-01 — PRODUCTION VERIFIED`

**PR:** [#59](https://github.com/maynowak/mays-jobsearch/pull/59)

**Merge commit:** `c8268ffa2b14145202fdcbb7821fa60be55026f0`

**Integrated branch:** `integration/jm-ui-consolidated-release-01`

**Verified integration head:** `13c53dc81cfa5125ef4e96673c47821cd9563fc6`

**Main base before merge:** `3579ade`

## 1. Integrated work packages

| Step | Feature | Feature head | Integration merge |
|---|---|---|---|
| 01 | Responsive applications navigation | `4eba9cc` | `b64edea` |
| 02 | Visual-11 + Premium CV Studio | `913b4f3` | `31dab67` |
| 03 | Profile glass navbar | `076957e` | `f716cf7` |
| 04 | CV upload privacy disclosure | `1006be1` | `eac38ef` |
| 05 | Match Radar incl. accessibility correction | `1abe3b9` | `f2af08e` |
| 06 | Application draft release documentation | `eb6cf6a` | `a1d2626` |

Visual-11 was integrated through CV Studio and not separately duplicated.
Conflicts were limited to `package.json` and `docs/AI_AUDITLOG.md`; all E2E
scripts and audit entries were retained. No `ours`/`theirs` bulk resolution
was used.

## 2. Merge and deployment

PR #59 was merged with exact head matching as:

`c8268ffa2b14145202fdcbb7821fa60be55026f0`

Automatic Vercel Production deployments:

| Project | Deployment | Status |
|---|---|---|
| `mays-jobsearch` | `dpl_J2smHoDjsF9dX1a7fj9VFAF4oTYd` | READY |
| `mays-job-matcher` | `dpl_EEjFHWU7SN32V8RvjNkDoGrpnC1X` | READY |

Both domains served:

`Version 2.2.0 · production · main · c8268ff`

## 3. Public Production smoke

Both `www.mays-job-matcher.app` and `mays-jobsearch.vercel.app`:

- `/`, `/profil`, `/profil?tab=applications`, `/search`, `/anmelden`: HTTP 200
- footer: `production · main · c8268ff`
- no console errors
- no horizontal overflow

No manual deployment was performed.

## 4. Authenticated Production read-only check

The existing approved Chromium tab was used through the TESTING.md CDP
procedure. No token was copied and no write operation was performed.

- 6 profile tabs × 1440/390: 12/12 PASS
- dashboard header present, shell `layout-profile-command`, profile navbar glass
- CV tab contains the premium CV Studio
- applications navigation: sticky at 1440/1024, static at 980/900/768, hidden/mobile switcher at 390
- no navigation/content overlap at any tested width
- no overflow, no console errors, footer `c8268ff`

## 5. Test evidence

| Check | Result |
|---|---|
| Focused integration tests | **128 PASS** |
| Full Vitest suite, serial | **2048 PASS / 5 skipped** |
| Production build | PASS |
| `git diff --check` / secret scan | PASS |

Browser E2E:

- applications responsive 1440/1024/980/900/768/390 — PASS
- CV Studio empty/filled 1920/1440/768/390 — PASS
- profile glass navbar 1920/1440/768/390 — PASS
- CV upload privacy 1440/390 — PASS
- Match Radar 20 jobs desktop/mobile/keyboard/Escape — PASS
- login hydration/consent/identity isolation — PASS
- application draft create/retry/list/reload — PASS
- Visual-11 cards/header/tabs/reduced motion — PASS

## 6. Remaining boundaries

- The application write E2E was not repeated against this new build; its
  unchanged fix was already Production-verified at `3579ade`, and this release
  adds no application/RIS logic.
- No RIS/AWS/Terraform/Cognito/Consent/Storage changes.
- No new credentials and no Cognito callback changes.
- No additional Main push after this documentation branch.
- Original feature branches were not modified, force-pushed or deleted.
