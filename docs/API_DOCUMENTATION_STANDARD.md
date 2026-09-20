# API Documentation Standard — Mays Platform

**Version**: 1.0.0  
**Status**: Active  
**Owner**: Platform Team  
**Last Updated**: 2026-09-20  
**Applies To**: All public APIs in Mays ecosystem

---

## 1. Purpose

This document defines the **mandatory standard** for all public API endpoints across the Mays platform ecosystem (mays-jobsearch, mays-order-aws, Mays-Recruiting-Intelligence-System, and future modules).

Every public API endpoint MUST comply with this standard. Non-compliant endpoints MUST be migrated or deprecated.

---

## 2. Scope

**Applies To**:
- All public HTTP/REST APIs
- All new API endpoints
- All existing APIs (migration required per migration plan)
- Internal APIs exposed to frontend or external consumers

**Excludes**:
- Internal service-to-service communication (gRPC, message queues)
- Internal library functions
- Build/deployment tooling APIs

---

## 3. Versioning Standard

### 3.1 URL Versioning (Mandatory)

All public API endpoints MUST include major version in URL path:

```
POST /api/v1/<resource>
GET  /api/v1/<resource>
```

### 3.2 Version Format

| Version | Format | Example |
|---------|--------|---------|
| Major (breaking) | `v{N}` | `/api/v2/cv-improvement` |
| Current stable | `v1` | `/api/v1/cv-improvement` |

### 3.3 Versioning Rules

| Change Type | Version Impact | Example |
|-------------|----------------|---------|
| New optional field (request/response) | None (compatible) | Add `source` to response |
| New optional enum value | None (compatible) | Add `NEW_STATUS` to enum |
| New endpoint | None (compatible) | Add `/api/v1/new-endpoint` |
| Remove response field | **Breaking** → Major | Remove `deprecatedField` |
| Rename required field | **Breaking** → Major | `city` → `location` |
| Change field type | **Breaking** → Major | `radiusKm: number` → `string` |
| Change field semantics | **Breaking** → Major | `score: 0-100` → `score: 0-1` |
| Required field → optional | **Breaking** → Major | `city` becomes required |
| Optional field → required | **Breaking** → Major | `tags` becomes required |
| Auth scheme change | **Breaking** → Major | JWT → API Key |
| Error code removal | **Breaking** → Major | Remove `legacy_code` |

### 3.4 Version Header (Required)

All responses MUST include version header:

```
X-API-Version: v1
```

---

## 4. URL Structure Standard

### 4.1 Path Format

```
/api/v{major}/{resource}[/{id}][/{sub-resource}]
```

### 4.2 Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Resource | kebab-case, plural | `/cv-improvement`, `/ats-analysis` |
| Sub-resource | kebab-case, plural | `/jobs/{id}/matches` |
| Path parameters | kebab-case | `/jobs/{job-id}/matches` |
| Query parameters | camelCase | `?pageSize=20&sortBy=score` |

### 4.3 HTTP Methods

| Method | Use Case | Idempotent |
|--------|----------|------------|
| GET | Retrieve resource(s) | Yes |
| POST | Create, complex queries, actions | No |
| PUT | Full resource replacement | Yes |
| PATCH | Partial resource update | No |
| DELETE | Delete resource | Yes |

---

## 5. Request Standard

### 5.1 Headers

| Header | Required | Value |
|--------|----------|-------|
| `Content-Type` | Yes (POST/PUT/PATCH) | `application/json` |
| `Accept` | Recommended | `application/json` |
| `X-Request-ID` | Recommended | UUID v4 |
| `Authorization` | When required | `Bearer <token>` |
| `X-API-Version` | No (in URL) | `v1` |

### 5.2 Request Body

- **Format**: JSON only (`Content-Type: application/json`)
- **Encoding**: UTF-8
- **Max size**: 1 MB (configurable per endpoint)
- **Character encoding**: UTF-8

### 5.3 Query Parameters

- **Format**: camelCase
- **Arrays**: Comma-separated or repeated keys
- **Boolean**: `true`/`false` (lowercase)
- **Dates**: ISO 8601 (`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ssZ`)

---

## 6. Response Standard

### 6.1 Success Response Structure

```json
{
  "data": {},
  "meta": {
    "version": "v1",
    "requestId": "uuid-v4",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "pagination": {}
  }
}
```

### 6.2 Required Response Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `data` | object/array | Yes | Primary response payload |
| `meta` | object | Yes | Response metadata |
| `meta.version` | string | Yes | API version (e.g., `v1`) |
| `meta.requestId` | string | Recommended | UUID v4 for tracing |
| `meta.timestamp` | string | Recommended | ISO 8601 timestamp |

