# PUBLIC-ATS-SOURCES-03 — EXECUTION LOG

## Current status
COMPLETED — Architecture investigation, contract design, factory design documented. Design-only task (no implementation).

## Audit date/time
2026-09-28

## Git state (Start)
- Branch: main
- HEAD: (current)
- Working tree: clean

## Git state (End)
- Branch: main
- Working tree: contains changes from previous task (ATS-JOB-SOURCES-01) + this design report
- Modified (Category B - previous task): `api/_lib/config.mjs`, `api/_lib/sources/index.mjs`
- Untracked (Category B - previous task): `api/_lib/sources/greenhouse.mjs`, `docs/ATS_JOB_SOURCES.md`, `tests/api/greenhouse-source.test.mjs`, `docs/reports/ATS-JOB-SOURCES-01-EXECUTION_LOG.md`, `docs/reports/ATS-DEEP-INVESTIGATION-01-EXECUTION_LOG.md`
- Untracked (Category A - this task): `docs/reports/PUBLIC-ATS-SOURCES-03-EXECUTION_LOG.md`

## Task / Purpose
Design the technical contract and factory structure for public ATS-based job sources (Greenhouse, Lever, Ashby, Workable, Recruitee, Personio) — WITHOUT implementing the six providers.

---

## 1. Ausgangsarchitektur (Existing Architecture)

### Source Registry (`api/_lib/sources/index.mjs`)
- `SOURCES` array: `[arbeitnow, greenhouse, ...APIFY_ACTORS.map(createApifySource)]`
- `enabledSources()` filters by `source.enabled()`
- `fetchAllJobs({ skills, targetRoles, targetRole, city, radiusKm, workMode, employmentType })` orchestrates:
  1. `enabledSources()` → parallel `source.fetchJobs({ skills, targetRoles, city: geoCity })`
  2. `Promise.allSettled` with error isolation (critical sources throw, others log + empty result)
  3. `dedupJobs()` via `jobKey(title|company|location)` + `source[]` merge
  4. `applySearchFilters(combined, { radiusKm, workMode, employmentType })`
  5. `applySearchStrategyWithTargetRole(skills, roles, filtered)`

### Existing Source Contract (implemented by all sources)
Each source module exports:
```javascript
{
  id: string,                    // unique source id (e.g., "arbeitnow", "greenhouse")
  displayName: string,           // human-readable name
  provider: string,              // "direct-api" | "apify" | "ats"
  critical?: boolean,            // if true, failures propagate as HttpError
  enabled: () => boolean,        // checks config + required secrets
  fetchJobs: (params) => Promise<{ jobs: Job[], meta: SourceMeta }>,
  // optional:
  actorId: string,               // for apify sources
  maxJobs: number,               // for apify sources
}
```

**`fetchJobs` Parameters:**
```javascript
{
  skills: string[],              // tokenized skills array
  targetRoles: string[],         // array of target role strings
  targetRole?: string,           // legacy single target role (backward compat)
  city: string                   // city query string (empty when no radius)
}
```

**Return Value:**
```javascript
{
  jobs: Job[],                   // normalized jobs (max ~40)
  meta: {
    enabled: boolean,
    reason: string | null,       // e.g., "no_boards_configured", "missing_config"
    totalScanned: number,        // raw jobs fetched from API
    totalFiltered: number,       // jobs after local filtering
    city?: string[],             // city queries used
    keywords?: string[]          // keyword tokens used
  }
}
```

### Job Normalization (existing)
All sources normalize to this shape (via `compactJob` / `normalize`):
```javascript
{
  slug: string,              // unique ID for deduplication
  title: string,
  company_name: string,
  location: string[],        // array of locations
  remote: boolean,
  tags: string[],            // skills/keywords
  url: string,               // canonical job URL
  created_at?: number,       // unix timestamp (seconds)
  source: string[],          // array of source ids
  description?: string,      // HTML
  descriptionPlain?: string, // plain text
  language?: "de" | "en",
  jobTypes?: string[],       // employment types
  contractType?: string,
  salary?: string,
  startDate?: string,
  // ATS-specific (Greenhouse):
  applyUrl?: string,
  jobUrl?: string,
  workplaceType?: string,
  department?: string,
  externalId?: string
}
```

### Deduplication (`dedupJobs` in `index.mjs`)
- Key: `title|company|location` (lowercase, trimmed, location joined by comma)
- Merge: combine `source[]` arrays when key matches
- Order: first occurrence wins position, sources appended

