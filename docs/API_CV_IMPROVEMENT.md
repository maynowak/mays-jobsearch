# CV Improvement API

## Endpoint
```http
POST /api/v1/cv-improvement
```

## Purpose
Generate CV improvement recommendations based on a job posting and candidate profile to improve ATS (Applicant Tracking System) compatibility.

## Version
`v1` (since 2026-09-20)

## Authentication
- **Required**: No
- **Type**: None (public endpoint)

## Request

### Headers
| Header | Required | Description |
|--------|----------|-------------|
| Content-Type | Yes | application/json |
| X-Request-ID | No | UUID for tracing |

### Body Parameters

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `job` | Object | Yes | Job posting data | |
| `job.title` | string | Yes | Job title | min: 1, max: 200 |
| `job.tags` | string[] | No | Job tags/keywords | max: 50 items |
| `job.slug` | string | No | Job identifier | max: 100 |
| `job.descriptionPlain` | string | No | Plain text job description | max: 50000 |
| `job.location` | string[] | No | Job locations | max: 20 items |
| `job.remote` | boolean | No | Remote work option | |
| `job.jobTypes` | string[] | No | Job types (full-time, part-time, etc.) | max: 10 items |
| `job.contractType` | string | No | Contract type | max: 50 |
| `job.language` | string | No | Job language | max: 50 |
| `profile` | Object | Yes | Candidate profile | |
| `profile.skills` | string | Yes | Comma-separated skills | min: 1, max: 5000 |
| `profile.targetRole` | string | No | Target job role | max: 200 |
| `profile.city` | string | No | Preferred city | max: 100 |
| `profile.radiusKm` | number | No | Search radius in km | min: 0, max: 500 |
| `profile.workModes` | string[] | No | Work modes (remote, hybrid, onsite) | max: 10 items |
| `profile.employmentTypes` | string[] | No | Employment types | max: 10 items |

### Example Request

```json
{
  "job": {
    "title": "Senior React Developer",
    "tags": ["react", "typescript", "node.js"],
    "descriptionPlain": "We are looking for a Senior React Developer with 5+ years experience...",
    "location": ["Berlin", "Remote"],
    "remote": true,
    "jobTypes": ["full_time"],
    "contractType": "permanent"
  },
  "profile": {
    "skills": "react, typescript, javascript, node.js, docker",
    "targetRole": "Senior Frontend Developer",
    "city": "Berlin",
    "radiusKm": 50,
    "workModes": ["remote", "hybrid"],
    "employmentTypes": ["full_time"]
  }
}
```

## Response

### Success Response (200 OK)

