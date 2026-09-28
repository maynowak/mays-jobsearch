# PUBLIC-ATS-SOURCES-03 — EXECUTION LOG (Contract Reconciliation & Final GREEN)

## Current status
**GREEN** — Design reconciled with implemented ATS-JOB-SOURCES-01. All 6 providers conform to contract.

## Audit date/time
2026-09-28 (nach ATS-JOB-SOURCES-01 commit 6b1d0ac)

## Git state
- Branch: main, HEAD 6b1d0ac, synchron mit origin/main
- Working tree: clean (nur dieser Report)

---

## 1. Ausgangsarchitektur (Bestätigt)

### Source Registry (`api/_lib/sources/index.mjs`) — **Implementation matches Design**
```javascript
export const SOURCES = [arbeitnow, greenhouse, ...publicAtsSources, ...APIFY_ACTORS.map(createApifySource)];
```

Resulting Registry Structure:
```
EXISTING SOURCE REGISTRY
│
├── Arbeitnow          (direct-api)
├── Arbeitsagentur     (apify)
├── Greenhouse         (ats)  ← legacy standalone + factory instances
├── Lever              (ats)  ← factory instance
├── Ashby              (ats)  ← factory instance
├── Workable           (ats)  ← factory instance
├── Recruitee          (ats)  ← factory instance
└── Personio           (ats)  ← factory instance
```

**Keine `PublicATS` Wrapper-Source** — jeder Provider ist eigenständiger Registry-Eintrag. ✅

---

## 2. Contract-Conformance-Matrix

| Provider   | Registry Contract | Identifier Semantik | Normalization | Error Isolation | Config via Factory | Status |
|------------|-------------------|---------------------|---------------|-----------------|-------------------|--------|
| **Greenhouse** | ✅ `id`, `displayName`, `provider:"ats"`, `enabled()`, `fetchJobs()` | ✅ `board_token` (legacy) + factory `identifier` | ✅ All fields, `externalId=gh-{id}` | ✅ Per-board try/catch, `emptyResult` | ✅ Legacy + Factory dual-path | **GREEN** |
| **Lever**      | ✅ `id=lever:{id}`, `displayName`, `provider:"ats"`, `enabled()`, `fetchJobs()` | ✅ `site` slug | ✅ All fields, `externalId=lv-{id}` | ✅ HTTP 404/429/5xx → `emptyResult` | ✅ Factory `createLeverSource` | **GREEN** |
| **Ashby**      | ✅ `id=ashby:{id}`, `displayName`, `provider:"ats"`, `enabled()`, `fetchJobs()` | ✅ `job_board_name` | ✅ All fields, `externalId=ab-{id}` | ✅ HTTP 404/429/5xx → `emptyResult` | ✅ Factory `createAshbySource` | **GREEN** |
| **Workable**   | ✅ `id=workable:{id}`, `displayName`, `provider:"ats"`, `enabled()`, `fetchJobs()` | ✅ `account_subdomain` | ✅ All fields, `externalId=wk-{shortcode}` | ✅ HTTP 404/429/5xx → `emptyResult` | ✅ Factory `createWorkableSource` | **GREEN** |
| **Recruitee**  | ✅ `id=recruitee:{id}`, `displayName`, `provider:"ats"`, `enabled()`, `fetchJobs()` | ✅ `company_subdomain` | ✅ All fields, `externalId=rc-{id}` | ✅ HTTP 404/429/5xx → `emptyResult` | ✅ Factory `createRecruiteeSource` | **GREEN** |
| **Personio**   | ✅ `id=personio:{id}`, `displayName`, `provider:"ats"`, `enabled()`, `fetchJobs()` | ✅ `career_site` | ✅ All fields, `externalId=po-{id}` (XML) | ✅ HTTP 404/429/5xx → `emptyResult` | ✅ Factory `createPersonioSource` | **GREEN** |

