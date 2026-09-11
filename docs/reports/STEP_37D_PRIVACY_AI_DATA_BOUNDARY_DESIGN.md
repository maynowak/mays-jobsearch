# STEP 37D-PRIVACY: AI DATA BOUNDARY & ANONYMIZATION DESIGN

## PLAN

Define a clear data boundary for AI CV formulation layer (STEP 37D) before production deployment.

This is a **DESIGN/AUDIT ONLY** step - no code changes, no API changes, no deployments.

---

## ACTION

1. Audit existing AI data flows in the codebase
2. Classify data by type and sensitivity
3. Design data minimization strategy
4. Define anonymization approach
5. Document provider boundaries

---

## CURRENT DATA FLOW

### 37C: generateCVRecommendations()
**Location:** `api/_lib/ats.mjs:513-607`

**Input:**
- `analysisResult` object containing:
  - `requirements` array - job requirements extracted from job postings
  - `matches` array - matching evidence with status (MATCHED/PARTIAL/CONTRADICTION/UNKNOWN)
  - `criticalGaps` array - high-importance unmatched requirements
  - `recommendations` array (pass-through, if any)
- `cvSkills` array - candidate skills extracted from CV profile

**Output:**
- Array of recommendation objects with:
  - `requirementId` - reference to job requirement ID
  - `changeType` - KEYWORD_REINFORCEMENT | EVIDENCE_CLARIFICATION | GAP_FLAG | UNKNOWN_REVIEW
  - `priority` - medium/high
  - `proposedChange` - string suggestion for CV improvement
  - `rationale` - explanation of why the change is needed
  - `relatedCVEvidence` - matched skill string OR null
  - `safetyStatus` - SAFE_EVIDENCE | CRITICAL_GAP | SAFE_REVIEW

**Data Characteristics:**
- NO personal identifiers (names, emails, phones, addresses)
- NO job company names in recommendations
- NO project names
- NO dates or years
- Contains job requirement text snippets from public job postings

---

### 37D: formulateCVText()
**Location:** `api/_lib/ats.mjs:673-770`

**Input:**
- `recommendation` object (from generateCVRecommendations)
- `cvSkills` array - candidate skills
- `aiOptions` object - optional {mock: boolean, temperature, model, ...}

**Prompt Template Location:** `api/_lib/ats.mjs:612-634`

**Prompt Contents:**
```
You are an ATS-optimized CV formulation assistant.

TASK: Improve CV text for better ATS matching.

RULES:
1. Candidate facts are authoritative.
2. Never invent facts.
3. Only rewrite provided evidence.
4. Never convert a missing requirement into a claimed skill.
5. Preserve uncertainty.
6. Preserve factual meaning.
7. Keep technical terminology ATS-readable.
8. Do not optimize by keyword stuffing.
9. Return structured output only.

INPUT:
- current text: {original}
- requirement: {requirement}
- change type: {change_type}

OUTPUT:
- proposed text: improved version that keeps factual truth
```

**Replaced Values:**
- `{original}` = `recommendation.relatedCVEvidence` (the matched skill string) or "N/A"
- `{requirement}` = `recommendation.requirementId` or "N/A"
- `{change_type}` = `recommendation.changeType` or "N/A"

**The AI never sees:**
- Full CV text
- Candidate name
- Email
- Phone
- Address
- Date of birth
- Photo
- Projects
- Companies

---

### Data Flow Summary

```
CV Text (browser)
    │
    ▼
ATS Analysis (local, deterministic)
    │
    ├─ Requirements from job postings (public data)
    ├─ Matched skills (strings like "react", "python")
    ├─ Gap detection (boolean flags)
    │
    ▼
Recommendation Object (minimal data)
    │
    ├─ requirementId (from job)
    ├─ changeType (enum)
    ├─ proposedChange (string)
    ├─ relatedCVEvidence (skill keyword or null)
    │
    ▼
AI Formulation (STEP 37D)
    │
    ├─ FORMULATION_PROMPT template
    └─ Replaces placeholders with minimal values
    │
    ▼
chat() → Provider (OpenRouter/EdenAI)
    │
    ├─ ONLY: requirement ID, matched keyword, change type
    │
    ▼
AI Response
    │
    ▼
Structured output back to caller
```

