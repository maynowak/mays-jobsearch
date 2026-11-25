# JM-UX-CONSOLIDATED-RELEASE-01 — CONTROLLED MAIN MERGE & PRODUCTION VERIFICATION

**Status: PRODUCTION VERIFIED**

- Repository: `maynowak/mays-jobsearch`
- PR: [#66](https://github.com/maynowak/mays-jobsearch/pull/66)
- Integration branch: `integration/jm-ux-consolidated-release-01`
- Approved integration HEAD: `5ef5df8`
- Main base before merge: `e92d78b`
- Merge commit: `df1fe01983487b6badcc29653a3f8474f10a5938`
- No force-push, no branch deletion, no manual deployment.

## 1. Release content

Only the three approved UX packages:

- `JM-PROFILE-LAYOUT-CONSISTENCY-13`
- `JM-CV-IMPORT-EXPANDED-VIEW-UX-01`
- `JM-CV-EDITOR-EXPANDED-VIEW-UX-01`

No additional feature, API, RIS, AWS, Terraform, Cognito, consent, storage,
ATS, AI or persistence change.

## 2. Git preflight and merge

- `docs/AI_AUDITLOG.md` read; remote refs refreshed.
- Worktree clean; integration HEAD `5ef5df8`; `origin/main` still `e92d78b`.
- Whole diff re-checked: 94 PR files, +1643 / −136; no unexpected source or
  infrastructure file.
- PR #66: `MERGEABLE` / `CLEAN`; head `5ef5df8` matched the verified local
  HEAD immediately before merge.
- CodeQL Analysis: PASS.
- Vercel Preview `mays-job-matcher`: PASS.
- Vercel Preview `mays-jobsearch`: PASS.
- Vercel Deployments – Maymilly: PASS.
- Vercel Preview Comments: PASS.
- Merge executed through GitHub with `--match-head-commit 5ef5df8`.
- Main/remote HEAD after merge: `df1fe01`.

## 3. Automatic Production deployments

No manual `vercel --prod`; existing Git/Vercel automation only.

| Project | Deployment ID | Status |
| --- | --- | --- |
| `mays-jobsearch` | `dpl_GXVGsTs1u98y2952bCqGUVuCtBgE` | READY |
| `mays-job-matcher` | `dpl_BrrdddUMvZ21YyUTWn8z6RidGVPr` | READY |

Both production domains serve build `df1fe01`:

- `https://www.mays-job-matcher.app/`
- `https://mays-jobsearch.vercel.app/`

Footer on both: `Version 2.2.0 · production · main · df1fe01`.

## 4. Production smoke (guest)

42 checks at `320 / 390 / 768 / 1024 / 1440 / 1920` across:

- `/`
- `/profil`
- `/profil?tab=applications`
- `/datenschutz`
- `/impressum`
- `/anmelden`
- `/cv-builder/workspace`

Result: all HTTP 200, `0` horizontal overflow, `0` console/page errors. At
1440 and 390 the synthetic PDF import and the empty structured editor were
also exercised:

- import: expand all, radar visible, screenshot mode hides radar, exit restores;
- editor: 8 sections expand, radar and turbo hands visible, screenshot mode
  hides both and returns.

## 5. Authenticated Production verification

The existing authorized Chromium session was used through CDP. No token,
cookie or credential was read, copied or logged. All checks were read-only;
no application, CV or account data was written or changed.

### Profile

At 1440: header `left 123 / width 1180 / top 94` and sidebar
`left 123 / width 279` were identical in all six sections (Übersicht, Mein
Profil, Lebenslauf, Bewerbungen, Job-Präferenzen, Einstellungen).
Applications main stayed wider (`970`) than the other sections (`871`) while
header and sidebar stayed fixed.

At 390: header `left 12 / width 351` remained identical in all six sections;
mobile switcher available; no horizontal overflow.

### Applications

- Existing application list and detail opened read-only.
- Edit form opened; unchanged tab switch did **not** show a decision dialog.
- The own-letter region was reachable without opening or saving any real text.
- No `POST`/`PATCH`/`PUT`/`DELETE` request was observed; no real application
  was changed.
- No console/page error.

### CV import and structured editor

- Import: expand all with radar visible; screenshot mode hid the radar; exit
  restored the earlier state.
- Editor: all 8 sections expanded; radar and turbo hands stayed visible;
  screenshot mode hid radar and hands; exit restored the expanded state.
- Synthetic PDF / empty draft only; no server write, no AI/RIS/ATS call.

## 6. Visual evidence

- Integrated synthetic screenshots (pre-merge, same build code):
  `docs/reports/assets/JM-UX-CONSOLIDATED-RELEASE-01/`
  - profile overview, applications, CV import expanded/screenshot, CV editor
    expanded/screenshot at 1440 and 390.
- Production guest screenshots:
  `docs/reports/assets/JM-UX-CONSOLIDATED-RELEASE-01-PRODUCTION/`
  - CV import expanded/screenshot and CV editor expanded/screenshot at 1440
    and 390.
- Authenticated screenshots were **not committed** because they can contain
  account/application data. The structural assertions above are the evidence.

## 7. Test results (integration HEAD)

| Gate | Result |
| --- | --- |
| `tsc` | PASS |
| Production build | PASS |
| Focused profile/applications | 85 PASS |
| Focused CV import | 31 PASS |
| Focused CV editor | 31 PASS |
| Applications edit/dialog/own letter | 71 PASS |
| Full serial suite | **2113 PASS / 5 skipped** (202 files) |
| Integration E2E profile | PASS |
| Integration E2E CV import | PASS |
| Integration E2E CV editor | PASS |
| Integration E2E applications | PASS |
| Regression `cv-import-ux-07` / `cv-builder-ux-08` | PASS |
| `git diff --check` / secret scan | PASS |

## 8. Known limitations

- `cv-builder-workflow-02a` remains a pre-existing stale E2E: it waits for the
  old save label “Lebenslauf speichern” while the UI uses “Entwurf
  übernehmen”; it fails identically on unmodified `main` `e92d78b`. No product
  change was made. Recommendation: minimal separate test-selector correction.
- The applications workspace intentionally uses the shared 1180 px profile
  frame with a right-extending content area; it is narrower than the former
  1600 px shell at 1440 but wider than every other profile section.
- Import and editor screenshot modes still expand all sections for the capture
  and restore the previous state afterwards.
- The first integration full-suite run hit an unrelated Docker `beforeAll`
  timeout in `ip-quota-parallel.test.mjs`; isolated 6/6 PASS and the repeated
  full run passed. Production is unaffected.

## 9. Cleanup and safety

- No synthetic server record was created; CV guest data is session-only.
- Authenticated run: `0` write requests.
- Chrome test session closed.
- No leftover `mj-rest-redis-*` container.
- No credential, token, cookie or real application data in this report or in
  committed screenshots.
- No AWS/RIS/Terraform/Cognito/consent/storage/CI-CD change.

## 10. Documentation

- Release report: this file.
- Audit entry added to `docs/AI_AUDITLOG.md`.
- Documentation branch: `docs/jm-ux-consolidated-release-01-production`.
- No README/roadmap rewrite inside this release gate.

`JM-UX-CONSOLIDATED-RELEASE-01 — PRODUCTION VERIFIED`
