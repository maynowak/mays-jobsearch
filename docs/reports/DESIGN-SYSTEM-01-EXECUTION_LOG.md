# DESIGN-SYSTEM-01 — FINAL CONSISTENCY REVIEW

## 1. PLAN

Deep technical audit of the design-system implementation in Mays-Jobsearch repository (HEAD 728dffb). Read-only investigation of git state, design tokens, hard-coded values, palette consistency, theme readiness, documentation accuracy, and change history. Local validation via test, typecheck, and build commands.

## 2. ACTUAL GIT STATE

- **repository path**: /home/dci-student/projects/Mays-Jobsearch
- **branch**: main
- **HEAD**: 728dffb94f824fbc043257206f14553ba5f72729
- **HEAD commit message**: "style: update card styles to light beige gradient and light yellow border"
- **working tree**: clean (git status --short returns empty)
- **remote**: origin → git@github.com:maynowak/mays-jobsearch.git (fetch/push)
- **synchronization**: branch is up to date with origin/main (verified via `git status` output: "Ihr Branch ist auf demselben Stand wie 'origin/main'")

## 3. 728DFFB INVESTIGATION

**Commit 728dffb** changed exactly 2 files:

### docs/AI_AUDITLOG.md
- Added entry: "# BORDER COLOR UPDATE - Updated border-primary color to #5afff0 after CSS changes."
- Modified header separators (=== vs ====)

### src/styles.css (97 lines changed, 56 insertions / 48 deletions)
**New design tokens added to :root:**
- `--border-primary: #5afff0` (cyan/teal)
- `--border-radius-primary: 30px`
- `--main-gradient: linear-gradient(180deg, #fff 0%, #dbf5fd 55%, #dbf5fd 100%)` (white → light cyan)

**Component changes (all cards now use the new gradient + thick border):**
- `.card` → background: var(--main-gradient), border: 3px solid var(--border-primary)
- `.search-card` → background: var(--main-gradient), border: 3px solid var(--border-primary)
- `.alert-card` → background: var(--main-gradient), border-color: var(--border-primary)
- `.remaining-card` → background: var(--main-gradient), border: 3px solid var(--border-primary), border-radius: var(--border-radius-primary)
- `.match-card` → background: var(--main-gradient), border: 3px solid var(--border-primary)
- `.modal-box` → border: 3px solid var(--border-primary), border-radius: var(--border-radius-primary)
- `.ats-section` → border: 3px solid var(--border-primary), border-radius: var(--border-radius-primary), border: 1px solid var(--border) (double border!)

**Border-radius changes (12px → var(--border-radius-primary) = 30px):**
- `a.navbar-title`, `.city-suggestions`, `.cv-dropzone`, `.model-popover`, `.tag`, `.modal-box`, `.ats-section`, and several other selectors

