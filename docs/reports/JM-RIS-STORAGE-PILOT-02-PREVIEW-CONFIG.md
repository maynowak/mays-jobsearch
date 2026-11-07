# JM-RIS-STORAGE-PILOT-02 — Jobsearch preview configuration plan

**Status:** `PLAN ONLY — NOT APPLIED, NO ENV CHANGE, NO DEPLOY, NO ACTIVATION`
**Date:** 2026-11-07
**Repository:** `mays-jobsearch` (A side)
**Worktree:** `worktrees/jobsearch-storage-activation-01`
**Branch:** `feature/jm-ris-storage-activation-01`
**Baseline:** `95680e3` (BFF hardening `324ad18` + `b8074a0`, final report `95680e3`)
**RIS counterpart:** `81634d8` (notice-state Terraform wiring + approval packet + isolated-environment analysis)

> This plan prepares a dedicated preview/test deployment. It does not approve
> legal text, change an environment, enable a flag, deploy, or claim live
> persistence. The pilot remains blocked by (a) no legally approved
> ApplicationV1 consent notice and (b) no isolated RIS runtime.

---

## 1. BFF re-check against the pilot requirements — verdict `PASS`

| Requirement | Implementation | Evidence |
| --- | --- | --- |
| Live catalogue check | `GET /api/ris/consents` evaluates the RIS `catalog`; POST grant re-reads it immediately before writing | `api/_lib/ris/consentsHandler.mjs`, `api/_lib/ris/consentNotice.mjs`, tests `ris-consents.test.mjs` |
| Version binding | Notice version is server-owned (`RIS_CONSENT_NOTICE_VERSION`); a body-supplied version is ignored | test `sendet bei freigegebener Notice die serverseitige Version an RIS` (body `9.9`, sent `1.0`) |
| Fail-closed | Missing/malformed catalogue, unknown version, `DRAFT`/`SUPERSEDED`, non-boolean flags, RIS 5xx/timeout/network error, conflicting duplicates all block | `consentNotice.mjs`; `ris-consents.test.mjs` 26 API cases |
| State semantics | Accepts `APPROVED` or `ACTIVE`; requires strict `noticeApproved === true` and `acceptedForNewGrant === true` | `consentNotice.mjs:12`, `:82-85` |
| Consent status UI | Shows status, RIS state, block reason and both text versions; grant button disabled unless `grantAllowed` | `src/components/StorageConsentLive.tsx`; 3 UI tests |
| Remote mode | Session is default; remote only with `VITE_RIS_APPLICATION_STORAGE_ENABLED=true` + verified login + access token | `src/App.tsx:280-291`, `src/lib/applications/risRemoteRepository.ts:40` |
| Allowlist | Server-side `RIS_TEST_USER_ALLOWLIST` `<issuer>\|<sub>`; empty/missing denies; `403 test_user_not_allowed` | `api/_lib/ris/config.mjs`, both BFF handlers |
| Error handling | 401/403/422/409/503 mapping; no grant call when blocked; withdraw independent of notice state | `consentsHandler.mjs`, `ris-consents.test.mjs` |
| No success without backend confirmation | Consent state comes from the RIS response; application create/update parse the server `application` envelope; delete requires `deleted === true` | `risRemoteRepository.ts:127-330`, `remoteSessionRepository.ts` |

Focused test evidence (run for this review, exact output):

```
$ npx vitest run tests/api/ris-consents.test.mjs tests/api/ris-routing.test.mjs tests/api/ris-config-separation.test.mjs
 Test Files  3 passed (3)
      Tests  50 passed (50)

$ npx vitest run src/components/StorageConsentLive.test.tsx \
    src/lib/applications/risRemoteRepository.test.ts \
    src/lib/applications/remoteSessionRepository.test.ts
 Test Files  3 passed (3)
      Tests  36 passed (36)
```

No proven gap required a code change. Residual (non-blocking) observations:

1. If RIS rejects a grant after the pre-check (e.g. state changed between the
   two calls), the BFF forwards RIS's uppercase `NOTICE_NOT_ACTIVE`. The UI
   recognizes only the lowercase BFF codes and would show the generic
   "service unavailable" text. Cosmetic, no grant is written.
