# AI Data Boundary and Interfaces

## Overview

The AI Data Boundary module ensures that only minimized, non-PII data is sent to external AI providers for CV optimization suggestions.

## MODULE BOUNDARY

```
ATS/CV DATA (LOCAL)
↓
AI Data Boundary
│
├─ Validation (Safety)
├─ Minimization
├─ Anonymization (implicit)
│
↓
API Contract: FormulationRequest
{
  requirementId: string,     // From job
  matchedKeyword: string,    // From CV keywords only
  changeType: string         // From recommendations
}
↓
AI Provider
│
├─ OpenRouter: https://openrouter.ai/api/v1/chat/completions
├─ EdenAI: https://api.edenai.run/v3/chat/completions
│
↓
FormulationResponse
{
  proposedText: string,
  rationale: string
}
```

## CURRENT IMPLEMENTATION

### Files

- `api/_lib/ats.mjs` - `formulateCVText()`, `validateRecommendationSafety()`
- `api/ats-analysis.mjs` - API layer that includes consent
- `src/components/ConsentGate.tsx` - Frontend consent UI
- `src/components/PrivacyNotice.tsx` - Transparency component

### Key Contracts

#### FormulationRequest

```typescript
// What ACTUALLY goes to AI
{
  originalText: string;        // Matched keyword only
  requirement: string;         // Requirement ID
  change_type: string;         // Change type
}
```

#### Safety Validation

```typescript
function validateRecommendationSafety(recommendation, cvSkills):
  returns { safe: boolean, reason: string }

Guarantees:
- GAP_FLAG → DO_NOT_GENERATE
- UNKNOWN_REVIEW → REVIEW_REQUIRED
- Missing evidence → REVIEW_REQUIRED
```

## DATA MINIMIZATION

### Allowed (AFTER MINIMIZATION)

| Field | Source | Purpose |
|-------|--------|---------|
| requirementId | Job | Identify which requirement |
| matchedKeyword | CV | Evidence to highlight |
| changeType | Rec | Context for formulation |

### NOT Sent to AI

- Name, Email, Phone, Address
- Full CV text or profile
- Company names
- Project details
- Dates/Years
- Location
- Screenshots
- Certificates
- User IDs

### Example Data Flow

```
CV: "John Doe, 5 years AWS, Terraform, Python at Acme Corp"
↓
ATS Analysis
│
├─ Requirements: ["AWS", "Terraform", "Deployments"]
├─ Matches: [MATCHED for "AWS"], [PARTIAL for "Terraform"]
│
↓
Recommendations:
│
├─ { changeType: "KEYWORD_REINFORCEMENT", 
│     relatedCVEvidence: "aws", 
│     requirementId: "requirement_1" }
│
↓
Formulation Request:
│
├─ requirement: "requirement_1"
├─ originalText: "aws"
├─ change_type: "KEYWORD_REINFORCEMENT"
│
↓
AI Provider (OpenRouter)
```

## PRIVACY STATUS

### OpenRouter

**Verified:** https://openrouter.ai/privacy (Aug 31, 2026)

| Property | Status | Notes |
|----------|--------|-------|
| Input retention | Collected | See privacy policy |
| Training use | NOT by OpenRouter | Model providers may differ |
| Deletion | Available | Via email request |
| Opt-out | Model selection | Choose non-training models |

### EdenAI

**Status:** UNKNOWN

No verified privacy policy documentation found.
Treat as requiring investigation before production use.

## CONSENT ARCHITECTURE

```
User Action
│
├─ ATS Analysis (no consent needed)
│
└─ AI Optimization Request
      │
      ├─ Show PrivacyNotice
      │   - Provider info
      │   - Data categories
      │   - Privacy status
      │
      ├─ Show ConsentGate
      │   - Checkbox
      │   - Clear explanation
      │
      ├─ User clicks "Continue"
      │
      └─ API call with consent=true
            │
            ├─ Backend validates
            │
            └─ AI Provider receives minimized data
```

## LOGGING RESTRICTIONS

### NEVER Log

- Full CV/text content
- PII (names, emails, phones)
- Company names
- Project details
- Dates/years of experience

### Safe to Log

- Operation type
- Provider name
- Model used
- Success/failure status
- Request ID
- Latency
- Safety validation result

## FUTURE DOCUMENTATION GAPS

1. EdenAI privacy policy location
2. AI retention detail from providers
3. Permission for model training opt-out features
4. Data export/delete procedures per provider

## INTERFACE STABILITY

### Stable Interfaces

- `analyzeJobForAts(job, profile)` - Main ATS analysis
- `generateCVRecommendations(analysis, cvSkills)` - Recommendations
- `formulateCVText(recommendation, cvSkills, options)` - AI formulation

These functions will be called by the Recruiting Intelligence System's Agent.

### Replaceable Components

- AI Provider (OpenRouter ↔ EdenAI ↔ others)
- Consent mechanism
- Privacy notice display
- Logging implementation