### Search Strategy Integration
- `applySearchStrategyWithTargetRole(skills, roles, jobs, source)` — K-of-N threshold matching
- Skills + TargetRoles → keyword tokens → progressive threshold
- TargetRoles act as hard OR-filter before skill matching
- No provider-specific search logic in sources — all local filtering

### Capabilities / Metadata
- `sourceDetails()` returns: `id`, `displayName`, `provider`, `enabled`, `actorId` (optional)
- `analyzeSourceCapabilities(source)` in `searchStrategy.mjs` returns:
  - `supportsAND`, `supportsOR`, `supportsGroupedBoolean`, `supportsRepeatedQuery`
  - `maxQueryLength`, `requiresLocation`, `name`

---

## 2. Bestehender Source Contract (Documented)

The existing contract is **already fully implemented** and used by:
- `arbeitnow` (provider: "direct-api", critical: true)
- `greenhouse` (provider: "ats")
- `arbeitsagentur` via Apify (provider: "apify", via `createApifySource` factory)

**No new fields needed** — the factory design must produce objects compatible with this exact contract.

---

## 3. Ziel-Contract für Public Job Sources

### PublicJobSourceConfig (Provider-neutral configuration)
```typescript
interface PublicJobSourceConfig {
  provider: "greenhouse" | "lever" | "ashby" | "workable" | "recruitee" | "personio";
  identifier: string;           // provider-specific: board_token, site, job_board_name, etc.
  enabled?: boolean;            // default: true
  label?: string;               // optional human-readable label for UI
  options?: Record<string, unknown>; // provider-specific overrides (e.g., EU endpoint, language)
}
```

### PublicJobSource (Runtime instance — matches existing Source Contract)
```typescript
interface PublicJobSource {
  id: string;                    // stable: "greenhouse:company-a"
  displayName: string;           // e.g., "Greenhouse (company-a)"
  provider: "ats";               // all public ATS sources use "ats"
  enabled: () => boolean;
  fetchJobs: (params: FetchJobsParams) => Promise<FetchJobsResult>;
  // Factory-injected, not in config:
  identifier: string;            // the provider-specific identifier
  capabilities: SourceCapabilities; // declared capabilities
}
```

### Factory Function Signature
```typescript
function createPublicJobSource(config: PublicJobSourceConfig): PublicJobSource
```

**Factory Responsibilities:**
1. Validate `provider` is known (throw on unknown)
2. Validate `identifier` is present (throw on missing)
3. Select provider-specific adapter module
4. Bind `identifier` via closure (not passed at fetch time)
5. Return object compatible with existing Source Registry contract
6. Generate stable `id` = `${provider}:${identifier}`

---

## 4. Factory Design

### Provider Adapter Map (Static, No Dynamic Imports)
```javascript
// api/_lib/sources/public-ats/factory.mjs
import { createGreenhouseSource } from "./adapters/greenhouse.mjs";
import { createLeverSource } from "./adapters/lever.mjs";
// ... etc.

const ADAPTERS = {
  greenhouse: createGreenhouseSource,
  lever: createLeverSource,
  ashby: createAshbySource,
  workable: createWorkableSource,
  recruitee: createRecruiteeSource,
  personio: createPersonioSource,
};
```

### Factory Implementation
```javascript
export function createPublicJobSource(config) {
  const { provider, identifier, enabled = true, label, options = {} } = config;

  if (!provider || !ADAPTERS[provider]) {
    throw new Error(`Unknown public ATS provider: ${provider}`);
  }
  if (!identifier || typeof identifier !== "string" || !identifier.trim()) {
    throw new Error(`Missing identifier for provider ${provider}`);
  }

  const adapter = ADAPTERS[provider];
  const source = adapter({ identifier, enabled, label, options });

  // Ensure stable composite ID
  source.id = `${provider}:${identifier}`;
  source.provider = "ats";

  return source;
}
```

### Registry Integration
```javascript
// In api/_lib/sources/index.mjs
import { createPublicJobSource } from "./public-ats/factory.mjs";
import { getPublicAtsSourcesConfig } from "../config.mjs"; // new config function

const publicAtsConfigs = getPublicAtsSourcesConfig(); // PublicJobSourceConfig[]
const publicAtsSources = publicAtsConfigs.map(createPublicJobSource);

export const SOURCES = [arbeitnow, greenhouse, ...publicAtsSources, ...APIFY_ACTORS.map(createApifySource)];
```

