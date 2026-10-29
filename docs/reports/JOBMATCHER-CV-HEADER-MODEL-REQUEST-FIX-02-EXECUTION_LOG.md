# JOBMATCHER-CV-HEADER-MODEL-REQUEST-FIX-02 — Execution Log

- Status: COMPLETE — GREEN for scoped changes; unrelated untracked workspace files remain YELLOW
- Date: 2026-10-29
- Branch: `main`
- HEAD at audit start: `5014476 docs: sync final audit head`
- Scope: anonymize all-caps names in CV headers and avoid sending `response_format` to OpenRouter models that do not advertise structured-output support.

## Verified findings

- `MAY NOWAK · PROFESSIONAL CV` was not matched by the previous mixed-case name patterns and reached the anonymized model text unchanged.
- OpenRouter eligibility allowed free text models without structured-output support, while the provider still sent `response_format` for every JSON request. Such models can reject the request and surface as repeated `502 model_unavailable` fallback failures.
- The PDF filename remains UI-only; this fix does not add it to the model request.

## Changes

- Added a conservative all-caps header-name rule: an all-caps two-word pair is replaced only at a line/header start when followed by a visual separator.
- OpenRouter now sends `response_format` only when the selected model's live catalogue metadata advertises structured output. The JSON prompt/parser remains active for other models.
- Added regression tests for `MAY NOWAK` anonymization and unsupported OpenRouter structured output.

## AI / privacy / data-flow assessment

- Privacy impact: positive. The observed all-caps personal name is replaced before `POST /api/profile`.
- AI/data-flow impact: positive. The same selected model is now called with a compatible request shape; no new provider or destination is introduced. Existing model fallback behavior remains available.
- The all-caps rule is intentionally conservative to avoid masking ordinary labels such as `PROFESSIONAL CV`.

## Validation

- Targeted `npx vitest run src/lib/anonymize.test.ts tests/api/openrouter-provider.test.mjs` — PASS (10 tests)
- `node --check api/_lib/providers/openrouter.mjs` — PASS
- `git diff --check` — PASS
- `npm test -- --run` — PASS (849 passed, 5 skipped)
- `npm run build` — PASS (`tsc -b` + Vite build)
- `find api -name '*.mjs' -print0 | xargs -0 -n1 node --check` — PASS
- Terraform: not applicable; no Terraform files or changes are in scope.

## Git / workspace

- Current tracked changes: `src/lib/anonymize.ts`, `src/lib/anonymize.test.ts`, `api/_lib/providers/openrouter.mjs`, `tests/api/openrouter-provider.test.mjs`, this log, and `docs/AI_AUDITLOG.md`.
- Existing unrelated untracked files are preserved and will not be staged.

## Git status / resume point

- Current Git status before commit: scoped changes listed above; unrelated untracked files preserved and not staged.
- Resume point: commit and push `main`. No deployment.