2. Remote application mode does not pre-check the consent itself; **RIS
   `APPLICATION_CONSENT_ENFORCED` is the write gate**. Until that flag is
   `true` in the pilot workspace, a remote write would not prove the
   "no consent → no write" guarantee. The gate order in §5 reflects this.
3. `VITE_RIS_CONSENT_UI_ENABLED=true` is already set in production and shows
   the consent panel there; grants remain blocked because notice `1.0` is
   `DRAFT`. Production must not receive the application-storage browser flag.

---

## 2. RIS packet / environment review (read-only)

Reviewed `docs/reports/APPLICATION-STORAGE-1.0-APPROVAL-PACKET.md` and
`docs/reports/JM-RIS-STORAGE-PILOT-02-ENVIRONMENT-ANALYSIS.md` at RIS `81634d8`.

**Confirmed: no complete, legally approved application-storage consent
declaration exists.**

- RIS internal draft (`docs/privacy/RIS-JOBSEARCH-PRIVACY-NOTICE-DRAFT-V1.md`)
  is marked "Arbeitsentwurf — nicht juristisch freigegeben, nicht
  veröffentlichen", covers profile/CV/search-profile data and calls itself
  "keine Einwilligungserklärung". It cannot serve as the ApplicationV1 notice.
- Jobsearch policy v1.1 §9/§10 (`public/legal/datenschutz.md`) is a privacy
  notice/description, not a first-person consent declaration. The quoted §9/§10
  passages match the current file.
- The live consent UI renders no declaration text; the grant button is the only
  affirmative act (packet §3.3 matches `StorageConsentLive.tsx` and the DE
  `privacyStorage.*` strings).
- Version identifiers match: Jobsearch `STORAGE_CONSENT_TEXT_VERSION` and
  `STORAGE_CONSENT_PRIVACY_NOTICE_VERSION` = `2026-11-04-draft-1`; RIS notice
  `application-storage/1.0` = `DRAFT`, `legalApprovalRef = null`; the external
  reference is deliberately not mapped.
- Retention facts match this repository's Terraform/code: applications table
  TTL enabled on `expiresAt` but the repository never writes it; consents table
  has no TTL; `r08_pitr_enabled=false`; `ERASURE_APPLICATIONS_ENABLED="false"`;
  log retention default 14 days. No approved ApplicationV1 retention rule
  exists.
- Withdrawal claims match: withdraw works in every state and does not consult
  `CONSENT_NOTICE_STATE_ENFORCED`; with `APPLICATION_CONSENT_ENFORCED=true` the
  five write paths return `403 CONSENT_REQUIRED`; reads/export/delete stay
  available.

Minor bookkeeping note: the packet lists Jobsearch `b8074a0`; the branch head
is `95680e3` (final report commit, code identical). Not a correctness issue.

`VITE_RIS_APPLICATION_STORAGE_ENABLED` is absent from both Vercel projects
(`mays-job-matcher` and `mays-jobsearch`) per the RIS environment analysis and
the earlier Jobsearch audit entries; it must be preview-only for this pilot.

---

## 3. Dedicated preview topology

- **Jobsearch:** a dedicated Vercel project or preview-only environment
  (recommended: separate project `mays-jobsearch-storage-pilot`) with Vercel
  Deployment Protection and **no production alias**. Preview-scoped variables
  affect every preview deployment of a project, so a separate project avoids
  leaking the pilot flags into unrelated previews.
- **RIS:** the dedicated workspace from the RIS analysis
  (`project_name=ris-storage-pilot`, `environment=test`), with its own API,
  Lambda, DynamoDB tables, log group, state key and partner credential.
- **Hard rule:** the preview must **not** point at `ris-dev`
  (`ris-dev-jobsearch-api`, API `c7e9pdwe78`). `ris-dev` is the permanent dev
  install shared with the Jobsearch production partner edge; its consents table
  already holds historical synthetic rows and flipping either gate there would
  change the shared partner surface. The preview uses the dedicated pilot API
  base URL instead.
- Production `mays-job-matcher` keeps all application-storage flags off.

---

