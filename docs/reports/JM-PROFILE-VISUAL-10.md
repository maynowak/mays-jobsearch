# JM-PROFILE-VISUAL-10 — Brighter Cyan Particles

**Status:** `IMPLEMENTED / VERIFIED LOCAL`  
**Branch:** `feature/jm-profile-visual-10`  
**Base:** `feature/jm-profile-visual-09` (`338861b`)  
**Scope:** profile particle layer only. Header, cards, dual-AI background, CV workspace, RIS, AWS, Cognito, consent and analytics unchanged.

## 1. Particle Changes

The existing 16 deterministic particles are preserved.

| Property | New range |
|---|---|
| Opacity | **0.60–0.90** |
| Animation duration | **14–22 s** |
| Colors | `#22D3EE`, `#67E8F9`, occasional `#A5F3FC` |
| Count | 16 desktop; 8 visible on mobile |
| Flight paths | Existing positions/directions retained |

Visual treatment:

- small white-cyan light core through a radial gradient;
- soft turquoise glow with two shadow layers;
- no larger particle count;
- no flashing or high-speed movement;
- GPU-friendly `translate3d` keyframes;
- `pointer-events: none`;
- `aria-hidden="true"`;
- z-index remains behind dashboard/cards/navigation;
- `prefers-reduced-motion: reduce` disables animation completely;
- mobile still hides particles 9–16.

Header, card style, faces, image proportions, masks and dark center were not changed.

## 2. E2E Verification

Browser E2E on the demo profile surface:

| Width | Visible particles | Contrast/header | Overflow |
|---|---:|---|---:|
| 1920 px | 16 | PASS | 0 px |
| 1440 px | 16 | PASS | 0 px |
| 768 px | 16 | PASS | 0 px |
| 390 px | 8 | PASS | 0 px |

Additional computed checks:

- particle opacity within `0.60–0.90`;
- animation duration within `14–22 s`;
- animation uses `profile-particle-drift`;
- particles cannot intercept pointers;
- reduced-motion computed animation: **`none`**.

Screenshots:

```text
docs/reports/assets/JM-PROFILE-VISUAL-10/
├── profile-1920.webp
├── profile-1440.webp
├── profile-768.webp
├── profile-390.webp
└── profile-reduced-motion-1440.webp
```

## 3. Tests and Build

| Check | Result |
|---|---|
| Particle/header/card unit tests | **8 PASS** |
| Browser E2E 4 widths | **PASS** |
| Reduced-motion E2E | **PASS** |
| Full Vitest suite | **2004 PASS / 11 skipped** |
| `npm run build` | PASS |
| Diff-check | PASS |

No production write, auth, RIS, consent, CV persistence or analytics operation
was performed.

## 4. Git

- Implementation: `5a964a4`
- Branch: `feature/jm-profile-visual-10`
- No Main merge and no Production deployment.

## 5. Open Points

- The visual E2E uses the existing synthetic `/dev/dashboard-v2` profile shell;
  no authenticated account or production write is involved.
- Particles remain decorative and are intentionally hidden behind content.