### Registry Contract Verification (alle Provider)
| Feld | Erwartet | Greenhouse | Lever | Ashby | Workable | Recruitee | Personio |
|------|----------|------------|-------|-------|----------|-----------|----------|
| `id` | string | ✅ `greenhouse` / `greenhouse:{id}` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `displayName` | string | ✅ `"Greenhouse"` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `provider` | `"ats"` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `enabled()` | `() => boolean` | ✅ Config-basiert | ✅ | ✅ | ✅ | ✅ | ✅ |
| `fetchJobs(params)` | `Promise<{jobs,meta}>` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 3. PublicJobSourceConfig — **Implementation Matches Design**

### Design (aus 03-Report)
```typescript
interface PublicJobSourceConfig {
  provider: "greenhouse" | "lever" | "ashby" | "workable" | "recruitee" | "personio";
  identifier: string;
  enabled?: boolean;      // default: true
  label?: string;
  options?: Record<string, unknown>;
}
```

### Implementation (`api/_lib/config.mjs` + `factory.mjs`)
```javascript
// Config Parser
function parsePublicAtsSources(value) {
  // Returns array of { provider, identifier, enabled, label, options }
  // Validates provider + identifier required
  // Trims strings, defaults enabled=true
}

// Factory
export function createPublicJobSource(config) {
  const { provider, identifier, enabled = true, label, options = {} } = config;
  // Validates provider known, identifier present
  // Returns source with id = `${provider}:${identifier.trim()}`
  // Sets source.provider = "ats"
}
```

**Conformance: GREEN** — Exakt wie designed. Keine Abweichung.

---

## 4. Multiple Instances — **Verified Working**

### Config Example (aus `.env.example`)
```json
[
  {"provider":"greenhouse","identifier":"stripe","enabled":true},
  {"provider":"greenhouse","identifier":"airbnb","enabled":true},
  {"provider":"lever","identifier":"netflix","enabled":true}
]
```

### Resulting Source IDs
```
greenhouse:stripe
greenhouse:airbnb
lever:netflix
```

**Factory erzeugt:** `source.id = \`${provider}:${identifier.trim()}\`` — deterministisch, stabil. ✅

**Deduplication:** `jobKey(title|company|location)` funktioniert cross-instance. ✅

---

## 5. Stable Source IDs — **Verified**

| Provider | Identifier | Resulting ID | Stabil |
|----------|------------|--------------|--------|
| greenhouse | stripe | `greenhouse:stripe` | ✅ |
| greenhouse | airbnb | `greenhouse:airbnb` | ✅ |
| lever | netflix | `lever:netflix` | ✅ |
| ashby | notion | `ashby:notion` | ✅ |
| workable | acme | `workable:acme` | ✅ |
| recruitee | mycompany | `recruitee:mycompany` | ✅ |
| personio | personio | `personio:personio` | ✅ |

**Sonderzeichen/Whitespace:** Factory macht `.trim()` — robust. ✅
**Doppelte Config-Einträge:** Werden als separate Instanzen behandelt (gewollt). ✅

---

## 6. Provider Identifier Semantics — **Implementation Matches Design**

| Provider | Config Field | Identifier Name | Example | Actual Endpoint Used |
|----------|--------------|-----------------|---------|---------------------|
| Greenhouse | `identifier` | `board_token` | `stripe` | `boards-api.greenhouse.io/v1/boards/{board_token}/jobs` |
| Lever | `identifier` | `site` | `netflix` | `api.lever.co/v0/postings/{site}?mode=json` |
| Ashby | `identifier` | `job_board_name` | `notion` | `api.ashbyhq.com/posting-api/job-board/{job_board_name}` |
| Workable | `identifier` | `account_subdomain` | `acme` | `apply.workable.com/api/v3/accounts/{account_subdomain}/jobs?details=true` |
| Recruitee | `identifier` | `company_subdomain` | `mycompany` | `{company_subdomain}.recruitee.com/api/offers/` |
| Personio | `identifier` | `career_site` | `personio` | `{career_site}.jobs.personio.de/xml` |

**Keine künstliche Vereinheitlichung zu `boardId`.** ✅

---

## 7. Normalization Boundary — **Verified**

