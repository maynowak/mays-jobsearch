# API Versioning Standard — Mays Platform

**Version**: 1.0.0  
**Status**: Active  
**Owner**: Platform Team  
**Last Updated**: 2026-09-20  
**Part of**: API Documentation Standard v1.0.0  

---

## 1. Purpose

This document defines the **versioning strategy** for all public APIs in the Mays platform. It ensures predictable, non-breaking evolution of APIs while enabling continuous improvement.

---

## 2. Versioning Philosophy

### Core Principles

1. **Predictability**: Consumers know exactly what to expect
2. **Stability**: Existing integrations never break without warning
3. **Clarity**: Version in URL makes capabilities obvious
4. **Migration Path**: Clear upgrade path for every breaking change

---

## 2. Versioning Scheme

### URL-Based Major Versioning (Required)

```
POST /api/v1/resource
GET  /api/v2/resource/{id}
```

- **Major version ONLY** in URL (`v1`, `v2`, `v3`)
- **No minor/patch** in URL (`v1.1`, `v1.0.1` forbidden)
- **Version in path**, not header or query param

### Version Format

```
v{N}          where N = positive integer (1, 2, 3...)
```

Examples:
- ✅ `/api/v1/jobs`
- ✅ `/api/v2/cv-improvement`
- ❌ `/api/v1.1/jobs`
- ❌ `/api/v1.0.0/cv-improvement`
- ❌ `/api/latest/cv-improvement`
- ❌ `/api/v1.2.3/jobs`

---

## 3. Version Lifecycle

### Lifecycle States

```
┌──────────────┐     ┌────────┐     ┌─────────────┐     ┌────────┐     ┌─────────┐
│ DEVELOPMENT  │ →   │ ACTIVE │ →   │ DEPRECATED  │ →   │ SUNSET │ →   │ REMOVED │
└──────────────┘     └────────┘     └─────────────┘     └────────┘     └─────────┘
   Internal           Full              Migration       Critical       Gone
   only               Support           Path + Notice    Fixes Only
```

### State Definitions

| State | Description | Support | Duration |
|-------|-------------|---------|----------|
| **DEVELOPMENT** | Under development, not public | Internal only | Until release |
| **ACTIVE** | Current stable version | Full support | Until deprecated |
| **DEPRECATED** | Superseded, migration path exists | Security fixes only | Min 90 days |
| **SUNSET** | End-of-life announced | Critical fixes only | Until sunset date |
| **REMOVED** | No longer available | None | Permanent |

---

## 3. Version Lifecycle Transitions

### 3.1 DEVELOPMENT → ACTIVE

**Trigger**: Code complete, tested, documented, deployed to staging

**Requirements**:
- [ ] All contract tests pass
- [ ] Documentation complete per §11
- [ ] Deployed to staging
- [ ] Smoke tests pass in staging
- [ ] Version header returns correctly

**Action**: Deploy to production, mark `ACTIVE` in docs

---

### 3.2 ACTIVE → DEPRECATED

**Trigger**: New major version released (`v{N+1}`)

**Requirements**:
- [ ] New version (`v{N+1}`) is `ACTIVE`
- [ ] Migration guide published
- [ ] Deprecation notice added to old version docs
- [ ] Deprecation meta added to responses
- [ ] `sunsetDate` set (minimum 90 days from announcement)
- [ ] Clients notified via changelog/notifications
- [ ] Old version marked `DEPRECATED` in docs

**Deprecation Meta** (added to all responses):
```json
{
  "meta": {
    "version": "v1",
    "deprecation": {
      "deprecated": true,
      "announcedDate": "2024-10-01",
      "sunsetDate": "2025-01-01",
      "replacement": "/api/v2/resource",
      "migrationGuide": "https://docs.example.com/migration/v1-to-v2"
    }
  }
}
```

**Response Headers** (recommended):
```
X-API-Deprecated: true
X-API-Sunset-Date: 2025-01-01
X-API-Replacement: /api/v2/resource
```

---

### 3.3 DEPRECATED → SUNSET

**Trigger**: `sunsetDate` reached (or business decision)