---

## DATA CLASSIFICATION

### A) DIRECTLY PERSONNALLY IDENTIFYING DATA

| Data Type | Example | Sent to AI? | Local Processing |
|-----------|---------|-------------|------------------|
| Name | "John Doe" | NO | NO |
| Email | "john@example.com" | NO | NO |
| Phone | "+49 123 456789" | NO | NO |
| Address | "Berlin, Germany" | NO | NO |
| Date of birth | "1990-01-15" | NO | NO |
| Photo | base64 image data | NO | NO |
| Portfolio URL | "github.com/username" | NO | NO |
| LinkedIn URL | "linkedin.com/in/username" | NO | NO |

**Status:** NOT processed by AI layer. Evidence field contains only skill keywords.

---

### B) APPLICATION/CV-RELATED DATA

| Data Type | Example | Source | Sent to AI? | Reasoning |
|-----------|---------|--------|-------------|-----------|
| Skills | ["React", "Node.js", "AWS"] | CV profile | PARTIAL | Only matched keywords in evidence |
| Experience Level | "Senior", "Junior" | CV profile | NO | Not included in formulation |
| Target Roles | "Frontend Developer" | CV profile | NO | Not used |
| Career History | "Company XYZ 2020-2023" | CV text | NO | Never extracted to recommendation |
| Project Names | "E-commerce Platform" | CV text | NO | Never extracted to recommendation |
| Company Names | "Acme Corp" | CV text | NO | Never extracted to recommendation |
| Dates | "2020-2023" | CV text | NO | Never extracted to recommendation |
| Certifications | "AWS Certified Developer" | CV text | NO | Only extracted as skill keywords |

**Status:** Only skill keywords are passed. All structured CV data remains local.

---

### C) JOB DATA

| Data Type | Example | Source | Sent to AI? | Notes |
|-----------|---------|--------|-------------|-------|
| Job Title | "Senior React Developer" | API | PARTIAL | Requirement text used, not full title |
| Company | "TechCorp GmbH" | API | NO | Only requirement keywords |
| Location | "Berlin, Remote" | API | NO | Only in scoring, not formulation |
| Tags | ["React", "Node.js"] | API | PARTIAL | Used as requirements |
| Description | Full text | API | NO | Only extracted requirements |

**Status:** Requirement text (from job) is passed. Company names and descriptions are anonymized.

---

### D) TECHNICAL METADATA

| Data Type | Example | Purpose | Logged? |
|-----------|---------|---------|---------|
| Session ID | "sess_abc123" | Tracking | Server-side only |
| Request ID | UUID | Debugging | Server-side only |
| Timestamp | ISO string | Monitoring | Server-side only |
| Provider | "openrouter" | Routing | Logged (no content) |
| Model | "gpt-4o-mini" | Selection | Logged (no content) |

**Status:** Technical metadata is logged for observability, but NO CV/text content is logged.

---

## DATA MINIMIZATION

### Current Approach (PASSIVE)

The existing architecture already implements data minimization:

1. **ATS Layer is Deterministic** - No AI calls needed for matching
2. **Recommendation Generation extracts only:**
   - Required skill keywords (from CV)
   - Requirement text (from job)
   - Status flags (MATCHED/PARTIAL/GAP/UNKNOWN)
3. **No personal data flows to AI:**
   - Names remain in browser/CV
   - Emails never processed
   - Companies never included
   - Projects never mentioned

### MAXIMAL MINIMIZATION EXAMPLE

**Job Requirement:**
> "3+ years AWS experience with Terraform infrastructure as code"

