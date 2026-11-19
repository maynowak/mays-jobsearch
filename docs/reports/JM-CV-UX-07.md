# JM-CV-UX-07 — Background & View Consistency

**Status:** `IMPLEMENTED / VERIFIED LOCAL`  
**Branch:** `feature/jm-cv-ux-07-background-view-consistency`  
**Scope:** CSS/layout and visual verification only. No CV persistence, RIS, consent or auth changes.

## 1. CV Workspace View Switch

`Ansicht wechseln` toggles the existing screenshot/editor layout. It still
changes only the editor presentation (open sections, overflow and scroll
layout); it does not change CV data.

The background inconsistency came from the workspace side-art pseudo-elements
being positioned against the document height. Expanding all editor sections
therefore changed their height/crop even though no background class changed.

Fixed in `src/styles.css`:

- `.cv-workspace-page::before` and `::after` are now viewport-fixed.
- The workspace gradient uses `background-attachment: fixed`.
- The existing view-switch layout rules remain otherwise unchanged.

Verified computed styles before and after the switch are identical:

- same background image/position/size,
- same fixed pseudo-element positions,
- same gradient attachment.

## 2. Profile Background

Asset added:

```text
src/assets/images/jm-profile-ai-face.webp
```

Source: provided `Ki-Hintergrund-Profil.jpg`, optimized to 2400 × 1345 WebP.

Implementation:

- separate `::before` pseudo-element for the image;
- `transform: scaleX(-1)` mirrors only the image, never UI/text;
- face is positioned on the left and looks toward the profile surface;
- separate `::after` gradient overlay preserves contrast;
- background covers the full profile shell;
- responsive positions for desktop and mobile;
- existing light profile cards, navigation and text remain readable.

No profile/card markup or data flow was changed.

## 3. Visual Verification

Screenshots committed under:

```text
docs/reports/assets/JM-CV-UX-07/
```

- `workspace-editor-1440.webp`
- `workspace-screenshot-1440.webp`
- `workspace-390.webp`
- `profile-1440.webp`
- `profile-390.webp`

Checks:

- desktop and mobile rendering;
- workspace normal view ↔ view-switch view;
- profile navigation/shell route;
- no horizontal overflow at 390 px or 1440 px;
- computed profile image is mirrored (`matrix(-1, 0, 0, 1, 0, 0)`);
- gradient overlay is a separate layer.

## 4. Quality Gates

| Check | Result |
|---|---|
| Focused profile/editor tests | **21 PASS** |
| Workspace/profile browser E2E | **PASS** |
| Screenshots | **5 created** |
| Full Vitest suite | **2000 PASS / 11 skipped** |
| `npm run build` | PASS |
| `git diff --check` | PASS |

No page/console errors were reported by the E2E run. No API writes, auth
changes, RIS calls, consent changes or CV persistence changes occurred.

## 5. Git

- Implementation commit: pending at report creation
- Branch: `feature/jm-cv-ux-07-background-view-consistency`
- No Main merge and no Production deployment.

## 6. Open Points

- The authenticated profile navigation was not driven through a real login in
  this visual-only task; the shared profile shell is used by all three profile
  route renderings and is covered by the existing component navigation tests.
- No production deployment or live profile/CV write was performed.
