# PROFILE-HIERARCHY-06 — ATS Search Configuration & Tag Analysis

## Status

- Status: COMPLETE — product/UI concept audit only; no implementation
- Date: 2026-10-29
- Branch: `main`
- HEAD at audit: `4a655bd`
- Working tree: only pre-existing unrelated untracked user files; no tracked code changes before this report
- Terraform: not applicable; no Terraform/infrastructure work

## Product concept recorded

Target hierarchy for unregistered session UX:

`User → CV (max 10) → SearchProfile (max 2 per CV) → ATSSearchProfile (max 5 per SearchProfile)`

These are capacity limits, not required empty slots. The proposed UI behavior is:

1. Select a CV and SearchProfile in the CV tab.
2. Show only ATS variants belonging to that SearchProfile.
3. SearchProfile-only uses the existing SearchProfile search.
4. SearchProfile + ATS variant is a future exclusive ATS-search configuration; the parent is not run as a second search.
5. Job tags/relevant job attributes may later be compared against profiles, but ranking/scoring is intentionally unresolved.
6. A concrete job may later show which profile/variant produced relevant matches.

## Current implementation baseline

- CVs are session-only, held in App state, with the existing maximum of 10.
- Search-/ATS-profile lists are session-memory buckets keyed by anonymized CV hash and expire after 12 hours.
- Current store capacity remains 50 entries per list; the product target 2/5 is not treated as implemented by this report.
- New ATS entries are parent-linked through `searchProfileId` with store-level context and cap checks. Legacy entries without a parent remain possible in the existing store for compatibility.
- SearchProfile-only job search exists and remains the current search path.
- ATS selection currently supports the existing per-job ATS analysis flow; ATS profiles do not yet control the general job search.
- The recent UI fix now filters ATS options by the selected SearchProfile. This is a GUI/session step toward the target, not persistent user ownership.

## Explicit non-decisions / open questions

- Which job fields/tags are authoritative for comparison?
- Counted or weighted tags? How are synonyms and missing tags handled?
- One or multiple ATS variants active at once?
- Ranking per job, per search run, or both?
- Tie handling and explanation text?
- Does ATS-search replace or coexist with the current per-job ATS analysis?
- Which ATS fields are search configuration versus analysis-only fields?
- What are delete/cascade semantics and how are legacy unassigned ATS entries handled?

No ranking, scoring, tag ontology, persistence migration, ownership model, API, or infrastructure decision is made here.

## AI / privacy / data-flow assessment

- No AI call, model, prompt, provider, API, storage, or data-flow change was implemented.
- Future tag analysis would be an AI/data-flow-relevant change and requires a separate implementation gate, privacy review, and explicit scoring/product decision.
- The current session-only behavior must not be described as durable user-owned persistence.

## Validation

- Read-only comparison against `PROFILE-HIERARCHY-04`, `PROFILE-HIERARCHY-05`, and `JOBMATCHER-ATS-PROFILE-INTEGRITY-01`.
- No code tests/build were needed for this documentation-only concept audit.
- No deployment or push performed.

## Next step

Resolve the open product questions first. Only then create a separate implementation task for ATS-driven job search/tag analysis; preserve the existing SearchProfile-only search as the reference path.