**CV Evidence:**
> "Designed and implemented AWS infrastructure using Terraform for 4 years at Acme Corp..."

**Current Flow:**
- `relatedCVEvidence`: "aws" (matched keyword only)
- `requirementText`: requirement object's `requirementId`

**Allowed change:**
```
EVIDENCE_CLARIFICATION
→ Only the keyword "aws" is referenced
→ AI can suggest emphasizing "AWS" in context
→ Cannot invent Terraform or years of experience
```

### MINIMAL REQUIRED INPUT

For `formulateCVText()`:

| Field | Required | Why | Can be removed? |
|-------|----------|-----|-----------------|
| changeType | YES | Determines AI behavior | No |
| proposedChange | NO | Human suggestion | Yes - can use evidence |
| relatedCVEvidence | YES | Evidence to highlight | Must be minimal keyword |

### NEVER-SEND INPUT

| Field | Reason |
|-------|--------|
| Full CV text | Not needed for micro-formulation |
| Candidate name | No personalization needed |
| Email | Personal data |
| Phone | Personal data |
| Company name | From CV/project |
| Project details | Not relevant to keyword highlighting |
| Dates/Years | Could infer age/career stage |

---

## ANONYMIZATION DESIGN

### Current State: Implicit Anonymization

The system achieves privacy through **passive anonymization** - data is never exposed to AI in non-anonymized form.

**ANONYMIZATION (Complete removal):**

Not needed for current flow. All personally identifying information is already excluded from AI requests.

**PSEUDONYMIZATION (Replace with identifier):**

Not used. No replacement identifiers are introduced.

**REDACTION (Remove sensitive parts):**

Currently applied implicitly:
- CV text never sent to AI
- Only extracted keywords sent

### FAIL-SAFE

If ANY of these conditions are true, DO NOT CALL AI:

1. `validateRecommendationSafety()` returns `safe: false`
   - GAP_FLAG recommendations
   - UNKNOWN_REVIEW recommendations
2. Evidence is empty/null

**Return on fail:**
```json
{
  "safetyStatus": "DO_NOT_GENERATE",
  "error": "Recommendation could not be safely formulated"
}
```

---

## PROVIDER BOUNDARY

### OpenRouter (VERIFIED)

**Privacy Policy:** https://openrouter.ai/privacy (Last Updated: August 31, 2026)

**Verified Findings from Privacy Policy:**

1. **Data Retention:**
   - Inputs are collected: "Any text or data you input into the Service ("Inputs") that include personal data will also be collected by us"
   - Retention: "We will retain your information for as long as is reasonably necessary"
   - Deletion: Available via email request

2. **Storage of Prompts/Inputs:**
   - Inputs ARE collected and stored
   - "We do not control, and are not responsible for, LLMs' handling of your Inputs"

3. **Training / Model Improvement:**
   - **IMPORTANT:** "Some Model Providers may use your Inputs for model training"
   - **IMPORTANT:** "**OpenRouter does not use your Inputs or Outputs for model training.**"
   - Model Providers (not OpenRouter) may differ

4. **Opt-out Options:**
   - Select models labeled as NOT using data for training

**Configuration in Codebase:**
- Default: `openai/gpt-4o-mini`
- Override: `OPENROUTER_MODEL` env var
- Enabled by default

**Conclusion:** OpenRouter collects prompts but claims not to train on them. Model providers may have different policies. Formulation payload contains only requirement ID and matched keyword.

---

### EdenAI

**Privacy Policy:** UNKNOWN - Could not locate accessible privacy policy

**Provider Code Analysis:**
- Location: `api/_lib/providers/edenai.mjs`
- Endpoint: `https://api.edenai.run/v3/chat/completions`
- Model: Default `cloudflare/@cf/google/gemma-7b-it-lora` (configurable via `EDENAI_MODEL`)

**KNOWN UNKNOWNS:**
- Input retention policy
- Training on inputs/outputs
- Data sharing practices

