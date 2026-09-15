# STEP 37G-13 — Persistent Search Workspace Execution Log

## PLAN

1. Analyze search layout architecture causing visual jump
2. Implement persistent search workspace in App.tsx
3. Add necessary CSS for new layout
4. Update tests for new behavior contract
5. Verify all tests pass
6. Verify TypeScript and build
7. Commit and prepare for deployment

## ROOT CAUSE

The original architecture had two completely separate layout structures:

**Landing:**
```
.container
└── .landing
    ├── .navbar
    └── .landing-hero
```

**Results:**
```
.container.layout-split
├── .sidebar
│   ├── searchCard (duplicate of search-hero)
│   └── AlertCard
└── .content
    └── Results
```

This caused a visible layout jump because:
- The search form was NOT persisted
- The layout switched from landing-hero to layout-split
- CSS min-height on `.search-hero` caused jump: `clamp(560px, 74vh, 760px)`

## ARCHITECTURAL CHANGE

The new architecture uses a persistent search workspace:

```
.container.layout-search
├── .search-hero (always present)
│   └── .search-hero-inner
│       ├── .search-hero-text
│       └── .search-card
├── .results-area (when hasResults)
│   └── Results
└── .alerts-section (when !hasResults)
    └── AlertCard
```

Key changes:
1. Search panel is ALWAYS mounted, never removed
2. Results load independently in their own section
3. No conditional rendering of main content area
4. Layout structure remains stable throughout user flow

## TEST CONTRACT MIGRATION

The previous tests encoded the OLD layout contract. Tests were updated to validate the NEW contract:

**OLD assertions that were removed:**
- `.layout-split` must not exist before results
- `.search-hero` disappears after results
- `.hero` used for result header

**NEW assertions added:**
- `.search-hero` is ALWAYS truthy
- `.results-area` appears when results exist
- `.alerts-section` appears on error/empty state
- Search values preserved across transitions

Tests that required updates:
- `Bug-Regression: runSearch -> phase=searching`
- `Scoring (foundJobs gesetzt, Matches ausstehend)`
- `0 AI-Evaluation: kein Landing-Rücksprung`
- `Old results / Search Clearing A-G` tests
- `UX-/Datenquellen-Runde` tests

## IMPLEMENTATION

### 1. App.tsx Changes

**Before:**
```jsx
{showResults ? <Hero /> : <search-hero>}
{showResults ? <layout-split> : <alerts-section>}
```

**After:**
```jsx
<search-hero> (always)
  ├── .search-hero-inner
  │   ├── .search-hero-text
  │   └── .search-card
{hasResults ? <results-area> : <alerts-section>}
```

### 2. CSS Changes

**Initial CSS (Incorrect):**
- `.container.layout-search` used `display: grid` on desktop
- This created two columns, squeezing search-hero into narrow sidebar

**Fixed CSS:**
- `.container.layout-search` stays as `display: flex; flex-direction: column;` always
- `.search-hero` is WIDE, not squeezed
- `.search-hero-inner` uses flex to arrange text and card horizontally
- `.search-card` has `flex: 0 1 420px` for stable desktop width
- `.search-hero-text` has `flex: 1 1 auto` to fill remaining space
- Results and alerts appear BELOW search-hero, not beside

Key CSS rules for desktop (min-width: 900px):
```css
.container.layout-search {
  display: flex;          /* No grid splitting */
  flex-direction: column; /* Vertical stack */
}

.search-hero {
  width: 100%;            /* Full width */
  min-height: clamp(560px, 74vh, 760px);
}

.search-hero-inner {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 32px;
  max-width: 1220px;
  margin: 0 auto;
  padding: 72px 20px;
}
```

### 3. Test Changes

Updated assertions:
- `.layout-split` → `.results-area`
- `.search-hero` expectations changed to always truthy
- Removed `.hero` assertions (removed component usage)

## TEST RESULTS

```
Test Files  32 passed (32)
     Tests  348 passed (348)
```

All tests pass after migration to new contract.

## VISUAL VERIFICATION

### Initial State
- `/top` route loads matcher layout
- `.search-hero` visible with title, tagline, and search card
- `.alerts-section` shown (no results yet)

### Loading State
- Search form shows "Suche auf der Jobbörse…"
- `.search-hero` remains in DOM
- Values preserved in form fields

### Results State
- `.results-area` appears below search hero
- Matches displayed in Results component
- Search card remains visible for new searches

### Error State
- Status error shown in search card
- `.alerts-section` visibility toggled
- No layout jump occurs

## AI / PRIVACY

**AI behavior: UNCHANGED**

No changes to:
- AI matching logic
- AI providers
- AI payloads
- Consent mechanisms
- ATS module
- API contracts

**ai_auditlog.md:**
- Reviewed - no modifications needed
- All safety rules preserved
- No new AI pathways introduced

## GIT STATE

**Before commits:**
- HEAD: `7a3a164` (style: global design system)

**Production deployment commits:**
- Commit 1: `3853abc` (fix: stabilize persistent search workspace)
- Commit 2: `1fdd61d` (fix: correct persistent search workspace desktop layout)
- Commit 3: `4283538` (docs: update execution log with desktop layout fix details)
- **Production SHA: `4283538`**
- Build matches deployed commit: **YES**

**Files changed:**
- `src/App.tsx` - Layout restructuring, removed Hero usage
- `src/App.test.tsx` - Updated assertions for persistent-search contract
- `src/styles.css` - Fixed desktop layout to use flex not grid

### Corrected Desktop Layout

The initial CSS used `grid-template-columns` which created two columns and
squeezed the search-hero. Fixed to use `flex-direction: column` so search
always spans full width.

## DEPLOYMENT

Deployed to Vercel:
- Build succeeds
- No TypeScript errors
- Production-ready

## FINAL RESULT

### Verification Checklist

| Checkpoint | Status |
|------------|--------|
| Search visible initially | ✅ PASS |
| Search visible during loading | ✅ PASS |
| Search visible after results | ✅ PASS |
| Search visible on error | ✅ PASS |
| Values preserved | ✅ PASS |
| No layout jump | ✅ PASS |
| No duplicate form | ✅ PASS |
| ATS preserved | ✅ PASS |
| Tests | 348 passed |
| TypeScript | PASS |
| Build | PASS |

### Root Cause Summary
The visual jump was caused by two separate layout structures that swapped during navigation. The fix removes this by keeping the search panel persistent in a stable container.

### Architectural Fix Summary
- Search panel is always mounted in `.search-hero`
- Results load into `.results-area` or `.alerts-section`
- No more layout structure changes during user flow
- CSS uses grid/flex for responsive layout

**STEP 37G-13 STATUS: COMPLETE**