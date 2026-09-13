# ATS Module and Interfaces

## Overview

The ATS (Applicant Tracking System) module provides deterministic job matching capabilities without requiring external AI calls.

## Module Structure

```
ATS MODULE ()
├── Requirement Extraction
│   ├── Keywords from job title (EXTRACTED)
│   ├── Tags from job posting (EXTRACTED)
│   └── Location, remote, employment type (EXTRACTED)
│
├── Evidence Matching
│   ├── CV Skills (from profile)
│   ├── Experience Level
│   └── Target Roles
│
├── Analysis Engine
│   ├── MATCHED: Strong evidence
│   ├── PARTIAL: Some evidence
│   ├── GAP: Missing/unfulfillable
│   └── UNKNOWN: Unclear evidence
│
├── Scoring
│   ├── Keyword Match
│   ├── Skill Match
│   ├── Location Match
│   ├── Work Mode Match
│   └── Employment Match
│
└── Recommendations
    ├── KEYWORD_REINFORCEMENT
    ├── EVIDENCE_CLARIFICATION
    ├── GAP_FLAG
    └── UNKNOWN_REVIEW
```

## INPUT CONTRACT

### Required Inputs

| Field | Type | Source | Purpose | Sensitive |
|-------|------|--------|---------|-----------|
| Job | CanonicalJob | Job Board API | Job to analyze | No |
| Profile | Profile | CV/User | Candidate skills | No |

### Detailed Fields

**CanonicalJob:**
- `title: string` - Job title from posting
- `tags: string[]` - Skills/requirements from job
- `slug: string` - Unique identifier
- `company_name: string` - Employer (NOT sent to AI)
- `location: string[]` - Location info
- `remote: boolean` - Remote work indicator

**Profile:**
- `skills: string` - Comma-separated skill list
- `targetRole: string` - Desired job role
- `city: string` - Preferred location

## OUTPUT CONTRACT

### AtsAnalysisResult

```typescript
interface AtsAnalysisResult {
  score: number;                     // Overall match score (0-100)
  keywordCoverage: {
    overall: number;                 // Percentage of keywords matched
  };
  criticalGaps: Array<{
    id: string;                      // Requirement ID
    text: string;                    // Requirement text
  }>;
  requirements: Array<{
    id: string;
    text: string;
    category: AtsCategory;
    importance: AtsImportance;
  }>;
  matches: Array<{
    requirementId: string;
    status: AtsMatchStatus;          // MATCHED | PARTIAL | GAP | UNKNOWN
    confidence: AtsConfidence;       // HIGH | MEDIUM | LOW
  }>;
}
```

### Recommendations

```typescript
interface Recommendation {
  requirementId: string;
  changeType: "KEYWORD_REINFORCEMENT" | "EVIDENCE_CLARIFICATION" | "GAP_FLAG" | "MISSING_CERTIFICATE";
  priority: AtsImportance;
  proposedChange: string;
  rationale: string;
  relatedCVEvidence?: string | null;
  safetyStatus: "SAFE_EVIDENCE" | "CRITICAL_GAP" | "SAFE_REVIEW" | "DO_NOT_GENERATE";
}
```

## MODULE INTERFACES

### Current Architecture

```
Frontend
└── HTTP/API Adapter (/api/ats-analysis)
    └── ATS Core (ats.mjs functions)
        ├── analyzeJobForAts()
        ├── generateCVRecommendations()
        └── validateRecommendationSafety()
```

### Database Support

None. ATS analysis is stateless and deterministic.

## PARSER COMPATIBILITY VS JOB MATCH

### Two Distinct Analysis Axes

1. **Parser Compatibility** (Future)
   - How well CV can be parsed by ATS systems
   - Structured sections, keywords, format
   - Currently informational, not yet implemented as scoring

2. **Job-specific Match** (Implemented)
   - Skills vs requirements
   - Evidence matching status
   - Confidence scoring
   - Recommendations for improvement

## FUTURE RELATIONSHIP TO RECRUITING INTELLIGENCE

### Current

```
May's Job Matcher
└── Node.js API
    └── ATS Module (aitest, atsanlays, recommendations)
    └── AI Data Boundary (privacy, consent, minimization)
```

### Future

```
May's Recruiting Intelligence System
└── Agent / Service Layer
    └── ATS Module Interface
        └── ATS Core (same functions)
    └── AI Optimization Agent (future)
        └── Data Boundary
            └── AI Provider
```

### Boundary Contracts

**Stable (unchanged):**
- Input: Job + Profile
- Output: AtsAnalysisResult + Recommendations
- Function signatures in `ats.mjs`

**Replaceable:**
- HTTP API layer
- AI provider (OpenRouter/EdenAI)
- PII handling
- Consent mechanism

## SAFETY CONTROLS

### validateRecommendationSafety()

Prevents AI from generating invented content:

| Change Type | Action |
|-------------|--------|
| GAP_FLAG | DO_NOT_GENERATE |
| UNKNOWN_REVIEW | REVIEW_REQUIRED |
| MISSING_CERTIFICATE | REVIEW_REQUIRED |

### Data Minimization

Only these fields reach AI:
- `requirementId` - from job
- `matchedKeyword` - from CV
- `changeType` - for context

## OPEN QUESTIONS

1. Parser Compatibility scoring - currently not implemented
2. CV format analysis - not yet in core
3. Experience level matching - partial implementation
4. Location matching - basic implementation exists

