# JM-CV-EDITOR-EXPANDED-VIEW-UX-01

**Status: READY FOR VISUAL REVIEW**

- Repository: `maynowak/mays-jobsearch`
- Branch: `feature/jm-cv-editor-expanded-view-ux-01`
- Base: `origin/main` `e92d78b`
- Scope: structured CV editor, editor radar, UX and existing tests.
- No main merge, no production deployment, no force-push, no branch deletion.
- No RIS/AWS/Terraform/Cognito/consent/CV-persistence/ATS/AI/import-mapping change.

## 1. Technical cause

The editor rendered eight collapsible `<details class="cv-builder-section">`
blocks, but had no control to open or close them together. The only way to
expand all sections was screenshot mode:

```ts
const [screenshotMode, setScreenshotMode] = useState(false);

const toggleScreenshotMode = () => {
  // store current open states, force every section open
  // set screenshotMode -> radar and scroll hands disappear
};
```

The radar was rendered only when `!screenshotMode`, so a complete editor view
was permanently coupled to the screenshot view without radar navigation.

## 2. State model

### Before

| Function | Sections | Radar / turbo hands |
| --- | --- | --- |
| Normal editor | individual, default collapsed | visible |
| Screenshot mode | forced all open | hidden |
| Expanded editor with radar | not available | not available |

### After

| Function | Sections | Radar / turbo hands |
| --- | --- | --- |
| Normal editor | individual, default collapsed | visible |
| “Alle Abschnitte aufklappen” | all open | **visible** |
| “Alle Abschnitte einklappen” | all closed | **visible** |
| Screenshot mode | all open for a clean capture | hidden |
| Exit screenshot mode | previous states restored | visible again |

`allSectionsExpanded` is derived from the native `<details>` `toggle` events,
so the shared button label and `aria-pressed` remain correct after individual
sections are opened or closed.

## 3. Implementation

- New fullpage-only header action next to the width and screenshot controls:
  - `Alle Abschnitte aufklappen` / `Expand all sections`
  - `Alle Abschnitte einklappen` / `Collapse all sections`
- `toggleAllSections()` opens or closes every `.cv-builder-section` inside the
  editor dialog. It does not touch `screenshotMode`, `wideMode`, `template`,
  `mobileView`, draft data or validation.
- The button exposes `aria-pressed`, keeps focus, is at least 44 px high and is
  full width on mobile.
- Screenshot mode keeps its existing behaviour: store states, open all for the
  capture, hide radar/scroll hands/editing controls, restore exactly the
  previous states on exit.
- Radar targets and the validation summary are unchanged. Radar navigation and
  “Zum ersten Fehler” still open the affected section; the existing
  `pendingErrorFocus`/`radarFocusPath` paths focus the field.
- Turbo hands remain coordinated through the existing
  `onBeforeNavigate={() => scrollHandsRef.current?.stop()}`. The E2E confirms
  no `scrollBy` tick during radar navigation.
- No `RadarNavigator` core change, no new editor architecture.

## 4. Changed files

- `src/components/CvBuilderEditor.tsx` — expand/collapse state, handler,
  header action, existing screenshot restoration.
- `src/i18n.tsx` — DE/EN labels.
- `src/styles.css` — 44 px button, pressed style, focus ring, mobile width.
- `src/components/CvBuilderEditor.test.tsx` — expand/collapse, individual
  state, input/validation/preview/template retention, first-error focus,
  screenshot restoration, DE/EN.
- `src/components/CvBuilderEditorNavigator.test.tsx` — radar/hands remain in
  the expanded view and return with restored sections after screenshot mode.
- `tests/e2e/jm-cv-editor-navigator-03.mjs` — existing radar E2E extended with
  expand/collapse marker positions, validation from collapsed state, preview/
  template checks, screenshot restoration, API comparison and mobile coverage.

## 5. Tests

| Check | Result |
| --- | --- |
| `npx tsc -b` | PASS |
| `npm run build` | PASS |
| Focused editor/radar suites | **31 PASS** (2 files) |
| Full serial suite `npx vitest run --maxWorkers=1` | **2110 PASS / 5 skipped** (202 files) |
| E2E `jm-cv-editor-navigator-03` (extended) | PASS |
| Regression `cv-builder-ux-08` | PASS |
| `git diff --check` | PASS |
| Secret scan | PASS |

