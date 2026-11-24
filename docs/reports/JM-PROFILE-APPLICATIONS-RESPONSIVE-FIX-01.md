# JM-PROFILE-APPLICATIONS-RESPONSIVE-FIX-01

**Status:** `READY FOR VISUAL REVIEW`

**Branch:** `fix/jm-profile-applications-responsive-fix-01`

**Implementation commit:** `e4aa74e`

**Base:** `origin/main` `3579ade`

## 1. Confirmed conflict

At `≤ 980px`, the application manager correctly sets:

`.dashboard-v2--applications .dashboard-v2__navigation-card { position: static; }`

but the later profile shell rule:

`.layout-profile-command .dashboard-v2__navigation-card { position: sticky; }`

reintroduced sticky positioning. Because the stack has one column in this
range, the sticky navigation could remain over the application content while
scrolling.

## 2. Fix

Added a scoped responsive override with higher specificity:

```css
@media (max-width: 980px) {
  .layout-profile-command
    .dashboard-v2--applications
    .dashboard-v2__navigation-card {
    position: static;
    top: auto;
  }
}
```

- Only profile applications below/equal 980px are affected.
- Navigation stays in normal document flow in the stacked layout.
- Desktop applications keep the existing sticky/wide layout above 980px.
- Other profile sections are untouched.
- No data, RIS, consent or application logic changed.

## 3. Browser verification

`tests/e2e/jm-profile-applications-responsive-fix-01.mjs` checked:

| Width | Navigation | Layout | Overlap | Overflow |
|---:|---|---|---|---:|
| 1440 px | sticky | wide desktop columns | none | 0 |
| 1024 px | sticky | desktop columns | none | 0 |
| 980 px | static | one column | none | 0 |
| 900 px | static | one column | none | 0 |
| 768 px | static | one column | none | 0 |
| 390 px | hidden; mobile switcher | one column | none | 0 |

Top, middle and bottom scroll positions were checked at every width.
Application filters and action buttons remained reachable, desktop navigation
between Einstellungen and Bewerbungen still worked, and no console errors were
observed.

Evidence (18 screenshots):

```text
docs/reports/assets/JM-PROFILE-APPLICATIONS-RESPONSIVE-FIX-01/
├── applications-1440-{top,middle,bottom}.webp
├── applications-1024-{top,middle,bottom}.webp
├── applications-980-{top,middle,bottom}.webp
├── applications-900-{top,middle,bottom}.webp
├── applications-768-{top,middle,bottom}.webp
└── applications-390-{top,middle,bottom}.webp
```

## 4. Tests and build

| Check | Result |
|---|---|
| ProfileCommandCenter / DashboardV2 / ApplicationsSection tests | **56 PASS** |
| Production build | PASS |
| Responsive browser E2E | PASS |
| `git diff --check` | PASS |
| Secret scan | PASS |

## 5. Boundaries

- No changes to data, RIS, consent, application logic or other profile areas.
- No Main merge and no Production deployment.
- The change is CSS-only plus the E2E regression and evidence.

`READY FOR VISUAL REVIEW`
