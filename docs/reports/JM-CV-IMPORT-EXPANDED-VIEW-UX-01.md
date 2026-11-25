# JM-CV-IMPORT-EXPANDED-VIEW-UX-01

**Status: READY FOR VISUAL REVIEW**

- Repository: `maynowak/mays-jobsearch`
- Branch: `feature/jm-cv-import-expanded-view-ux-01`
- Base: `origin/main` `e92d78b`
- Scope: CV import preview, radar visibility, UX and existing tests.
- No main merge, no production deployment, no force-push, no branch deletion.
- No RIS/AWS/Terraform/Cognito/consent/CV-persistence/ATS/AI/import-mapping change.

## 1. Technical cause

The fullpage import preview had only one state:

```ts
const [screenshotMode, setScreenshotMode] = useState(false);
```

`toggleScreenshotMode()` did two things at once:

1. it stored the current `<details>` open states and forced every
   `.cv-import-section__details` open;
2. it set `screenshotMode = true`.

The radar was rendered only when `!screenshotMode`:

```tsx
{fullpage && step === "preview" && !screenshotMode && <RadarNavigator … />}
```

There was no control to expand all sections without entering screenshot mode,
and the screenshot mode was the only way to get the full CV view. This coupled
display completeness to radar visibility.

## 2. State model

### Before

| Function | Sections | Radar |
| --- | --- | --- |
| Normal preview | individual / default collapsed | visible |
| Screenshot view | forced all open | hidden |
| Expanded view with radar | not available | not available |

### After

| Function | Sections | Radar |
| --- | --- | --- |
| Normal preview | individual, default collapsed | visible |
| “Alle Abschnitte aufklappen” | all open | **visible** |
| “Alle Abschnitte einklappen” | all closed | **visible** |
| Screenshot view | all open for a clean display | hidden |
| Exit screenshot view | previous states restored | visible again |

The new `allSectionsExpanded` state is derived from the native `<details>`
`toggle` events, so the button label and `aria-pressed` stay correct after
individual sections are opened or closed by the user.

## 3. Implementation

### Expand / collapse all

- New fullpage-only button in the import header:
  - `Alle Abschnitte aufklappen` / `Expand all sections`
  - `Alle Abschnitte einklappen` / `Collapse all sections`
- `toggleAllSections()` reads the current `.cv-import-section__details`
  elements and opens or closes all of them. It does not touch
  `screenshotMode`, import decisions, filters, pagination or selection.
- The button sets `aria-pressed` from the derived all-open state.
- Import status markers and the radar remain mounted.
- On mobile the button is full width and at least 44 px high.

### Screenshot mode

- Still stores the current section states, opens all sections for a clean
  display and hides the radar plus floating/action controls.
- Leaving screenshot mode restores exactly the states captured on entry,
  including an explicitly expanded or collapsed view.
- No import decision, candidate choice, filter, page or draft data is changed.

### Radar

- The shared `RadarNavigator` and its existing `ResizeObserver` /
  `MutationObserver` measurement are reused unchanged.
- Expand/collapse changes the region height; the existing observer re-measures
  the markers. No second radar implementation and no synthetic marker
  positions were added.

## 4. Changed files

- `src/components/CvBuilderImportDialog.tsx` — independent expand/collapse
  state, toggle handler, button semantics, screenshot restoration unchanged.
- `src/i18n.tsx` — DE/EN labels for expand/collapse all.
- `src/styles.css` — 44 px button and mobile full-width action.
- `src/components/CvBuilderImportDialog.test.tsx` — expand/collapse
  independence, decisions/state preservation through screenshot mode,
  DE/EN labels.
- `src/components/CvBuilderImportNavigator.test.tsx` — radar stays in the
  expanded view and returns after screenshot mode with restored details.
- `tests/e2e/jm-cv-import-navigator-02.mjs` — existing radar E2E extended
  with expand/collapse marker re-measurement, API-request comparison,
  screenshot restore cycles and mobile coverage.

