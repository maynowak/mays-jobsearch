# JM-ATS-MATCHING-QUALITY-01

**Status:** `IMPLEMENTED / VERIFIED LOCAL / RELEASE REVIEW PENDING`

**Date:** 2026-11-15
**Repository:** `maynowak/mays-jobsearch`
**Branch:** `feature/jm-ats-matching-quality-01`
**Baseline:** `origin/main` `f4cb0a36ebb465ee9a4a60fd7e7835c5147b9a94`

## 1. Root cause

The UI called `analyzeATS()` with only:

```ts
{ title, tags, slug }
```

The complete job description was never sent to `/api/ats-analysis`. For
“AI Platform Engineer”, `extractRequirementsFromJob()` therefore saw only
`platform` and `engineer`, both matched the ATS profile, and the result was
2/2 = 100 %.

Two additional issues made the result misleading:

1. `extractSkillsFromText()` discarded almost all ordinary description tokens
   because it only kept aliases/required keywords.
2. Title tokens were treated as complete job requirements instead of a separate
   role signal.

## 2. Corrections

### Full description is transmitted

All three `analyzeATS()` calls in `src/components/AtsOverlay.tsx` now use one
shared payload helper containing:

- `title`, `tags`, `slug`
- `descriptionPlain` and `description`
- `location`, `remote`, `jobTypes`, `contractType`, `language`

The existing `/api/ats-analysis` endpoint and request contract remain in use.
Old clients that send only title/tags still work.

### Conservative requirement extraction

`api/_lib/ats.mjs` now uses a curated technical vocabulary with multi-word terms
and aliases. Examples:

- MCP / Model Context Protocol, OAuth, OIDC, SAML, SCIM, Okta
- LLM, AI agents, autonomous/multi-step agents, agent identities, tool integrations
- IAM, least privilege, audit logging, security guardrails, access control
- Evaluation, regression testing, observability, OpenTelemetry, Grafana, Datadog,
  Langfuse, LangSmith, Braintrust
- Python, TypeScript, Go, CI/CD, cloud infrastructure
- Anthropic, OpenAI, OpenRouter, GitHub Apps, service accounts, API keys,
  1Password, policy-as-code

Arbitrary nouns and punctuation artifacts are no longer accepted as skills.
Requirements retain their source and are deduplicated; a title term repeated in
tags/description is upgraded to the non-title source.

### Score semantics

`analyzeJobForAts()` now separates:

- **Role match** — `profile.targetRoles` versus the job title.
- **Requirement coverage** — actual job requirements versus `profile.skills`.
- **Profile evidence** — matched/partial actual requirements.
- **Title count** — displayed only as basis information.

Title requirements are excluded from the overall requirement score. If there is
no actual requirement basis, `analysisStatus` is `insufficient` and the UI shows
“Not enough basis for an evaluation” instead of a percentage. If only tags/
non-description data exist, the status is `limited`; the UI explicitly marks the
result as incomplete.

No keyword hit is presented as proof of practical experience.

### ATS profiles

- `targetRoles` is used for role matching.
- `skills` is used for requirement matching.
- `criteria.requiredSkills`, `preferredSkills` and `excludedTerms` are consumed
  according to the existing `ATSCriteriaV1` contract.
- No RIS persistence contract or profile model was changed.

### UI

- Requirement terms are rendered once.
- “Was bereits passt” is now a compact summary instead of repeating every term.
- Tips repeat the matched count, not the keyword list again.
- Role match and requirement coverage are displayed separately.
- Insufficient and limited analyses are visibly distinguished.
- Existing responsive/accessibility structure is retained.

## 3. Before / after

Fixture based on the owner-provided AI Platform Engineer requirement content
(the full external ad is not stored in the checkout):

| Case | Before | After |
|---|---|---|
| Extracted requirements | 2 (`platform`, `engineer`) | 42 total: 2 title + 40 job requirements |
| Profile `platform, engineer` | 100/100 | Role match 100, requirement coverage 0, overall 0 |
| Analysis status | implicit complete | complete with 40 actual requirements |
| Title-only job | 100/100 possible | `insufficient`, no percentage |
| Repeated term display | requirements + matched + tips | once in requirements; summary counts elsewhere |

The UI now makes clear that `platform + engineer` is a role match, not a complete
CV suitability score.

## 4. Tests

Commands executed:

```bash
npm run build
npm test -- --run --no-file-parallelism
```

Results:

- Production build: **PASS**
- Full suite: **1888 PASS / 11 skipped**
- ATS-focused tests: **80 PASS**
- New tests cover:
  - full description and `targetRoles`/`criteria` payload
  - API description transfer
  - MCP/OAuth/LLM/IAM/evaluation/observability/Python/TypeScript/Go/CI-CD extraction
  - title-only `insufficient` state
  - title/requirements separation
  - criteria support
  - single rendering of requirement terms

## 5. Files changed

- `api/_lib/ats.mjs`
- `api/ats-analysis.mjs`
- `src/App.tsx`
- `src/api.ts`
- `src/components/AtsOverlay.tsx`
- `src/components/AtsOverlay.test.tsx`
- `src/i18n.tsx`
- `tests/api/ats-analysis.test.js`
- `tests/api/ats-extraction.test.js`

## 6. Limitations

- The exact full external Jobgether ad is not committed; a requirements fixture
  covering the named technologies is used. Add the complete ad only with owner
  approval if a byte-for-byte fixture is needed.
- The extraction vocabulary is intentionally conservative. Unknown technologies
  outside the vocabulary remain unreported rather than being guessed.
- Requirement coverage is keyword/skill evidence, not proof of years of practical
  experience.
- ATS live UI against real RIS data is not part of this frontend-only change.

## 7. Git

Implementation commit: `e9d47d2`

Feature branch: `feature/jm-ats-matching-quality-01`

No main merge, deployment, production change, RIS change, Terraform/AWS change or
new ATS architecture.

**IMPLEMENTED / VERIFIED LOCAL / RELEASE REVIEW PENDING**
