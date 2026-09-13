# STEP 36A — ATS Match & CV Tailoring Analysis

## Findings

### Existing Job Data Models

**Job (api/_lib/sources/arbeitnow.mjs:56-76)**
- `slug`: string - unique identifier
- `title`: string - job title
- `company_name`: string 
- `location`: string[] - array of locations
- `remote`: boolean
- `tags`: string[] - skills/keywords from job board
- `url`: string - job posting URL
- `created_at`: number | string - timestamp
- `source`: string[] - source identifiers ("arbeitnow" | "arbeitsagentur")
- `description`: string - raw HTML description
- `descriptionPlain`: string - HTML entities decoded + tags stripped
- `language?`: string - detected language (en/de)
- `jobTypes?`: string[] - employment types
- `contractType?`: string - contract type for Arbeitsagentur jobs

**Profile (src/types.ts:40-47)**
- `skills`: string - comma-separated skills
- `targetRole`: string - desired job role
- `city`: string - location preference
- `radiusKm`: number | null - search radius
- `workModes`: WorkMode[] - remote|hybrid|onsite
- `employmentTypes`: EmploymentType[] - full_time|part_time

**Match (src/types.ts:56-61)**
- `score`: number (0-100)
- `why`: string - explanation
- `prepare`: string - interview prep question
- `job`: Job | null

**SuggestedProfile (src/types.ts:49-54)**
- `skills`: string[] - extracted from CV
- `experienceLevel`: string - Junior|Mid|Senior
- `targetRoles`: string[] - extracted from CV
- `location`: string - city from CV

### Existing CV Parsing

**Profile Extraction (api/profile.mjs)**
- Uses AI via `/api/profile` endpoint
- Input: CV text (PDF extracted)
- Output: `{skills, experienceLevel, targetRoles, location}`
- Caching: L1 localStorage (`mj-cv-profile:<hash>`, 30 days), L2 Redis (`cv-profile:<hash>`, 30 days)
- Cache key: SHA-256 hash of normalized text

### Existing Matching & Analysis

**Match Pipeline (api/match.mjs)**
- Preselection: keywordHits heuristic, max 10 candidates
- AI evaluation: score 0-100 with `why` and `prepare`
- Prompt engineered for skills, role, location matching

**Keyword Matching (api/_lib/filter.mjs:117-124)**
```javascript
export function keywordHits(job, keywordTokens) {
  const title = job.title || "";
  const tags = job.tags || [];
  const description = job.description || "";
  const haystack = `${title} ${tags} ${description}`;
  return keywordTokens.filter(kw => haystack.includes(kw)).length;
}
```

**Location Matching (api/_lib/filter.mjs:107-115)**
```javascript
export function locationMatches(job, cityQueries) {
  const locs = job.location || [];
  return locs.some(l => cityQueries.some(cq => l.includes(cq) || cq.includes(l)));
}
```

---

## Proposed Data Contract for ATS Analysis

### ATSAnalysisResult

**Location**: `api/_lib/atsAnalysis.mjs`

```typescript
interface ATSAnalysisItem {
  type: "MATCHED" | "PARTIAL" | "GAP" | "UNKNOWN";
  category: "keyword" | "skill" | "requirement" | "experience" | "education" | "certification" | "location" | "workmode" | "employment";
  field: string; // e.g., "react", "5 years", "Bachelor", "AWS", "remote"
  found: boolean;
  confidence: number; // 0-100 for PARTIAL
  evidence?: string; // actual text where match was found
  recommendation: string; // action needed for GAP
}

interface ATSAnalysisResult {
  job: {
    slug: string;
    title: string;
    company: string;
  };
  profile: {
    skills: string[];
    targetRole: string;
    city: string;
  };
  items: ATSAnalysisItem[];
  scores: {
    keywordMatch: number;    // % of keywords matched
    skillMatch: number;      // % of required skills matched
    locationMatch: number;   // 0=0, 100=full, PARTIAL between
    workmodeMatch: number;   // same scale
    employmentMatch: number; // same scale
    overall: number;         // weighted composite
  };
  summary: {
    matched: number;
    partial: number;
    gap: number;
    unknown: number;
  };
  recommendations: string[]; // actionable list for CV tailoring
}
```

