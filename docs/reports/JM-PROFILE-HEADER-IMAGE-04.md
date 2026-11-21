# JM-PROFILE-HEADER-IMAGE-04 — Original Artwork Layout Correction

**Status:** `IMPLEMENTED / VISUALLY VERIFIED LOCAL`

**Branch:** `feature/jm-profile-header-image-04`

**Implementation commit:** `25a2a49`

**Baseline:** `feature/jm-profile-header-image-03`, `42d690e`

**Scope:** profile header artwork and responsive composition only. Dual-AI
background, particles, cards, navigation, navbar, CV workspace, RIS, AWS,
Cognito, consent and analytics are unchanged.

## 1. Correction

The previous composition placed the globe in the middle-right area. The
original artwork has the globe on the left, with the profile labels and
`Willkommen` copy above/over it, followed by the cyan grid waves flowing to the
right.

The header now follows that original reading direction again:

- globe left, not right of the profile copy;
- `DEV-MODUS`/`Aktiv`, `Profil` and `Willkommen` over the globe;
- original cyan wave field continuing left to right;
- no globe stretching;
- no visible seam, tile transition or abrupt vertical image edge.

## 2. Artwork Composition

Runtime assets:

```text
src/assets/images/jm-profile-header-cyan-composed.webp        2480 × 400
src/assets/images/jm-profile-header-cyan-composed-mobile.webp 744 × 464
```

Source remains exclusively `LeuchtendesProfilheaderHG.png` (2170 × 725) and
the prepared original-derived globe/wave assets. No new image generation and no
replacement motif.

Desktop:

- globe is positioned at the left edge area of the header;
- labels and copy are layered over it;
- the wave field remains continuous to the right border;
- globe proportions and original cyan brightness are retained;
- only the image composition is cropped/anchored, not the globe.

Mobile:

- dedicated reduced composition;
- globe is visibly smaller and remains on the left;
- text receives a stronger local readability scrim;
- text is not covered by a right-side globe.

## 3. Responsive CSS

`src/styles.css` uses:

- desktop header `min-height: 190px`;
- `background-position: left center` for the desktop artwork;
- `background-size: cover`, opacity `1`, no brightness/saturation filter;
- left-anchored tablet crop with the globe remaining in view;
- mobile-specific artwork at `min-height: 210px`;
- mobile text scrim and text shadow for complete copy readability;
- no image animation.

## 4. Visual Acceptance

Screenshots reviewed at 1920, 1440, 768 and 390 px, directly against the
original artwork:

```text
docs/reports/assets/JM-PROFILE-HEADER-IMAGE-04/
├── profile-1920.webp
├── profile-1440.webp
├── profile-768.webp
├── profile-390.webp
└── profile-reduced-motion-1440.webp
```

| Criterion | Result |
|---|---|
| Large globe remains on the left | PASS |
| `Aktiv`/`Profil`/`Willkommen` over the globe | PASS |
| Subtle dark overlay protects text only | PASS |
| Original cyan waves flow left to right | PASS |
| Waves retain detail and reach the right border | PASS |
| No globe distortion | PASS |
| No visible seams, tiles or abrupt edges | PASS |
| Original brightness / cyan retained | PASS |
| Desktop text and badges readable | PASS |
| Tablet crop: globe left, text over it | PASS |
| Mobile: reduced globe left, text fully readable | PASS |
| No horizontal page overflow | PASS |

Rendered header sizes:

| Width | Header | Result |
|---|---|---|
| 1920 px | 1180 × 190 | globe left under labels, waves to right edge |
| 1440 px | 1180 × 190 | globe left under labels, waves to right edge |
| 768 px | 722 × 190 | left-anchored crop, globe visible under copy |
| 390 px | 366 × 232 | dedicated mobile composition, globe left |

## 5. Tests and Build

| Check | Result |
|---|---|
| Profile command-center test | **4 PASS** |
| Header browser E2E 1920/1440/768/390 | **PASS** |
| Reduced-motion E2E | **PASS** |
| Header copy overflow | 0 |
| Horizontal page overflow | 0 px |
| Header opacity / filter | `1` / `none` |
| Full Vitest suite, serial | **2004 PASS / 11 skipped** |
| `npm run build` | PASS |
| `git diff --check` | PASS |

## 6. Git

- Branch: `feature/jm-profile-header-image-04`
- Implementation: `25a2a49`
- Baseline: `42d690e`
- No Main merge and no Production deployment.
- No RIS, AWS, Cognito, consent, analytics or production data operation.