**Configuration in Codebase:**
- Default: `cloudflare/@cf/google/gemma-7b-it-lora`
- Override: `EDENAI_MODEL` env var
- Enabled by default

**Conclusion:** EdenAI privacy policy is not documented in the repository.

---

## LOGGING / OBSERVABILITY

### Current Logging Behavior

**What IS logged:**
1. Provider request logging: `[ai] provider=openrouter model=<model> ...`
2. Error logging: `[/api/match] unexpected: <error>`

**What is NOT logged:**
1. Prompt content
2. Response content
3. CV text
4. Personal data
5. Recommendation details

**Recommended:** Add safety status to logs for audit trail.

---

## USER TRANSPARENCY

### Critical Issue (NEEDS WORK)

No explicit user notice exists for AI formulation calls.

**Required before deployment:**

1. Notice before first formulaion call
2. Explanation of what data is sent
3. Confirmation that personal data is not included

**Example Notice:**
> "We'll send a minimal snippet (your matched skill keyword and the job requirement) to an external AI service for optimization suggestions. No personal information (name, email, company, etc.) is included."

---

## ARCHITECTURAL BOUNDARY

```
LOCAL / MAY'S JOB MATCHER
├─ ATS Analysis (deterministic)
├─ Evidence matching
├─ Safe recommendations
└─ Data minimization (implicit)

EXTERNAL AI PROVIDER
├─ Receives: requirement ID, matched keyword, change type
├─ Does NOT receive: name, email, phone, company, project, dates

RETURN
├─ Structured AI result
├─ Local safety validation
└─ User can accept/reject
```

---

## FAIL-SAFE

If anonymization fails or data contains PII:

→ DO NOT MAKE AI CALL

Return safe fallback with `safetyStatus: "DO_NOT_GENERATE"`

---

## FUTURE USER MODES

### MODE A — Local/Deterministic ATS (Current)
- No AI calls
- Rules-based matching

### MODE B — Privacy-Minimized AI (Recommended)
- Only minimal relevant evidence
- Keywords only, no personal data

### MODE C — Full AI CV Processing (Future)
- Requires explicit consent
- Full CV may be sent

---

## OPEN QUESTIONS

1. **EdenAI Privacy Policy:** UNKNOWN - need to investigate
2. **Provider Training:** Unknown for EdenAI; OpenRouter claims no training
3. **User Notice:** Not implemented - needs design
4. **Logging:** Could add safety status for audit

---

## RESULT

### COMPLETED

✅ Data flow fully mapped  
✅ Data classification complete  
✅ Data minimization strategy defined  
✅ Anonymization approach documented  
✅ OpenRouter privacy policy verified  
✅ Provider boundary established  
✅ Safety controls identified  

### STATUS: PARTIAL

- OpenRouter policy verified (no training, inputs collected)
- EdenAI policy: UNKNOWN
- User notice: NOT IMPLEMENTED
- No code changes made (as required)

---

## GIT STATE

```
Branch: main
Status: Clean (no changes committed)
Files Modified:
  - docs/reports/STEP_37D_PRIVACY_AI_DATA_BOUNDARY_DESIGN.md (new)

No changes to:
  - api/_lib/ats.mjs
  - api/_lib/providers/
  - packages.json
  - Build configuration
```

---

## NEXT

### Before Production Deployment:

1. [ ] Verify EdenAI privacy policy
2. [ ] Add user-facing privacy notice
3. [ ] Consider formal anonymization function
4. [ ] Update AI_PROVIDERS.md with privacy notes

### STEP 37D-PRIVACY: COMPLETE / PARTIAL / BLOCKED

**RESULT: PARTIAL**

Documentation complete with verified OpenRouter findings. EdenAI policy remains unknown. Production deployment requires:
- EdenAI privacy verification
- User notice implementation
- Provider policy review before AI calls

---

## METRICS

- AI production calls: 0
- Apify runs: 0
- Deployments: 0
- Code changes: 0