### 6.3 Pagination Meta (when applicable)

```json
{
  "meta": {
    "version": "v1",
    "requestId": "uuid",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "pagination": {
      "cursor": "next-page-token",
      "hasMore": true,
      "pageSize": 20,
      "totalCount": 150
    }
  }
}
```

### 6.4 Empty Response

```json
{
  "data": [],
  "meta": {
    "version": "v1",
    "requestId": "uuid",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## 7. Error Standard

### 7.1 Error Response Structure

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    }
  },
  "meta": {
    "version": "v1",
    "requestId": "uuid",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### 7.2 Required Error Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `error.code` | string | Yes | Machine-readable error code |
| `error.message` | string | Yes | Human-readable message |
| `error.details` | object | No | Additional context |

### 7.3 Standard Error Codes

| Code | HTTP Status | Category | Description |
|------|-------------|----------|-------------|
| `VALIDATION_ERROR` | 400 | Client | Request validation failed |
| `BAD_REQUEST` | 400 | Client | Malformed request |
| `UNAUTHORIZED` | 401 | Auth | Authentication required |
| `FORBIDDEN` | 403 | Auth | Insufficient permissions |
| `NOT_FOUND` | 404 | Client | Resource not found |
| `CONFLICT` | 409 | Client | Resource conflict |
| `UNPROCESSABLE_ENTITY` | 422 | Client | Semantic validation failed |
| `RATE_LIMITED` | 429 | Rate | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Server | Unexpected server error |
| `SERVICE_UNAVAILABLE` | 503 | Server | Service temporarily unavailable |
| `BAD_GATEWAY` | 502 | Server | Upstream service failure |
| `GATEWAY_TIMEOUT` | 504 | Server | Upstream timeout |

### 7.4 HTTP Status Codes

| Status | Usage |
|--------|-------|
| 200 | Successful GET, POST, PUT, PATCH |
| 201 | Resource created |
| 202 | Accepted (async processing) |
| 204 | Success, no content |
| 400 | Bad Request (validation) |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 405 | Method Not Allowed |
| 409 | Conflict |
| 422 | Unprocessable Entity |
| 429 | Too Many Requests |
| 500 | Internal Server Error |
| 502 | Bad Gateway |
| 503 | Service Unavailable |
| 504 | Gateway Timeout |

---

## 8. Pagination Standard

### 8.1 Cursor-Based (Preferred)

```json
{
  "data": [...],
  "meta": {
    "version": "v1",
    "pagination": {
      "nextCursor": "eyJvZmZzZXQiOjIwfQ==",
      "hasMore": true,
      "pageSize": 20
    }
  }
}
```

### 8.2 Offset-Based (Legacy Support)

```json
{
  "data": [...],
  "meta": {
    "version": "v1",
    "pagination": {
      "offset": 20,
      "limit": 20,
      "total": 150,
      "hasMore": true
    }
  }
}
```

---

## 9. Authentication Standard

### 9.1 Documentation Requirements

Each endpoint MUST document:

```markdown
## Authentication
- **Required**: Yes/No
- **Type**: Bearer Token / API Key / Session Cookie / None
- **Scopes**: `read:jobs`, `write:profile` (if applicable)
- **Header**: `Authorization: Bearer <token>`
```

### 9.2 Supported Auth Types

| Type | Header Format | Use Case |
|------|---------------|----------|
| Bearer Token (JWT) | `Authorization: Bearer <token>` | User APIs |
| API Key | `X-API-Key: <key>` | Service-to-service |
| Session Cookie | `Cookie: session=<id>` | Browser sessions |
| None | N/A | Public endpoints |

### 9.3 Error Responses for Auth

| Scenario | Status | Code |
|----------|--------|------|
| Missing auth | 401 | `UNAUTHORIZED` |
| Invalid/expired token | 401 | `UNAUTHORIZED` |
| Insufficient scope | 403 | `FORBIDDEN` |
| Invalid API key | 401 | `UNAUTHORIZED` |

---

## 9. Request ID / Correlation ID

### 9.1 Requirements

- **Request**: Client SHOULD send `X-Request-ID` header (UUID v4)
- **Response**: Server MUST echo `X-Request-ID` in response header
- **Logging**: All logs MUST include `requestId`

### 9.2 Header Format

```
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
```

### 9.3 Generation

- Server generates if not provided by client
- Must be UUID v4 (RFC 4122)
- Used for distributed tracing

---

## 10. Metadata Standard

### 10.1 Response Meta Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | Yes | API version (e.g., `v1`) |
| `requestId` | string | Recommended | Echoed from request |
| `timestamp` | string | Recommended | ISO 8601 UTC |
| `pagination` | object | When applicable | Pagination info |
| `deprecation` | object | When applicable | Deprecation notice |

### 10.2 Deprecation Meta

```json
{
  "meta": {
    "version": "v1",
    "deprecation": {
      "deprecated": true,
      "sunsetDate": "2025-06-01",
      "replacement": "/api/v2/resource",
      "message": "This endpoint will be removed on 2025-06-01. Migrate to /api/v2/resource."
    }
  }
}
```

---

## 11. Documentation Standard

Every public endpoint MUST have documentation following this structure:

```markdown
# Endpoint Name

