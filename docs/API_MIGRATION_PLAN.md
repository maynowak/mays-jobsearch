# API Migration Plan — Mays Platform

**Version**: 1.0.0  
**Status**: Draft  
**Owner**: Platform Team  
**Last Updated**: 2026-09-20  
**Based on**: API Versioning Standard v1.0.0, API Documentation Standard v1.0.0  

---

## 1. Purpose

This document defines the **migration plan** to transition all existing unversioned/legacy APIs to the new versioned standard (`/api/v1/...`). It serves as the authoritative migration tracker and execution guide.

---

## 2. Current State Summary

### 2.1 Current API Landscape

All **13 public endpoints** are currently **unversioned** (legacy):

| # | Endpoint | Method | Current Path | Version | Status |
|---|----------|--------|--------------|---------|--------|
| 1 | Jobs Search | GET | `/api/jobs` | unversioned | legacy |
| 2 | AI Match/Scoring | POST | `/api/match` | unversioned | legacy |
| 3 | Job Details | POST | `/api/job-details` | unversioned | legacy |
| 4 | Profile Creation | POST | `/api/profile` | unversioned | legacy |
| 5 | Cover Letter | POST | `/api/cover-letter` | unversioned | legacy |
| 6 | Models List | GET | `/api/models` | unversioned | legacy |
| 7 | ATS Analysis | POST | `/api/ats-analysis` | unversioned | legacy |
| 8 | CV Improvement | POST | `/api/cv-improvement` | unversioned | legacy |
| 9 | Model Info | GET | `/api/model` | unversioned | legacy |
| 10 | Job Details (legacy) | POST | `/api/job-details` | unversioned | legacy |
| 11 | Alerts | POST/DELETE | `/api/alerts` | unversioned | legacy |
| 12 | Usage | GET | `/api/usage` | unversioned | legacy |
| 14 | Cron Digest | POST | `/api/cron/digest` | unversioned | legacy |

**Total**: 13 endpoints, **0 versioned**, 13 legacy

---

## 3. Migration Strategy

### 3.1 Phased Approach

| Phase | Endpoints | Timeline | Risk |
|-------|-----------|----------|------|
| **Phase 1** | Core Search & Match | Week 1-2 | Medium |
| **Phase 2** | CV/Profile Pipeline | Week 3-4 | High |
| **Phase 3** | ATS & CV Improvement | Week 5-6 | High |
| **Phase 4** | Auxiliary & Admin | Week 7-8 | Low |

### 3.2 Migration Principles

1. **Parallel Run**: Old and new versions coexist during transition
2. **No Breaking Changes** without version bump
3. **Client-First**: Frontend updated before legacy removal
3. **Rollback Ready**: Instant rollback capability
4. **Observability**: Full monitoring during transition

---

## 4. Detailed Migration Plan

### Phase 1: Core Search & Match (Week 1-2)

| # | Endpoint | Target | Breaking? | Effort | Dependencies |
|---|----------|--------|-----------|--------|--------------|
| 1 | Jobs Search | `GET /api/v1/jobs` | No | Low | None |
| 2 | AI Match | `POST /api/v1/match` | No | Low | Jobs Search |
| 3 | Job Details | `POST /api/v1/job-details` | No | Low | Jobs Search |
| 4 | Models List | `GET /api/v1/models` | No | Low | None |
| 5 | Model Info | `GET /api/v1/model` | No | Low | None |

**Deliverables**:
- [ ] New v1 endpoints deployed
- [ ] Frontend client updated (`src/api.ts`)
- [ ] Contract tests pass
- [ ] Legacy endpoints marked deprecated
- [ ] Deprecation headers added
- [ ] Sunset date set (90 days)

---

### Phase 2: CV/Profile Pipeline (Week 3-4)

| # | Endpoint | Target | Breaking? | Effort | Dependencies |
|---|----------|--------|-----------|--------|--------------|
| 6 | Profile Creation | `POST /api/v1/profile` | No | Medium | CV Upload |
| 7 | Cover Letter | `POST /api/v1/cover-letter` | No | Medium | Match |
| 8 | CV Improvement | `POST /api/v1/cv-improvement` | **Yes** | High | Profile, ATS |
| 9 | ATS Analysis | `POST /api/v1/ats-analysis` | No | Medium | Profile |

