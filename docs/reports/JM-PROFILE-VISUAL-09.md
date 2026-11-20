# JM-PROFILE-VISUAL-09 — Futuristic Profile Surface

**Status:** `IMPLEMENTED / VERIFIED LOCAL`  
**Branch:** `feature/jm-profile-visual-09`  
**Base:** `origin/main` (`5d7f3b3`)  
**Scope:** profile view only. CV workspace, RIS, AWS, Cognito, consent and analytics untouched.

## 1. Profile Header

The existing profile header now uses a dark 3D glass treatment:

- dark layered gradient;
- turquoise hairline border and light seam;
- outer depth shadow plus inner highlight;
- backdrop blur/saturation;
- high-contrast light heading and supporting text;
- status badges retain readable dark/active/soon color states;
- demo note remains readable on the dark surface.

Implemented in `src/styles.css` under the profile-only
`.layout-profile-command` selector.

## 2. Card Edges

Profile content cards now receive a restrained 3D frame:

- stepped light gradient surface;
- translucent turquoise border;
- inner white highlights;
- soft depth shadow;
- no exaggerated neon glow;
- hover treatment remains limited to existing interactive controls.

The dual-AI background, face proportions, masks and dark middle remain
unchanged.

## 3. Particle Layer

`src/components/ProfileParticles.tsx` renders:

- **16** deterministic particles;
- colors `#22D3EE`, `#06B6D4`, `#67E8F9`;
- different sizes, opacity, blur, durations and delays;
- GPU-friendly `translate3d(...)` CSS drift;
- static definitions, so React renders do not randomize layout;
- one `aria-hidden="true"` layer;
- `pointer-events: none`;
- z-index below `.dashboard-v2`/`.dashboard-v2-state`, so cards and navigation
  remain above it;
- mobile shows **8** particles;
- `prefers-reduced-motion: reduce` disables all particle animation.

No animation library, canvas or WebGL was added.

## 4. Responsive Verification

Browser E2E on the demo profile surface:

| Width | Particles visible | Header/cards | Overflow |
|---|---:|---|---:|
| 1920 px | 16 | PASS | 0 px |
| 1440 px | 16 | PASS | 0 px |
| 768 px | 16 | PASS | 0 px |
| 390 px | 8 | PASS | 0 px |

Reduced-motion context:

- computed particle `animation-name`: **`none`**
- static profile remains readable.

Screenshots:

```text
docs/reports/assets/JM-PROFILE-VISUAL-09/
├── profile-1920.webp
├── profile-1440.webp
├── profile-768.webp
├── profile-390.webp
└── profile-reduced-motion-1440.webp
```

## 5. Tests and Build

| Check | Result |
|---|---|
| Particle/header/card unit tests | **7 PASS** |
| Profile visual browser E2E | **PASS** |
| Reduced-motion browser check | **PASS** |
| Full Vitest suite | **2003 PASS / 11 skipped** |
| `npm run build` | PASS |
| `git diff --check` | PASS |

No production write, auth, RIS, consent, CV persistence or analytics operation
was performed.

## 6. Git

- Implementation: pending at report creation
- Branch: `feature/jm-profile-visual-09`
- No Main merge and no Production deployment.

## 7. Open Points

- Authenticated profile navigation was not exercised with a real login in this
  visual-only task; the shared profile shell and existing navigation tests are
  unchanged.
- Mobile intentionally shows fewer particles and prioritizes readability.
