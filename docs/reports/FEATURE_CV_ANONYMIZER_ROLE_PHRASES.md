# CV anonymizer role-phrase and model-boundary fix

## Goal

Ensure the selected anonymized CV mode transforms extracted text before the
`createProfile`/`POST /api/profile` model call. Preserve job-relevant phrases
such as `Machine Learning Engineer`, `Human Resources Specialist`, and
`Customer Success Manager`, while continuing to mask ordinary names.

## Recovery checkpoint

| Step | Topic | Status | Commit |
| --- | --- | --- | --- |
| 1 | Bestandsanalyse | COMPLETE | — |
| 2 | Implementierung + Regressionstests | COMPLETE | pending |
| 3 | Build and targeted validation | COMPLETE | pending |

## Verified findings

- The prior word allowlist preserved any capitalized pair containing terms such
  as `cloud` or `data`, which could let names such as `Cloud Schmidt` or `Data
  Müller` reach the model.
- The anonymizer now protects only explicit, complete role phrases before a
  Unicode-aware generic name matcher runs.
- `src/App.tsx` snapshots the selected anonymization mode before asynchronous
  PDF extraction and passes only the resulting text to `createProfile`.
- The App regression uploads/extracts a synthetic CV, verifies names are absent
  from the model-bound text, and verifies all three multi-word role phrases are
  retained.
- `/profil` is the authenticated UI route; CV extraction/profile AI uses the
  separate `POST /api/profile` endpoint. This change affects the latter flow,
  not the `/profil` route.
- No API contract, upload path, persistence, or dependency changed.

## AI / privacy / data-flow assessment

- Privacy impact: positive. Ordinary names, including Unicode names and
  ambiguous pairs such as `Cloud Schmidt`, remain replaced with `[NAME]`.
- Data-flow impact: positive and limited. The selected anonymized mode is now
  explicitly bound to the extracted text before the existing `POST /api/profile`
  flow; no new destination or data category was introduced.
- AI impact: positive and limited. The existing profile/matching AI receives
  usable role and skill text instead of anonymization placeholders. No prompt,
  model, provider, or API behavior changed.
- No secrets or personal CV content were added to source control or reports.

## Validation

Validation: targeted `src/lib/anonymize.test.ts` and `src/App.test.tsx` passed
(98 tests); full suite passed (845 passed, 5 skipped); `npm run build` passed;
all `api/**/*.mjs` syntax checks passed; `git diff --check` passed. No
deployment performed.

## Git state

- Branch: `fix/cv-anonymizer-role-phrases`
- Previous fix commit: `d9598c2`
- Final implementation commit: pending
- Existing unrelated untracked files were preserved and not modified.
- Changed by this task: `src/lib/anonymize.ts`,
  `src/lib/anonymize.test.ts`, `docs/AI_AUDITLOG.md`,
  `docs/CHANGELOG.md`, this report.