**Special Notes**:
- **CV Improvement**: Response format changes (wraps in `data` + `meta`)
- **Profile Creation**: Response format change (wraps in `data` + `meta`)

---

### Phase 3: ATS & CV Improvement Deep Dive (Week 5-6)

| # | Endpoint | Target | Breaking? | Effort |
|---|----------|--------|-----------|--------|
| 10 | Job Details | `POST /api/v1/job-details` | No | Low |
| 11 | ATS Analysis | `POST /api/v1/ats-analysis` | No | Low |

**Notes**: These are lower risk, mostly response format standardization.

---

### Phase 4: Auxiliary & Admin (Week 7-8)

| # | Endpoint | Target | Breaking? | Effort |
|---|----------|--------|-----------|--------|
| 12 | Alerts | `POST/DELETE /api/v1/alerts` | No | Low |
| 13 | Usage | `GET /api/v1/usage` | No | Low |
| 14 | Cron Digest | `POST /api/v1/cron/digest` | No | Low |
| 15 | Job Details (legacy) | `POST /api/v1/job-details` | No | Low |

---

## 5. Detailed Endpoint Migration Specs

### 5.1 Jobs Search — `GET /api/jobs` → `GET /api/v1/jobs`

**Current**: `GET /api/jobs?skills=...&city=...`

**Changes**:
- Add version to path
- Wrap response in `data` + `meta`
- Add version header

**Request**: Unchanged (query params)

**Response (Before)**:
```json
{ "jobs": [...], "meta": {...} }
```

**Response (After)**:
```json
{
  "data": { "jobs": [...], "meta": {...} },
  "meta": { "version": "v1", "requestId": "...", "timestamp": "..." }
}
```

---

### 5.2 AI Match — `POST /api/match` → `POST /api/v1/match`

**Current**: `POST /api/match` with body `{ profile, jobs, model }`

**Changes**:
- Path versioning
- Response wrapper
- Version header

**Response (Before)**:
```json
{ "matches": [...], "meta": {...} }
```

**Response (After)**:
```json
{
  "data": { "matches": [...], "meta": {...} },
  "meta": { "version": "v1", "requestId": "...", "timestamp": "..." }
}
```

---

### 5.3 Profile Creation — `POST /api/profile` → `POST /api/v1/profile`

**Current**: Returns `SuggestedProfile` directly

**Changes**:
- Response wrapped in `data` + `meta`
- Version header

**Response (Before)**:
```json
{ "skills": [...], "experienceLevel": "...", "targetRoles": [...], "location": "..." }
```

**Response (After)**:
```json
{
  "data": { "skills": [...], "experienceLevel": "...", "targetRoles": [...], "location": "..." },
  "meta": { "version": "v1", "requestId": "...", "timestamp": "..." }
}
```

---

### 5.4 CV Improvement — `POST /api/cv-improvement` → `POST /api/v1/cv-improvement`

**Current**: Already has `meta.version` but unversioned path

**Changes**:
- Path versioning
- Response already has `meta.version` but needs `requestId`, `timestamp`
- Already wraps in `improvement` + `analysis` + `meta` (close to standard)

**Response (Before)**:
```json
{
  "improvement": { "plan": [...], "summary": {...}, "totalRequirements": 12, "generatedAt": "..." },
  "analysis": { "score": 78, "keywordCoverage": {...}, "criticalGaps": [...], "summary": {...} },
  "meta": { "version": "1.0.0", "generatedAt": "..." }
}
```

**Response (After)**:
```json
{
  "data": {
    "improvement": { "plan": [...], "summary": {...}, "totalRequirements": 12, "generatedAt": "..." },
    "analysis": { "score": 78, "keywordCoverage": {...}, "criticalGaps": [...], "summary": {...} }
  },
  "meta": { "version": "v1", "requestId": "...", "timestamp": "..." }
}
```

