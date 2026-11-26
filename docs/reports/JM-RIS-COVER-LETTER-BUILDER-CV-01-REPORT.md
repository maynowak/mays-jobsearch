# JM-RIS-COVER-LETTER-BUILDER-CV-01 — Report

- **Status:** IMPLEMENTED / VERIFIED LOCAL — READY FOR REVIEW
- **Agent:** Agent C (XREPO-MULTI-AGENT-ORCHESTRATION-02)
- **Worktree:** `worktrees/jm-ris-cover-letter-builder-cv-01`
- **Branch:** `feature/jm-ris-cover-letter-builder-cv-01`
- **Base:** `origin/main` `c63911f`
- **Date:** 2026-11-26
- **Scope:** Jobsearch only. No RIS, AWS, Terraform, Cognito, consent, main merge or deployment change.

## Goal

Reconcile the existing BFF/RIS application contract with the UI for

1. remote cover-letter versions, and
2. builder-CV references in remote storage mode.

## Verified starting contract

- `api/_lib/ris/applicationsHandler.mjs` already accepts
  `POST /api/ris/applications?id=<id>&action=cover-letter`, forwards to RIS
  `/cover-letter-versions` via `toRisCoverLetter(version, expectedVersion)` and
  returns only `{ version }`.
- `api/_lib/ris/map.mjs` rejects `documents.cvReference.cvSource === "builder"`
  with `builder_cv_unsupported` (HTTP 422).
- The BFF exposes no atomic "adopt cover letter" action.

## Implementation

### 1. Remote cover-letter versions

`src/lib/applications/risRemoteRepository.ts`

- Implemented `addCoverLetterVersion`:
  - validates `expectedVersion` and the `CoverLetterVersionV1` fields before any
    request (source allowlist, `jobId`, non-empty bounded `content`, bounded
    `versionId`/`model`, `language` de/en where present);
  - `POST ?id=…&action=cover-letter` with `{ expectedVersion, version }`;
  - then `GET ?id=…` and returns the complete, parsed `ApplicationV1` so callers
    receive the new optimistic-concurrency `version`;
  - errors flow through the existing `request()` / `mapHttpError()` path, so
    409 `version_conflict`, 401 `unauthorized`, 403 `forbidden`, 422
    `validation_error`, network `unavailable`, abort `aborted`, logout
    `session_ended` behave like every other write.
- `adoptCoverLetter` was not added to the persistence port. It remains a
  deliberately unsupported bridge operation (see below), because there is no
  confirmed atomic RIS endpoint.

`src/lib/applications/remoteSessionRepository.ts`

- `addCoverLetterVersion` now delegates to the remote port with
  `expectedVersion`, `version` and the abort signal, then maps the returned
  `ApplicationV1` back to `SessionApplicationV1`.
- `adoptCoverLetter` remains `not_supported` and is documented in code: the
  interactive adopt flow updates the draft through `update()`, so a compound
  client-side call would not be atomic.

### 2. Builder-CV references in remote mode

`src/components/ApplicationsSection.tsx` (CV-reference block only)

- Builder profiles are no longer offered in the `<optgroup>` for new selection
  in remote mode (`!remoteStorage && cvBuilderProfiles.length > 0`).
- An existing persisted builder reference is kept visible and read-only:
  - a clear `role="alert"` explains that a self-created CV cannot be stored
    with an RIS application;
  - the current `builder:<cvId>` option is rendered with a “not storable in
    RIS” marker so the value is not silently cleared;
  - `handleCvReferenceChange` returns early for new `builder:` values in remote
    mode, so no new builder reference is written.
- Session mode is unchanged: the builder optgroup, profile-open button and
  `builder:` selection still work as before.
- No loading, empty, error or search-profile logic was touched.

`src/i18n.tsx`

- Added DE/EN keys:
  - `applications.cvSource.builderRemoteReadOnly`
  - `applications.cvReferenceBuilderRemoteUnsupported`

## Tests

Focused (4 files, 98 tests):

```
npx vitest run \
  src/lib/applications/risRemoteRepository.test.ts \
  src/lib/applications/remoteSessionRepository.test.ts \
  src/components/ApplicationsSection.test.tsx \
  src/components/ApplicationsSection.remote.test.tsx
→ Test Files 4 passed (4)
  Tests 98 passed (98)
```

Broader applications regression (14 files, 188 tests):