**Requirements**:
- [ ] `sunsetDate` has passed
- [ ] Critical fixes only (security only)
- [ ] No new features
- [ ] Monitoring for remaining usage
- [ ] Final client notifications sent

---

### 3.4 SUNSET → REMOVED

**Trigger**: Post-sunset date, minimal usage confirmed

**Action**:
- Remove endpoint code
- Remove documentation
- Return `410 Gone` for any remaining requests
- Update API inventory

---

## 4. Breaking Change Definition

### 4.1 Breaking Changes (Require Major Version Bump)

| Change | Example |
|--------|---------|
| Remove response field | Remove `deprecatedField` from response |
| Rename required field | `city` → `location` |
| Change field type | `radiusKm: number` → `string` |
| Change field semantics | `score: 0-100` → `score: 0-1` |
| Required field added | `city` becomes required |
| Optional field → required | `tags` becomes required |
| Remove enum value | Remove `LEGACY_STATUS` from enum |
| Change error code | `bad_request` → `validation_error` |
| Change HTTP status | `400` → `422` for validation |
| Auth scheme change | JWT → API Key |
| Remove endpoint | Delete `/api/v1/old-endpoint` |

### 4.2 Non-Breaking (Compatible) Changes

| Change | Example |
|--------|---------|
| Add optional response field | Add `source` to response |
| Add optional enum value | Add `NEW_STATUS` to enum |
| Add optional request field | Add `source` to request |
| New optional endpoint | Add `/api/v1/new-endpoint` |
| Add optional query param | Add `?includeDetails=true` |
| New response metadata | Add `meta.processingTime` |
| Extend enum with new value | Add `PENDING` to status enum |
| Relax validation | Make required field optional |

---

## 4. Version Numbering Rules

### Major Version Only in URL

```
✅ /api/v1/resource
✅ /api/v2/resource
❌ /api/v1.1/resource
❌ /api/v1.0/resource
❌ /api/v1.2.3/resource
```

### Version Number Semantics

| Version | Meaning |
|---------|---------|
| `v1` | Initial stable release |
| `v2` | First breaking change |
| `v3` | Second breaking change |
| ... | Subsequent breaking changes |

**No semantic versioning in URL** — only major version.

---

## 5. API Evolution Strategy

### 5.1 Adding Features Without Breaking

| Technique | Example |
|----------|----------|
| Add optional response field | Add `source` to job object |
| Add optional enum value | Add `NEW_STATUS` to status enum |
| New endpoint | Add `/api/v1/new-report` |
| New optional query param | `?includeDetails=true` |
| New response meta | Add `meta.processingTime` |

### 5.2 Deprecating Fields

**Phase 1** (Current version):
- Keep field in response
- Add `deprecated: true` to field docs
- Add alternative field

**Phase 2** (Next minor):
- Mark field as deprecated in schema
- Log warning when field accessed

**Phase 3** (Next major):
- Remove field entirely

```json
{
  "data": {
    "city": "Berlin",
    "location": "Berlin",  // New field
    "city": "Berlin",       // Deprecated, kept for compatibility
    "_deprecated": {
      "city": "Use 'location' instead. Will be removed in v2."
    }
  }
}
```

---

## 6. Version Communication

### 6.1 Announcement Channels

| Channel | Timing | Audience |
|----------|--------|----------|
| Changelog | Release day | All developers |
| API Docs | Release day | All developers |
| Email/Slack | Release day | Registered API consumers |
| Deprecation Header | At deprecation | Active clients |

### 5.2 Release Notes Template

```markdown
## Version v2.0.0 - 2024-10-01

### Breaking Changes
- `/api/v1/cv-improvement` → `/api/v1/cv-improvement` (response format changed)
- `job.tags` renamed to `job.skills` in response

### New Features
- Added `/api/v1/cv-improvement/v2` with enhanced recommendations
- Added `includeRawAnalysis` query parameter

### Deprecations
- `/api/cv-improvement` (unversioned) deprecated, sunset 2025-01-01

### Migration
See [Migration Guide v1→v2](/docs/migration/v1-to-v2)
```

---

## 6. Client Migration Support

### 6.1 Migration Requirements

For each breaking change:

