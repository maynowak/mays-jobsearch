# JM-CV-BUILDER-UX-08 — Wide Workspace & Dual Turbo Scroll

**Status:** `MERGED TO MAIN / PRODUCTION DEPLOYED`

**Branch:** `feature/jm-cv-builder-ux-08`

**Implementation commit:** `0fe1673`

**Release:** included in PR #52, merged to `origin/main` as `c1cb1f8`; production deployment at `c1cb1f8`.

**Baseline:** `feature/jm-cv-import-ux-07b` (`ad5d70e`)

**Scope:** separate fullpage CV editor only. The import flow, PDF parsing,
mapping, validation, storage, handoff, profile header and workspace background
are unchanged.

## 1. Wide Workspace

The fullpage editor header now provides:

```text
⛶ Breite maximieren
↔ Normalbreite
```

- Normal width remains the default.
- Maximized width uses the full available workspace width.
- The existing editor/preview grid remains in place and both columns grow.
- The CV data is not recreated or changed by the toggle.
- No horizontal scrollbar is introduced.
- The screenshot view hides the maximize control.

Measured at 1920 px:

| State | Main width | Editor box width |
|---|---:|---:|
| Normal | 1120 px | 1024 px |
| Maximized | 1920 px | 1766 px |
| Restored | 1120 px | 1024 px |

## 2. Dual Scroll Hands

A fixed dark-glass control is shown at the right edge of the fullpage editor:

```text
☝️ ↑
👇 ↓
```

Both controls are at least 44 × 44 px and use accessible labels. The editor
reserves space for them at narrow widths, and the E2E verifies that they do not
cover the editor box at 1440, 768 or 390 px.

### Turbo down

- Hover starts after **400 ms**.
- Speed ramps from **200 px/s** toward **6,000 px/s** over about 3.2 s.
- Speed is reduced over the last 600 px and capped by the remaining distance.
- The actual target is `.cv-builder-footer > .cv-builder-footer__actions`.
- The animation stops when the footer action row is fully visible.
- It never scrolls blindly to the absolute document end.

Observed with the synthetic long CV:

```text
scrollY after 520 ms:        13
scrollY after 1,270 ms:      227
turbo target / stop:         5,521
```

### Scroll up

- Hover starts after 180 ms.
- Constant speed: 1,200 px/s.
- Stops when the structured CV editor header is at the top of the viewport.
- No turbo ramp is used.

### Safety behavior

The animation stops immediately on:

- pointer leave;
- Escape;
- wheel/manual scroll;
- window blur;
- screenshot mode/unmount;
- reaching the target.

A manual interruption suppresses restart while the pointer remains on the same
hand. Moving to the other hand is treated as a new deliberate activation.

Click/touch and keyboard Enter use the direct jump path instead of the hover
animation. `prefers-reduced-motion: reduce` disables the accelerated hover
scroll; direct jumps use automatic scrolling.

## 3. Screenshot Protection

When the existing editor screenshot view is active:

- both scroll hands are removed;
- the maximize control is removed;
- the animation is stopped by component unmount/cleanup;
- the document remains in normal flow at full height;
- no inner scroll container is introduced;
- the complete editor remains fullpage-screenshot capable.

## 4. Verification

Synthetic long CV: one personal entry and **10 experience entries**, giving a
document height of roughly 6,700 px at 1440 px.

The E2E covers:

- normal → maximized → normal;
- wide layout/editor columns;
- CV data preservation;
- hover start, acceleration and footer stop;
- full visibility of the footer action row;
- equal-speed scroll up and editor-header stop;
- mouseleave, Escape and manual wheel stops;
- no restart while the pointer stays on the hand;
- keyboard Enter jump and click jump;
- reduced motion;
- screenshot view hiding hands and maximize control;
- 1920/1440/768/390 without horizontal overflow;
- hand/editor non-overlap at all responsive widths;
- no page/console errors.

Screenshots:

```text
docs/reports/assets/JM-CV-BUILDER-UX-08/
├── 00-normal-1920.webp
├── 01-wide-1920.webp
├── 02-screenshot-view-1920.webp
├── 03-responsive-1440.webp
├── 03-responsive-768.webp
├── 03-responsive-390.webp
└── 04-turbo-footer-1920.webp
```

## 5. Tests

| Check | Result |
|---|---|
| Focused editor tests | **18 PASS** |
| Fullpage scroll/width E2E | **PASS** |
| Reduced Motion | **PASS** |
| Screenshot mode | **PASS** |
| Full Vitest suite, serial | **2009 PASS / 11 skipped** |
| Production build | **PASS** |
| `git diff --check` | **PASS** |

## 6. Git

- Branch: `feature/jm-cv-builder-ux-08`
- Implementation: `0fe1673`
- No Main merge and no Production deployment.
- No RIS, AWS, Cognito, consent, storage, import, parsing, mapping, profile or
  workspace-background changes.
