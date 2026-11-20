# JM-CV-UX-08 — Dual AI Profile Background

**Status:** `MERGED TO MAIN / PRODUCTION DEPLOYED / PRODUCTION E2E VERIFIED`

**Branch:** `feature/jm-cv-ux-08-dual-ai-profile-background`

**Merge commit:** `3545dc2` (PR #45)

**Base:** `origin/main` `81db09a`

**Scope:** profile background only. No CV-workspace, RIS, AWS, Cognito, consent or analytics changes.

## 1. Source and Asset Preparation

Source:

```text
/home/dci-student/Downloads/Ki-Hintergrund-Profil-duble.jpg
5824 × 3264 JPEG
```

The image already has the required composition:

- turquoise face on the left;
- orange-blue face on the right;
- dark flexible middle;
- colored light strips toward the bottom.

Optimized WebP derivatives:

```text
src/assets/images/jm-profile-dual-left.webp
src/assets/images/jm-profile-dual-right.webp
```

The source was not stretched. The left and right motifs are rendered with
`background-size: cover`; no `100% 100%` sizing is used anywhere.

## 2. Profile CSS Implementation

Only the profile shell is targeted:

```css
.container.layout-dashboard.layout-profile-command
```

Changes:

- left face: `::before` pseudo-element;
- right face: `::after` pseudo-element;
- central area: flexible CSS gradient, independent of card height;
- full profile height: `inset-block: 0`;
- face proportions preserved with `background-size: cover`;
- soft inner masks fade each face into the middle gradient;
- no independent width/height distortion;
- bottom radial light/color bands and darkening gradient;
- no mirroring of UI or text;
- profile nav/cards remain above the background via the existing z-index
  layer and an explicit guest-state stacking context;
- profile card surfaces are opaque enough for tablet/mobile readability.

No CV workspace selectors or editor behavior were changed.

## 3. Responsive Results

| Viewport | Result |
|---|---|
| 1920 px | both faces visible at the sides, central dark area, cards readable |
| 1440 px | both faces visible, proportional, central area flexible |
| 768 px | both motifs partially cropped as allowed; cards readable |
| 390 px | faces remain subtle at the sides; cards/text take priority; no horizontal overflow |

No horizontal overflow was measured at any of the four widths.

## 4. Verification

Browser E2E:

```bash
node tests/e2e/jm-cv-ux-08-dual-ai-profile-background.mjs
```

Result: **PASS** for 1920, 1440, 768 and 390 px.

Checks:

- left and right assets resolved;
- `background-size: cover` and no transform distortion;
- central gradient and bottom color bands present;
- no horizontal overflow;
- screenshots generated.

Screenshots committed under:

```text
docs/reports/assets/JM-CV-UX-08/
├── profile-1920.webp
├── profile-1440.webp
├── profile-768.webp
└── profile-390.webp
```

## 5. Tests and Build

| Check | Result |
|---|---|
| Profile command-center test | **4 PASS** |
| Dual-background browser E2E | **PASS** |
| Full Vitest suite | **2000 PASS / 11 skipped** |
| `npm run build` | PASS |
| `git diff --check` | PASS |

No production write, auth, RIS, consent, CV persistence or analytics operation
was performed.

## 6. Release and Production E2E

- PR #45 merged to `origin/main` as `3545dc2`; branch retained.
- Code: `ecddb45`; docs/audit: `94a82bf`.
- Automatic Vercel main deployments:
  - `www.mays-job-matcher.app` → `dpl_cvKoc4JonauV48DU8Bz8DtjW1XVc` READY
  - `mays-jobsearch.vercel.app` → `dpl_HZitg8q5ZgUMSSyrmJEwPUDv2rco` READY
- Read-only production browser E2E against `https://www.mays-job-matcher.app/profil`:
  - 1920, 1440, 768 and 390 px: HTTP 200
  - left/right WebP assets resolved from production
  - `background-size: cover`, no transform distortion
  - central gradient present
  - **0 px horizontal overflow** at all widths
  - no page/console errors
- No production writes or authenticated account operations were performed.

## 7. Open Points

- The authenticated profile navigation was not driven through a real login in
  this visual-only task; the shared profile shell is used by all three profile
  route renderings and retains existing navigation tests.
- Mobile presentation intentionally gives readability priority over showing
  both faces fully.
