# JM-PROFILE-VISUAL-10 — Controlled Release

**Status:** `MERGED / PRODUCTION DEPLOYED / PRODUCTION E2E VERIFIED`  
**Scope:** VISUAL-09, VISUAL-10 and VISUAL-10B  
**Release branch:** `feature/jm-profile-visual-10b-navbar-fix`  
**PR:** #47  
**Merge commit:** `9314b77`  
**Main baseline:** `5d7f3b3`

## 1. Included Changes

- VISUAL-09: dark 3D glass profile header, subtle card depth, deterministic particle layer.
- VISUAL-10: brighter/faster cyan particles (`0.60–0.90` opacity, `14–22 s`).
- VISUAL-10B: navbar diagnostic only; no CSS fix.
- Existing dual-AI background, image proportions, CV workspace, RIS, AWS, Cognito, consent and analytics remain unchanged.

## 2. Pre-Merge Verification

- Branch was 5 commits ahead / 0 behind `origin/main` at `5d7f3b3`.
- Full Vitest suite: **2004 PASS / 11 skipped**.
- `npm run build`: PASS.
- `git diff --check`: PASS.
- VISUAL-10 browser E2E 1920/1440/768/390: PASS.
- Reduced-motion E2E: `animation-name: none`.
- VISUAL-10B Chromium diagnostic: no layout defect; full-page screenshot artifact documented.
- Firefox: **NOT VERIFIED** — local Playwright Firefox binary unavailable.

## 3. PR and Merge

- PR #47 head: `ead882d`.
- Vercel preview checks: PASS.
- CodeQL Analysis: PASS; duplicate CodeQL status skipped.
- PR merge state: `CLEAN` / `MERGEABLE`.
- Merged as `9314b77`; branch was retained, no force-push.

## 4. Production Deployments

Automatic main deployments, no manual `vercel --prod`:

| Project | Deployment | Status |
|---|---|---|
| `www.mays-job-matcher.app` | `dpl_EnsLvH5BQBQcdsmMuUbubdbSxhTc` | READY |
| `mays-jobsearch.vercel.app` | `dpl_HDWnDr2Rg7TW1pSdCk219J98trXR` | READY |

Production footer confirms:

```text
Version 2.2.0 · production · main · 9314b77
```

## 5. Production E2E

Read-only Chromium E2E on both domains, all four widths:

| Check | Result |
|---|---|
| `/` and `/profil` HTTP 200 | PASS |
| 1920 / 1440 / 768 / 390 | PASS |
| 16 particles desktop/tablet | PASS |
| 8 visible particles at 390 px | PASS |
| Color variables `#22D3EE`, `#67E8F9`, `#A5F3FC` | PASS |
| `profile-particle-drift` animation | PASS |
| Fast duration window in source (14–22 s) | PASS |
| Reduced-motion animation `none` | PASS |
| Left/right dual-AI assets | PASS |
| Horizontal overflow | 0 px |
| Browser console/page errors | none |
| Production Build SHA | `9314b77` |

Header/card/navigation visual behavior was verified in the local demo-profile E2E; the public production `/profil` guest surface has no authenticated header or sidebar shell. No authenticated production account or write operation was used.

## 6. Navbar Artifact

VISUAL-10B determined that the apparent navbar-over-card issue is a full-page screenshot artifact at non-zero scroll. Normal viewport measurements showed `top=-61px` when scrolled and no visible navbar; full-page capture paints the sticky element at the captured scroll offset. No CSS change was made.

## 7. Final Boundaries

- No RIS, AWS, Terraform, Cognito, consent or analytics change.
- No authenticated production write or real applicant data.
- Feature branches retained.

## 8. Auditlog Commit

The release entry is added to `docs/AI_AUDITLOG.md` in the docs-only follow-up commit on `main`.

**Final:** `MERGED / PRODUCTION DEPLOYED / PRODUCTION E2E VERIFIED`
