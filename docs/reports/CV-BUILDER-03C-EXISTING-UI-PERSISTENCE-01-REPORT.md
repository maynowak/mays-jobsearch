# CV-BUILDER-03C-EXISTING-UI-PERSISTENCE-01

**Status:** `CV-BUILDER-03C — PERSISTENCE BLOCKED / RIS STRUCTURED-CV CONTRACT REQUIRED`
**Date:** 2026-11-12
**Branch:** `feature/cv-builder-03c-existing-ui-persistence`
**Base:** `a0dc1ec`
**Main:** `a0dc1ec` (unchanged)
**Decision:** **STOP before implementation, merge and production release.**

## 1. Scope

The task requires durable, editable CV-builder profiles in the **existing**
“Meine Lebensläufe” UI through Mays-RIS, with owner isolation, consent,
versioning, export and erasure.

The safety rule in the task is explicit: the existing PDF storage contract
must not be treated as a contract for structured CV data.

## 2. Jobsearch inventory

The existing builder profile is:

- `CvBuilderProfileV1` in `src/lib/cvBuilder/profileTypes.ts`;
- stored only by `createCvBuilderProfileRepository()` in
  `src/lib/cvBuilder/profileRepository.ts`;
- explicitly session-only/in-memory;
- includes profile name, structured draft, template, version and timestamps;
- imports the 03B quality report through the separate session store;
- is not part of the RIS search-profile contract;
- is not written to `localStorage` or RIS.

Existing UI actions already exist in `CvBuilderProfileList`: create, edit,
duplicate, rename, download, delete. No second profile management UI is needed.

## 3. Available RIS/BFF contracts

The documented Jobsearch BFF routes are:

- `/api/ris/applications`
- `/api/ris/consents`
- `/api/ris/cvs`
- `/api/ris/cv-consents`
- `/api/ris/search-profile-consents`
- `/api/ris/search-profiles`
- `/api/ris/erasure`

The documented RIS partner OpenAPI contains:

- PDF/CV document list/create/update/delete and upload/download;
- manual search profiles;
- CV-search profiles;
- ATS search profiles;
- user profile (`/me/profile`, identity/name fields only);
- consents, applications, erasure.

There is **no** documented structured CV-builder endpoint with a draft,
template, import-review, version and owner contract.

### Why existing contracts cannot be reused

| Existing contract | Why not suitable |
|---|---|
| PDF/CV document storage | Stores uploaded PDF artifacts/metadata, not editable structured drafts, template, review items or edit state. |
| Manual search profiles | Search configuration/city/matching preferences, not CV content. |
| CV-search profiles | Derived search configuration under a PDF CV; not the source CV draft. |
| ATS profiles | ATS search configuration, not a CV builder profile. |
| `/me/profile` | Identity/name profile row, not structured CV data. |

Using any of these would violate owner/semantic isolation, capacity, consent
purpose, export/erasure and version expectations. It is not implemented.

## 4. Required RIS contract before implementation

The following needs an explicit, separately authorized RIS contract and
legal/privacy approval:

1. New structured CV-builder profile resource (not PDF/search profile), e.g.
   list/create/get/update/delete under a partner route.
2. Server-owned ownership/tenant/user isolation.
3. Draft schema version, profile name, template, editable state and import
   review sidecar.
4. Optimistic concurrency (`version`/conditional write) and conflict response.
5. Capacity and quota semantics.
6. Dedicated consent purpose and approved notice text; no reuse of PDF or
   search-profile consent.
7. Export and erasure coverage, including review sidecar.
8. Retention and backup behavior.
9. Audit/security model for partner access.
10. OpenAPI + BFF route + contract tests.

No AWS/Terraform apply, consent change or RIS repository change was made.

## 5. Verification / git

- Working tree: only this report and the audit entry.
- No product code changed.
- No tests can honestly claim durable persistence without the missing
  contract; baseline regression remains `1806 PASS / 5 skipped` from 03B.
- No main merge, no production deployment, no RIS/AWS/Cognito/Terraform/
  consent change.
- Automatic Vercel preview builds remain enabled.

## 6. Next required decision

**STOP.** Provide or authorize a documented RIS structured-CV-builder profile
contract (schema, consent purpose, versioning, capacity, export/erasure).
After that, the existing profile list can be extended with “Dauerhaft
speichern” and storage status without creating a second profile UI.

**Do not merge; do not deploy.**
