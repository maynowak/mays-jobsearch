# JM-CV-BUILDER-UX-08A — Workspace Footer & Release Preparation

**Status:** `READY FOR CONTROLLED MERGE`

**Branch:** `feature/jm-cv-builder-ux-08a`

**Implementation commit:** `84ac3f0`

**Baseline:** `feature/jm-cv-builder-ux-08` (`630fa4f`)

## 1. Shared Legal Footer

`CvBuilderWorkspacePage` now renders the existing shared `Footer` component
exactly once in every workspace mode, after the main document content:

- loading;
- import review;
- editor;
- error;
- start.

It provides the existing legal navigation and release information:

- `/impressum`
- `/datenschutz`
- `/datenschutzprinzipien`
- existing version/environment/branch/commit information.

No legal text was duplicated. Only the shared footer's colors were adapted to
the dark workspace surface. The footer is `position: relative`, not sticky or
fixed.

The existing CV editor action row remains unchanged. The legal footer is placed
after the editor and therefore does not alter the Turbo target calculation for
`.cv-builder-footer > .cv-builder-footer__actions`.

## 2. UX-08 Verification

The separate fullpage editor still has:

- `⛶ Breite maximieren` / `↔ Normalbreite`;
- `☝️ Nach oben`;
- `👇 Turbo nach unten`.

Verified with a synthetic long CV:

| Check | Result |
|---|---|
| Normal → maximized → normal | PASS |
| Main width 1120 → 1920 → 1120 | PASS |
| Editor box 1024 → 1766 → 1024 | PASS |
| CV data preserved | PASS |
| Turbo hover start/acceleration | PASS |
| Turbo stops with footer action row fully visible | PASS |
| Footer action stop position | 3,453 px |
| Scroll up to editor header | PASS |
| Mouseleave / Escape / manual wheel | PASS |
| No restart while pointer remains | PASS |
| Keyboard Enter jump | PASS |
| Reduced Motion | PASS |
| Screenshot view removes hands/maximize control | PASS |
| No horizontal overflow | PASS |
| Hands do not overlap editor at 1440/768/390 | PASS |

The shared legal footer exists at the document end and is not part of the
floating controls or the editor action bar. The import review is unchanged and
does not receive the flying-hands feature.

## 3. Screenshot Capability

- No sticky website footer.
- No additional inner scroll container.
- The floating controls remain hidden in the existing editor screenshot view.
- Fullpage screenshot still captures the complete document, including the
  legal footer.
- CV data is untouched.

Screenshots:

```text
docs/reports/assets/JM-CV-BUILDER-UX-08A/
├── 00-normal-1920.webp
├── 01-wide-1920.webp
├── 02-screenshot-view-1920.webp
├── 03-responsive-1440.webp
├── 03-responsive-768.webp
├── 03-responsive-390.webp
├── 04-turbo-footer-1920.webp
└── 05-workspace-footer-1920.webp
```

## 4. Tests and Build

| Check | Result |
|---|---|
| Workspace footer component test | PASS |
| Focused workspace/footer tests | PASS |
| Fullpage UX-08 E2E 1920/1440/768/390 | PASS |
| Footer links/version/no duplicate/no sticky | PASS |
| Turbo stop with footer present | PASS |
| Screenshot mode | PASS |
| Full Vitest suite, serial | **2010 PASS / 11 skipped** |
| Production build | PASS |
| `git diff --check` | PASS |

## 5. Release Diff Review

Against `origin/main`:

- **81 files changed**, +3,055 / -81 lines;
- **18 commits ahead**, 0 behind at review time;
- scope is the cumulative CV/UX and profile-artwork feature branches plus their
  reports/screenshots;
- no RIS, AWS, Cognito, consent, storage API, PDF parser, ATS mapping or
  backend contract files are changed;
- no Main merge and no Production deployment.

## 6. Git

- Branch: `feature/jm-cv-builder-ux-08a`
- Implementation: `84ac3f0`
- Baseline: `630fa4f`
- No Main merge and no Production deployment.

**READY FOR CONTROLLED MERGE**