**Breaking Changes**:
- Response wrapped in `data` object
- `meta.version` format: `1.0.0` → `v1`
- Added `requestId`, `timestamp` to meta

---

### 5.4 ATS Analysis — `POST /api/ats-analysis` → `POST /api/v1/ats-analysis`

**Current**: Complex response with `analysis`, `recommendations`, `ai`

**Changes**:
- Path versioning
- Response wrapper
- Version header

---

### 5.5 Models — `GET /api/models` → `GET /api/v1/models`

**Current**: Returns `{ models, providers, defaultModel, fallbackModel, recommendedModel, fallbackMaxAttempts }`

**Changes**:
- Path versioning
- Response wrapper

---

### 5.6 Other Endpoints (Low Risk)

| Endpoint | Changes |
|----------|---------|
| `GET /api/model` → `GET /api/v1/model` | Path + wrapper |
| `POST /api/job-details` → `POST /api/v1/job-details` | Path + wrapper |
| `POST/DELETE /api/alerts` → `POST/DELETE /api/v1/alerts` | Path + wrapper |
| `GET /api/usage` → `GET /api/v1/usage` | Path + wrapper |
| `POST /api/cron/digest` → `POST /api/v1/cron/digest` | Path + wrapper |
| `POST /api/cover-letter` → `POST /api/v1/cover-letter` | Path + wrapper |

---

## 6. Frontend Client Updates (src/api.ts)

### 6.1 Required Changes

```typescript
// Before
export async function fetchJobs(profile: Profile): Promise<JobsResponse> {
  return apiFetch<JobsResponse>(`/api/jobs?${params.toString()}`);
}

// After
export async function fetchJobs(profile: Profile): Promise<JobsResponse> {
  const params = new URLSearchParams();
  // ... params
  return apiFetch<JobsResponse>(`/api/v1/jobs?${params.toString()}`);
}

// All functions need base URL update:
// /api/ → /api/v1/
```

### Functions to Update

| Function | Old Path | New Path |
|----------|----------|----------|
| `fetchJobs` | `/api/jobs` | `/api/v1/jobs` |
| `fetchMatches` | `/api/match` | `/api/v1/match` |
| `fetchJobDetails` | `/api/job-details` | `/api/v1/job-details` |
| `fetchModels` | `/api/models` | `/api/v1/models` |
| `fetchModel` | `/api/model` | `/api/v1/model` |
| `createProfile` | `/api/profile` | `/api/v1/profile` |
| `generateCoverLetter` | `/api/cover-letter` | `/api/v1/cover-letter` |
| `subscribeAlert` | `/api/alerts` | `/api/v1/alerts` |
| `unsubscribeAlert` | `/api/alerts` | `/api/v1/alerts` |
| `analyzeATS` | `/api/ats-analysis` | `/api/v1/ats-analysis` |
| `fetchCvImprovement` | `/api/cv-improvement` | `/api/v1/cv-improvement` |

### Response Unwrapping

All client functions need to unwrap `data` from response:

```typescript
// Before
return apiFetch<JobsResponse>(`/api/jobs?${params}`);

// After
const response = await apiFetch<{ data: JobsResponse; meta: Meta }>(`/api/v1/jobs?${params}`);
return response.data;
```

---

## 6. Deployment & Rollout Strategy

### 6.1 Deployment Order

```
Week 1-2: Phase 1 (Core Search)
  1. Deploy v1 endpoints alongside legacy
  2. Update frontend client (feature flag)
  3. Canary release (10% traffic)
  4. Full rollout
  5. Mark legacy deprecated

Week 3-4: Phase 2 (CV/Profile)
  1. Deploy v1 endpoints
  2. Update frontend with feature flag
  3. Canary release
  4. Full rollout

Week 5-6: Phase 3 (ATS/CV Improvement)
  1. Deploy v1 endpoints
  2. Update frontend
  3. Canary release
  4. Full rollout

Week 7-8: Phase 4 (Auxiliary)
  1. Deploy remaining v1 endpoints
  2. Update frontend
  3. Full rollout
  4. Remove legacy endpoints
```