---

## 5. Provider Identifier Semantics

| Provider | Config Field | Identifier Name | Example | Public Endpoint Pattern |
|----------|--------------|-----------------|---------|-------------------------|
| Greenhouse | `identifier` | `board_token` | `stripe` | `boards-api.greenhouse.io/v1/boards/{board_token}/jobs` |
| Lever | `identifier` | `site` | `netflix` | `api.lever.co/v0/postings/{site}` |
| Ashby | `identifier` | `job_board_name` | `notion` | `api.ashbyhq.com/posting-api/job-board/{job_board_name}` |
| Workable | `identifier` | `account_subdomain` | `acme` | `apply.workable.com/api/v3/accounts/{account_subdomain}/jobs` |
| Recruitee | `identifier` | `company_subdomain` | `mycompany` | `{company_subdomain}.recruitee.com/api/v2/jobs` |
| Personio | `identifier` | `career_site` | `personio` | `{career_site}.jobs.personio.de/xml` |

**Key Principle:** `identifier` is provider-neutral in config; each adapter interprets it correctly. No artificial UUID or common `boardId`.

---

## 6. Multiple Instances of Same Provider

### Config Example
```javascript
[
  { provider: "greenhouse", identifier: "company-a", enabled: true },
  { provider: "greenhouse", identifier: "company-b", enabled: true, label: "Greenhouse B" },
  { provider: "lever", identifier: "company-c", enabled: true },
]
```

### Resulting Source IDs (Stable, Deterministic)
```
greenhouse:company-a
greenhouse:company-b
lever:company-c
```

### Deduplication Implications
- `jobKey()` uses `title|company|location` → cross-source dedup works naturally
- `source[]` array will contain both `greenhouse:company-a` and `greenhouse:company-b` if same job appears on both boards
- `sourceDetails()` in registry will show each instance separately
- No changes needed to existing deduplication logic

---

## 7. Normalization Boundary

### Provider Adapter Responsibility
Each adapter's `normalize` function must map provider response → **existing normalized Job shape** (no new fields).

### Required Normalized Fields (from existing sources)
```javascript
{
  slug: string,              // must be unique per source instance (use externalId pattern)
  title: string,
  company_name: string,
  location: string[],
  remote: boolean,
  tags: string[],
  url: string,
  created_at?: number,
  source: string[],          // [source.id, "ats"]
  description?: string,
  descriptionPlain?: string,
  language?: "de" | "en",
  jobTypes?: string[],
  // ATS-specific (optional, only if provider supplies):
  applyUrl?: string,
  jobUrl?: string,
  workplaceType?: "remote" | "hybrid" | "onsite" | "unspecified",
  department?: string,
  salary?: string,
  externalId?: string        // provider-specific stable ID (e.g., "gh-123", "lv-abc")
}
```

### Utilities Available (in `filter.mjs`)
- `stripHtml()`, `htmlToPlainText()` — HTML → plain text
- `detectLanguage()` — "de" | "en" | undefined
- `tokenize()` — skill/keyword tokenization
- `locationMatches()`, `keywordHits()` — used by registry for local filtering

**Adapters must NOT implement their own search/filter logic** — registry handles all local filtering.

---

## 8. Capability Model

### SourceCapabilities (for Search Strategy awareness)
```typescript
interface SourceCapabilities {
  description: boolean;           // provides description/descriptionPlain
  remote: boolean;                // provides remote boolean
  locations: boolean;             // provides location array
  employmentType: boolean;        // provides jobTypes
  publishedAt: boolean;           // provides created_at/updatedAt
  workplaceType: boolean;         // provides workplaceType enum
  salary: boolean;                // provides salary/compensation
  departments: boolean;           // provides department
  tags: boolean;                  // provides tags/skills
  applyUrl: boolean;              // provides applyUrl separate from url
  pagination: boolean;            // supports pagination (for future)
  nativeFiltering: string[];      // e.g., ["location", "department"] — for info only
}
```

### Usage
- Declared by each adapter at creation time
- Used by `analyzeSourceCapabilities()` in `searchStrategy.mjs` if needed
- Does NOT change search pipeline — only informs strategy if source supports server-side filtering (currently none do)

### Provider Capability Matrix (Expected)

