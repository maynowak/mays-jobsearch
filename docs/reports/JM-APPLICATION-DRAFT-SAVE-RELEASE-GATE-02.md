# JM-APPLICATION-DRAFT-SAVE-RELEASE-GATE-02

**Status:** `READY FOR CONTROLLED MERGE`

**Live status:** `PRODUCTION E2E NOT VERIFIED`

**Branch:** `fix/jm-application-draft-save-recovery-01`

**PR:** [#58](https://github.com/maynowak/mays-jobsearch/pull/58)

**Verified implementation head:** `88afe0d`

**Main base:** `origin/main` `91f92a4`

## 1. Git and scope

- Working tree clean and branch in sync with its remote.
- PR is 3 commits ahead / 0 behind `main`.
- Changed files: **8**, additions 535, deletions 1.
- Scope is limited to the application draft fix, its tests and documentation:
  - `api/_lib/ris/map.mjs`
  - `src/components/ApplicationsSection.tsx`
  - `src/lib/applications/manualJob.test.ts`
  - `tests/api/ris-applications.test.mjs`
  - `tests/e2e/application-draft-save-recovery-01.mjs`
  - `package.json` (one E2E script)
  - the implementation report and audit log

No unrelated product, RIS infrastructure, AWS, Terraform, Cognito, consent or
storage change is included.

## 2. Contract verification

`ApplicationV1` permits manual jobs with an empty `location` array. The RIS BFF
now maps that absence to the RIS string field as `""` rather than inventing a
location:

- `[]` → `""`, and `fromRisJob()` restores `[]`;
- a single supplied location still maps to one string;
- multiple locations remain `422 unsupported_location_multiple`;
- source jobs with an empty location remain rejected;
- an empty optional URL remains omitted;
- `coverLetterDraft` remains preserved;
- `jobOrigin: "manual"` remains represented by `source: "manual"` (the BFF
  does not send the unsupported RIS field).

## 3. Idempotency and error handling

`ApplicationsSection` supplies the stable key
`manual-draft:<jobId>` for manual draft create retries. The browser E2E
verifies:

1. first create returns synthetic `503`;
2. the form text remains intact;
3. the second attempt reuses the same idempotency key;
4. create succeeds;
5. the draft appears in the list;
6. reload loads the same draft again from the mocked RIS list.

No AI, ATS, profile or cover-letter request is made during this flow.

## 4. Verification evidence

| Check | Result |
|---|---|
| Focused application/API tests | **120 PASS** |
| Full Vitest suite, serial | **2038 PASS / 5 skipped** |
| Production build | PASS |
| `git diff --check` | PASS |
| Secret scan | PASS |
| Browser E2E create/retry/list/reload | PASS |

PR #58 gates:

| Gate | Result |
|---|---|
| Mergeability | `MERGEABLE` / `CLEAN` |
| CodeQL Analysis | PASS |
| Vercel – mays-job-matcher Preview | PASS |
| Vercel – mays-jobsearch Preview | PASS |
| Vercel Deployments / Preview Comments | PASS |

The repository has no separate `ci.yml`; configured automated checks are
CodeQL and Vercel.

## 5. Production boundary

The authenticated Production tab was inspected through the TESTING.md CDP
procedure. Remote RIS mode was active, but the delivered build was
`1abe3b9` (`feature/jm-search-match-radar-01`), which does not contain this
fix. No Production write was attempted. A successful Preview deployment is not
an authenticated RIS end-to-end proof.

**Live status remains `PRODUCTION E2E NOT VERIFIED`.**

After separate merge authorization, the release operator must:

1. wait for automatic Vercel deployments on both domains;
2. confirm the delivered main SHA contains this fix;
3. use the existing authenticated-tab procedure and approved synthetic
   identity;
4. create one manual draft with empty location and URL;
5. verify Create → List → Reload → Read;
6. delete the synthetic draft;
7. document any RIS `422` contract rejection without changing RIS/AWS.

## 6. Decision

`READY FOR CONTROLLED MERGE`

No Main merge, Production deployment, Cognito callback change, new credential,
RIS/AWS/Terraform mutation or live application write was performed in this
gate.
