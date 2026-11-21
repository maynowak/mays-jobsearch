# JM-CV-WORKSPACE-INITIAL-RENDER-01 — CV Workspace Initial Background

**Status:** `IMPLEMENTED / VISUALLY VERIFIED LOCAL`

**Branch:** `feature/jm-cv-workspace-initial-render-01`

**Implementation commit:** `fe4a22c`

**Scope:** the two decorative CV-workspace background layers only. No handoff,
CV data, RIS, AWS, Cognito, consent or analytics change.

## 1. Reproduction and Diagnosis

The actual new-tab handoff was reproduced with a synthetic PDF:

1. Profile import review → **In neuem Tab öffnen**
2. Workspace `loading → import`
3. Measurement at DOMContentLoaded, first import paint, fonts/image
   decoding plus two animation frames, after 500 ms, after resize, and after
   the import summary.

### Measured before the fix

| Stage | Document height | `::before` height | `::after` height |
|---|---:|---:|---:|
| Direct workspace / summary | 1000 px | 1000 px | 1000 px |
| Long import workspace | 2682.53 px | 2682.53 px | 2682.53 px |

`background-size` remained `cover, cover`; positions remained stable. The
background was already identical after fonts, image decode, two RAFs, 500 ms
and resize. There was therefore **no decode/reflow race and no initial CSS
timing issue**.

The permanent difference was caused by both decorative pseudo-layers being
tied to the document height:

```css
position: absolute;
inset: 0;
background-size: cover;
```

A tall import workspace therefore scaled/cropped the city and human artwork
differently from the short reference view. The reference view at
`2026-11-21 15:11:51` uses the short viewport composition.

## 2. Correction

The decorative layers are now viewport-bound instead of document-bound:

```css
position: fixed;
height: 100dvh;
```

Both `.cv-workspace-page::before` (city) and `.cv-workspace-page::after`
(digital human) retain their existing images, colors, masks, positions,
`cover` sizing and opacity. No JavaScript, timers, reload, hiding or handoff
change was introduced.

## 3. Verification

The regression test opens the actual popup handoff with a synthetic PDF and
checks six stages at **1920 × 1080**:

```text
01 first open
02 handoff complete / import first paint
03 document.fonts.ready + image decode + two RAFs
04 after 500 ms
05 after resize
06 import summary
```

All six stages report:

- decorative layer height: **1080 px**, even when the import document is
  **2682.53 px** tall;
- identical city/human `background-size` and `background-position`;
- no horizontal overflow;
- no page or console errors.

Screenshots:

```text
docs/reports/assets/JM-CV-WORKSPACE-INITIAL-RENDER-01/
├── 01-first-open.webp
├── 02-handoff-complete.webp
├── 03-fonts-images-two-raf.webp
├── 04-after-wait.webp
├── 05-after-resize.webp
└── 06-import-summary.webp
```

The first import render now shows the full city image on the left and the full
digital human on the right, matching the short reference composition.

## 4. Tests

| Check | Result |
|---|---|
| New first-tab-open regression | **PASS** |
| `tests/e2e/jm-cv-design-02.mjs` | **PASS** |
| Full Vitest suite, serial | **2005 PASS / 11 skipped** |
| `npm run build` | PASS |
| `git diff --check` | PASS |

## 5. Git

- Branch: `feature/jm-cv-workspace-initial-render-01`
- Implementation/test: `fe4a22c`
- No Main merge and no Production deployment.
- No Cognito, RIS, AWS, consent or analytics changes.
