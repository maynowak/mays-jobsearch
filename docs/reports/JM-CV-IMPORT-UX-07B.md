# JM-CV-IMPORT-UX-07B — Screenshot & Navigation Completion

**Status:** `IMPLEMENTED / VISUALLY VERIFIED LOCAL`

**Branch:** `feature/jm-cv-import-ux-07b`

**Implementation commit:** `4b26de4`

**Baseline:** `feature/jm-cv-import-ux-07` (`74601a9`)

**Scope:** fullpage CV import only plus styling of the original modal workspace
action. The original dialog behavior, PDF parsing, mapping, handoff, CV data
and storage remain unchanged.

## 1. Screenshot View

The fullpage import header now has:

```text
📸 Screenshot-Ansicht
Screenshot-Ansicht beenden
```

Behavior:

- toggles a `cv-import-workspace--screenshot` presentation;
- opens every existing section detail for a complete capture and restores the
  original open/closed state on exit;
- hides Help, overview jumps, the internal decision jump, review filters,
  per-item controls, and the decision panel;
- keeps the current review page, pagination, pending count and decisions
  unchanged;
- keeps the document in normal flow with full document height;
- introduces no fixed/sticky elements, inner scroll container or download
  action;
- the exit control remains available in the header.

## 2. Immediate Decision Jump

A second decision action is now in the fullpage import header:

```text
↓ Direkt zur Importentscheidung
```

It is available as soon as the preview is rendered, without scrolling the
review list. It:

- scrolls to the existing decision card;
- focuses the decision panel;
- does not apply/import anything;
- does not change pending or accepted decisions;
- uses the same reduced-motion handling as the existing in-review jump.

The existing `✓ Auswahl getroffen? → Zu den Importaktionen` button stays in
the review list.

## 3. Original Import Dialog

The original modal workspace action is now a prominent cyan-accented button:

```text
↗ In neuem Tab öffnen
```

The modal close control and the existing import action row were harmonized
with a 44 px target, consistent border radius, spacing and focus treatment.
No handler, validation or import behavior changed.

## 4. Visual and Functional Verification

Synthetic PDF: **44 review lines → 40 pending items across 4 review pages.**

Verified:

- modal workspace button is visible and styled;
- screenshot view activates and exits;
- screenshot view preserves pending count, current page and decisions;
- section open/closed state restores after exit;
- header decision jump is visible immediately after opening the preview;
- keyboard Enter moves focus to the decision panel;
- navigation does not open the summary or perform an import;
- existing in-review jump remains available;
- pagination 1 → 2 → 1 remains functional;
- one decision is preserved and pending count changes 40 → 39;
- existing summary and editor flow completes;
- 1920/1440/768/390 render without horizontal overflow;
- Reduced Motion is active for the second jump;
- no page/console errors.

Screenshots:

```text
docs/reports/assets/JM-CV-IMPORT-UX-07B/
├── 00-import-modal-1920.webp
├── 01-fullpage-import-1920.webp
├── 02-responsive-1440.webp
├── 02-responsive-768.webp
├── 02-responsive-390.webp
├── 03-decision-panel-focus-1920.webp
├── 04-import-summary-1920.webp
└── 05-screenshot-view-1920.webp
```

## 5. Tests and Build

| Check | Result |
|---|---|
| Focused import dialog tests | **21 PASS** |
| Fullpage import E2E | **PASS** |
| Fullpage screenshot view E2E | **PASS** |
| Existing `cv-builder-full-page-workspace-03a` | **PASS** |
| Existing `cv-workspace-initial-render-01` | **PASS** |
| Full Vitest suite, serial | **2008 PASS / 11 skipped** |
| Production build | **PASS** |
| `git diff --check` | **PASS** |

## 6. Git

- Branch: `feature/jm-cv-import-ux-07b`
- Implementation: `4b26de4`
- No Main merge and no Production deployment.
- No PDF/ATS/RIS/AWS/Cognito/consent/storage/profile-header/workspace-background
  changes.