| Capability | Greenhouse | Lever | Ashby | Workable | Recruitee | Personio |
|------------|:----------:|:-----:|:-----:|:--------:|:---------:|:--------:|
| description | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| remote | ✅ (inferred) | ✅ | ✅ | ✅ | ✅ | ❌ |
| locations | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| employmentType | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| publishedAt | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| workplaceType | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| salary | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| departments | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| tags | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| applyUrl | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| pagination | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| nativeFiltering | [] | [loc,commit,team,dept,lvl] | [] | [] | [] | [] |

**Note:** Capabilities are declared, not enforced. Registry filtering remains local.

---

## 9. Suchparameter (Search Parameters)

### Parameters Passed to `fetchJobs()`
```javascript
{
  skills: string[],      // from user input / CV extraction
  targetRoles: string[], // from user input / CV extraction
  targetRole?: string,   // legacy
  city: string           // empty string when radiusKm not set (geoCity logic)
}
```

### Provider Adapter Behavior
- **NO** provider-specific search logic
- **NO** K-of-N, threshold, targetRole logic in adapters
- **NO** city/radius logic in adapters
- Adapter fetches **full public feed** (or paginated if supported)
- Registry applies: `locationMatches()`, `keywordHits()`, `applySearchFilters()`, `applySearchStrategyWithTargetRole()`

---

## 10. Fehlerverhalten (Error Handling)

### Configuration Errors (Factory)
- Unknown provider → `Error("Unknown public ATS provider: X")` — thrown at startup
- Missing identifier → `Error("Missing identifier for provider X")` — thrown at startup

### Runtime Errors (Adapter `fetchJobs`)
Adapters follow existing pattern (see `arbeitnow.mjs`, `greenhouse.mjs`):

| Error | Behavior |
|-------|----------|
| HTTP 404 (board not found) | Log + return `emptyResult("not_found")` |
| HTTP 429 (rate limited) | Log + return `emptyResult("rate_limited")` |
| HTTP 5xx / network | Log + return `emptyResult("upstream")` |
| Timeout | Log + return `emptyResult("timeout")` |
| Invalid JSON | Log + return `emptyResult("invalid_response")` |
| Empty feed | Return `emptyResult("no_jobs")` with `enabled: true` |

### Registry Integration (Existing)
- `Promise.allSettled` — failures isolated per source
- `source.critical` — if true, throws; if false, logs + continues with empty result
- `countJobSourceRequest(source.id)` called on success
- `meta.reason` propagated to API response

**No new error handling architecture** — reuse existing `HttpError`, `emptyResult`, `Promise.allSettled` pattern.

---

## 11. Configuration

### Server-Side JSON Config (Environment Variable)
```bash
# PUBLIC_ATS_SOURCES='[{"provider":"greenhouse","identifier":"stripe","enabled":true},{"provider":"lever","identifier":"netflix","enabled":true}]'
PUBLIC_ATS_SOURCES='[]'  # default empty
```

### Config Parser (`api/_lib/config.mjs`)
```javascript
function parsePublicAtsSources(value) {
  if (!value || value === "[]") return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) throw new Error("Not an array");
    return parsed.map((item, i) => {
      if (!item.provider || !item.identifier) {
        throw new Error(`Invalid config at index ${i}: provider and identifier required`);
      }
      return {
        provider: String(item.provider).trim(),
        identifier: String(item.identifier).trim(),
        enabled: item.enabled !== false,
        label: item.label ? String(item.label).trim() : undefined,
        options: item.options && typeof item.options === "object" ? item.options : {},
      };
    });
  } catch (e) {
    console.error("[config] Invalid PUBLIC_ATS_SOURCES:", e.message);
    return [];
  }
}

export function getConfig() {
  return {
    // ... existing ...
    publicAtsSources: parsePublicAtsSources(process.env.PUBLIC_ATS_SOURCES || "[]"),
  };
}
```

### Security
- **No `VITE_` prefix** — server-side only
- **No secrets** — identifiers are public board tokens, not credentials
- **No database / admin UI / API gateway** — simple JSON env var
- **Client never sees config** — only job data flows to frontend

---

## 12. Deduplication Implications

### Existing `jobKey()` handles cross-source dedup
- Key: `title|company|location` (normalized)
- Multiple ATS instances with same job → `source[]` merged

### ATS-internal dedup (within one provider's multi-tenant fetch)
- Adapter should use `externalId` (provider-specific stable ID) for dedup across boards
- Example: Greenhouse `gh-${job.id}`, Lever `lv-${job.id}`
- Registry `jobKey()` is fallback for cross-provider dedup

