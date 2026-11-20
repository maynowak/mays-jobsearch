# JM-PROFILE-VISUAL-10B — Navbar Position Diagnostic

**Status:** `NOT REPRODUCIBLE / SCREENSHOT ARTIFACT`  
**Branch:** `feature/jm-profile-visual-10b-navbar-fix`  
**Base:** `feature/jm-profile-visual-10` (`24dfe19`)  
**CSS/product fix:** **none required**  
**No Main merge and no Production deployment.**

## 1. Result

No navbar layout error was reproduced in Chromium.

The apparent navbar-over-card issue is a **full-page screenshot artifact** when
the page is captured at a non-zero scroll position while the navbar is sticky.
Normal viewport rendering remains correct.

No CSS, Navbar, body, profile-card, sidebar or applications rules were changed.

## 2. Measurements — Chromium

Demo profile route: `/dev/dashboard-v2`

### 1920 px

| State | scrollY | navbarTop | navbar position/top | .scrolled | cardTop | sidebarTop |
|---|---:|---:|---|---:|---:|---:|
| top | 0 | 0 | sticky / 0px | false | 345 | 345 |
| scrolled down | 590 | -61 | sticky / -61px | true | -245 | 77 |
| after full-page capture | 590 | -61 | sticky / -61px | true | -245 | 77 |
| scrolled up | 330 | 0 | sticky / 0px | false | 15 | 77 |

### 1440 px

Same values as 1920 px for top, down, full-page capture and up.

### 768 px

| State | scrollY | navbarTop | navbar position/top | .scrolled | cardTop | sidebarTop |
|---|---:|---:|---|---:|---:|---:|
| top | 0 | 0 | sticky / 0px | false | 324 | 324 |
| scrolled down | 720 | -61 | sticky / -61px | true | -396 | 77 |
| after full-page capture | 720 | -61 | sticky / -61px | true | -396 | 77 |
| scrolled up | 460 | 0 | sticky / 0px | false | -136 | 77 |

### 390 px

| State | scrollY | navbarTop | navbar position/top | .scrolled | cardTop | sidebarTop |
|---|---:|---:|---|---:|---:|---:|
| top | 0 | 0 | sticky / 0px | false | 475 | 0 (hidden) |
| scrolled down | 720 | -61 | sticky / -61px | true | -245 | 0 (hidden) |
| after full-page capture | 720 | -61 | sticky / -61px | true | -245 | 0 (hidden) |
| scrolled up | 460 | 0 | sticky / 0px | false | 15 | 0 (hidden) |

All widths: **0 px horizontal overflow**.

## 3. Screenshot Comparison

At 1440 px:

- **top viewport** and **top full-page** show the navbar at the top, above the
  profile content.
- **scrolled viewport** shows no navbar because `.scrolled` moves it out:
  `top = -61px`.
- **scrolled full-page artifact** shows the navbar at the scroll position
  inside the long capture, even though it is outside the viewport at that
  moment.

Artifact screenshots:

```text
docs/reports/assets/JM-PROFILE-VISUAL-10B/
├── top-viewport-1440.webp
├── top-fullpage-1440.webp
├── scrolled-viewport-1440.webp
├── scrolled-fullpage-artifact-1440.webp
└── up-viewport-390.webp
```

The correct full-page capture method is to reset `window.scrollTo(0, 0)` before
the full-page screenshot, or to use a viewport screenshot at the current scroll
position. The diagnostic script now does both and labels the artifact image.

## 4. Sidebar and Applications

- Sidebar sticky top at scroll: **77 px** on desktop/tablet; no card overlay in
  the tested states.
- Mobile sidebar uses the existing mobile navigation; sidebar top value is
  not applicable.
- Applications view keeps the existing special rule: navbar computed
  `position: relative` (not sticky) and remains outside the scroll-fixed
  stacking. No change was made.
- Switching back to overview returned the normal profile shell.

## 5. Browser Coverage

- Chromium: tested at 1920, 1440, 768 and 390 px.
- Firefox: **NOT AVAILABLE** in the local Playwright installation; the Firefox
  executable is not installed. No Firefox PASS is claimed.

## 6. Verification

| Check | Result |
|---|---|
| Navbar diagnostic Chromium | PASS (no layout defect) |
| Full-page artifact comparison | reproduced and classified |
| Horizontal overflow | 0 px at all widths |
| Focused/full suite | **2004 PASS / 11 skipped** |
| Build | PASS |
| Diff-check | PASS |
| Firefox | Not available |
| Product CSS change | None |

No auth, RIS, consent, CV persistence, AWS, Cognito or analytics operation was
performed.

## 7. Git

- Diagnostic test and documentation only.
- Branch: `feature/jm-profile-visual-10b-navbar-fix`
- No Main merge and no Production deployment.

**Conclusion:** `NOT REPRODUCIBLE / SCREENSHOT ARTIFACT` — no product fix is
justified.
