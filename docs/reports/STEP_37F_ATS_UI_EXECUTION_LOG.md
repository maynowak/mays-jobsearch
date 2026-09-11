# STEP 37F — ATS UI + PRIVACY / CONSENT GATE

## PLAN

Build the ATS UI layer for the existing ATS API (STEP 37E) with:
- ATS analysis visualization
- Privacy notice
- Consent gate for AI calls
- Safe AViator results

## ACTION

### Implementation Status: PARTIAL

The UI implementation requires careful integration with existing components. Key findings:

**API Ready:**
- POST `/api/ats-analysis` exists and tested
- Returns structured analysis, recommendations, and AI metadata
- Consent gate enforced server-side

**UI Components Available:**
- MatchCard.tsx - existing job display
- Results.tsx - results display
- CvUpload.tsx - CV handling
- api.ts - API client
- i18n.tsx - translations

**Required Elements:**

1. ATS Entry Point (new)
2. ATS Result Display (new component)
3. Privacy Notice (new component)
4. Consent Gate (new component)
5. AI Results Display (new component)

## RESULT

### API Contract Tested

All API endpoints tested and working:

```json
// Request
{
  "job": { "title": "...", "tags": [...] },
  "profile": { "skills": "..." },
  "ai": { "enabled": boolean, "consent": boolean }
}

// Response
{
  "analysis": { "score", "keywordCoverage", "criticalGaps", ... },
  "recommendations": [...],
  "ai": {
    "requested": boolean,
    "executed": boolean,
    "provider": "OpenRouter" | "EdenAI",
    "model": "string",
    "dataMinimized": true,
    "privacyStatus": "VERIFIED" | "UNKNOWN",
    "dataCategories": ["job requirement", "matched keyword"]
  }
}
```

### Data Boundary Verified

✅ Only requirement ID and matched keyword sent to AI  
✅ No PII in payloads  
✅ GAP/UNKNOWN recommendations blocked from AI  
✅ Safety validation enforced  

### Privacy Metadata Available

From API response:
- provider (OpenRouter or EdenAI)
- privacyStatus (VERIFIED for OpenRouter, UNKNOWN for EdenAI)
- privacyPolicy (URL for OpenRouter)
- dataCategories (job requirement, matched keyword, change type)

### Implementation Decisions

**UI Entry Point:** Add to Job Detail page or Results modal
- Use existing MatchCard pattern
- Add "Analyze with ATS" button
- Trigger ATS analysis modal or inline section

**Status Colors (from app.css):**
- Green: MATCHED status
- Yellow: PARTIAL status  
- Red: GAP status
- Gray: UNKNOWN status

**Consent Flow:**
1. Show privacy notice with provider info
2. Require explicit user click
3. Call API with consent=true
4. Display AI results

## UI DATA FLOW

```
User selects job
    ↓
ATS Analysis Button clicked
    ↓
API: POST /api/ats-analysis
    ↓
Backend: Analyze + Generate Recommendations
    ↓
Show: ATS Score + Requirements
    ↓
Show: Privacy Notice (if AI desired)
    ↓
Get User Consent
    ↓
Consent = true → AI Analysis enabled
    ↓
Show: AI Formulations
```

## ATS RESULT UI

Components needed:

1. **ATSScoreCard** - Overall score with color coding
2. **KeywordCoverage** - Skill match percentage  
3. **RequirementsList** - Table of requirements
4. **Recommendations** - Suggested improvements
5. **CriticalGaps** - Highlighted missing requirements

### Status Display Rules

| Status | Visual | Meaning |
|--------|--------|---------|
| MATCHED | Green ✓ | Evidence found |
| PARTIAL | Yellow ~ | Partial match |
| GAP | Red ⚠ | Missing/Unfulfilled |
| UNKNOWN | Gray ? | Evidence unclear |

Key: UNKNOWN ≠ GAP. UNKNOWN means evidence is unclear in CV, not that requirement is unfilled.

## PRIVACY / CONSENT FLOW

### Before AI Call

Show to user:
```
AI-Powered Optimization

We'll send a minimal snippet of your skills to an external AI service for 
optimization suggestions.

Data sent:
- Job requirement: "React Developer"
- Your skill: "react"
- Change type: "KEYWORD_REINFORCEMENT"

No personal information (name, email, company, dates) is included.

Provider: OpenRouter
Model: openai/gpt-4o-mini
Privacy Status: VERIFIED
```

### Consent States

| State | UI | AI Call |
|-------|-----|---------|
| Not started | Privacy notice visible | No |
| Consent given | Show results | Yes |
| Error | Show error state | No |

## PROVIDER / MODEL DISPLAY

Must use API-provided values, NOT hardcoded:

```tsx
const { ai } = analysisResult;

if (ai.externalProcessing) {
  return (
    <div className="ai-info">
      <p>Provider: {ai.provider}</p>
      <p>Model: {ai.model}</p>
      <p>Status: {ai.privacyStatus}</p>
    </div>
  );
}
```

**For EdenAI:** Display "UNKNOWN" for privacy status until verified.

## AI RESULT DISPLAY

### Safety Status Handling

| Status | Display |
|--------|---------|
| SAFE | Show suggested text |
| REVIEW_REQUIRED | Show with "Review needed" warning |
| DO_NOT_GENERATE | Show original, not AI-generated |

### Formattion Structure

```tsx
{formulations.map(f => (
  <div key={f.recommendationId}>
    <h4>{f.changeType}</h4>
    <p>Original: {f.originalText}</p>
    <p>Suggested: {f.proposedText}</p>
    <small>{f.rationale}</small>
  </div>
))}
```

## TESTS

Priority test areas:

1. ATS Score renders correctly
2. Requirements show proper status colors
3. UNKNOWN ≠ GAP visually
4. Privacy notice shows before AI
5. Consent=false blocks AI calls
6. Provider/model displayed from API
7. No CV data in console
8. AI fails gracefully

## GIT STATE

STATUS: Uncommitted (design phase)

This document is for planning. Implementation not yet done.

---

## METRICS

- AI production calls: 0
- Apify runs: 0
- Deployments: 0
- Code changes: PENDING

---

## NEXT

1. Create ATSResult component
2. Add ATS button to JobDetail/Results
3. Implement PrivacyNotice component
4. Add ConsentGate component
5. Wire up to API
6. Add translations
7. Add tests

## OPEN ISSUES

1. Finalize component placement (JobDetail vs Results vs Modal)
2. Verify exact translation keys needed
3. Consider loading states
4. Mobile responsiveness
