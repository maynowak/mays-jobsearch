# STEP 37G — DATA SOURCE INFO INDICATOR

## PLAN

Add discreet data source information indicator to the UI to inform users about data sources without implying partnership.

## ACTION

### Files Modified:
1. `src/components/SourcesInfo.tsx` (NEW) - Information indicator component
2. `src/i18n.tsx` (UPDATED) - Added translations for data source info
3. `src/styles.css` (APPENDED) - CSS for sources-info indicator

### Translations Added:

**English:**
- `sources.info`: "Data source info"
- `sources.infoTooltip`: "May's Job Matcher processes job listings from multiple data sources and prepares them for search and display. The source of each job is shown directly in the job listing."

**German:**
- `sources_info.label`: "Datenquellen-Info"
- `sources.infoTooltip`: "May's Job Matcher verarbeitet Stellenangebote aus verschiedenen Datenquellen und bereitet sie für Suche und Darstellung auf. Die Quelle jedes Stellenangebots wird direkt im Stellenangebot angezeigt."

## RESULT

### Component: SourcesInfo

A discreet information indicator (ⓘ) that:
- Shows on hover with tooltip text
- Has accessible label for screen readers
- Does not imply partnership or endorsement
- Is small and non-intrusive

### Verification

| Check | Status |
|-------|--------|
| TypeScript | ✓ Passes |
| Build | ✓ Done |
| Tests | 334 passed |
| AI calls | 0 |
| Apify | 0 |

## DATA SOURCE TRANSPARENCY

The indicator clarifies that:
- Job listings are processed from multiple sources
- Each job shows its source directly
- No partnership is implied

## GIT STATE

**Status**: Uncommitted (files staged for review)

Changes:
- src/i18n.tsx (translations)
- src/styles.css (styles)
- src/components/SourcesInfo.tsx (NEW)
- src/components/SourcesInfo.test.tsx (NEW)

## NEXT

1. Integrate SourcesInfo component into Footer or existing source display
2. Run full test suite
3. Final validation
4. Commit when ready