### 6.2 Canary Release Checklist

- [ ] Deploy to staging
- [ ] Run contract tests
- [ ] Enable for 10% traffic (cookie-based)
- [ ] Monitor error rates (target: < 0.1%)
- [ ] Monitor latency (p95 < 500ms)
- [ ] Gradual rollout: 10% → 50% → 100%
- [ ] Rollback plan documented

### 6.3 Rollback Plan

| Trigger | Action |
|---------|--------|
| Error rate > 1% | Immediate rollback |
| Latency p95 > 2s | Immediate rollback |
| Critical bug | Immediate rollback |
| Rollback method | Revert deployment, clear cache |

---

## 7. Deprecation & Sunset Schedule

### 7.1 Deprecation Timeline

| Endpoint | Deprecated | Sunset Date | Removal |
|-----------|------------|-------------|---------|
| `/api/jobs` | Week 1 | +90 days | +180 days |
| `/api/match` | Week 1 | +90 days | +180 days |
| `/api/job-details` | Week 1 | +90 days | +180 days |
| `/api/models` | Week 1 | +90 days | +180 days |
| `/api/model` | Week 1 | +90 days | +180 days |
| `/api/profile` | Week 3 | +90 days | +180 days |
| `/api/cover-letter` | Week 3 | +90 days | +180 days |
| `/api/cv-improvement` | Week 3 | +90 days | +180 days |
| `/api/ats-analysis` | Week 3 | +90 days | +180 days |
| `/api/job-details` | Week 5 | +90 days | +180 days |
| `/api/alerts` | Week 7 | +90 days | +180 days |
| `/api/usage` | Week 7 | +90 days | +180 days |
| `/api/cron/digest` | Week 7 | +90 days | +180 days |
| `/api/job-details` (legacy) | Week 7 | +90 days | +180 days |
| `/api/cover-letter` | Week 7 | +90 days | +180 days |
| `/api/cron/digest` | Week 7 | +90 days | +180 days |

**All legacy endpoints**: Minimum 90 days deprecation, 180 days total before removal.

---

## 7. Deprecation Implementation

### 7.1 Legacy Endpoint Response (After v1 Deploy)

```json
{
  "data": { ... },
  "meta": {
    "version": "v1",
    "deprecation": {
      "deprecated": true,
      "announcedDate": "2024-10-01",
      "sunsetDate": "2025-01-01",
      "replacement": "/api/v1/jobs",
      "migrationGuide": "https://docs.mays.example.com/migration/v1"
    }
  }
}
```

### 7.2 Response Headers

```
X-API-Deprecated: true
X-API-Sunset-Date: 2025-01-01
X-API-Replacement: /api/v1/jobs
```

---

## 8. Testing Strategy

### 8.1 Test Matrix

| Test Type | Scope | Tool | Timing |
|-----------|-------|------|--------|
| Unit | Validation, helpers | Vitest | Every commit |
| Integration | Endpoint behavior | Vitest | Every PR |
| Contract | Schema validation | Vitest + JSON Schema | Every PR |
| E2E | Full flows | Playwright | Nightly |
| Contract | Schema validation | Vitest + JSON Schema | Every PR |
| Load | Performance | k6 | Weekly |

### 7.2 Test Coverage Requirements

| Endpoint | Unit | Integration | Contract | E2E |
|----------|------|-------------|----------|-----|
| `/api/v1/jobs` | ✅ | ✅ | ✅ | ✅ |
| `/api/v1/match` | ✅ | ✅ | ✅ | ✅ |
| `/api/v1/profile` | ✅ | ✅ | ✅ | ✅ |
| `/api/v1/cv-improvement` | ✅ | ✅ | ✅ | ✅ |
| `/api/v1/ats-analysis` | ✅ | ✅ | ✅ | ✅ |
| All others | ✅ | ✅ | ✅ | ❌ |

---

## 8. Communication Plan

### 8.1 Internal Communication

