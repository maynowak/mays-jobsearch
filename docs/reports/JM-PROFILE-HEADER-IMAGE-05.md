# JM-PROFILE-HEADER-IMAGE-05 — Premium Layered Globe & Cyan Waves

**Status:** `IMPLEMENTED / VISUALLY VERIFIED LOCAL`

**Branch:** `feature/jm-profile-header-image-05`

**Implementation commit:** `5bf44d3`

**Baseline:** `feature/jm-profile-header-image-04`, `afdf17b`

**Scope:** profile header artwork only. Dual-AI background, cyan particles,
profile cards, navigation, navbar, CV workspace, RIS, AWS, Cognito, consent and
analytics are unchanged.

## 1. Provided Assets

Source PNGs used directly, without image generation:

```text
Leuchtender Globus mit Amerika-Fokus.png      1261 × 1247 RGBA
Neon-Türkis Wireframe-Wellen.png              2170 × 725 RGBA
```

Optimized runtime assets:

```text
src/assets/images/jm-profile-globe.webp       720 × 712, alpha, 59 KB
src/assets/images/jm-profile-waves.webp       2170 × 725, alpha, 601 KB
```

The globe and wave PNGs were checked individually on a checkerboard and dark
background:

- globe fully isolated and round;
- wave graphic contains no embedded globe;
- alpha corners are transparent, with no black or white rectangular image
  background;
- original colors retained.

Evidence:

```text
docs/reports/assets/JM-PROFILE-HEADER-IMAGE-05/asset-globe-checker.webp
docs/reports/assets/JM-PROFILE-HEADER-IMAGE-05/asset-waves-checker.webp
```

## 2. Layer Architecture

The header now uses the requested independent layers:

```text
Layer 0: dark premium glass background
Layer 1: .dashboard-v2__header-waves     → jm-profile-waves.webp
Layer 2: .dashboard-v2__header-globe     → jm-profile-globe.webp
Layer 3: local text contrast overlay     → header::after
Layer 4: .dashboard-v2__header-copy      → badges, title, welcome text
```

The globe is an independent `<img>` with `object-fit: contain`,
`pointer-events: none`, `aria-hidden="true"` and `alt=""`. It is positioned
above the wave layer. No composed background image is used.

## 3. Header Styling

- Dark glass remains: dark radial/linear background, cyan border, inset light
  edge and existing depth shadows.
- Wave layer: one proportional `cover` image with controlled vertical crop,
  no repeated tiles and transparent edges.
- Globe layer: 175 px desktop, 150 px tablet, 126 px mobile; always round.
- Text layer: local left-side gradient only; no global opacity or filter.
- Header min-height: 190 px desktop/tablet; 210 px minimum on mobile.
- No image animation and no additional neon effects.

## 4. Visual Acceptance

Screenshots reviewed at 1920, 1440, 768 and 390 px:

```text
docs/reports/assets/JM-PROFILE-HEADER-IMAGE-05/
├── profile-1920.webp
├── profile-1440.webp
├── profile-768.webp
├── profile-390.webp
├── profile-reduced-motion-1440.webp
├── asset-globe-checker.webp
└── asset-waves-checker.webp
```

| Criterion | Result |
|---|---|
| Globe fully visible and round | PASS |
| Globe positioned left | PASS |
| Globe above the wave layer | PASS |
| Waves never run in front of the globe | PASS |
| `Aktiv`/`Profil`/`Willkommen` over the globe | PASS |
| Waves visible across header to right edge | PASS |
| No hard image edges or tile repetition | PASS |
| Original cyan brightness retained | PASS |
| Local text contrast only | PASS |
| Desktop text/badges readable | PASS |
| Tablet and mobile text fully readable | PASS |
| No horizontal overflow | PASS |

Rendered geometry:

| Width | Header | Globe |
|---|---|---|
| 1920 px | 1180 × 190 | 175 px, left |
| 1440 px | 1180 × 190 | 175 px, left |
| 768 px | 722 × 190 | 150 px, left |
| 390 px | 366 × 232 | 126 px, left |

## 5. Tests and Build

| Check | Result |
|---|---|
| Profile command-center tests | **5 PASS** |
| Header E2E 1920/1440/768/390 | **PASS** |
| Header copy overflow | 0 |
| Horizontal page overflow | 0 px |
| Page/console errors | 0 |
| Reduced-motion E2E | **PASS** |
| Full Vitest suite, serial | **2005 PASS / 11 skipped** |
| `npm run build` | PASS |
| `git diff --check` | PASS |

## 6. Git

- Branch: `feature/jm-profile-header-image-05`
- Implementation: `5bf44d3`
- Baseline: `afdf17b`
- No Main merge and no Production deployment.
- No RIS, AWS, Cognito, consent, analytics or production data operation.
