# STEP 37G-3 — ATS OVERLAY / JOB-SPECIFIC ATS EVALUATION

## PLAN

Add "CV mit ATS bewerten" button to job listings that opens an overlay showing
the deterministic ATS analysis (score, requirements, gaps, recommendations).

The component should:
1. Show an "Evaluate with ATS" button on each job card
2. Open an accessible modal overlay on click
3. Display ATS analysis results
4. NOT automatically call AI functions
5. Use existing ConsentGate and PrivacyNotice for AI flow

## ACTION

### Files Modified:

1. `src/components/AtsOverlay.tsx` (NEW) - Modal component for ATS analysis
2. `src/components/RemainingCard.tsx` (MODIFIED) - Added onAtsEvaluate prop
3. `src/components/Results.tsx` (MODIFIED) - Added onAtsEvaluate prop
4. `src/App.tsx` (MODIFIED) - Added ATS state and modal rendering
5. `src/i18n.tsx` (MODIFIED) - Added German and English translations

### Implementation Details:

**AtsOverlay Component:**
- Shows job title and company for context
- Displays ATS score (0-100) with keyword coverage
- Lists requirements with MATCHED/PARTIAL/GAP/UNKNOWN status
- Shows critical gaps with highlighted warnings
- Displays AI recommendations

**Integration:**
- Button added to RemainingCard component
- State managed in App.tsx for overlay visibility
- Profile passed for ATS analysis context
- ESC key closes modal, backdrop click also closes

### Translations Added:

**English:**
- `match.noProfile`: "No profile available for ATS evaluation"
- `match.analysisError`: "Could not analyze job"
- `match.atsEvaluate`: "Evaluate with ATS"
- `ats.overlayTitle`: "ATS Analysis"
- `ats.loading`: "Analyzing job requirements..."
- `ats.error`: "Analysis failed"
- `ats.score`: "Match Score"
- `ats.requirements`: "Requirements"
- `ats.criticalGaps`: "Critical Gaps"
- `ats.recommendations`: "Recommendations"
- `modal.close`: "Close"

**German:**
- `match.noProfile`: "Kein Profil für die ATS-Bewertung verfügbar"
- `match.analysisError`: "Konnte die Stelle nicht analysieren"
- `match.atsEvaluate`: "Mit ATS bewerten"
- `ats.overlayTitle`: "ATS-Analyse"
- `ats.loading`: "Stellenanforderungen werden analysiert..."
- `ats.error`: "Analyse fehlgeschlagen"
- `ats.score`: "Übereinstimmungs-Score"
- `ats.requirements`: "Anforderungen"
- `ats.criticalGaps`: "Kritische Lücken"
- `ats.recommendations`: "Empfehlungen"
- `modal.close`: "Schließen"

## VERIFICATION

| Check | Status |
|-------|--------|
| **TypeScript** | ✓ Passes |
| **Build** | ✓ Done |
| **Tests** | 335 passed |
| **AI calls** | 0 |
| **Apify** | 0 |

## ARCHITECTURE

### Module Boundaries:

**ATS Module (unchanged):**
- Deterministic analysis only
- No external AI dependencies
- Uses `analyzeATS()` from API

**UI Layer:**
- `AtsOverlay` - Modal display
- `RemainingCard` - Job card with button
- `Results` - Container with callback

**Data Flow:**
```
App (profile)
  ↓
RemainingCard (job)
  ↓  onAtsEvaluate(job)
App (atsJob state)
  ↓
AtsOverlay (job, profile)
  ↓  analyzeATS(job, profile)
API (deterministic analysis)
```

### Safety Controls:

1. **No AI calls without consent** - AtsOverlay only calls `analyzeATS` with `{ enabled: false }`
2. **Profile validation** - Shows error if profile has no skills
3. **Keyboard accessibility** - ESC closes modal
4. **Focus management** - Modal has proper ARIA attributes

## AI FLOW (Future Integration)

The current implementation does NOT include AI evaluation. 

When "Bewerte mit KI" is added:
1. User sees PrivacyNotice with provider/model info
2. User sees ConsentGate with checkbox
3. Only on consent → AI analysis call
4. Results shown separately from ATS results

## DATA SOURCE TRANSPARENCY

The overlay shows:
- Job title and company for context
- Each requirement matches MISSED status
- Confidence levels for each match
- Critical gaps highlighted

## GIT STATE

**Status:** Uncommitted

Changes staged:
- src/App.tsx (added ATS state and modal)
- src/components/AtsOverlay.tsx (NEW)
- src/components/RemainingCard.tsx (added button handler)
- src/components/Results.tsx (added callback prop)
- src/i18n.tsx (added translations)

## LIMITATIONS

1. AtsOverlay does not yet include AI evaluation button
   - No "Bewerte mit KI" button implemented
   - Model selection not included
   - Privacy/Consent flow not integrated

2. Profile must be available in App context
   - Current profile passed to AtsOverlay
   - Could be enhanced with context or props

## NEXT STEPS

1. Add AI evaluation button to AtsOverlay
2. Integrate ModelSelector for model choice
3. Connect PrivacyNotice and ConsentGate
4. Handle AI response and display optimizations
5. Add tests for overlay functionality

TESTS: 335 passed
TS: ✓
BUILD: ✓
AI CALLS: 0
APIFY: 0
DEPLOYMENT: 0