| Channel | Audience | Frequency |
|---------|----------|-----------|
| Slack #platform-api | Platform team | Real-time |
| Weekly sync | Platform + Frontend | Weekly |
| Sprint review | All stakeholders | Bi-weekly |

### 8.2 External Communication

| Channel | Audience | Timing |
|---------|----------|--------|
| Changelog | All developers | Release day |
| API Docs | All developers | Release day |
| Email/Slack | API consumers | Deprecation day |
| Deprecation headers | Active clients | At deprecation |

---

## 9. Risk Assessment & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Frontend not updated in time | Medium | High | Feature flags, parallel run |
| Breaking change missed | Low | Critical | Contract tests, code review |
| Legacy endpoint removal too early | Low | High | 90-day minimum, monitoring |
| Client not migrated | Medium | High | 90-day overlap, monitoring |
| Performance regression | Low | Medium | Canary + monitoring |
| Data loss | Very Low | Critical | Read-only during migration |

---

## 10. Success Criteria

| Metric | Target |
|--------|--------|
| All 13 endpoints migrated | 100% |
| Contract tests passing | 100% |
| Legacy endpoints deprecated | 100% |
| Frontend using v1 | 100% |
| Zero breaking changes in v1 | 0 |
| Error rate during migration | < 0.1% |
| Latency p95 < 500ms | 100% |
| Legacy traffic < 1% | Before sunset |

---

## 11. Rollback Plan

### 11.1 Per-Endpoint Rollback

| Trigger | Action | Time |
|---------|--------|-------|
| Error rate > 1% | Revert deployment | < 5 min |
| Latency p95 > 2s | Revert deployment | < 5 min |
| Critical bug | Revert deployment | < 5 min |
| Data corruption | Restore DB snapshot | < 30 min |

### 11.2 Full Migration Rollback

If critical issue affects multiple endpoints:
1. Revert all v1 deployments
- Re-enable legacy endpoints
- Clear CDN cache
- Notify team
- Post-mortem within 24h

---

## 12. Go/No-Go Criteria

### Per Phase Go Criteria

| Criterion | Threshold |
|-----------|-----------|
| Contract tests pass | 100% |
| Integration tests pass | 100% |
| Canary error rate | < 0.1% |
| Latency p95 | < 500ms |
| No critical bugs | 0 |
| Documentation complete | 100% |
| Frontend updated | 100% |

### Phase No-Go Triggers

- Any critical bug unfixed
- Contract tests failing
- Frontend not ready
- Error rate > 0.1% in canary

---

## 12. Post-Migration

### 12.1 Cleanup (After All Phases)

- [ ] Remove legacy endpoint code
- [ ] Remove legacy routes
- [ ] Update API inventory
- [ ] Archive legacy documentation
- [ ] Update API inventory document
- [ ] Celebrate! 🎉

### 12.2 Post-Migration Monitoring (30 days)

- [ ] Daily error rate review
- [ ] Weekly latency review
- [ ] Monthly usage analysis
- [ ] Quarterly API audit

---

## 13. Appendix: Migration Checklist Template

### Per-Endpoint Checklist

```
Endpoint: ________________
Target: /api/v1/__________

☐ v1 endpoint implemented
☐ Contract tests written
☐ Integration tests pass
☐ Frontend client updated
☐ Feature flag configured
☐ Canary deployed (10%)
☐ Canary metrics OK
☐ Full rollout
☐ Legacy marked deprecated
☐ Deprecation headers added
☐ Sunset date set (+90 days)
☐ Migration guide published
☐ Client notification sent
☐ Documentation updated
☐ API inventory updated
☐ Legacy removed (after sunset)
```

---

## 13. Appendix: Rollback Runbook

### Emergency Rollback (< 5 minutes)

```bash
# 1. Revert deployment
vercel rollback [deployment-url]

# 2. Verify legacy endpoints respond
curl https://api.mays.example.com/api/jobs

# 3. Verify frontend works
# Check browser console for errors

# 4. Notify team
# Post in #platform-api: "ROLLED BACK: [endpoint] - reason: [reason]"
```

---

*End of API Migration Plan v1.0.0*