### Required Fields — **Alle Provider liefern**
| Field | Greenhouse | Lever | Ashby | Workable | Recruitee | Personio |
|-------|------------|-------|-------|----------|-----------|----------|
| `slug` | ✅ `gh-{id}` | ✅ `lv-{id}` | ✅ `ab-{id}` | ✅ `wk-{shortcode}` | ✅ `rc-{id}` | ✅ `po-{id}` |
| `title` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `company_name` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `location[]` | ✅ (location+offices) | ✅ (categories.location + allLocations) | ✅ | ✅ | ✅ | ✅ (office+additionalOffices) |
| `remote` | ✅ inferred | ✅ (workplaceType/commitment) | ✅ | ✅ (remote bool) | ✅ (remote bool) | ✅ inferred |
| `tags[]` | ✅ (depts+tags) | ✅ (commitment,team,dept,level) | ✅ (department) | ✅ (department) | ✅ (dept+tags) | ✅ (dept,recruitingCat,seniority,exp) |
| `url` | ✅ `absolute_url` | ✅ `hostedUrl` | ✅ `jobUrl` | ✅ `url` | ✅ `careers_url` | ❌ (empty) |
| `created_at` | ✅ `updated_at` | ✅ `createdAt` | ❌ | ❌ | ✅ `created_at` | ✅ `createdAt` |
| `source[]` | ✅ `[id,"ats"]` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `description` | ✅ HTML | ✅ HTML | ✅ HTML | ✅ HTML | ❌ | ✅ HTML |
| `descriptionPlain` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `language` | ✅ detected | ✅ detected | ✅ detected | ✅ detected | "en" | ✅ detected |
| `jobTypes` | ✅ `employment_type` | ✅ `commitment` | ✅ `employmentType` | ✅ `employment_type` | ✅ `employment_type_code` | ✅ `employmentType` |
| `applyUrl` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `jobUrl` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `workplaceType` | ❌ | ✅ | ✅ | remote→"remote" | remote→"remote" | ❌ |
| `department` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `externalId` | ✅ `gh-{id}` | ✅ `lv-{id}` | ✅ `ab-{id}` | ✅ `wk-{id}` | ✅ `rc-{id}` | ✅ `po-{id}` |

**Gaps dokumentiert (Design-konform):**
- Personio `url`/`applyUrl`/`jobUrl`/`workplaceType` = Provider liefert nicht
- Recruitee `description` = Public Feed hat keine Beschreibung
- Workable/Ashby `created_at` = Provider liefert nicht
- Greenhouse `workplaceType` = Provider liefert nicht

**Keine erfundenen Felder.** ✅

---

## 8. Search/ATS Separation — **Verified Unchanged**

### Flow bleibt unverändert:
```
CV Upload
    ↓
POST /api/profile → Search Profile
    ↓
GET /api/jobs?skills=...&targetRoles=...&city=...
    ↓
alle Sources parallel (inkl. 6 ATS)
    ↓
Deduplication + Filter + SearchStrategy
    ↓
Jobs → UI
    ↓
User wählt Job
    ↓
POST /api/ats-analysis { job, profile: { skills } }
    ↓
ATS Analysis (ats.mjs) → deterministic scoring + optional AI formulation
```

**Public ATS Sources liefern nur Jobs.** Keine ATS-Profile, keine ATS-Analysis-Logik in Sources. ✅

---

## 9. Parallel Execution — **Verified**

### Registry Flow (`index.mjs`):
```javascript
const settled = await Promise.allSettled(
  sources.map((source) => source.fetchJobs({ skills, targetRoles: roles, city: geoCity }))
);
```

### Error Isolation — **Funktioniert**
- `arbeitnow` (critical) → throws on error
- `greenhouse` + ATS + `arbeitsagentur` (non-critical) → log + `emptyResult`
- Andere Sources unbeeinflusst ✅

### Zusammenführung → Deduplication → Filter → SearchStrategy ✅

---

## 10. Configuration — **Verified**

