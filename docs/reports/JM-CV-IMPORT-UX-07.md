# JM-CV-IMPORT-UX-07 — Premium Fullpage Decision Navigation

**Status:** `IMPLEMENTED / VISUALLY VERIFIED LOCAL`

**Branch:** `feature/jm-cv-import-ux-07`

**Implementation commit:** `4e3f0dd`

**Scope:** fullpage CV import only (`layoutMode="fullpage"`). The original
Jobsearch import dialog, PDF parsing, mapping, handoff and CV data flow are
unchanged.

## 1. Direct Decision Navigation

The review page now contains a fullpage-only jump button above the review list:

```text
✓ Auswahl getroffen? → Zu den Importaktionen
```

It:

- scrolls to the decision panel in normal document flow;
- moves focus to the decision panel;
- does not open the summary, apply an import or change any decision;
- uses `window.scrollTo` rather than a nested scroll container;
- respects `prefers-reduced-motion` by switching from smooth to automatic
  scrolling;
- uses the existing keyboard-focusable native button.

The decision panel includes:

```text
↑ Zurück zur Prüfung
```

which scrolls back and focuses the review heading.

## 2. Premium Decision Panel

The old fullpage preview action bar was replaced by a light frosted decision
card with:

- `DEINE IMPORTENTSCHEIDUNG`;
- the pending count from `manualDecisions` (not hard-coded);
- the note that previous decisions remain saved;
- `↑ Zurück zur Prüfung`;
- `← Zurück` (existing source step);
- `Import abbrechen` (existing close behavior);
- `✓ Angaben übernehmen →` (existing summary/import validation behavior).

The card is `position: static` and remains in normal document flow. There is no
sticky/fixed action bar, no new inner scroll container and no automatic scroll
on load. The page remains fully screenshotable.

The existing review pagination (`← Zurück | Seite 1 von 4 | Weiter →`) is
unchanged and remains separated from the decision card.

## 3. Responsive and Visual Verification

Synthetic PDF with 44 review lines produced **40 pending items across 4 review
pages**.

Verified at 1920, 1440, 768 and 390 px:

- no horizontal overflow;
- decision panel content and all four controls visible;
- buttons wrap vertically on mobile;
- review page remains scrollable and fullpage-capturable;
- no fixed/sticky action controls;
- page scroll position is 0 on first load.

Screenshots:

```text
docs/reports/assets/JM-CV-IMPORT-UX-07/
├── 01-fullpage-import-1920.webp
├── 02-responsive-1440.webp
├── 02-responsive-768.webp
├── 02-responsive-390.webp
├── 03-decision-panel-focus-1920.webp
└── 04-import-summary-1920.webp
```

## 4. Functional Test

`tests/e2e/cv-import-ux-07.mjs` verifies:

- 40 pending items and 4 review pages;
- jump by keyboard Enter;
- panel receives focus and no summary/import is triggered;
- pending count unchanged by navigation;
- back-to-review focus;
- one decision accepted without losing state;
- pending count updates from 40 to 39;
- pagination page 1 → 2 and back;
- reduced-motion emulation;
- existing summary → import flow;
- no page/console errors.

The fullpage screenshot with the long review and the complete decision card is
recorded in `01-fullpage-import-1920.webp`.

## 5. Tests and Build

| Check | Result |
|---|---|
| Focused import dialog tests | **20 PASS** |
| `cv-import-ux-07` fullpage E2E | **PASS** |
| `cv-builder-full-page-workspace-03a` | **PASS** |
| `cv-workspace-initial-render-01` | **PASS** |
| Full Vitest suite, serial | **2007 PASS / 11 skipped** |
| Production build | **PASS** |
| `git diff --check` | **PASS** |

## 6. Git

- Branch: `feature/jm-cv-import-ux-07`
- Implementation: `4e3f0dd`
- No Main merge and no Production deployment.
- No RIS, AWS, Cognito, consent, storage, profile-header or workspace-background
  changes.
