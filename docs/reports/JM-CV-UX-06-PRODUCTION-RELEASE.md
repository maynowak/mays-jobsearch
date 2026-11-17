# JM-CV-UX-06 — Production Release Evidence

**Status:** `PRODUCTION VERIFIED`

- **PR:** [#25](https://github.com/maynowak/mays-jobsearch/pull/25) — MERGED
- **Merged by:** `maynowak`
- **Merge time:** 2026-11-17T10:02:52Z
- **Main merge SHA:** `da1ebbb8cff28637874b17d2ee068ab64419968e`
- **Pre-merge feature head:** `d0bd291dc03ce9a5c833090d745a1fd3d7780592`
- **Production deployment:** `dpl_CXBBRTcThngJ4EyMikqJaN4eenJP`
- **Production URL:** https://www.mays-job-matcher.app
- **Production build SHA:** `da1ebbb` (footer)
- **Footer identity:** `Version 2.2.0 · production · main · da1ebbb`

## Reconciliation

- `origin/main` `08d74b9` integrated with merge `a69325b`.
- While the gate was running, main advanced to `7d5b4a7`; second integration merge `a77df49`.
- Only conflict per merge: `docs/AI_AUDITLOG.md`; UX-06, translation, ATS and model-selection entries were preserved completely.
- Translation/ATS/skills changes retained:
  - `api/profile.mjs` skill cap 100, prompt and `maxTokens`
  - ATS selected/total skill count
  - translation model picker and `api/job-details.mjs` changes
  - translation/ATS/skill regression tests
- UX-06 navigation, close/return flow, draft decisions and RIS blocker list retained.

## Verification

| Gate | Result |
|---|---|
| Full suite `npx vitest run --maxWorkers=2` | **1939 passed / 11 skipped**, 0 failed |
| Build `npm run build` | **PASS**, 1.44 s |
| Focused ATS/translation/skill tests | **59/59 PASS** |
| UX-06 two-tab browser E2E | **PASS** |
| Existing 03A workspace E2E | **PASS** |
| Diff/whitespace/secret audit | **PASS** |
| PR mergeability before merge | `MERGEABLE` / `CLEAN` |

PR checks before merge: Vercel previews **SUCCESS**, CodeQL Analysis **SUCCESS**. The auxiliary `CodeQL` check remained **NEUTRAL/skipping** because two historical `main` configurations were missing; the same warning existed on previously merged PR #22.

## Deployment

The main merge auto-triggered production deployments for the two connected Vercel projects. The application production project `mays-job-matcher` was used for the smoke test; no additional `vercel --prod` was run.

### Application production

- Deployment `dpl_CXBBRTcThngJ4EyMikqJaN4eenJP`
- Target: `production`
- Status: `READY`
- Deployment metadata SHA: `da1ebbb`
- Aliases: `www.mays-job-matcher.app`, `mays-job-matcher.app`, `mays-job-matcher.vercel.app`
- HTTP checks: `/` 200, `/search` 200, `/cv-builder/workspace` 200

### Secondary connected project

- Deployment `dpl_Hb1Q8g9htYE7sxnun4qYKK1wfwT6`
- Project: `mays-jobsearch`
- Target: `production`, status `READY`, metadata SHA `da1ebbb`
- Aliases: `mays-jobsearch.vercel.app`, `mays-jobsearch-maymilly.vercel.app`
- Not used for the application smoke test.

## Production Smoke

Executed against `https://www.mays-job-matcher.app` with synthetic UI data only.

- Desktop 1440: search page, CV workspace, new empty CV, separate tab, clean X close.
- Dirty separate tab: close prompt, cancel preserves data.
- Return to main window: data transferred, tab closed, source editor updated.
- Direct workspace: unsaved prompt, cancel preserves data, explicit discard returns to start.
- Mobile 390: workspace and editor render without horizontal overflow.
- Footer build identity matched the merge SHA: `da1ebbb`.
- Page errors: **0**; console errors: **0**.
- API requests during smoke: only `GET /api/models`; no RIS calls, no CV upload, no auth mutation.

Evidence:

- `docs/reports/assets/JM-CV-UX-06-PRODUCTION/production-search-1440.png`
- `docs/reports/assets/JM-CV-UX-06-PRODUCTION/production-return-1440.png`
- `docs/reports/assets/JM-CV-UX-06-PRODUCTION/production-direct-1440.png`
- `docs/reports/assets/JM-CV-UX-06-PRODUCTION/production-editor-390.png`

## Limitations

- Authenticated CV-editor/dashboard paths were not tested; no permitted test identity was used.
- RIS/S3 live PDF storage was not tested; no separate live-test authorization was used.
- No branches were deleted.
- The docs-only release-evidence branch intentionally remains separate from `main`.