```json
{
  "data": {
    "improvement": {
      "plan": [
        {
          "requirementId": "skill_0",
          "changeType": "KEYWORD_REINFORCEMENT",
          "changeTypeLabel": "Keyword Reinforcement",
          "priority": "high",
          "priorityLabel": "High",
          "currentEvidence": "present",
          "proposedChange": "\"react\" stärker hervorheben in Skills/Abschnitten",
          "rationale": "Exakter Match für react verbessert ATS-Bewertung",
          "relatedCVEvidence": "react",
          "safetyStatus": "SAFE_EVIDENCE",
          "safetyStatusLabel": "Safe - Evidence Based"
        }
      ],
      "summary": {
        "total": 5,
        "byType": {
          "KEYWORD_REINFORCEMENT": 2,
          "EVIDENCE_CLARIFICATION": 1,
          "GAP_FLAG": 1,
          "UNKNOWN_REVIEW": 1
        },
        "byPriority": {
          "high": 2,
          "medium": 2,
          "low": 1
        },
        "bySafety": {
          "SAFE_EVIDENCE": 3,
          "SAFE_REVIEW": 1,
          "CRITICAL_GAP": 1
        },
        "actionable": 4,
        "requiresReview": 1
      },
      "totalRequirements": 12,
      "generatedAt": "2024-01-15T10:30:00.000Z"
    },
    "analysis": {
      "score": 78,
      "keywordCoverage": { "overall": 65 },
      "criticalGaps": [
        { "id": "skill_5", "text": "kubernetes" }
      ],
      "summary": {
        "matched": 8,
        "partial": 3,
        "gap": 1,
        "unknown": 2
      }
    }
  },
  "meta": {
    "version": "v1",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Response Fields

#### Improvement Plan

| Field | Type | Description |
|-------|------|-------------|
| `plan` | Array | Array of recommendation objects |
| `plan[].requirementId` | string | Unique identifier for the job requirement |
| `plan[].changeType` | string | Type of change (KEYWORD_REINFORCEMENT, EVIDENCE_CLARIFICATION, GAP_FLAG, UNKNOWN_REVIEW) |
| `plan[].changeTypeLabel` | string | Human-readable label for change type |
| `plan[].priority` | string | Priority level (critical, high, medium, low) |
| `plan[].priorityLabel` | string | Human-readable priority label |
| `plan[].currentEvidence` | string | Current evidence status (present, partial, none, contradictory) |
| `plan[].proposedChange` | string | Proposed CV change |
| `plan[].rationale` | string | Rationale for the recommendation |
| `plan[].relatedCVEvidence` | string/null | Related CV evidence if available |
| `plan[].safetyStatus` | string | Safety status (SAFE_EVIDENCE, SAFE_REVIEW, CRITICAL_GAP, DO_NOT_GENERATE, REVIEW_REQUIRED) |
| `plan[].safetyStatusLabel` | string | Human-readable safety status label |

#### Summary

| Field | Type | Description |
|-------|------|-------------|
| `total` | number | Total number of recommendations |
| `byType` | object | Count by change type |
| `byPriority` | object | Count by priority level |
| `bySafety` | object | Count by safety status |
| `actionable` | number | Number of immediately actionable recommendations |
| `requiresReview` | number | Number requiring human review |

#### Analysis

| Field | Type | Description |
|-------|------|-------------|
| `score` | number | Overall ATS score (0-100) |
| `keywordCoverage.overall` | number | Keyword coverage percentage |
| `criticalGaps` | array | Critical gaps found |
| `summary` | object | Match summary counts |

### Meta

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | API version (e.g., `v1`) |
| `requestId` | string | Echoed from request header |
| `timestamp` | string | ISO 8601 UTC timestamp |

### Empty Response

When no recommendations can be generated:

```json
{
  "data": {
    "improvement": {
      "plan": [],
      "summary": {
        "total": 0,
        "byType": {},
        "byPriority": {},
        "bySafety": {},
        "actionable": 0,
        "requiresReview": 0
      },
      "totalRequirements": 0,
      "generatedAt": "2024-01-15T10:30:00.000Z"
    },
    "analysis": {
      "score": 0,
      "keywordCoverage": { "overall": 0 },
      "criticalGaps": [],
      "summary": {
        "matched": 0,
        "partial": 0,
        "gap": 0,
        "unknown": 0
      }
    }
  },
  "meta": {
    "version": "v1",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

An empty plan means the CV already matches the job requirements well, or there are no significant improvements to suggest.

## Error Responses

| Status Code | Code | Description |
|-------------|------|-------------|
| 400 | `bad_request` | Invalid request body (missing job or profile) |
| 405 | `method` | Method not allowed (only POST allowed) |
| 500 | `internal` | Internal server error |

### Error Response Format

```json
{
  "error": {
    "code": "bad_request",
    "message": "Request body must be an object",
    "details": { "field": "job", "reason": "Job must be an object" }
  },
  "meta": {
    "version": "v1",
    "requestId": "uuid",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

## Example Flow

### Frontend Integration

```typescript
import { fetchCvImprovement } from './api';

async function getCVImprovement(job, profile) {
  try {
    const response = await fetchCvImprovement(job, profile);
    
    if (response.data.improvement.plan.length === 0) {
      console.log('No improvements needed');
      return [];
    }
    
    // Display recommendations grouped by type
    const byType = response.data.improvement.summary.byType;
    console.log('Recommendations:', response.data.improvement.plan);
    
    return response.data.improvement.plan;
  } catch (error) {
    console.error('Failed to fetch CV improvement:', error);
    throw error;
  }
}
```

### Complete CV Flow Integration

```text
1. User uploads CV
   ↓
2. Consent obtained
   ↓
3. Profile created from CV
   ↓
4. Anonymization choice
   ↓
5. Goal selected (ATS Analysis)
   ↓
6. ATS Analysis executed
   ↓
7. User clicks "Get CV Improvements"
   ↓
8. POST /api/v1/cv-improvement
   ↓
8. Display recommendations in UI
```

## Privacy & Security

- **Data Minimization**: Only job requirements and CV skills are sent
- **No PII**: No personal identifiable information is sent or stored
- **Data Categories**: Job requirement, matched keyword, change type
- **Retention**: Results are not stored server-side
- **Consent**: Follows existing consent flow (Upload ≠ Consent)

## Safety

The API implements safety checks:

- `SAFE_EVIDENCE`: Recommendation based on existing CV evidence
- `SAFE_REVIEW`: Requires human review before applying
- `CRITICAL_GAP`: Critical gap identified, no auto-generation
- `DO_NOT_GENERATE`: Safety violation, do not generate
- `REVIEW_REQUIRED`: Requires human verification

Recommendations with `DO_NOT_GENERATE` or `REVIEW_REQUIRED` status should not be automatically applied.

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1 | 2026-09-20 | Standardized to API v1 format |

## Related Endpoints

- `POST /api/v1/ats-analysis` - Full ATS analysis with AI formulations
- `POST /api/v1/profile` - Create profile from CV text
- `POST /api/v1/jobs` - Search jobs by profile
- `POST /api/v1/match` - Match jobs against profile with AI

## Migration Notes

**Legacy Endpoint**: `POST /api/cv-improvement` (unversioned)

**Status**: Migration Pending

**Target**: `POST /api/v1/cv-improvement`

**Migration Status**: See [API Migration Plan](/docs/API_MIGRATION_PLAN.md)

**Breaking Changes from Legacy**:
- Response wrapped in `data` object
- `meta.version` format: `1.0.0` → `v1`
- Added `requestId` and `timestamp` to meta
- Response wrapped in `data` object

**Migration Guide**: See [API Migration Plan v1→v2](/docs/API_MIGRATION_PLAN.md#cv-improvement-api)