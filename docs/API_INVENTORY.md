# API Inventory — Mays Job Search System

## Overview
Complete inventory of all existing API endpoints in the Mays Job Search system as of 2026-09-20.

---

## API Endpoints Inventory

| # | API | Method | Path | Auth | Version | Request | Response | Errors | Documentation | Status |
|---|-----|--------|------|------|---------|---------|----------|--------|---------------|--------|
| 1 | **Jobs Search** | GET | `/api/jobs` | None | unversioned | Query params: skills, targetRole, city, radiusKm, workMode, employmentType | JobsResponse | 400, 500 | Inline (code) | unversioned/legacy |
| 2 | **AI Match/Scoring** | POST | `/api/match` | Session cookie | unversioned | { profile, jobs[], model?, attempt? } | { matches[], meta } | 400, 405, 500, 502 | Inline (code) | unversioned/legacy |
| 3 | **Job Details** | POST | `/api/job-details` | None | unversioned | { jobs: string[] } | { jobs: Record<string, Job>, meta } | 400, 500 | Inline (code) | unversioned/legacy |
| 4 | **AI Match/Scoring** | POST | `/api/match` | Session cookie | unversioned | { profile, jobs[], model?, attempt? } | { matches[], meta } | 400, 405, 500, 502 | Inline (code) | unversioned/legacy |
| 5 | **Profile Creation** | POST | `/api/profile` | None | unversioned | { text, hash?, model?, attempt? } | SuggestedProfile | 400, 405, 500, 502 | Inline (code) | unversioned/legacy |
| 6 | **Cover Letter** | POST | `/api/cover-letter` | None | unversioned | { profile, job, language?, prepareQuestion?, model?, attempt? } | { letter, meta } | 400, 405, 500 | Inline (code) | unversioned/legacy |
| 7 | **Models List** | GET | `/api/models` | None | unversioned | None | { models[], providers[], defaultModel, fallbackModel, recommendedModel, fallbackMaxAttempts } | 405, 502 | Inline (code) | unversioned/legacy |
| 6 | **ATS Analysis** | POST | `/api/ats-analysis` | None | unversioned | { job, profile, ai?: { enabled, consent } } | AtsAnalysisResponse | 400, 405, 500, 502 | Inline (code) + docs/API_CV_IMPROVEMENT.md | unversioned/legacy |
| 8 | **CV Improvement** | POST | `/api/cv-improvement` | None | unversioned | { job, profile } | CvImprovementResponse | 400, 405, 500 | docs/API_CV_IMPROVEMENT.md | unversioned/legacy |
| 9 | **Model Info** | GET | `/api/model` | None | unversioned | None | { model: string } | 405, 500 | Inline (code) | unversioned/legacy |
| 10 | **Job Details** | POST | `/api/job-details` | None | unversioned | { jobs: string[] } | { jobs: Record<string, Job>, meta } | 400, 500 | Inline (code) | unversioned/legacy |
| 11 | **Alerts** | POST/DELETE | `/api/alerts` | None | unversioned | POST: { email, profile } / DELETE: { email } | { message } | 400, 405, 500 | Inline (code) | unversioned/legacy |
| 12 | **Usage** | GET | `/api/usage` | None | unversioned | None | { ... } | 405, 500 | Inline (code) | unversioned/legacy |
| 13 | **Cron Digest** | POST | `/api/cron/digest` | None | unversioned | None | { ... } | 405, 500 | Inline (code) | unversioned/legacy |

---

## Frontend API Client Functions (src/api.ts)

| Function | Endpoint | Method | TypeScript Types |
|----------|----------|--------|------------------|
| `fetchJobs` | `/api/jobs` | GET | Profile → JobsResponse |
| `fetchMatches` | `/api/match` | POST | Profile, Job[], model?, attempt? → MatchResponse |
| `fetchJobDetails` | `/api/job-details` | POST | string[] → { jobs, meta } |
| `fetchModels` | `/api/models` | GET | () → ModelsResponse |
| `fetchModel` | `/api/model` | GET | () → string |
| `createProfile` | `/api/profile` | POST | text, model?, hash?, attempt? → SuggestedProfile |
| `generateCoverLetter` | `/api/cover-letter` | POST | Profile, Job, prepareQuestion, language?, model?, attempt? → string |
| `subscribeAlert` | `/api/alerts` | POST | email, Profile → string |
| `unsubscribeAlert` | `/api/alerts` | DELETE | email → string |
| `analyzeATS` | `/api/ats-analysis` | POST | Job, Profile, ai? → AtsAnalysisResponse |
| `fetchCvImprovement` | `/api/cv-improvement` | POST | Job, Profile → CvImprovementResponse |