### Source ID Stability
- `id = `${provider}:${identifier}`` — deterministic, stable across restarts
- Used in: `source[]` array, cache keys, `sourceDetails()`, `disabledSources()`

---

## 13. Future Development Point: ATS Profile Source Knowledge

**NOT IMPLEMENTED — DOCUMENTED ONLY**

```typescript
// Future: ATS Profile could declare source knowledge
interface AtsProfile {
  // ... existing fields
  sourceKnowledge?: {
    knownProviders: string[];        // e.g., ["greenhouse", "lever"]
    coverage?: Record<string, number>; // estimated job coverage per provider
    preferences?: string[];          // preferred sources for this ATS type
  };
}
```

**Use Case:** ATS Analysis could weight matches differently based on known source reliability, or UI could show "This ATS profile knows about Greenhouse jobs".

**No changes to:** ATS Profile, ATS Analysis, CV Profile, Search Profile in this task.

---

## 14. Nicht Bestandteil dieses Tasks (Out of Scope)

- ❌ Greenhouse/Lever/Ashby/Workable/Recruitee/Personio adapter implementations
- ❌ `/api/v1` migration or API contract changes
- ❌ Cross-repo changes (mays-recruiting-intelligence, mobile app, etc.)
- ❌ ATS Profile / ATS Analysis modifications
- ❌ Database, Admin UI, API Gateway
- ❌ Client-side config (`VITE_*`)
- ❌ Secrets in config (identifiers are public)
- ❌ New parallel source architecture

---

## 15. Offene Punkte (Open Questions)

1. **Personio XML parsing** — needs XML parser (e.g., `fast-xml-parser`) as new dependency. Defer to implementation task.
2. **Workable/Recruitee description** — public feeds lack description; may need detail endpoint calls. Design decision needed in implementation task.
3. **Rate limit handling** — no official docs for public endpoints; current defensive pattern (return empty) is safe.
4. **EU instances** — Lever has `api.eu.lever.co`; could be added via `options.endpoint` in config.
5. **Cache strategy** — ATS sources currently no cache; could add L1 cache like Apify (10 min) in future.

---

## 16. Nächster Sinnvoller Implementierungsschritt

**PUBLIC-ATS-SOURCES-04 — Reference Adapter: Greenhouse**

1. Create `api/_lib/sources/public-ats/factory.mjs` with factory + adapter map
2. Create `api/_lib/sources/public-ats/adapters/greenhouse.mjs` (move/refactor existing `greenhouse.mjs`)
3. Add `publicAtsSources` config to `config.mjs`
4. Register factory outputs in `sources/index.mjs`
5. Add `PUBLIC_ATS_SOURCES` to `.env.example`
6. Tests: factory selection, config validation, registry compatibility
7. Verify: `npm test`, `npm run build`, `git diff --check`

---

## 17. AI_AUDITLOG.md Prüfung

**Template Analysis (`docs/AI_AUDITLOG.md`):**
- Template defines execution log structure (status, date/time, git branch/HEAD, scope, findings, evidence, classification GREEN/YELLOW/ORANGE/RED/GRAY, git status, files changed, open questions, risks, next actions)
- Template does NOT contain actual audit entries — those go in individual report files under `docs/reports/`
- Template §44: "The execution log itself is part of the audit workflow and must be kept accurate even if the audit remains completely read-only."

**Classification for PUBLIC-ATS-SOURCES-03:**
- This task is a **source-contract/factory design task** (read-only design, no implementation)
- Public ATS Sources only provide job data → deterministic normalization/filter/search
- No model call, AI provider, consent flow, anonymization flow, AI fallback, or AI data transfer introduced or changed
- **No AI data-flow change**

**AI_AUDITLOG.md Classification:**
```
AI_AUDITLOG classification: NO AI DATA-FLOW CHANGE

Reason:
PUBLIC-ATS-SOURCES-03 is a source-contract/factory design task.
Public ATS sources only provide job data.
No model call, AI provider, consent flow, anonymization flow,
AI fallback, or AI data transfer is introduced or changed.

AI_AUDITLOG.md template was reviewed.
No artificial audit entry was created because the template
does not require one for a no-AI-data-flow design task.
```

---

## 18. Tests (Contract/Factory Level Only)