## Endpoint
```http
POST /api/v1/resource
```

## Purpose
One sentence describing what this endpoint does.

## Version
`v1` (since 2024-01-15)

## Authentication
- **Required**: Yes/No
- **Type**: Bearer Token / API Key / Session Cookie / None
- **Scopes**: `read:resource`, `write:resource`
- **Header**: `Authorization: Bearer <token>`

## Request

### Headers
| Header | Required | Description |
|--------|----------|-------------|
| Content-Type | Yes | application/json |
| X-Request-ID | No | UUID for tracing |

### Body Parameters
| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| fieldName | string | Yes | Description | min: 1, max: 100 |

### Example Request
```json
{
  "fieldName": "value"
}
```

## Response

### Success (200)
```json
{
  "data": {},
  "meta": {
    "version": "v1",
    "requestId": "uuid",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Error Responses
| Status | Code | Message |
|--------|------|---------|
| 400 | VALIDATION_ERROR | Request validation failed |
| 401 | UNAUTHORIZED | Authentication required |
| 500 | INTERNAL_ERROR | Server error |

## Example

### Request
```bash
curl -X POST https://api.example.com/api/v1/resource \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -H "X-Request-ID: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{"fieldName": "value"}'
```

### Response
```json
{
  "data": { "id": "123", "name": "Example" },
  "meta": {
    "version": "v1",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

## Version History
| Version | Date | Changes |
|---------|------|---------|
| v1 | 2024-01-15 | Initial release |

---

## 12. API Version Lifecycle

### 12.1 Lifecycle States

```
DEVELOPMENT → ACTIVE → DEPRECATED → SUNSET → REMOVED
```

### 12.2 State Definitions

| State | Description | Support Level |
|-------|-------------|---------------|
| DEVELOPMENT | Under development, not public | Internal only |
| ACTIVE | Current stable version | Full support |
| DEPRECATED | Superseded, migration path exists | Security fixes only |
| SUNSET | End-of-life announced, migration deadline | Critical fixes only |
| REMOVED | No longer available | None |

### 12.3 Deprecation Process

1. **Announce**: Mark as `DEPRECATED` in docs and meta
2. **Communicate**: 90-day minimum notice
3. **Migrate**: Provide migration guide and new version
4. **Sunset**: Set `sunsetDate` in meta
5. **Remove**: After sunset date, return 410 Gone

### 12.4 Deprecation Meta

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

---

## 13. API Contract Testing

### 13.1 Required Test Coverage

Every endpoint MUST have tests for:

- [ ] Request validation (valid/invalid)
- [ ] Response shape matches schema
- [ ] Error response format
- [ ] HTTP status codes
- [ ] API version in response
- [ ] Required fields present
- [ ] Auth behavior (when applicable)
- [ ] Rate limiting (if applicable)

### 13.2 Contract Test Pattern

```typescript
describe("POST /api/v1/resource", () => {
  it("returns 200 with valid request", async () => {
    const res = await request(app)
      .post("/api/v1/resource")
      .send(validPayload)
      .expect(200);
    
    expect(res.body.meta.version).toBe("v1");
    expect(res.body.data).toMatchSchema(ResourceSchema);
  });

  it("returns 400 for invalid payload", async () => {
    await request(app)
      .post("/api/v1/resource")
      .send(invalidPayload)
      .expect(400)
      .expect({ error: { code: "VALIDATION_ERROR" } });
  });
});
```

---

## 14. Migration Standard

### 14.1 Migration Principles

1. **Never break existing clients** without version bump
2. **Parallel run**: Old and new versions coexist
3. **Clear migration path**: Documented migration guide
4. **Parallel testing**: Both versions tested in CI

### 14.2 Migration Checklist

- [ ] New version endpoint created (`/api/v2/...`)
- [ ] Old version marked `DEPRECATED` in docs
- [ ] Migration guide published
- [ ] Deprecation meta added to old version responses
- [ ] `sunsetDate` set (minimum 90 days)
- [ ] Migration guide published
- [ ] Clients notified
- [ ] Old version removed after sunset

---

## 15. CV Improvement API — Current Status

### Current State

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /api/cv-improvement` |
| **Version** | Unversioned (legacy) |
| **Target** | `POST /api/v1/cv-improvement` |
| **Status** | Migration Pending |

### Migration Plan

| Step | Action | Status |
|------|--------|--------|
| 1 | Create `/api/v1/cv-improvement` | Not Started |
| 2 | Mark `/api/cv-improvement` as deprecated | Not Started |
| 3 | Add deprecation meta to legacy endpoint | Not Started |
| 4 | Set sunset date (90 days) | Not Started |
| 5 | Publish migration guide | Not Started |
| 6 | Update frontend client | Not Started |
| 6 | Set sunset date (90 days from announcement) | Not Started |
| 7 | Remove legacy endpoint | Not Started |

---

## 16. Implementation Checklist for New Endpoints

### Before Implementation
- [ ] Review this standard document
- [ ] Design request/response schemas
- [ ] Define error codes
- [ ] Plan versioning (`/api/v1/...`)
- [ ] Plan authentication
- [ ] Design pagination (if list)

### During Implementation
- [ ] Add version header (`X-API-Version`)
- [ ] Add request ID handling
- [ ] Implement standard error format
- [ ] Add request validation
- [ ] Add CORS headers
- [ ] Add OPTIONS handler

### Testing
- [ ] Unit tests for validation
- [ ] Integration tests for success/error
- [ ] Contract tests (schema validation)
- [ ] Auth tests (if applicable)
- [ ] Error scenario tests

### Documentation
- [ ] Create endpoint documentation (per §11)
- [ ] Update API inventory
- [ ] Add to API changelog

### Deployment
- [ ] Deploy to staging
- [ ] Run contract tests
- [ ] Deploy to production
- [ ] Monitor error rates

---

## 17. Compliance & Enforcement

### 17.1 Code Review Requirements

All API changes MUST pass:
- [ ] Code review by Platform team
- [ ] Contract tests pass
- [ ] Documentation complete
- [ ] Version header present
- [ ] Error format compliant

### 17.2 CI/CD Gates

Pipeline MUST enforce:
- [ ] TypeScript compilation
- [ ] Contract tests pass
- [ ] API docs updated
- [ ] No breaking changes without version bump

### 17.3 Audit Schedule

- **Quarterly**: Full API audit against this standard
- **Per release**: New endpoints reviewed
- **Annual**: Standard review and update

---

## 18. References

- [REST API Tutorial](https://restfulapi.net/)
- [Microsoft REST API Guidelines](https://github.com/microsoft/api-guidelines)
- [Google API Design Guide](https://cloud.google.com/apis/design)
- [JSON:API Specification](https://jsonapi.org/)
- [RFC 7807 - Problem Details for HTTP APIs](https://tools.ietf.org/html/rfc7807)
- [RFC 9457 - Problem Details (Updated)](https://www.rfc-editor.org/rfc/rfc9457)

---

## 19. Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-09-20 | Platform Team | Initial standard |

---

## Appendix A: Quick Reference Card

### URL Format
```
/api/v1/resource
/api/v1/resource/{id}
/api/v1/resource/{id}/sub-resource
```

### Headers
```
Content-Type: application/json
X-Request-ID: uuid-v4
Authorization: Bearer <token>
X-API-Version: v1 (in URL path)
```

### Success Response
```json
{
  "data": {},
  "meta": {
    "version": "v1",
    "requestId": "uuid",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Error Response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {}
  },
  "meta": { "version": "v1", "requestId": "uuid", "timestamp": "..." }
}
```

### Error Codes
```
VALIDATION_ERROR (400), UNAUTHORIZED (401), FORBIDDEN (403),
NOT_FOUND (404), CONFLICT (409), UNPROCESSABLE_ENTITY (422),
RATE_LIMITED (429), INTERNAL_ERROR (500), SERVICE_UNAVAILABLE (503)
```

### Versioning
```
/api/v1/resource     → Current stable
/api/v2/resource     → Breaking changes
```

### Deprecation Header
```
X-API-Deprecated: true
X-API-Sunset-Date: 2025-06-01
X-API-Replacement: /api/v2/resource
```

---

*End of API Documentation Standard v1.0.0*