---

## Error Handling Patterns

### Current Error Response Format
```json
{
  "error": "Error message",
  "code": "error_code"
}
```

### Common Error Codes
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `bad_request` | 400 | Invalid request body or missing required fields |
| `method` | 405 | HTTP method not allowed |
| `unauthorized` | 401 | Authentication required |
| `forbidden` | 403 | Access denied |
| `not_found` | 404 | Resource not found |
| `bad_ai_response` | 502 | AI service returned invalid response |
| `model_unavailable` | 503 | AI model temporarily unavailable |
| `free_quota_exceeded` | 429 | Free AI quota exhausted |
| `models_unavailable` | 503 | No AI models available |
| `text_too_long` | 400 | Input text exceeds maximum length |
| `missing_text` | 400 | Required text field missing |
| `missing_text` | 400 | Required text field missing |
| `internal` | 500 | Internal server error |

### HTTP Status Codes Used
| Status | Usage |
|--------|-------|
| 200 | Success |
| 204 | OPTIONS preflight |
| 400 | Bad Request (validation errors) |
| 405 | Method Not Allowed |
| 500 | Internal Server Error |
| 502 | Bad Gateway (AI service failure) |
| 502 | Model unavailable |
| 503 | Service Unavailable (quota exceeded) |

---

## API Client Patterns (src/api.ts)

### Base Fetch Wrapper
```typescript
apiFetch<T>(url: string, options?: RequestInit): Promise<T>
```

### Error Class
```typescript
class ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}
```

### Error Classification
- `isModelUnavailable(err)` - Checks for model availability issues
- `isFreeQuotaExceeded(err)` - Checks for quota exhaustion

### Model Fallback
```typescript
withModelFallback<T>({
  initialModel,
  availableModels,
  recommendedModel,
  request: (model, attempt) => Promise<T>
}): Promise<FallbackResult<T>>
```

---

## Request/Response Patterns

### Common Request Patterns
- **GET with query params**: `/api/jobs?skills=...&city=...`
- **POST with JSON body**: `/api/match`, `/api/profile`, etc.
- **OPTIONS preflight**: All endpoints support CORS preflight

### Common Response Patterns
- **Success**: Direct JSON response (200)
- **Error**: `{ error: string, code: string }` with appropriate HTTP status
- **CORS**: `Access-Control-Allow-Origin: *` on all responses
- **Session cookies**: Some endpoints set session cookies

### Common Request Validation
- Body must be valid JSON
- Required fields validated (job, profile, skills, etc.)
- Maximum text length limits (e.g., 30,000 chars for profile)
- Skills parsed as comma-separated strings

---

## Authentication & Authorization

### Current State
- **No authentication required** for any public endpoints
- **Session cookies** used for `/api/match` (anonymous identity)
- **No JWT/OAuth** implemented
- **No role-based access control**
- **No API keys** required

### Session Handling
- `/api/match` sets session cookie via `sessionCookieHeader`
- Identity created via `anonymousIdentity(req)`
- Session used for BArbeitsagentur detail enrichment

---

## Documentation Status