No component re-architecture, no new API, no parser/mapping changes.

## 5. Tests

| Check | Result |
| --- | --- |
| `npx tsc -b` | PASS |
| `npm run build` | PASS |
| Focused import/radar suites | **39 PASS** (3 files) |
| Full serial suite `npx vitest run --maxWorkers=1` | **2108 PASS / 5 skipped** (202 files) |
| E2E `jm-cv-import-navigator-02` (extended) | PASS |
| Regression `cv-import-ux-07` | PASS |
| Regression `cv-builder-import-ux-02d` | PASS |
| `git diff --check` | PASS |
| Secret scan | PASS |

Extended E2E evidence (synthetic PDF, no real CV/RIS/AI):

- initial view: sections collapsed, radar present, 14 markers;
- expand all: every section open, radar present, screenshot class absent,
  `aria-pressed="true"`, all 14 markers within 2 px of their measured targets;
- collapse all: every section closed, radar present, markers within 2 px;
- screenshot from expanded state: radar `0`, sections open, exit restores
  expanded state and re-measures markers;
- screenshot from collapsed state: exit restores collapsed state;
- candidate decision before screenshot remains completed afterwards;
- mobile 390: expand all, radar present, no overflow, screenshot hides radar,
  exit restores the expanded state;
- API requests during all view toggles: **0** (no new AI/RIS/ATS calls);
- console/page errors: 0.

The first full-suite run hit an unrelated Docker `beforeAll` startup timeout in
`tests/integration/ip-quota-parallel.test.mjs`; that file passed in isolation
(6/6) and the repeated serial full run passed completely.

## 6. Screenshots

`docs/reports/assets/JM-CV-IMPORT-EXPANDED-VIEW-UX-01/`

Before (base `e92d78b`):

- `before-normal-1440.webp` — collapsed sections, radar visible, no expand
  control
- `before-screenshot-1440.webp` — sections open, radar hidden
- `before-normal-390.webp`
- `before-screenshot-390.webp`

After:

- `expanded-1440.webp` — all sections open **with radar**
- `collapsed-1440.webp` — collapsed with radar
- `radar-1440-screenshot-mode.webp` — screenshot view without radar
- `expanded-390.webp` / `screenshot-mode-390.webp`
- existing radar hover/status/1920/768/mobile-panel evidence

## 7. Responsive and accessibility

- Fullpage E2E checked 1440, 1920, 768 and 390; no horizontal overflow.
- Mobile radar trigger stays clear of the card; mobile panel remains usable.
- Keyboard marker navigation, decision-panel focus and Escape focus return
  remain PASS in the existing radar E2E.
- Expand/collapse button is keyboard operable, has a visible 44 px target and
  exposes `aria-pressed`.
- `prefers-reduced-motion: reduce` remains active in the final E2E phase;
  navigation uses the existing reduced-motion scroll behavior.
- ARIA of sections, decision panel and radar markers is unchanged.

## 8. API request comparison

| Phase | API requests |
| --- | --- |
| Initial preview | 0 |
| After expand | 0 |
| After collapse | 0 |
| Screenshot enter/exit | 0 |

No AI, RIS, ATS, download or model call is triggered by any view change.

## 9. Known limitations

- Screenshot mode continues to auto-expand all sections for a clean capture;
  the previous individual states are restored on exit.
- Expand/collapse applies to the collapsible `.cv-import-section__details`
  blocks. The skills list has no collapsible details block and is always
  visible.
- The section summary label remains “Details anzeigen” even when the section
  is open (native `<summary>` text, pre-existing behaviour).
- Visual review of the before/after screenshots is still required.

## 10. Git

- Branch: `feature/jm-cv-import-expanded-view-ux-01`
- Base: `origin/main` `e92d78b`
- Implementation commit: `754ed1e`
- Documentation commit: this commit

`JM-CV-IMPORT-EXPANDED-VIEW-UX-01 — READY FOR VISUAL REVIEW`