## 4. Non-secret configuration matrix (target state, not applied)

### 4.1 RIS pilot workspace

| Setting | Pilot value | Note |
| --- | --- | --- |
| workspace | `project_name=ris-storage-pilot`, `environment=test` | Own tables/API/Lambda |
| `partner_surface_enabled` | `true` | Required for `/v1/partner/me/*` |
| `consent_notice_state_enforced` | `true` | Newly wired in `81634d8`; default stays `false` until GO |
| `application_consent_enforced` | `false` during setup, `true` before write-block tests | Only in the pilot workspace |
| notice `application-storage/1.0` | `APPROVED`/`ACTIVE` + real `legalApprovalRef` | Requires the legal decision; code + bundle change |
| `jobsearch_cognito_issuer` / `_client_id` | pilot pool issuer/client | Never production `eu-central-1_ZURSMpD2O` / `5hb3…` |
| `jobsearch_edge_cors_origins` | preview origin only | No production domain |
| `api_cors_origins` | preview origin only | No wildcard |
| `orders_lifecycle` | `disabled` | Unrelated subsystem |
| `r08_pitr_enabled` | `false` unless separately approved | Not a retention decision |

### 4.2 Jobsearch preview environment (names only; secrets never recorded)

Server-side (Vercel Preview scope of the pilot project):

| Variable | Pilot value |
| --- | --- |
| `RIS_API_BASE_URL` | dedicated pilot API invoke URL (**not** `ris-dev`/`c7e9pdwe78`) |
| `RIS_PARTNER_CREDENTIAL` | pilot partner credential (**secret**, created via the approved secret process) |
| `RIS_COGNITO_ISSUER` | pilot Cognito issuer |
| `RIS_COGNITO_CLIENT_ID` | pilot Cognito client id |
| `RIS_TEST_USER_ALLOWLIST` | `<pilot issuer>\|<synthetic sub>` — exactly one entry, no wildcard |
| `RIS_CONSENT_NOTICE_VERSION` | `1.0` |
| `RIS_CONSENT_SERVICE_ENABLED` | `true` |
| `RIS_APPLICATION_STORAGE_ENABLED` | `true` |
| `RIS_API_TIMEOUT_MS` | optional; default `10000` |

Browser-visible (preview build only):

| Variable | Pilot value |
| --- | --- |
| `VITE_RIS_CONSENT_UI_ENABLED` | `true` |
| `VITE_RIS_APPLICATION_STORAGE_ENABLED` | `true` — **preview only; currently absent from both Vercel projects** |
| `VITE_RIS_APPLICATION_MIGRATION_MOCK` | `false`/absent |

Production (`mays-job-matcher`): no application-storage changes; in particular
`VITE_RIS_APPLICATION_STORAGE_ENABLED` and `RIS_APPLICATION_STORAGE_ENABLED`
must stay off. Enabling the browser flag in production requires a UI allowlist
and a separate RG-09 decision.

---

## 5. Gate order (strict)

1. **Legal/operator decision (blocker a):** approved consent declaration text,
   `legalApprovalRef` (owner, date, approving body), ApplicationV1 retention
   rule, Art. 9 assessment, and Jobsearch `2026-11-04-draft-1` ↔ RIS `1.0`
   mapping. Engineering agents do not produce or approve this text.
2. **RIS notice state:** set `application-storage/1.0` to `APPROVED`/`ACTIVE`
   with the real `legalApprovalRef`; rebuild the deterministic Lambda bundle.
3. **RIS isolated workspace (blocker b):** reviewed plan/apply of
   `ris-storage-pilot` with `partner_surface_enabled=true`,
   `consent_notice_state_enforced=true`, `application_consent_enforced=false`,
   pilot-only CORS and pilot Cognito issuer/client.
4. **Jobsearch preview config:** server variables first, then the two `VITE_`
   flags; deploy the preview; confirm production untouched.
5. **Access gate:** non-allowlisted identity gets `403`, no RIS call;
   allowlisted identity gets `GET /api/ris/consents` with
   `noticeState=APPROVED|ACTIVE`, `noticeApproved=true`,
   `acceptedForNewGrant=true`, `grantAllowed=true`, `status=NOT_GRANTED`.