### `PUBLIC_ATS_SOURCES` — **Server-side JSON**
```bash
PUBLIC_ATS_SOURCES='[
  {"provider":"greenhouse","identifier":"stripe","enabled":true},
  {"provider":"lever","identifier":"netflix","enabled":true},
  {"provider":"ashby","identifier":"notion","enabled":true}
]'
```

### Parser (`config.mjs`):
- Validiert Array, required `provider` + `identifier`
- Trimmt Strings, default `enabled=true`
- `options` object für provider-spezifische Overrides (z.B. Ashby `includeCompensation`, Personio `language`)

### Security:
- Kein `VITE_` prefix ✅
- Keine Secrets ✅ (Identifiers sind öffentliche Board-Tokens)
- Keine DB/Admin UI ✅
- Client sieht nur Job-Daten ✅

---

## 11. Capabilities — **Actual vs Design**

| Capability | Design (Expected) | Greenhouse | Lever | Ashby | Workable | Recruitee | Personio |
|------------|-------------------|------------|-------|-------|----------|-----------|----------|
| description | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| remote | ✅ | ✅ (inferred) | ✅ | ✅ | ✅ | ❌ |
| locations | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| employmentType | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| publishedAt | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| workplaceType | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| salary | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| departments | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| tags | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| applyUrl | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| pagination | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |

**Note:** Capabilities sind deklarativ (nicht erzwungen). Registry filtering bleibt lokal. ✅

---

## 12. Error Handling — **Verified**

### Config Errors (Factory):
- Unknown provider → `throw Error("Unknown public ATS provider: X")` ✅
- Missing identifier → `throw Error("Missing identifier for provider X")` ✅

### Runtime Errors (alle Adapter konsistent):
| Error | Behavior | Verified |
|-------|----------|----------|
| HTTP 404 | Log + `emptyResult("not_found")` | ✅ alle 6 |
| HTTP 429 | Log + `emptyResult("rate_limited")` | ✅ alle 6 |
| HTTP 5xx | Log + `emptyResult("upstream")` | ✅ alle 6 |
| Network/Timeout | Log + `emptyResult("network"/"timeout")` | ✅ alle 6 |
| Invalid JSON/XML | Log + `emptyResult("invalid_response")` | ✅ alle 6 |
| Empty Feed | `emptyResult("no_jobs")` / `enabled: true` | ✅ alle 6 |

### Registry Integration:
- `Promise.allSettled` — Isolation pro Source ✅
- `source.critical` nur bei `arbeitnow` ✅
- `countJobSourceRequest(source.id)` auf Success ✅
- `meta.reason` in API Response ✅

---

## 13. Deduplication — **Verified**

### Cross-Source:
- `jobKey(title|company|location)` → merge `source[]` ✅
- Z.B. `greenhouse:stripe` + `lever:netflix` gleicher Job → `source: ["greenhouse:stripe", "lever:netflix", "ats"]`

### ATS-Internal (multi-board/tenant):
- Adapter nutzt `externalId` (provider-prefixed) ✅
- Greenhouse: `gh-{id}`, Lever: `lv-{id}`, etc.

---

## 14. AI_AUDITLOG.md — **Template Compliance Verified**

### Template Analysis:
- Template definiert Execution Log Struktur (Status, Date/Time, Git Branch/HEAD, Scope, Findings, Evidence, Classification GREEN/YELLOW/ORANGE/RED/GRAY, Git Status, Files Changed, Open Questions, Risks, Next Actions)
- Template enthält KEINE eigentlichen Audit-Einträge — diese gehen in `docs/reports/`
- Template §44: "The execution log itself is part of the audit workflow and must be kept accurate even if the audit remains completely read-only."

### Classification für PUBLIC-ATS-SOURCES-03:
- **Design-Task** (Contract Reconciliation, keine Implementierung)
- Public ATS Sources: Job Data → Normalization → Deterministic Filter/Search
- **Kein Model Call**, **Kein AI Provider**, **Kein Consent Flow**, **Keine Anonymization**, **Kein AI Fallback**, **Kein AI Data Transfer**

