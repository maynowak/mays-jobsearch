# JM-PROFILE-LAYOUT-CONSISTENCY-13

**Status: READY FOR VISUAL REVIEW**

- Repository: `maynowak/mays-jobsearch`
- Branch: `feature/jm-profile-layout-consistency-13`
- Base: `origin/main` `e92d78b` (release `JM-APPLICATION-EDIT-TAB-NAVIGATION-01`)
- Scope: frontend layout and existing tests only. No RIS/AWS/Terraform/Cognito/consent/storage/ATS/AI/application-persistence change.
- No main merge, no production deployment, no force-push.

## 1. Root cause

Three independent rules changed the shared profile frame when the
applications section became active:

1. `.dashboard-v2--applications { width: min(1600px, 98vw); }`
   changed the whole dashboard shell from `min(1180px, 94vw)` to the wider
   value. Header, sidebar and content were re-centred and resized together.
2. `.dashboard-v2--applications .dashboard-v2__layout { grid-template-columns:
   minmax(200px, 0.22fr) minmax(0, 1fr); }`
   changed the sidebar column fraction, so the sidebar became narrower and
   moved left while the content moved left and became wider.
3. `body:has(.dashboard-v2--applications) .navbar { position: relative; }`
   removed the sticky/hide-on-scroll behaviour of the global navigation only
   in applications, so the main navigation behaved differently from every
   other profile section.

Additionally the applications layout stacked at `max-width: 980px` while all
other profile sections stacked only at `max-width: 767px`. Between 768 and
980 px the applications sidebar therefore became a full-width block instead
of the shared 210 px column.

Measured at 1440 px before the change:

| Section | Header left/width | Sidebar left/width | Main left/width | Navbar |
| --- | --- | --- | --- | --- |
| Overview | 130 / 1180 | 130 / 279 | 439 / 871 | sticky |
| Applications | 14 / 1411 | 14 / 249 | 293 / 1132 | relative (scrolls away) |

## 2. Architecture decision

One shared profile frame, one deliberately wider applications workspace:

- Header, sidebar and the mobile section switcher always use the shared
  `--jm-profile-shell-width: min(1180px, 94vw)`.
- The sidebar width is derived from that shared shell width
  (`--jm-profile-sidebar-width`), so a wider applications shell cannot change
  it.
- On screens `>= 1024px` only the applications dashboard gets extra width. It
  keeps the shared left edge and grows to the right into the available
  viewport. The header stays at the shared width and position.
- The global navbar is sticky/hide-on-scroll in every profile section again.
- All profile sections now use the same two-column / stacked breakpoints
  (two columns above 767 px, mobile switcher at and below 767 px). The
  applications workspace inside the main column becomes single-column at
  `<= 980px`.

This preserves the generous applications workspace without moving or resizing
the header, the sidebar or the main navigation, and without shrinking the
other profile sections.

Relevant CSS:

```css
.container.layout-profile-command {
  --jm-profile-shell-width: min(1180px, 94vw);
  --jm-profile-layout-gap: clamp(16px, 2.5vw, 30px);
  --jm-profile-sidebar-width: max(
    210px,
    calc((var(--jm-profile-shell-width) - var(--jm-profile-layout-gap)) * 0.32 / 1.32)
  );
}

@media (min-width: 1024px) {
  .layout-profile-command .dashboard-v2--applications {
    flex: 1 1 auto;
    width: auto;
    min-width: 0;
    max-width: none;
    margin-left: calc((100% - var(--jm-profile-shell-width)) / 2);
    margin-right: clamp(12px, 2vw, 24px);
  }

  .layout-profile-command .dashboard-v2--applications .dashboard-v2__header {
    width: var(--jm-profile-shell-width);
  }

  .layout-profile-command .dashboard-v2--applications .dashboard-v2__layout {
    grid-template-columns: var(--jm-profile-sidebar-width) minmax(0, 1fr);
  }
}
```

## 3. Changed components/files

- `src/styles.css` — shared frame variables, right-extending applications
  workspace, removed the applications-only navbar and 980 px stacking
  exceptions; applications inner workspace single-column at `<= 980px`.
- `tests/e2e/jm-profile-applications-responsive-fix-01.mjs` — extended from an
  applications-only responsive check to a profile-wide shell consistency
  check across all six sections at `320/390/768/900/980/1024/1440/1920`,
  including keyboard switching and reduced motion.
- `tests/e2e/jm-application-edit-tab-navigation-01.mjs` — extended with an
  edit-form/dialog clipping check at the same seven widths.
- No component, API, contract, persistence or auth file changed.

