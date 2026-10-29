# CV anonymizer role-phrase fix

## Goal

Prevent CV anonymization from removing job-relevant phrases such as `React
Developer` and `Software Engineer`, while continuing to mask ordinary names.

## Recovery checkpoint

| Step | Topic | Status | Commit |
| --- | --- | --- | --- |
| 1 | Bestandsanalyse | COMPLETE | — |
| 2 | Implementierung + Regressionstests | COMPLETE | d9598c2 |
| 3 | Build and targeted validation | COMPLETE | d9598c2 |

## Verified findings

- `src/lib/anonymize.ts` previously replaced every two-word sequence beginning
  with two capitalized words.
- This matched role/skill phrases before `/api/profile` could parse the CV,
  leaving no usable roles or skills in affected CVs.
- The fix keeps title/name masking and makes the generic replacement preserve
  two-word phrases containing recognized job-relevant terms.
- No API contract, upload path, persistence, or dependency changed.

## AI / privacy / data-flow assessment

- Privacy impact: positive. Ordinary names remain replaced with `[NAME]`.
- Data-flow impact: positive and limited. Job-relevant CV text now survives
  the client-side anonymization step and can be parsed into the existing
  profile flow; no new destination or data category was introduced.
- AI impact: positive and limited. The existing profile/matching AI receives
  usable role and skill text instead of anonymization placeholders. No prompt,
  model, provider, or API behavior changed.
- No secrets or personal CV content were added to source control or reports.

## Validation

Verified results: targeted test 3 passed; full suite 845 passed and 5
skipped; build passed; all `api/**/*.mjs` syntax checks passed; `git diff
--check` passed. No deployment performed.

## Git state

- Branch: `fix/cv-anonymizer-role-phrases`
- Fix commit: `d9598c2`
- Existing unrelated untracked files were preserved and not modified.
- Changed by this task: `src/lib/anonymize.ts`,
  `src/lib/anonymize.test.ts`, `docs/AI_AUDITLOG.md`,
  `docs/CHANGELOG.md`, this report.
