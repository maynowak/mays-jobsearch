# JM-ATS-PROFILE-SAVE-FIX-01 — ATS Profile Save

**Status:** `ATS PROFILE SAVE FIXED / VERIFIED LOCAL`  
**Release status:** `MERGED TO MAIN / PRODUCTION DEPLOYED / LIVE SMOKE VERIFIED`

**Branch:** `feature/jm-ats-profile-save-fix-01`

**Code commits:** `5f8b570`, `8c1c75d`, `2265bb6`

**Merge commit:** `116b15d` (PR #43)

**No RIS/AWS/Terraform/consent change.**

## 1. Reproduced path

The error text in the report is emitted by `App.tsx` for a rejected durable
ATS save:

```text
UI CV workflow
  → persistentSearchProfiles.createAts(searchProfileId, input)
  → src/lib/searchProfilesApi.ts
  → POST /api/ris/search-profiles?type=ats&searchProfileId=…
  → api/_lib/ris/searchProfilesHandler.mjs
  → RIS /v1/partner/me/search-profiles/{searchProfileId}/ats-profiles
```

The UI persistent path previously passed `name: atsProfileName` without
trimming or empty-name validation. The browser client and BFF also forwarded
`targetRoles`/`skills` unchanged, without enforcing the RIS `Name` and
`PhraseList` constraints. The BFF then collapsed any upstream failure into the
generic `cv.errorAtsProfileSave` message.

## 2. Reproduction and observed result

A synthetic ATS profile exposes the failing class:

- whitespace-only/empty `name`;
- duplicate or untrimmed `targetRoles`/`skills`;
- an upstream `422 validation_error` from the RIS contract;
- the previous UI catch discarded status/code and showed only
  “Das ATS-Profil konnte nicht gespeichert werden. Bitte versuche es erneut.”

The relevant contract constraints are:

- `Name`: string, min length 1, max length 200;
- `PhraseList`: array of unique non-empty strings, max 200 characters.

The previous path did not normalize these values before the RIS call. The
fix keeps the RIS contract as source of truth but prevents avoidable invalid
requests and exposes the remaining server error class clearly.

## 3. Fix

### Client normalization

- `src/lib/profiles/profileValidation.ts`
  - `normalizeCreateATSProfileInput`
  - `normalizeUpdateATSProfileInput`
  - trims `name`, target roles and skills;
  - removes exact duplicate phrases;
  - rejects empty/oversized names and invalid phrase lists before HTTP.
- `src/lib/searchProfilesApi.ts`
  - applies normalization to ATS POST and PUT payloads.

### UI

- `src/App.tsx`
  - trims the ATS name before save;
  - blocks an empty name with a specific message and disabled save button;
  - keeps the default name robust when target roles are empty/whitespace;
  - maps `422 validation_error`, `403`, `404` and `409/capacity` to useful
    messages instead of always using the generic failure text;
  - keeps create vs. update behavior unchanged.
- `src/components/PersistentCvProfilesOverlay.tsx`
  - checks the 5-ATS-profile limit before creating a new child profile;
  - existing edit path remains unchanged.
- `src/i18n.tsx`
  - adds the specific name/validation messages in DE and EN.

### BFF

- `api/_lib/ris/searchProfilesHandler.mjs`
  - normalizes ATS `name`, `targetRoles` and `skills` before forwarding;
  - rejects invalid ATS bodies with `422 validation_error` without calling RIS;
  - preserves the existing manual/CV paths and RIS contract;
  - preserves auth, search-profile consent and RIS test-user gates.
  - no new endpoint, no auth bypass, no RIS contract change.

## 4. Tests

| Check | Result |
|---|---|
| Focused ATS save/BFF/client/overlay tests | **25 PASS** |
| ATS create → RIS call body normalization | PASS |
| ATS save → subsequent list/reload | PASS |
| Empty ATS name rejected before RIS | PASS |
| BFF no upstream call on invalid ATS body | PASS |
| Client normalization before fetch | PASS |
| Existing search-profile/consent tests | PASS |
| Full frontend/API suite | **2000 PASS / 11 skipped** |
| `npm run build` | PASS |
| API syntax / `git diff --check` | PASS |

No production write test was performed. No real CV, profile or personal data
was used.

## 5. Release and Production

- PR #43 merged as `116b15d`; branch retained.
- Code: `5f8b570` ATS save fix, `8c1c75d` report/audit, `2265bb6` AGENTS/subagent context.
- Automatic main deployments completed without manual `vercel --prod`:
  - `www.mays-job-matcher.app` → `dpl_79opuM7m2v98iGjsrouzJPA3rGJt` READY
  - `mays-jobsearch.vercel.app` → `dpl_G3RgYGDP1QCczoRPzxJwravBoYQx` READY
- Live smoke: `/` 200 on both domains, `/datenschutz` 200, legacy `/api/ats-analysis` 200.
- No authenticated production ATS write was performed; the new BFF validation is covered locally and remains behind the existing auth/consent gates.

## 6. Open Points

- If the production failure was caused by a different RIS status (for example
  a remote capacity or allowlist rejection), the new status/code mapping will
  make that visible instead of reporting the generic message.
- Actual production write/reload remains gated by the existing RIS test-user
  allowlist and search-profile consent; no production write was attempted.
- The existing API-03 legacy UI auth/consent boundary is unrelated and remains
  unchanged.