## 4. Before / after

At 1440 px after the change:

| Section | Header left/width | Sidebar left/width | Main left/width | Navbar |
| --- | --- | --- | --- | --- |
| Overview | 130 / 1180 | 130 / 279 | 439 / 871 | sticky |
| Applications | 130 / 1180 | 130 / 279 | 439 / 977 | sticky |

Across all six sections and widths `320 / 390 / 768 / 900 / 980 / 1024 /
1440 / 1920`:

- header position, width and top are identical in every section;
- sidebar position and width are identical in every section at `>= 768px`;
- horizontal page overflow is `0` at every width and in every section;
- applications is the only section whose main column is wider: `720px` at
  1024, `977px` at 1440, `1217px` at 1920 (other sections keep `710/871/871`).

The applications main is intentionally narrower than the former 1600 px shell
at 1440 px (1132 px before). That width was only possible by moving the whole
frame; the applications workspace remains 106 px wider than every other
profile section at 1440 px and 346 px wider at 1920 px. No other profile
section was shrunk.

Screenshots:

- `docs/reports/assets/JM-PROFILE-LAYOUT-CONSISTENCY-13/before-1440-overview.webp`
- `.../before-1440-applications.webp`
- `.../before-390-overview.webp`
- `.../before-390-applications.webp`
- `.../after-1440-overview.webp`
- `.../after-1440-applications.webp`
- `.../after-390-overview.webp`
- `.../after-390-applications.webp`
- `.../after-1024-applications.webp`
- `.../after-1920-applications.webp`
- `.../applications-<width>-top|middle|bottom.webp` from the responsive E2E

## 5. Tests

| Check | Result |
| --- | --- |
| `npx tsc -b` | PASS |
| `npm run build` | PASS |
| Focused Dashboard/Profile/Applications tests | **85 PASS** (5 files) |
| Full serial suite `npx vitest run --maxWorkers=1` | **2105 PASS / 5 skipped** (202 files) |
| `npm run test:e2e:profile-applications-responsive-fix-01` | PASS (8 widths, 6 sections, keyboard, reduced motion) |
| `node tests/e2e/jm-application-edit-tab-navigation-01.mjs` | PASS (main flow + 7-width form/dialog clipping) |
| `git diff --check` | PASS |
| Secret scan | PASS |

The responsive E2E asserts for every tab at every width:

- profile header rect identical to the overview baseline;
- sidebar rect identical at `>= 768px`;
- `overflow === 0`;
- applications controls present;
- global navigation sticky at `>= 768px`, mobile switcher below.

The edit-form check opens the application edit mask, verifies it and its first
field fit inside the viewport, opens the unsaved-edit decision and verifies the
dialog fits, at `320/390/768/900/1024/1440/1920`. The main flow still verifies
unchanged switch, dirty switch with save failure retention and retry,
own-letter create/reload/edit, preserved versions and no AI calls.

## 6. Accessibility

- Keyboard: applications and settings were opened with focus + Enter; the
  active navigation keeps `aria-current="page"` and the header/sidebar rects
  remain unchanged.
- The mobile switcher (`#dashboard-section-select`) remains the navigation
  control below 768 px.
- Focus outlines, 44 px targets, dialog semantics, Escape handling and the
  unsaved-edit focus return are unchanged (re-verified by the existing
  applications E2E and unit suites).
- `prefers-reduced-motion: reduce` is active during the keyboard run; layout
  and navigation remain stable.

## 7. Boundaries

- No RIS API or repository contract change.
- No Cognito/auth, consent/storage, Terraform/AWS change.
- No ATS, AI or cover-letter workflow change.
- No application data, persistence or migration change.
- No CV-builder change.
- No extra API request is introduced by the layout or tab switch; the E2E
  logs only the previously expected model/capability/application reads.
- No real application or account data was created or changed for this task.

## 8. Known limitations

- Applications content is wider only to the right of the shared frame; the
  header deliberately stays at the shared width, so its right edge does not
  follow the wider applications card on large screens.
- Between 981 and 1023 px the applications workspace uses the same width as
  the other sections (wide mode starts at 1024 px). This avoids a very narrow
  split workspace at tablet widths.
- Visual review of the before/after screenshots is still required.

## 9. Git

- Branch: `feature/jm-profile-layout-consistency-13`
- Base: `origin/main` `e92d78b`
- Implementation commit: `d183105`
- Documentation commit: this commit (report, screenshots and audit entry)

`JM-PROFILE-LAYOUT-CONSISTENCY-13 — READY FOR VISUAL REVIEW`
