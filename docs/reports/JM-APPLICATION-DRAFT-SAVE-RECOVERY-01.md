# JM-APPLICATION-DRAFT-SAVE-RECOVERY-01

**Status:** `READY FOR CONTROLLED MERGE`

**Branch:** `fix/jm-application-draft-save-recovery-01`

**Implementation commit:** `c5f35ef`

**Base:** `origin/main` `91f92a4`

## 1. Reproduced conflict

The UI permits a manual application draft with:

- no location (`location: []`),
- no original URL,
- only a description.

`ApplicationV1` also explicitly permits a manual job with an empty location
array (`docs/contracts/fixtures/application-v1/application.manual-job.json`).

The RIS BFF rejected that representation before the request was sent:

```text
unsupported_location_empty: location must contain exactly one value
```

## 2. Fix

### RIS BFF mapping

`api/_lib/ris/map.mjs` now treats the missing location on a `jobOrigin:
"manual"` job as the empty string for the RIS string field:

- no invented city or placeholder text;
- `[]` maps to `""` and is restored to `[]` by `fromRisJob()`;
- a supplied single location maps losslessly (`["Berlin"]` → `"Berlin"`);
- multiple locations remain rejected (`unsupported_location_multiple`);
- source jobs still require exactly one location;
- optional `originalUrl` remains omitted when empty and is passed as `url`
  only when present;
- `coverLetterDraft` remains preserved;
- `jobOrigin` is not sent to RIS; `source: "manual"` remains the canonical
  manual marker.

This is a BFF mapping correction only; no RIS repository, AWS, Terraform,
Cognito or consent change was made.

### Draft retries

`ApplicationsSection` now supplies a stable idempotency key per manual draft
context (`manual-draft:<jobId>`). A retry after an unclear create response
therefore reuses the same server idempotency key and cannot create a duplicate
application.

The first create failure leaves the form text untouched and shows the existing
actionable error; retry uses the same form data.

## 3. Verification

### API/BFF tests

`tests/api/ris-applications.test.mjs` now covers:

- manual draft with empty location and no URL;
- payload has `location: ""`, no invented URL, and preserves
  `coverLetterDraft`;
- response mapping restores `location: []` and `jobOrigin: "manual"`;
- supplied manual location and URL are preserved;
- source jobs with empty location remain rejected;
- idempotency key is forwarded.

### Browser E2E

`tests/e2e/application-draft-save-recovery-01.mjs` uses synthetic OIDC and a
mocked RIS BFF:

1. authenticated profile → applications;
2. new application;
3. description entered, location and URL empty;
4. first create returns synthetic `503`;
5. form text remains intact;
6. retry uses the same idempotency key;
7. create succeeds as a draft;
8. draft appears in the overview;
9. reload loads the same draft again from the mocked RIS list.

Result:

```json
{
  "status": "PASS",
  "result": {
    "createAttempts": 2,
    "idempotencyReused": true,
    "listCalls": 5,
    "emptyLocation": [],
    "aiCalls": 0,
    "reloadFoundDraft": true
  }
}
```

No `/api/profile`, `/api/match`, `/api/cover-letter` or ATS call was made.
No real RIS write was performed.

### Test summary

| Check | Result |
|---|---|
| Focused application/API tests | **120 PASS** |
| Full Vitest suite, serial | **2038 PASS / 5 skipped** |
| Production build | PASS |
| Browser E2E create/retry/reload | PASS |
| `git diff --check` | PASS |
| Secret scan | PASS |

## 4. Live boundary

An existing authenticated Chromium tab was checked through the CDP playbook
without copying tokens or opening a second tab. Remote RIS application storage
was active. However, the deployed Production footer identified build
`1abe3b9` (`feature/jm-search-match-radar-01`), which does not contain the
draft-fix commit `c5f35ef`. A Production create would therefore exercise the
old BFF, not this fix. No Production write was performed.

Authenticated live verification of the fixed BFF requires a deployment/build
that contains `c5f35ef` plus an approved synthetic test identity. The local
mock-BFF E2E and BFF/API tests cover the fixed path; no live customer or real
application data was used.

If the current RIS deployment rejects an empty string for `job.location`, a
separate RIS contract change would be required. No such change was inferred or
made here.

## 5. Boundaries

- No RIS/AWS/Terraform/Cognito/Consent/Storage changes.
- No AI request during draft creation.
- No automatic status change to `submitted`.
- No lossy location/URL conversion.
- No Main merge or Production deployment.

`READY FOR CONTROLLED MERGE`
