# JM-PROFILE-VISUAL-11 — Cyan Glow Cards · Brighter Profile · Silver Glass Header

**Status:** `READY FOR VISUAL REVIEW`  
**Branch:** `feature/jm-profile-visual-11`  
**Base:** `origin/main` `91f92a4`  
**Scope:** profile surface only (`src/styles.css` scoped to `.layout-profile-command`), focused CSS test, visual E2E and documentation.

## 1. Changes

### Cyan glow cards

Outer profile cards now share a visible turquoise frame and soft glass depth:

- `2px` cyan border (`rgba(34, 211, 238, 0.62)`), lighter top edge for a glass highlight.
- Subtle cyan outer glow and inner white highlight.
- Existing rounded corners and card positions retained.
- Applied only to outer profile cards:
  - `.dashboard-v2__main > .aurora-card`
  - `.dashboard-v2__cv-section`
  - `.applications-section`
  - `.storage-consent`
  - `.dashboard-v2__manual-profiles`
  - `.may-help`
- Left navigation card keeps a deliberately quieter `1px` cyan frame.
- No additional borders were added to every inner input field.
- Existing keyboard focus outlines were not changed.

### Brighter profile surface

- Dark navy base remains.
- Middle area is visibly brighter with petrol/blue tones (`#0a3a50` at the centre).
- Added a soft cyan reflection and retained the existing orange/cyan lower glows.
- Left/right AI artwork pseudo-elements were not changed: same asset, size, position, masking and animation.
- Card text remains on opaque/light glass surfaces.

### Silver metallic glass header

- `.layout-profile-command .dashboard-v2__header` now uses a silver-to-petrol glass gradient:
  - bright silver/metallic highlight at the left;
  - smooth transition into dark petrol at the right;
  - subtle diagonal white reflection.
- Existing wave and globe elements remain untouched and layered as before.
- Header copy remains white with stronger local text shadow for readability over silver.
- Header geometry, globe position/size and wave positioning are unchanged.
- `jm-profile-globe.webp` and `jm-profile-waves.webp` were not modified.

## 2. Verification

| Check | Result |
|---|---|
| `ProfileCommandCenter.test.tsx` | **6/6 PASS** |
| Visual E2E `node tests/e2e/jm-profile-visual-11.mjs` | **PASS** |
| Viewports 1920 / 1440 / 768 / 390 | no horizontal overflow |
| Areas checked | Übersicht, Hilfe, Lebenslauf, Bewerbungen, Einstellungen |
| Card frame/glow checks | PASS for all visible outer cards |
| Header silver layer / brighter centre | PASS |
| Globe and wave assets/positions | retained |
| Reduced motion | particle animation `none` |
| `npm run build` | **PASS** (1,44 s) |
| Full Vitest suite | **2030 PASS / 11 skipped** |
| `git diff --check` | PASS |

## 3. Evidence

```text
docs/reports/assets/JM-PROFILE-VISUAL-11/
├── profile-overview-1920.webp
├── profile-overview-1440.webp
├── profile-overview-768.webp
├── profile-overview-390.webp
├── profile-help-1440.webp
├── profile-cv-1440.webp
├── profile-applications-1440.webp
├── profile-settings-1440.webp
└── profile-reduced-motion-1440.webp
```

## 4. Boundaries

- No RIS, AWS, Cognito, consent, CV, ATS or storage changes.
- No header/globe/wave asset changes.
- No Main merge and no Production deployment.
- Visual check uses the synthetic demo profile surface only.