### Category Definitions

| Category | MATCHED | PARTIAL | GAP | UNKNOWN |
|----------|---------|---------|-----|---------|
| **keyword** | Skill/keyword appears verbatim in job.title, tags, or description | Appears implicitly (synonym, acronym) but no direct match | Not found anywhere in job data | Truly unknown (no data from CV or job) |
| **skill** | Required skill from job.tags exists in profile.skills | Skill partially covered (e.g., "React" in CV but muxes needed) | Required skill not in profile | Job requirement not parsed/scanable |
| **requirement** | Explicit requirement met (e.g., "5+ years" with CV experience) | Experience level allows but not explicit | Requirement not met | Cannot determine |
| **experience** | Years/level matches or exceeds | Some overlap | Insufficient experience | Cannot calculate |
| **education** | Degree/cert matches field requirements | Degree from related field | Education gap | Not specified in job or CV |
| **certification** | Valid certificate present | Partial validity | Missing certificate | Not applicable |
| **location** | City matches exactly | Area code matches | Location conflict | Invalid location |
| **workmode** | Remote preference satisfied | Hybrid acceptable | Workmode mismatch | Invalid workmode |
| **employment** | Full-time matches, or Part-time matches | Type compatible | Employment type mismatch | Invalid type |

### Key Principle: "Not Found" ≠ "Not Present"

The analysis must distinguish:
- `found: false` with evidence → value exists but doesn't match
- `found: undefined` with recommendation → cannot be determined from available data
- `found: null` → truly unknown (insufficient parsing)

---

## Reuse Analysis

### Directly Reusable Components

1. **Tokenize (filter.mjs:9-16)**
   - Can reuse for CV text tokenization
   - Already used in keywordHits

2. **HTML to Plain Text (filter.mjs:48-54)**
   - Used for `descriptionPlain` already
   - Can apply to CV text for normalization

3. **Keyword Hits Function (filter.mjs:117-124)**
   - Core logic for skills/keywords matching
   - Already works with job.tags, title, description

4. **Location Matching (filter.mjs:107-115)**
   - Already handles city-based location matching
   - Can extend for broader location analysis

5. **Language Detection (filter.mjs:81-100)**
   - Useful for cross-language CV/job matching

6. **Profile Cache Pattern (profile.mjs:8-14, 99-104)**
   - Hashing + caching pattern reusable for ATS analysis results

### Reusable Endpoints

1. **`/api/profile`** - CV extraction endpoint
   - Already provides structured profile from CV
   - Can extend SuggestedProfile with education, certificates, experience

2. **`/api/match`** - Job scoring endpoint
   - Already has matching logic
   - Could be extended to return detailed ATS analysis

### Existing Patterns to Follow

1. **Cache Strategy**: Follow established L1 (localStorage) + L2 (Redis) pattern
   - Key: `ats-analysis:<job-slug>:<profile-hash>`

2. **AI Prompt Pattern**: Build prompts for structured JSON output
   - Follow profile.mjs prompt style for extraction
   - Use match.mjs prompt style for evaluation

3. **Error Handling**: Use HttpError pattern in backend
   - Reuse error codes from api/_lib/providers/errors.mjs

---

## Separation: ATS Analysis vs CV Tailoring

### Current Flow (CV → Profile → Match → Cover Letter)

```
CV Upload → /api/profile (extract) → Profile → /api/jobs (search) → Jobs → /api/match (score) → Matches → /api/cover-letter (generate)
```

### Proposed ATS Analysis Flow

```
CV Upload → /api/profile (extract) → Profile → /api/ats-analyze → Detailed Analysis → UI Display → CV Tailoring
                                                        │
                                                        ↓
                                                Recommendations
                                                
CV Tailoring → User edits profile → (re-run ATS) → Refined Profile
```