6. **Consent:** grant → `200 GRANTED` with `noticeVersion=1.0`; regrant is
   idempotent; history shows the events.
7. **Write gate:** set `application_consent_enforced=true` in the pilot
   workspace **before** remote write tests.
8. **Remote writes:** create/patch/status against RIS; reload/re-login must read
   the application back from RIS, not local state.
9. **Withdrawal:** withdraw → new write `403 CONSENT_REQUIRED`; read/export/
   delete still work; regrant restores writes.
10. **Negative notice states:** `DRAFT`/`SUPERSEDED` cannot be granted. Verify
    by local tests; a live flip would require a controlled state change and
    rollback, so it is not part of the first pilot run.

---

## 6. Test flow (execution checklist, not yet run)

| # | Step | Expected |
| --- | --- | --- |
| 1 | Signed-in non-allowlisted user calls `/api/ris/consents` | `403 test_user_not_allowed`, no RIS request |
| 2 | Allowlisted user `GET /api/ris/consents` | `200`, `grantAllowed=true`, `noticeState=APPROVED|ACTIVE`, `consent.status=NOT_GRANTED` |
| 3 | `POST /api/ris/consents` (grant) | `200 GRANTED`, `noticeVersion=1.0` |
| 4 | Consent panel reload | `GRANTED`, version `1.0`, history available |
| 5 | Remote create | RIS `applicationId` + `ownerId`; UI shows the server object |
| 6 | Reload / re-login | Application readable from RIS |
| 7 | Patch | `version` increments (conditional write) |
| 8 | Export | Contains the application |
| 9 | Delete | `deleted=true` receipt; then `404`/empty list |
| 10 | Withdraw | `WITHDRAWN`; create/patch → `403 CONSENT_REQUIRED`; read/export/delete still OK |
| 11 | Regrant | Writes allowed again |
| 12 | Cleanup | Delete synthetic applications and consent rows; restore the agreed baseline |

Every step must end with a backend-confirmed response; the UI must not show
success from local state.

---

## 7. Rollback

1. Jobsearch preview: set `VITE_RIS_APPLICATION_STORAGE_ENABLED=false` (or remove
   the preview project) → session mode; the session repository is the default.
2. RIS pilot workspace: `application_consent_enforced=false`; optionally
   `consent_notice_state_enforced=false` if the pilot must accept nothing new.
3. Notice: if the approval is withdrawn, set the notice back to `DRAFT` /
   `SUPERSEDED`; existing grants stay valid, new grants are blocked by both the
   RIS gate and the Jobsearch BFF.
4. Keep pilot data for export/delete; delete only synthetic rows.
5. Tear down the pilot workspace only after the data decision and a separate
   GO; never delete shared `ris-dev` resources.

---

## 8. Remaining blockers

1. **No legally approved ApplicationV1 consent notice/declaration.** Notice
   `application-storage/1.0` stays `DRAFT` with `legalApprovalRef=null`; the
   Jobsearch BFF therefore keeps all grants blocked. This cannot be resolved by
   code, an env var, or an agent.
2. **No isolated RIS runtime.** `ris-dev` is shared with the Jobsearch partner
   edge; the pilot needs the dedicated `ris-storage-pilot` workspace (or a
   verified `ris-dev2` in its real account) under a separate plan/apply GO.
3. **RIS server-side `CONSENT_NOTICE_STATE_ENFORCED`** is now wired in
   Terraform (`81634d8`) but remains `false` in deployed environments until the
   pilot workspace enables it. The Jobsearch BFF is the only active notice
   barrier until then.
4. **`APPLICATION_CONSENT_ENFORCED`** must be enabled in the pilot workspace
   before the write-block acceptance checks; production stays `false`.
5. Preview configuration above has not been applied; no Vercel env was read,
   changed or deployed by this task.

---

## 9. Explicit non-claims

- No live RIS call, grant, withdraw, persistence, deployment or Vercel change.
- No legal review or approval of any candidate text.
- No RIS file, Terraform, AWS, secret or flag change.
- No production activation; production `mays-job-matcher` remains unchanged.