**Visual effect**: All cards now have a light cyan gradient background (#fff → #dbf5fd) with a thick 3px cyan border (#5afff0) and large 30px border-radius. This is a significant visual departure from the previous "cool mint/turquoise" design system established in commits 7a3a164, 124ee20, f4dee5d, and 1b3c623.

## 4. TOKEN ARCHITECTURE

### Centralized tokens in :root (src/styles.css:1-19):
| Token | Value | Type |
|-------|-------|------|
| --bg | #f8fafc | page background |
| --surface | #ffffff | card/component surface |
| --text | #1b2333 | primary text |
| --muted | #6b6255 | secondary text |
| --brand | #0d9488 | primary brand (teal) |
| --brand-dark | #0f766e | brand dark variant |
| --brand-light | #a7f3d3 | brand light variant |
| --accent | #22d3ee | accent (cyan) |
| --border | #e5e7eb | default border |
| --radius | 14px | default border-radius |
| --shadow | 0 10px 30px rgba(92, 76, 50, 0.1) | default shadow |
| --green | #16a34a | semantic success |
| --amber | #d97706 | semantic warning |
| --red | #dc2626 | semantic error |
| --border-primary | #5afff0 | NEW: primary card border |
| --border-radius-primary | 30px | NEW: primary card radius |
| --main-gradient | linear-gradient(...) | NEW: primary card background |

### Tokens actually used across components:
- **Well-used**: --bg, --surface, --text, --muted, --brand, --brand-dark, --brand-light, --accent, --border, --radius, --shadow, --green, --amber, --red
- **Newly added but inconsistently applied**: --border-primary, --border-radius-primary, --main-gradient (applied to cards but not all components)

### Missing token categories:
- No semantic surface tokens (--surface-elevated, --surface-hover, --surface-pressed)
- No semantic border tokens beyond --border and --border-primary
- No shadow scale (--shadow-sm, --shadow-md, --shadow-lg, --shadow-xl)
- No spacing scale
- No typography scale (font sizes, weights, line heights)
- No z-index scale
- No transition/duration tokens

## 5. HARD-CODED VALUES

| Value | File | Location | Classification | Reason |
|-------|------|----------|----------------|--------|
| #f8fafc | styles.css:33 | body background | A — GLOBAL DESIGN TOKEN | Page background should be tokenized (already --bg exists but not used here) |
| #f8fafc, #f1f5f9, #e8f2f0, #d9f0ee | styles.css:345-348, 1859, 1927 | search-hero gradient, button gradients | A — GLOBAL DESIGN TOKEN | Workspace/hero gradients appear in 3 places, should be centralized |
| #fffdf9 | styles.css:573, 597, 647, 1032, 1081, 1308, 1345 | input/select backgrounds, popover | B — SEMANTIC / COMPONENT TOKEN | Form surface color, distinct from --surface |
| #e2d7c1 | styles.css:571, 595, 645, 1030, 1082, 1128 | input/select/check borders | B — SEMANTIC / COMPONENT TOKEN | Form border color (warm beige), not using --border |
| #c9b28a | styles.css:584, 610, 656, 1038, 1043, 1120, 1552, 1796 | focus borders, checked states, accents | B — SEMANTIC / COMPONENT TOKEN | Form focus/active accent (warm gold) |
| #a49883 | styles.css:579, 601, 602, 709, 712, 972, 1062, 1150 | placeholder, select arrow, city PLZ | B — SEMANTIC / COMPONENT TOKEN | Form muted/secondary text color |
| #f6efe2 / #f6efdd | styles.css:657, 705 | checked item hover, city suggestion hover | C — INTENTIONAL LOCAL VALUE | Component-specific hover states |
| #8a6f43 | styles.css:712 | city PLZ text | C — INTENTIONAL LOCAL VALUE | Component-specific |
| #4f8282 | styles.css:881 | drag-over icon color | C — INTENTIONAL LOCAL VALUE | Component-specific drag state |
| #37506e | styles.css:1307, 1344, 1411, 1623, 1811 | button text, link colors | B — SEMANTIC / COMPONENT TOKEN | Interactive element color (dark teal) |
| #efe9db / #6f5f3f | styles.css:1429-1430 | badge-jobtype | C — INTENTIONAL LOCAL VALUE | Component-specific badge |
| #ede7da / #5f5748 | styles.css:1434-1435 | badge-contract | C — INTENTIONAL LOCAL VALUE | Component-specific badge |
| #6d5630 | styles.css:1449 | remaining-salary | C — INTENTIONAL LOCAL VALUE | Component-specific |
| #b39a72 | styles.css:1663 | rank number | C — INTENTIONAL LOCAL VALUE | Component-specific |
| #e9f1e4 / #3f6b43 | styles.css:1683-1685 | score-high | D — ACCIDENTAL HARDCODE | Should use --green / semantic tokens |
| #f9eed6 / #96681f | styles.css:1689-1691 | score-mid | D — ACCIDENTAL HARDCODE | Should use --amber / semantic tokens |
| #f9e9e4 / #a35c44 | styles.css:1695-1697 | score-low | D — ACCIDENTAL HARDCODE | Should use --red / semantic tokens |
| #eeece3 / #5a5140 | styles.css:1745-1746 | badge default | C — INTENTIONAL LOCAL VALUE | Component-specific |
| #eaf1ea / #4f6b52 | styles.css:1750-1751 | badge-remote | C — INTENTIONAL LOCAL VALUE | Component-specific |
| #e8ecf3 / #41526b | styles.css:1755-1756 | badge-source | C — INTENTIONAL LOCAL VALUE | Component-specific |
| #f0e6cf / #7a6238 | styles.css:1760-1762 | badge-evaluated | C — INTENTIONAL LOCAL VALUE | Component-specific |
| #f0f9f9 / #6b6255 | styles.css:1773-1775 | tag | D — ACCIDENTAL HARDCODE | Tag uses hardcoded background, should use token |
| #faf6ec / #ede3cf | styles.css:1784-1785 | why box | C — INTENTIONAL LOCAL VALUE | Component-specific |
| #f6eddb / #c9a86b | styles.css:1795-1796 | prepare box | C — INTENTIONAL LOCAL VALUE | Component-specific |
| #8a6f43 | styles.css:1803 | prepare strong | C — INTENTIONAL LOCAL VALUE | Component-specific |
| linear-gradient(180deg, #f8fafc... | styles.css:1859, 1927 | button gradients (landing-cta, find-btn, alert-btn, letter-btn, cv-confirm) | A — GLOBAL DESIGN TOKEN | Primary button gradient appears in 2 variants, should be tokenized |
| rgba(13, 148, 136, 0.4) | styles.css:1842 | button border | B — SEMANTIC / COMPONENT TOKEN | Button border uses brand with opacity |
| box-shadow values (multiple) | styles.css:1860-1865, 1875-1880, etc. | button shadows | B — SEMANTIC / COMPONENT TOKEN | Complex button shadows not tokenized |
| #fff / #dbf5fd | styles.css:18 (--main-gradient) | card gradient | A — GLOBAL DESIGN TOKEN | New gradient token but hardcoded in definition |
| #5afff0 | styles.css:16 (--border-primary) | card border | A — GLOBAL DESIGN TOKEN | New border token but hardcoded in definition |
| 30px | styles.css:17 (--border-radius-primary) | card radius | A — GLOBAL DESIGN TOKEN | New radius token but hardcoded in definition |
| 10px | styles.css:572, 596, 646, 753, 765, 913, 961, 1031, 1221, 1253 | input/select/button radius | C — INTENTIONAL LOCAL VALUE | Form control radius (smaller than cards) |
| 8px | styles.css:695, 765, 1098, 1310, 1347, 1563, 1573, 1636, 1828, 2012, 2054, 2141 | small element radius | C — INTENTIONAL LOCAL VALUE | Tag, popover, dropdown radius |
| 999px | styles.css:149, 1676, 1742 | pill/circle radius | C — INTENTIONAL LOCAL VALUE | Full-rounded elements |
| 4px | styles.css:1573, 1636, 191, 2141 | tiny radius | C — INTENTIONAL LOCAL VALUE | Code, pre, small elements |
| 2px | styles.css:191 | burger line radius | C — INTENTIONAL LOCAL VALUE | Component-specific |
| ConsentGate.tsx:13, 31, 39 | bg-white, bg-blue-600, text-gray-600, etc. | Tailwind-like classes | D — ACCIDENTAL HARDCODE | Entire component uses non-design-system classes |
| PrivacyNotice.tsx:11-13 | bg-yellow-50, border-yellow-200, text-yellow-800, etc. | Tailwind-like classes | D — ACCIDENTAL HARDCODE | Entire component uses non-design-system classes |
| AtsOverlay.tsx:174, 184, 284, 313 | style={{ marginTop: '16px' }} | inline styles | C — INTENTIONAL LOCAL VALUE | Layout spacing |
| AtsOverlay.tsx:314 | style={{ color: 'var(--red)', fontSize: '0.9rem' }} | inline style | B — SEMANTIC / COMPONENT TOKEN | Uses --red token but hardcodes font-size |

## 6. PALETTE CONSISTENCY

### Active Design Tokens (from :root):
- **Primary brand**: #0d9488 (teal), #0f766e (dark), #a7f3d3 (light), #22d3ee (accent cyan)
- **Neutral**: #f8fafc (page bg), #ffffff (surface), #1b2333 (text), #6b6255 (muted), #e5e7eb (border)
- **Semantic**: #16a34a (green), #d97706 (amber), #dc2626 (red)

### Legacy Warm Values (still present in code):
| Value | Locations | Status |
|-------|-----------|--------|
| #fffdf9 | 6 locations | Active - form input backgrounds |
| #e2d7c1 | 6 locations | Active - form borders |
| #c9b28a | 8 locations | Active - form focus/checked accent |
| #a49883 | 8 locations | Active - form placeholder/secondary |
| #f6efe2 / #f6efdd | 2 locations | Active - checked/hover states |
| #8a6f43 | 2 locations | Active - city PLZ, prepare strong |
| #f4eee2 / #faf6ec / #ede3cf | 4 locations | Active - html-content, why box |
| #f6eddb / #c9a86b | 2 locations | Active - prepare box |

### New Values from 728dffb:
- **#5afff0** (--border-primary): Bright cyan - used on ALL cards as 3px border
- **#dbf5fd** (in --main-gradient): Light cyan - used as card background gradient end color
- **30px** (--border-radius-primary): Large radius - used on cards, modals, dropdowns

### Assessment:
The warm beige/cream values (#fffdf9, #e2d7c1, #c9b28a, #a49883, #f6efe2, #8a6f43) are **active legacy values** from the pre-teal design system (commits before 7a3a164). They persist in form components (inputs, selects, checkboxes, autocomplete) and were NOT migrated in the "remove legacy warm colors" commit 124ee20 — that commit only touched alert-card, search-card, check-item, city-suggestions, and score colors.

The 728dffb values (#5afff0, #dbf5fd, 30px) are **intentional but undocumented visual deviations**. The commit message says "light beige gradient and light yellow border" but the actual values are cyan/light-cyan, not beige/yellow. The AI_AUDITLOG.md entry claims "Updated border-primary color to #5afff0" which matches the code but the commit message is inaccurate.

## 7. THEME READINESS

### Current variable-driven properties:
- Page background: --bg (but body uses hardcoded #f8fafc)
- Card surfaces: --surface (but cards now use --main-gradient)
- Text: --text, --muted
- Borders: --border, --border-primary
- Border radius: --radius, --border-radius-primary
- Shadows: --shadow (but many hardcoded shadows exist)
- Brand colors: --brand, --brand-dark, --brand-light, --accent
- Semantic: --green, --amber, --red

### Properties requiring additional tokens for dark mode:
| Property | Current State | Needed for Dark Mode |
|----------|---------------|---------------------|
| Page background | Hardcoded #f8fafc on body | --bg-dark or [data-theme="dark"] override |
| Card background | --main-gradient (hardcoded gradient) | Semantic surface tokens (--surface, --surface-elevated) |
| Form backgrounds | Hardcoded #fffdf9 | --surface-form or similar |
| Form borders | Hardcoded #e2d7c1 | --border-form |
| Form focus | Hardcoded #c9b28a | --border-focus |
| Button gradients | Hardcoded linear-gradients | --btn-gradient-primary, --btn-gradient-secondary |
| Button shadows | Hardcoded complex shadows | --shadow-btn, --shadow-btn-hover |
| Score badges | Hardcoded hex colors | --score-high-bg, --score-high-text, etc. |
| Badge variants | Hardcoded hex colors | --badge-* tokens |
| Tag | Hardcoded #f0f9f9 / #6b6255 | --tag-bg, --tag-text |
| Why/Prepare boxes | Hardcoded warm colors | --callout-bg, --callout-border |

### Hard-coded values preventing clean theme switching:
1. **body background**: `background: #f8fafc` (line 33) - should use `var(--bg)`
2. **Form inputs/selects**: Hardcoded #fffdf9, #e2d7c1, #c9b28a, #a49883
3. **Button gradients**: Two different hardcoded gradients (lines 1859, 1927)
4. **Score badges**: Hardcoded green/amber/red variants
5. **Badge variants**: 5 different hardcoded color pairs
6. **Tag**: Hardcoded #f0f9f9 background
7. **ConsentGate/PrivacyNotice**: Entirely Tailwind-like classes with hardcoded colors
8. **AtsOverlay inline styles**: Hardcoded margins, font-sizes

### Semantic token sufficiency:
**NOT sufficient**. The current tokens are primarily primitive/brand tokens. Missing semantic layer: --surface-primary, --surface-secondary, --border-primary, --border-focus, --shadow-card, --shadow-modal, --btn-primary-bg, --btn-primary-hover, --btn-primary-active, --text-on-primary, etc.

## 8. DOCUMENTATION AUDIT

### AI_AUDITLOG.md claims vs Repository Evidence:

| Documentation Claim | Repository Evidence | Status |
|---------------------|---------------------|--------|
| "Updated border-primary color to #5afff0 after CSS changes" | Confirmed: --border-primary: #5afff0 exists in :root and used on cards | CONSISTENT |
| Commit 728dffb message: "light beige gradient and light yellow border" | Actual: --main-gradient uses #fff → #dbf5fd (cyan), --border-primary is #5afff0 (cyan) | INCONSISTENT |
| AI_AUDITLOG header: "==================================================" | Actual file has "=================================================" (one less =) | INCONSISTENT |
| Previous commits claim "all legacy warm colors removed" (124ee20) | Warm colors (#fffdf9, #e2d7c1, #c9b28a, #a49883, #f6efe2, #8a6f43) still active in forms | INCONSISTENT |
| Commit 7a3a164: "All 348 tests pass" | Current test run: 346 passed, 2 failed (timeouts) | NOT VERIFIED (different test baseline) |
| Commit 7a3a164: "TypeScript compiles, build succeeds" | Current: tsc --noEmit passes, npm run build succeeds | CONSISTENT |
| DESIGN_SYSTEM.md not found in docs/ | No DESIGN_SYSTEM.md exists in repository | NOT VERIFIED (file missing) |

### Additional documentation discrepancies:
- No DESIGN_SYSTEM.md exists in /docs despite AGENTS.md referencing "docs/DESIGN_SYSTEM.md"
- AI_AUDITLOG.md only contains the execution log template + one entry from 728dffb
- No design system documentation describing tokens, usage, or component patterns

## 9. DESIGN-SYSTEM COVERAGE

| Category | Status | Details |
|----------|--------|---------|
| **Color primitives** | CENTRALIZED | 16 tokens in :root covering brand, neutral, semantic |
| **Color semantics** | PARTIALLY CENTRALIZED | Form colors, badge colors, score colors, button gradients NOT tokenized |
| **Typography** | NOT CENTRALIZED | Font sizes, weights, line heights hardcoded throughout |
| **Spacing** | NOT CENTRALIZED | Margin, padding, gap values hardcoded |
| **Border radius** | PARTIALLY CENTRALIZED | --radius (14px), --border-radius-primary (30px) exist but 10px, 8px, 4px, 2px, 999px hardcoded |
| **Shadows** | PARTIALLY CENTRALIZED | --shadow exists but 10+ hardcoded shadow variants |
| **Gradients** | PARTIALLY CENTRALIZED | --main-gradient added but hero, search-hero, buttons use hardcoded gradients |
| **Z-index** | NOT CENTRALIZED | Hardcoded values (30, 40, 45, 50, 52) |
| **Transitions** | NOT CENTRALIZED | Hardcoded durations/easings |
| **Component tokens** | LOCAL BY DESIGN | Some component-specific values (tag, badge variants) reasonably local |
| **Form system** | NOT CENTRALIZED | Entire form subsystem uses warm legacy palette outside token system |
| **ConsentGate/PrivacyNotice** | NOT CENTRALIZED | Use entirely separate Tailwind-like class system |

## 10. TEST RESULTS

- **npm test -- --run**: 346 passed, 2 failed (timeouts in App.test.tsx: quota error test and parallel matching prevention test)
- **npx tsc --noEmit**: Passed (no output = success)
- **npm run build**: Passed (built in 371ms, 51 modules transformed)

## 11. GIT STATE AFTER REVIEW

- **files modified**: no
- **working tree clean**: yes
- **commit created**: no
- **push performed**: no

## 12. FINDINGS

1. **728dffb introduces undocumented visual deviation**: The commit message claims "light beige gradient and light yellow border" but implements cyan gradient (#fff→#dbf5fd) with cyan border (#5afff0). This contradicts the established teal/mint design system from commits 7a3a164, 124ee20, f4dee5d, 1b3c623.

2. **Form subsystem uses legacy warm palette**: Inputs, selects, checkboxes, autocomplete, and city suggestions still use #fffdf9, #e2d7c1, #c9b28a, #a49883, #f6efe2, #8a6f43 — values from pre-teal design system. Commit 124ee20 only partially migrated these.

3. **Two button gradient variants exist**: Lines 1859 and 1927 define slightly different gradients for landing-cta vs find-btn/alert-btn/cv-confirm/letter-btn. Neither is tokenized.

4. **Score badges use hardcoded colors**: .score-high, .score-mid, .score-low use hex values instead of --green/--amber/--red semantic tokens.

5. **Badge system has 5 hardcoded variants**: .badge, .badge-remote, .badge-source, .badge-evaluated, .badge-jobtype, .badge-contract all use hardcoded color pairs.

6. **ConsentGate and PrivacyNotice use alien class system**: These components use Tailwind-like utility classes (bg-white, bg-blue-600, text-gray-600, bg-yellow-50, etc.) completely outside the CSS custom property design system.

7. **Body background hardcoded**: Line 33 uses `background: #f8fafc` instead of `var(--bg)` despite --bg being defined as #f8fafc.

8. **Workspace gradient hardcoded in 3 places**: The gradient #f8fafc → #f1f5f9 → #e8f2f0 → #d9f0ee appears in .container.layout-search (line 501), .search-hero (line 345), and button gradients (lines 1859, 1927).

9. **Border-radius inconsistency**: 6 different radius values used (2px, 4px, 8px, 10px, 14px, 30px, 999px) with only 2 tokenized.

10. **Shadow inconsistency**: 18 hardcoded box-shadow values plus --shadow token.

11. **No dark-mode architecture**: Semantic token layer missing; hardcoded values throughout prevent clean theme switching.

12. **Documentation gap**: No DESIGN_SYSTEM.md exists; AI_AUDITLOG.md has minor inconsistencies and only one audit entry.

## 13. NEXT STEP

**Smallest logical follow-up implementation step**: Create a design token consolidation PR that:

1. **Tokenize the workspace gradient**: Add `--workspace-gradient` token and apply to body, .container.layout-search, .search-hero
2. **Tokenize button gradients**: Add `--btn-gradient-primary` and `--btn-gradient-secondary` tokens
3. **Migrate form subsystem to tokens**: Add `--surface-form`, `--border-form`, `--border-focus`, `--text-placeholder` tokens and replace #fffdf9, #e2d7c1, #c9b28a, #a49883
4. **Tokenize score badges**: Replace hardcoded colors with semantic token references (--green, --amber, --red with appropriate opacity/lightness variants)
5. **Fix body background**: Change `background: #f8fafc` to `background: var(--bg)`
6. **Document tokens**: Create docs/DESIGN_SYSTEM.md with token reference and usage guidelines
7. **Address ConsentGate/PrivacyNotice**: Either migrate to design system or document as intentional exceptions

This should be done as a single focused commit with visual regression verification, not as a refactor.