### Clean Separation Points

1. **ATS Analysis Endpoint** (`POST /api/ats-analyze`)
   - Input: `profile` + `job slug`
   - Output: `ATSAnalysisResult`
   - Independent of cover letter generation

2. **CV Refinement** (exists as `POST /api/profile` with edit mode)
   - User edits suggested profile
   - Re-runs ATS analysis

3. **Tailoring Recommendations** (new component)
   - Lists gaps with specific actions
   - Shows which CV sections to expand

---

## Recommendations

### 1. Location: `api/_lib/atsAnalysis.mjs`

New backend module for ATS analysis logic:

```javascript
// Key functions:
export function analyzeKeywordMatch(job, profile) { ... }
export function analyzeSkillMatch(job, profile) { ... }
export function analyzeLocationMatch(job, profile) { ... }
export function analyzeWorkmodeMatch(job, profile) { ... }
export function analyzeEmploymentMatch(job, profile) { ... }
export async function performATSAnalysis(job, profile, model) { ... }
```

### 2. Endpoint: `api/ats-analyze.mjs`

POST `/api/ats-analyze`:
- Input: `{ job, profile, model? }`
- Output: `ATSAnalysisResult`
- Cacheable by job-slug + profile-hash

### 3. Frontend: ATS Results Component

New component to display analysis:
- Filter by MATCHED/PARTIAL/GAP/UNKNOWN
- Show confidence scores
- Provide actionable recommendations

### 4. Extend SuggestedProfile

Optional fields in `src/types.ts`:
```typescript
interface ExtendedSuggestedProfile extends SuggestedProfile {
  experienceYears?: number;
  education?: string;
  certifications?: string[];
  achievements?: string[];
}
```

---

## Evidence/Begründung für Anforderungen

### Keyword Match

**MATCHED**: Job tags contains "React" and profile.skills = "React, TypeScript"
- Evidence: search in `job.tags.includes("react")` and case-insensitive match

**PARTIAL**: Job expects "React.js" but profile has "React"
- Evidence: Levenshtein similarity or substring match > 0.8

**GAP**: Job requires "Vue.js" but profile has no Vue
- Evidence: keyword not found in any job source

**UNKNOWN**: Cannot determine if user knows Vue (no data)
- Evidence: profile.skills is empty/undefined

### Requirements

**MATCHED**: Job requires "5+ years experience", CV shows "5 years at Acme"
- Evidence: regex extract years from CV experience section

**PARTIAL**: Job requires "5+ years", CV shows "3 years"
- Evidence: partial years match, confidence = 60%

**GAP**: Job requires "AWS certification", CV has no certs
- Evidence: certification field empty or null

**UNKNOWN**: Job requirement not parsable
- Evidence: requirement not found in structured job data

---

## OPEN QUESTIONS

1. **Education Extraction**: Currently CV parsing only extracts `skills`, `experienceLevel`, `targetRoles`, `location`. Should we add `education` and `certifications` extraction?

2. **Experience Parsing**: How granular should experience matching be? Simple years count, or detailed role/duration analysis?

3. **Real-time vs Cached**: Should ATS analysis be computed on-demand or cached longer (like profile cache)?

4. **Multiple Jobs**: Should analysis be per-job or batch analysis for all matches?

5. **Localization**: Should recommendations be localized (DE/EN) based on job location?

---

## GIT STATE

```
Branch: main
HEAD: e8236b6 (tracking origin/main)
Status: Clean working tree (no changes)

 uncommitted files (untracked/debug):
  - Debug files: debug_decode.ts, debug_decode2.ts, etc.
  - Test files: tests/api/debug.test.js, test_*.mjs
  - Documentation: docs/AI_AUDITLOG.md, various *.md
```

---

## STOP

Analysis complete. No code changes made.
No files modified.

```status
STATUS = STEP 36A ANALYSIS COMPLETE - WAITING FOR NEXT STEPS
```

---