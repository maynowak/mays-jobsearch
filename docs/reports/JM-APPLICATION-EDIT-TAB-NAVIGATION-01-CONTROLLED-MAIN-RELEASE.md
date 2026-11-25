# JM-APPLICATION-EDIT-TAB-NAVIGATION-01 — CONTROLLED MAIN RELEASE

**Status: PRODUCTION VERIFIED**

- Repository: `maynowak/mays-jobsearch`
- Feature branch: `feature/jm-application-edit-tab-navigation-01`
- Feature head: `9688978`
- Main base before merge: `c058555`
- PR: [#65](https://github.com/maynowak/mays-jobsearch/pull/65)
- Merge commit: `e92d78bf19c542119595f151557bcee902f0b8c7`
- Visual Review: ACCEPTED by the operator before this release run.

## 1. Preflight

- `AGENTS.md`, `docs/AGENTS.md` and `docs/AI_AUDITLOG.md` read.
- `origin/main` at `c058555`; feature branch clean, 3 ahead / 0 behind.
- Diff vs `origin/main`: 13 files, +1312 / −41 — only the two implementation
  steps, tests, E2E, i18n/styles, the report/assets and the audit entry.
  Neither `package-lock.json`, API, workflow, Terraform nor any RIS-facing
  contract file changed.
- No unexpected file, no secret, no generated artifact outside
  `docs/reports/assets/JM-APPLICATION-EDIT-TAB-NAVIGATION-01/`.

## 2. Controlled merge

- PR #65 head matched the verified feature head exactly (`9688978`).
- Merge was executed with `--match-head-commit`; no force-push, no branch
  deletion, no foreign commit.
- Merge commit: `e92d78b`.

## 3. Gates before merge

| Gate | Result |
| --- | --- |
| `npx tsc -b` | PASS |
| `npm run build` | PASS |
| Focused Applications/form/letter tests | **69 PASS** |
| Full Vitest suite, serial (`--maxWorkers=1`) | **2105 PASS / 5 skipped** (202 files) |
| Browser E2E `jm-application-edit-tab-navigation-01` (mock BFF) | PASS |
| CodeQL Analysis (javascript-typescript) | PASS |
| Vercel Preview – `mays-job-matcher` | PASS |
| Vercel Preview – `mays-jobsearch` | PASS |
| Vercel Deployments – Maymilly | PASS |
| Vercel Preview Comments | PASS |
| PR mergeability | `MERGEABLE` / `CLEAN` |

The E2E asserts the unchanged-form switch, the dirty-form decision, save
failure retention and retry, own-letter create/reload/edit, preserved version
stock, session mode without remote writes, 0 AI calls, 0 console/page errors
and no overflow at 1440/390.

## 4. Automatic Production deployments

No manual `vercel --prod` was run. Git/Vercel main deployments started
automatically after the merge:

| Project | Deployment | Status |
| --- | --- | --- |
| `mays-jobsearch` | `dpl_G8GUCGNnEXTPcothF5UTRccLxL1J` | READY |
| `mays-job-matcher` | `dpl_6gTLYaUPr7qmwauyQoG8tBWutUmn` | READY |

Both production domains serve the same build:

- `https://www.mays-job-matcher.app/`
- `https://mays-jobsearch.vercel.app/`

Footer on both: `Version 2.2.0 · production · main · e92d78b`.

## 5. Production smoke

| Check | Result |
| --- | --- |
| `/` | 200 |
| `/profil` | 200 |
| `/profil?tab=applications` | 200 |
| `/datenschutz` | 200 |
| `/impressum` | 200 |
| `/anmelden` | 200 |
| `/cv-builder/workspace` | 200 |
| Guest applications notice at 320/390/1440 | present |
| Horizontal overflow | 0 at all checked widths |
| Console/page errors | none |

## 6. Authenticated RIS E2E

The already-authenticated production Chromium tab was used through the
`TESTING.md` CDP procedure. No token, cookie or credential was read, copied or
printed. Remote RIS application storage was active (no session-only notice).
Only a synthetic record was created; real applications were not opened,
modified or deleted.

Synthetic record:

- title: `JM-APP-EDIT-TAB-NAV-01 <timestamp>`
- company: `OpenCode Synthetic QA`
- description: repeated synthetic text, no person reference
- own letter: unique synthetic text

Observed result:

| Check | Result |
| --- | --- |
| Remote create | PASS (`POST /api/ris/applications`) |
| Remote own-letter save, no AI | PASS (`PATCH /api/ris/applications`) |
| Reload returns the same text | PASS |
| Edit and save again | PASS |
| Tab switch after confirmed save | PASS, no repeated dialog |
| Dirty own-letter tab switch → dialog save | PASS, target tab opened |
| Reload after dialog save | PASS, same text |
| Existing version stock | unchanged at 0; **no version request** |
| AI/profile/match/ATS calls | **0** |
| 5xx responses | **0** |
| Synthetic delete | PASS (`DELETE /api/ris/applications`) |
| After reload | synthetic record gone |
| Real applications | none changed |

Write sequence: 1 create, 3 updates, 1 delete. No `action=version` request.

**Remote version-creation limitation:** the existing RIS adapter
(`addCoverLetterVersion`) is not implemented in the 01C remote contract. An
explicit remote version could therefore not be created for the production
record. The authenticated run verified the unchanged stock (0) and the absence
of any version write; the preserved non-empty version stock (1 version before
and after an own-letter edit) is covered by the mock-BFF browser E2E and the
unit tests.

## 7. DE/EN, mobile, accessibility

An additional English mock-BFF browser run (1440 and 390 px) confirmed:

- dialog title `Unsaved changes` and all three actions
  (`Save and switch`, `Discard changes`, `Continue editing`);
- focus on the save action, Escape closes the dialog and keeps the form values;
- own-letter region, remote-storage note, save success and unchanged version
  count in English;
- no horizontal overflow at 390 px;
- 0 AI calls and 0 console/page errors.

The German production run and the German unit/E2E coverage confirm the same
interaction and focus behaviour.

## 8. Boundaries

- No RIS, AWS, Terraform, Cognito, consent or storage-contract change.
- No new credential or Cognito flow.
- No manual Vercel deployment; no `vercel --prod`.
- No force-push, no branch deletion.
- No real application, CV, profile or account data changed.
- This report and the audit entry are committed on a separate docs branch;
  no additional `main` push.

`JM-APPLICATION-EDIT-TAB-NAVIGATION-01 — PRODUCTION VERIFIED`