### AI_AUDITLOG Classification:
```
AI_AUDITLOG classification: NO AI DATA-FLOW CHANGE

Reason:
PUBLIC-ATS-SOURCES-03 is a contract reconciliation task.
Public ATS sources only provide job data.
No model call, AI provider, consent flow, anonymization flow,
AI fallback, or AI data transfer is introduced or changed.

AI_AUDITLOG.md template was reviewed.
No artificial audit entry was created because the template
does not require one for a no-AI-data-flow design/reconciliation task.
```

**Kein künstlicher Audit-Eintrag erzeugt.** ✅

---

## 15. Negativ-DoD — **All Verified**

| Negativ-DoD Item | Status | Evidence |
|------------------|--------|----------|
| Keine neue Provider-Implementierung | ✅ | 01 bereits GREEN, 03 nur Reconciliation |
| Keine zweite Greenhouse-Impl | ✅ | Legacy + Factory dual-path documented |
| Keine neue Source-Architektur | ✅ | Bestehende Registry verwendet |
| Keine ATS-Profile/Analysis Änderung | ✅ | `ats.mjs`, `ats-analysis.mjs` unverändert |
| Keine `/api/v1` Migration | ✅ | `api/jobs.mjs` unverändert |
| Keine Cross-Repo-Änderung | ✅ | Nur `mays-jobsearch` Files |

---

## 16. Quality Gates — **All Passed**

```bash
# Tests
npm test -- tests/api/
# → 22 test files passed, 291 tests passed

# TypeScript + Build
npm run build
# → tsc -b && vite build → SUCCESS

# Git checks
git diff --check
# → no output (clean)

git status
# → clean working tree
```

---

## 17. Final DoD Matrix

| Bereich | Design | Implementation | Conformance |
|---------|--------|----------------|-------------|
| Registry | GREEN | GREEN | **GREEN** |
| Greenhouse | GREEN | GREEN | **GREEN** |
| Lever | GREEN | GREEN | **GREEN** |
| Ashby | GREEN | GREEN | **GREEN** |
| Workable | GREEN | GREEN | **GREEN** |
| Recruitee | GREEN | GREEN | **GREEN** |
| Personio | GREEN | GREEN | **GREEN** |
| Config | GREEN | GREEN | **GREEN** |
| Factory | GREEN | GREEN | **GREEN** |
| Normalization | GREEN | GREEN | **GREEN** |
| Error isolation | GREEN | GREEN | **GREEN** |
| Deduplication | GREEN | GREEN | **GREEN** |

---

## 18. Files Changed (nur dieser Task)

| File | Change |
|------|--------|
| `docs/reports/PUBLIC-ATS-SOURCES-03-EXECUTION_LOG.md` | **Updated** — Final reconciliation report |

**Keine Code-Änderungen** — nur Dokumentation der Reconciliation.

---

## 19. Final Classification

**PUBLIC-ATS-SOURCES-03 = GREEN**

- Design: GREEN (03-Report war vollständig)
- Implementation Conformance: GREEN (alle 6 Provider entsprechen Contract)
- Provider Count: 6
- Registry Integration: GREEN
- Parallel Execution: GREEN
- Deduplication: GREEN
- Search Profile: unchanged
- ATS Profile: unchanged
- ATS Analysis: unchanged
- AI Flow: unchanged
- Tests: 291 API tests PASS
- Build: SUCCESS
- TypeScript: clean
- Commit: Ready
- Working Tree: CLEAN

---

## 20. Next Step

**Nicht** automatisch PUBLIC-ATS-SOURCES-04 starten.

Empfohlene nächste isolierte Tasks (falls gewünscht):
- `PUBLIC-ATS-SOURCES-04` — Caching Layer für ATS Sources (L1/L2 wie Apify)
- `PUBLIC-ATS-SOURCES-05` — Pagination Support für Lever/Ashby/Workable/Recruitee
- `PUBLIC-ATS-SOURCES-06` — EU Endpoint Support (Lever `api.eu.lever.co`)
- `PUBLIC-ATS-SOURCES-07` — Health/Monitoring für öffentliche ATS Endpoints

Jeder Task isoliert, kein Scope Creep.