| Requirement | Description |
|------------|-------------|
| Migration Guide | Step-by-step upgrade instructions |
| Code Examples | Before/after code samples |
| Breaking Change List | Explicit list of all breaking changes |
| Automated Migration Tool | Script to transform requests (if feasible) |
| Support Window | Minimum 90 days overlap |

### 6.2 Client Communication

| Channel | Timing | Content |
|---------|--------|---------|
| Changelog | Release day | Technical details |
| Email/Slack | Release day | Summary + migration link |
| API Response Header | At deprecation | `X-API-Deprecated`, `X-API-Sunset-Date` |
| Deprecation Meta | At deprecation | In response `meta.deprecation` |

---

## 6. Version Header & Discovery

### 6.1 Version Discovery

Clients can discover available versions:

```
GET /api/versions
```

Response:
```json
{
  "data": [
    { "version": "v1", "status": "DEPRECATED", "sunsetDate": "2025-01-01" },
    { "version": "v2", "status": "ACTIVE", "since": "2024-10-01" }
  ],
  "meta": { "version": "v1" }
}
```

### 6.2 Version Header

All responses MUST include:
```
X-API-Version: v1
```

---

## 7. Testing Version Compliance

### 6.1 CI/CD Checks

Pipeline MUST verify:

```yaml
# .github/workflows/api-versioning.yml
jobs:
  version-check:
    steps:
      - run: npm run check:api-version
      - run: npm run test:contract
      - run: npm run check:version-header
```

### 5.2 Required Checks

| Check | Tool | Failure Action |
|-------|------|----------------|
| Version in URL | Custom script | Fail build |
| Version header present | Custom script | Fail build |
| No unversioned endpoints | Custom script | Warn |
| Deprecation headers | Custom script | Warn |
| Contract tests pass | Vitest | Fail build |
| Schema validation | JSON Schema | Fail build |

---

## 6. Version Migration Examples

### 6.1 v1 → v2 Migration (cv-improvement)

**v1 Request**:
```json
POST /api/cv-improvement
{ "job": {...}, "profile": {...} }
```

**v2 Request** (with version):
```json
POST /api/v1/cv-improvement
{ "job": {...}, "profile": {...} }
```

**v1 Response**:
```json
{ "recommendations": [...], "meta": { "version": "1.0.0" } }
```

**v2 Response**:
```json
{
  "data": { "improvement": { "plan": [...], "summary": {...} } },
  "meta": { "version": "v1", "requestId": "..." }
}
```

### 6.2 Migration Code Example

```typescript
// Client migration helper
async function fetchCvImprovementV2(job, profile) {
  const response = await fetch('/api/v1/cv-improvement', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': crypto.randomUUID(),
    },
    body: JSON.stringify({ job, profile }),
  });
  
  const { data, meta } = await response.json();
  
  // Handle deprecation warning
  if (meta.deprecation?.deprecated) {
    console.warn(`API deprecated. Migrate to ${meta.deprecation.replacement} by ${meta.deprecation.sunsetDate}`);
  }
  
  return data;
}
```

---

## 7. Monitoring & Metrics

### 6.1 Version Usage Metrics

Track per version:
- Request count
- Error rate
- Latency (p50, p95, p99)
- Unique clients
- Deprecation header responses

### 6.2 Alerting

| Metric | Threshold | Action |
|--------|-----------|--------|
| Deprecated version usage > 10% | After 30 days | Escalate to team |
| Deprecated version usage > 1% | After 60 days | Page on-call |
| Sunset version usage > 0 | After sunset | Page on-call |

---

## 6. Appendix: Version Decision Matrix

| Scenario | Action |
|----------|--------|
| New optional field | Same version |
| New required field | **Major version bump** |
| Remove optional field | Same version (deprecate first) |
| Remove required field | **Major version bump** |
| Change field type | **Major version bump** |
| Change field name | **Major version bump** |
| Add enum value | Same version |
| Remove enum value | **Major version bump** |
| New endpoint | Same version |
| Remove endpoint | **Major version bump** |
| Change auth | **Major version bump** |
| Change error format | **Major version bump** |
| Change HTTP status for same error | **Major version bump** |

---

*End of API Versioning Standard v1.0.0*