| Endpoint | Documentation | Location |
|----------|---------------|----------|
| `/api/jobs` | Inline code comments | `api/jobs.mjs` |
| `/api/match` | Inline code comments | `api/match.mjs` |
| `/api/job-details` | Inline code comments | `api/job-details.mjs` |
| `/api/profile` | Inline code comments | `api/profile.mjs` |
| `/api/cover-letter` | Inline code comments | `api/cover-letter.mjs` |
| `/api/models` | Inline code comments | `api/models.mjs` |
| `/api/ats-analysis` | Inline + docs/API_CV_IMPROVEMENT.md | `api/ats-analysis.mjs`, `docs/API_CV_IMPROVEMENT.md` |
| `/api/cv-improvement` | `docs/API_CV_IMPROVEMENT.md` | `docs/API_CV_IMPROVEMENT.md` |
| `/api/models` | Inline code comments | `api/models.mjs` |
| `/api/model` | Inline code comments | `api/model.mjs` |
| `/api/job-details` | Inline code comments | `api/job-details.mjs` |
| `/api/alerts` | Inline code comments | `api/alerts.mjs` |
| `/api/usage` | Inline code comments | `api/usage.mjs` |
| `/api/cron/digest` | Inline code comments | `api/cron/digest.mjs` |
| `/api/cv-improvement` | `docs/API_CV_IMPROVEMENT.md` | `docs/API_CV_IMPROVEMENT.md` |

---

## Test Coverage

| Endpoint | Test File | Test Count |
|----------|-----------|------------|
| `/api/jobs` | `src/api.test.ts` | Multiple |
| `/api/match` | `src/App.test.tsx` | Multiple |
| `/api/profile` | `src/App.test.tsx` | Multiple |
| `/api/ats-analysis` | `tests/api/ats-analysis.test.js` | 10 tests |
| `/api/cv-improvement` | `tests/api/cv-improvement-api.test.mjs`, `tests/api/cv-improvement-module.test.mjs` | 18 tests |
| `/api/models` | - | - |
| `/api/profile` | `src/App.test.tsx` | Multiple |
| `/api/cover-letter` | - | - |
| `/api/models` | - | - |

---

## CV Improvement API (Latest Addition)

### Endpoint
```
POST /api/cv-improvement
```

### Request
```json
{
  "job": { "title": "...", "tags": [...], "slug": "..." },
  "profile": { "skills": "react, typescript", "targetRole": "...", "city": "..." }
}
```

### Response
```json
{
  "improvement": {
    "plan": [...],
    "summary": { "total": 5, "byType": {...}, "byPriority": {...}, "bySafety": {...}, "actionable": 4, "requiresReview": 1 },
    "totalRequirements": 12,
    "generatedAt": "2024-01-15T10:30:00.000Z"
  },
  "analysis": { "score": 78, "keywordCoverage": { "overall": 65 }, "criticalGaps": [...], "summary": {...} },
  "meta": { "version": "1.0.0", "generatedAt": "2024-01-15T10:30:00.000Z" }
}
```

### Frontend Integration
```typescript
import { fetchCvImprovement } from './api';
const response = await fetchCvImprovement(job, profile);
```

---

## Summary Statistics

- **Total Endpoints**: 13
- **Versioned**: 0 (all unversioned/legacy)
- **Documented**: 2 fully documented (CV Improvement, ATS Analysis), rest inline only
- **Tests**: 366 total tests (including 18 new CV Improvement tests)
- **Error Codes**: 15 distinct error codes
- **HTTP Statuses**: 7 distinct status codes used
- **Frontend Client Functions**: 11 typed functions in `src/api.ts`

---

## Migration Priority

| Priority | Endpoint | Reason |
|----------|----------|--------|
| HIGH | `/api/cv-improvement` | Newest, needs versioning for contract stability |
| HIGH | `/api/ats-analysis` | Complex response, breaking changes likely |
| MEDIUM | `/api/match` | Core feature, stable but unversioned |
| MEDIUM | `/api/jobs` | Core feature, simple GET |
| LOW | `/api/profile`, `/api/cover-letter`, `/api/models` | Stable, simple contracts |
| LOW | `/api/job-details`, `/api/alerts`, `/api/usage`, `/api/cron/digest` | Low change frequency |

---

## Notes

1. **All endpoints currently unversioned** - no `/v1/` prefix
2. **No authentication** on any public endpoints
3. **Error format consistent** across all endpoints
4. **CORS headers** on all endpoints
5. **Session cookies** only on `/api/match`
6. **No rate limiting** implemented
7. **No request ID/correlation ID** in responses
8. **No pagination** on list endpoints (returns all results)
9. **No versioning** in URL paths
10. **Frontend client** (`src/api.ts`) provides typed access to all endpoints