Extended E2E evidence (synthetic empty CV):

- initial editor: 8 sections collapsed, 9 radar markers, turbo hands present;
- expand all: all sections open, radar and hands visible, screenshot class
  absent, `aria-pressed="true"`, 9 markers within 2 px of their measured
  targets;
- collapse all: all sections closed, radar/hands still visible, markers within
  2 px;
- a filled name, the selected `Modern` template and the live preview are
  unchanged by expand/collapse;
- validation: collapse all, then “Zum ersten Fehler” opens the personal
  section and focuses the invalid email field;
- screenshot mode from an expanded state hides radar/hands, keeps sections
  open, and restores the expanded state on exit; the same works from a
  collapsed state;
- mobile 390: expand all, no overflow, screenshot mode hides the radar, exit
  restores the expanded state;
- keyboard radar navigation after the layout toggle causes **0** turbo-hand
  `scrollBy` ticks;
- 0 API requests during all view actions, 0 console/page errors.

The first full-suite run hit an unrelated Docker `beforeAll` startup timeout in
`tests/integration/ip-quota-parallel.test.mjs`; that file passed in isolation
(6/6), the leftover test container was removed and the repeated serial full run
passed completely.

Note: `cv-builder-workflow-02a` is a pre-existing E2E with an outdated save
button label (“Lebenslauf speichern” vs. the current “Entwurf übernehmen”); it
fails on the base commit as well and is unrelated to this change.

## 6. Screenshots

`docs/reports/assets/JM-CV-EDITOR-EXPANDED-VIEW-UX-01/`

Before (base `e92d78b`):

- `before-normal-1440.webp` — collapsed sections, radar/hands visible, no
  expand control
- `before-screenshot-1440.webp` — all sections open, radar/hands hidden
- `before-normal-390.webp`
- `before-screenshot-390.webp`

After:

- `expanded-1440.webp` — all sections open **with radar and hands**
- `collapsed-1440.webp` — collapsed with radar
- `radar-1440-screenshot-mode.webp` — screenshot view without radar
- `expanded-390.webp` / `screenshot-mode-390.webp`
- existing radar/error/focus/1920/768/mobile-panel evidence

## 7. Responsive and accessibility

- E2E checked 1440, 1920, 768 and 390; no horizontal overflow.
- Mobile radar trigger and panel stay clear of the editor and turbo hands.
- Button is keyboard operable, at least 44 px, full width on mobile, has a
  visible focus ring and exposes `aria-pressed`.
- Focus remains on the shared action after toggling; field focus from the
  validation summary is verified.
- `prefers-reduced-motion: reduce` is active in the final E2E phase; the
  existing reduced-motion scroll/marker behaviour is unchanged.
- ARIA of sections, radar markers, validation summary and live preview is
  unchanged.

## 8. API request comparison

| Phase | API requests |
| --- | --- |
| Initial editor | 0 |
| After expand | 0 |
| After collapse | 0 |
| Validation navigation | 0 |
| Screenshot enter/exit | 0 |
| Mobile expand/screenshot | 0 |

No AI, RIS, ATS, model or persistence call is triggered by a view action.

## 9. Known limitations

- Screenshot mode continues to auto-expand all sections for a clean capture;
  the previous individual states are restored on exit.
- Expand/collapse applies to the eight `.cv-builder-section` blocks. Skill
  chips, preview and footer actions are not collapsible sections.
- The pre-existing stale `cv-builder-workflow-02a` E2E is unchanged and fails
  on its outdated button label.
- Visual review of the before/after screenshots is still required.

## 10. Git

- Branch: `feature/jm-cv-editor-expanded-view-ux-01`
- Base: `origin/main` `e92d78b`
- Implementation commit: `483aa5d`
- Documentation commit: this commit

`JM-CV-EDITOR-EXPANDED-VIEW-UX-01 — READY FOR VISUAL REVIEW`