### Factory Tests (Design Documented — Not Implemented)
- `greenhouse` → correct adapter selection
- `lever` → correct adapter selection
- `ashby` → correct adapter selection
- `unknown` → controlled configuration error

### Configuration Tests (Design Documented — Not Implemented)
- Valid config array → sources created
- Disabled config → `enabled()` returns false
- Missing provider → factory throws
- Missing identifier → factory throws
- Multiple instances same provider → distinct stable IDs

### ID Stability Tests (Design Documented — Not Implemented)
- `greenhouse:company-a` stable across calls
- `greenhouse:company-b` different from `company-a`
- Deterministic ordering

### Registry Compatibility Tests (Design Documented — Not Implemented)
- Factory output passes `enabledSources()` filter
- Factory output works with `fetchAllJobs()` params
- Factory output integrates with `dedupJobs()` and `sourceDetails()`

### Normalization Contract Tests (Design Documented — Not Implemented)
- Adapter returns all required normalized fields
- Missing optional fields = `undefined` (not invented)
- `externalId` provider-prefixed and stable

**No mock HTTP calls, no provider API simulation — pure contract tests.**

**Test Files in Repository:**
- `tests/api/greenhouse-source.test.mjs` — Category B (ATS-JOB-SOURCES-01 implementation tests for Greenhouse adapter)
- `tests/api/public-ats-factory.test.mjs` — **NOT CREATED** (belongs to PUBLIC-ATS-SOURCES-04 implementation task)

**Verification:** No factory implementation exists → no factory tests required for this design-only task.

---

## 19. Verification Commands (Executed)

```bash
# Tests
npm test
# → 46 test files passed, 552 tests passed

# TypeScript + Build
npm run build
# → tsc -b && vite build → SUCCESS

# Git checks
git diff --check
# → no output (clean)
```

---

## 20. Final DoD Matrix

| DoD Item | Status | Evidence |
|----------|--------|----------|
| Bestehende Source Architecture untersucht | GREEN | Report §1 — Source Registry, fetchAllJobs, dedupJobs, search integration documented with file refs |
| Bestehender JobSource-Contract dokumentiert | GREEN | Report §2 — Contract fields, fetchJobs params, return value, normalization shape, dedup, capabilities |
| `PublicJobSourceConfig` fachlich und technisch definiert | GREEN | Report §3 — TypeScript interface with provider, identifier, enabled, label, options |
| Factory-Vertrag definiert | GREEN | Report §4 — Function signature, responsibilities, static adapter map, implementation |
| Provider → Adapter-Auflösung definiert | GREEN | Report §4 — ADAPTERS map, factory selects by provider key |
| Mehrere Instanzen desselben Providers definiert | GREEN | Report §6 — Config example, resulting IDs, dedup implications |
| Stabile Source-ID definiert | GREEN | Report §6, §12 — `${provider}:${identifier}` pattern, deterministic, used in source[], cache, details |
| Provider-spezifische Identifier-Semantik dokumentiert | GREEN | Report §5 — Table mapping provider → identifier name, example, endpoint |
| Normalization Boundary definiert | GREEN | Report §7 — Required fields, utilities, no-search-logic rule |
| Capability Model definiert | GREEN | Report §8 — SourceCapabilities interface, usage, provider matrix |
| Fehler-/Konfigurationsverhalten definiert | GREEN | Report §10 — Config errors (throw), runtime errors (emptyResult), registry integration |
| Integration Boundary zur bestehenden Registry definiert | GREEN | Report §4 — Registry integration snippet, SOURCES array insertion |
| `PUBLIC_ATS_SOURCES` oder begründete Alternative entschieden | GREEN | Report §11 — JSON env var, parser, security notes |
| Deduplication-Auswirkungen dokumentiert | GREEN | Report §12 — Cross-source via jobKey, ATS-internal via externalId, ID stability |

### Negativ-DoD Verification (Code Check)

