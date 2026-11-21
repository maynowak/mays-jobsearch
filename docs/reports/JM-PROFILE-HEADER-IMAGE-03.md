# JM-PROFILE-HEADER-IMAGE-03 — True Artwork Composition Fix

**Status:** `IMPLEMENTED / VISUALLY VERIFIED LOCAL`

**Branch:** `feature/jm-profile-header-image-03`

**Implementation commit:** `c954658`

**Base:** `origin/main` (`048563a`)

**Scope:** profile header artwork and responsive composition only. Dual-AI
background, particles, glass cards, profile navigation, navbar, CV workspace,
RIS, AWS, Cognito, consent and analytics are unchanged.

## 1. Root Cause

The previous header used `background-size: auto 100%` for the wave image. The
actual header height was about 164 px, so the 4500 × 725 wave image was only
about 1018 px wide inside the 1180 px header. The result was the visible dark
strip at the right edge. The separate globe layer was also only about 130 px in
diameter because it scaled with the same short header.

This was not fixed with another CSS-only offset. The header now uses a
precomputed composition matched to the desktop header aspect ratio, plus a
separate mobile composition.

## 2. Artwork

Source only:

```text
LeuchtendesProfilheaderHG.png
2170 × 725 original
```

Prepared runtime assets:

```text
src/assets/images/jm-profile-header-cyan-composed.webp        2480 × 400
src/assets/images/jm-profile-header-cyan-composed-mobile.webp 744 × 464
```

The desktop composition contains:

- dark left text area;
- the original cyan globe, scaled proportionally to about 165–175 px at the
  rendered 1180 px header width;
- the wave field extended horizontally behind the globe to the right edge;
- a soft left shade only, ending before the globe;
- no new AI generation, no replacement motif and no brightness/saturation
  filter.

The mobile composition uses the same original globe and wave source at a
reduced scale, with the globe on the right and a protected text area on the
left.

## 3. CSS Composition

`src/styles.css` now uses:

- desktop header `min-height: 190px`;
- one precomposed image with `background-size: cover`;
- no opacity reduction and no `filter`;
- left text protection overlay only up to about 39%;
- tablet crop anchored left so the globe stays visible;
- mobile breakpoint with the dedicated mobile asset at `210px` minimum height;
- no image animation and no additional image libraries.

The prior separate globe `::before` layer and the short wave layer were
removed from the runtime CSS.

## 4. Visual Acceptance

Screenshots reviewed at 1920, 1440, 768 and 390 px:

```text
docs/reports/assets/JM-PROFILE-HEADER-IMAGE-03/
├── profile-1920.webp
├── profile-1440.webp
├── profile-768.webp
├── profile-390.webp
└── profile-reduced-motion-1440.webp
```

| Criterion | Result |
|---|---|
| Globe clearly larger and fully round | PASS |
| Waves continuously to the right header edge | PASS |
| No abrupt vertical image edges | PASS |
| Original cyan brightness preserved | PASS |
| Header text and badges readable | PASS |
| 768 px controlled crop with visible globe | PASS |
| 390 px reduced independent composition, no overflow | PASS |
| No hard tile/repetition transition | PASS |

Observed rendered geometry:

| Width | Header | Globe/result |
|---|---|---|
| 1920 px | 1180 × 190 | globe about 175 px, waves to right edge |
| 1440 px | 1180 × 190 | globe about 169 px, waves to right edge |
| 768 px | 722 × 190 | left-anchored crop, globe visible, waves to edge |
| 390 px | 366 × 232 | dedicated mobile composition, reduced globe, no overflow |

## 5. Tests and Build

| Check | Result |
|---|---|
| Profile command-center test | **4 PASS** |
| Header browser E2E 1920/1440/768/390 | **PASS** |
| Header copy overflow | 0 |
| Horizontal page overflow | 0 px |
| Header opacity / filter | `1` / `none` |
| Reduced-motion E2E | **PASS** |
| Full Vitest suite, serial | **2004 PASS / 11 skipped** |
| `npm run build` | PASS |
| `git diff --check` | PASS |

The first parallel full-suite run produced three unrelated timeout failures in
`apify-client` and `CvBuilderEditorRisStorage`. Both files passed in isolation
(26/26), and the complete serial run passed 2004/11. No header test failed.

## 6. Git

- Branch: `feature/jm-profile-header-image-03`
- Implementation: `c954658`
- No Main merge and no Production deployment.
- No RIS, AWS, Cognito, consent, analytics or production data operation.