```
npx vitest run src/lib/applications \
  src/components/ApplicationsSection.test.tsx \
  src/components/ApplicationsSection.remote.test.tsx \
  src/components/ApplicationLetterComparison.test.tsx
→ Test Files 14 passed (14)
  Tests 188 passed (188)
```

New coverage:

- `risRemoteRepository.test.ts`
  - POST `action=cover-letter` with `expectedVersion`/`version`, then GET and
    full `ApplicationV1` return;
  - 409 → `version_conflict` without a follow-up GET;
  - 403 → `forbidden`;
  - invalid version rejected before any fetch;
  - `adoptCoverLetter` remains absent/unsupported.
- `remoteSessionRepository.test.ts`
  - `addCoverLetterVersion` delegates to the port and maps the response;
  - `adoptCoverLetter` still `not_supported`;
  - `addHistory` still `not_supported`.
- `ApplicationsSection.test.tsx`
  - session mode still offers the builder optgroup;
  - remote mode offers no builder optgroup for new selections;
  - a persisted builder reference shows the remote unsupported alert, stays
    selected/read-only, keeps only its own `builder:` option, and triggers no
    repository write.

## Build and hygiene

```
npm run build
→ tsc -b && vite build PASS
```

```
git diff --check
→ PASS
```

```
secret scan over `git diff`
→ no API keys, bearer tokens, private keys or credential patterns found
```

## Full suite

```
npx vitest run --no-file-parallelism
→ Test Files 8 failed | 196 passed | 3 skipped (207)
  Tests      8 failed | 2145 passed | 11 skipped (2164)
```

The failures are environmental and unrelated to the changed files:

- `src/ManualSearchProfiles.integration.test.tsx` (8 tests, all failures) fails
  during module loading with
  `Denied ID /home/dci-student/projects/mays-xrepo-orchestration/repos/mays-jobsearch/node_modules/pdfjs-dist/build/pdf.worker.min.mjs?url`.
  The pre-existing `node_modules` symlink points outside this worktree, so
  Vite's filesystem allowlist rejects the PDF worker URL. The same file fails
  in isolation, without touching any changed module.
- `tests/integration/ip-quota-parallel.test.mjs` fails in `afterAll`
  (`server.close` on an undefined server) because its Docker-backed setup did
  not start; this is the known Docker-dependent integration test.

No failure references the changed repository/adapter/UI modules.

## Contract decisions

| Topic | Decision |
| --- | --- |
| Cover-letter version write | `POST action=cover-letter` + re-fetch `GET ?id=…`; return full `ApplicationV1`. |
| Version conflict | HTTP 409 / `version_conflict` is surfaced unchanged; no retry/overwrite. |
| Adopt cover letter | Remains unsupported remotely: no atomic RIS endpoint; UI adopts by updating the draft (`update()`). |
| Builder CV reference | Not storable via RIS (`builder_cv_unsupported`). Remote UI hides new builder options, preserves an existing reference read-only, blocks new builder writes. |
| Session behavior | Unchanged. |
| API/BFF | No changes. |

## Privacy / AI / data flow

- No new data category, consent purpose, provider, model call or persistence
  namespace.
- The re-fetch returns the same application data the client already reads via
  `GET`.
- Tests use synthetic fixtures only; no real application, CV or account data.
- No RIS code/API/DynamoDB/AWS/Terraform/Cognito/CloudFront access.

## Limitations

- No authenticated live RIS E2E was run; the remote contract is verified with
  the existing BFF/mapping code plus unit tests.
- A builder reference cannot normally exist in a RIS-stored application
  (the BFF rejects it). The read-only remote state is therefore defensive for
  mixed/legacy or client-side states, not a normal server payload.
- The global letter-adoption path in `App.tsx` still cannot adopt into an
  existing remote application, because it calls `adoptCoverLetter`; this was
  explicitly out of scope and is documented by the remaining `not_supported`
  bridge.
- Full-suite failures above are environment-related (PDF worker symlink path,
  Docker IP-quota test), not regressions from this change.

## Changed files

- `src/lib/applications/risRemoteRepository.ts`
- `src/lib/applications/risRemoteRepository.test.ts`
- `src/lib/applications/remoteSessionRepository.ts`
- `src/lib/applications/remoteSessionRepository.test.ts`
- `src/components/ApplicationsSection.tsx`
- `src/components/ApplicationsSection.test.tsx`
- `src/i18n.tsx`
- `docs/reports/JM-RIS-COVER-LETTER-BUILDER-CV-01-REPORT.md`