| Negativ-DoD Item | Status | Evidence |
|------------------|--------|----------|
| Kein echter Provider-Adapter für Greenhouse/Lever/Ashby/Workable/Recruitee/Personio | GREEN | `glob api/_lib/sources/public-ats/**/*` → no files; `api/_lib/sources/greenhouse.mjs` is Category B (previous task) |
| Keine echten Provider-HTTP-Calls | GREEN | No adapter implementations exist; no fetch calls to provider endpoints in new code |
| Keine Provider-spezifische Search-Logik | GREEN | Report §9 explicitly forbids; registry handles all filtering |
| Keine ATS-Profile geändert | GREEN | No changes to `api/_lib/ats.mjs` or ATS Profile types; Report §13 documents future point only |
| Keine ATS-Analysis geändert | GREEN | No changes to ATS Analysis modules; Report §14 out-of-scope |
| Keine `/api/v1` Migration | GREEN | No API version changes; `api/jobs.mjs` unchanged |
| Keine Cross-Repo-Änderung | GREEN | Only files in `mays-jobsearch` repo touched |

### Quality Gates

| Check | Status | Evidence |
|-------|--------|----------|
| Tests grün | GREEN | `npm test` → 552/552 passed |
| TypeScript/Build grün | GREEN | `npm run build` → SUCCESS |
| `git diff --check` clean | GREEN | No output |
| Contract-/Factory-Tests für Design vorhanden | N/A | Design-only task — tests belong to implementation task (04) |
| Report erstellt | GREEN | This file |
| AI_AUDITLOG.md geprüft | GREEN | §17 documents classification |
| Commit auf main | BLOCKED | Working tree contains Category B changes from previous task; 03-only changes = report only |
| Working Tree clean | BLOCKED | Category B uncommitted changes present |

---

## 21. Classification

**PUBLIC-ATS-SOURCES-03 = YELLOW**

**Reason:** Design DoD fully satisfied (all design items GREEN). However, commit/working-tree boundary cannot be cleanly established because previous task (ATS-JOB-SOURCES-01) left uncommitted implementation changes (`api/_lib/config.mjs`, `api/_lib/sources/index.mjs`, `greenhouse.mjs`, tests, docs). Per DoD rule: "Wenn der vorherige Task bereits uncommitted Änderungen hinterlassen hat, darfst du diese nicht einfach in den 03-Commit aufnehmen."

**Blocker:** Previous task (ATS-JOB-SOURCES-01) implementation changes uncommitted. PUBLIC-ATS-SOURCES-03 only produced the design report (`docs/reports/PUBLIC-ATS-SOURCES-03-EXECUTION_LOG.md`).

**Recommendation:** 
1. Complete ATS-JOB-SOURCES-01 commit/push separately
2. Then commit PUBLIC-ATS-SOURCES-03 report alone
3. Then proceed to PUBLIC-ATS-SOURCES-04

---

## 22. Files Summary

### Category A — PUBLIC-ATS-SOURCES-03 (Design Task Only)
- `docs/reports/PUBLIC-ATS-SOURCES-03-EXECUTION_LOG.md` — This design report

### Category B — ATS-JOB-SOURCES-01 (Previous Implementation Task)
- `api/_lib/config.mjs` — Greenhouse config added
- `api/_lib/sources/index.mjs` — Greenhouse registered in SOURCES
- `api/_lib/sources/greenhouse.mjs` — Greenhouse adapter implementation
- `docs/ATS_JOB_SOURCES.md` — ATS sources documentation
- `tests/api/greenhouse-source.test.mjs` — Greenhouse adapter tests (36 tests)
- `docs/reports/ATS-JOB-SOURCES-01-EXECUTION_LOG.md` — Implementation execution log
- `docs/reports/ATS-DEEP-INVESTIGATION-01-EXECUTION_LOG.md` — Investigation log

### Category C — Unknown
- None

---

## 23. Final Actions Required

1. **Complete ATS-JOB-SOURCES-01 commit:**
   ```bash
   git add api/_lib/config.mjs api/_lib/sources/index.mjs api/_lib/sources/greenhouse.mjs docs/ATS_JOB_SOURCES.md tests/api/greenhouse-source.test.mjs docs/reports/ATS-JOB-SOURCES-01-EXECUTION_LOG.md docs/reports/ATS-DEEP-INVESTIGATION-01-EXECUTION_LOG.md
   git commit -m "feat: ATS-JOB-SOURCES-01 — Greenhouse reference adapter + docs"
   git push
   ```

2. **Commit PUBLIC-ATS-SOURCES-03:**
   ```bash
   git add docs/reports/PUBLIC-ATS-SOURCES-03-EXECUTION_LOG.md
   git commit -m "docs: PUBLIC-ATS-SOURCES-03 — Public ATS source contract & factory design"
   git push
   ```

3. **Verify Working Tree Clean** → then proceed to PUBLIC-ATS-SOURCES-04

---