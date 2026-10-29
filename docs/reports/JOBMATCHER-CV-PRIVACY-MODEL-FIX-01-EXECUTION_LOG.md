# JOBMATCHER-CV-PRIVACY-MODEL-FIX-01 — Execution Log

- Status: COMPLETE — GREEN for scoped changes; YELLOW only for unrelated pre-existing untracked workspace files
- Date: 2026-10-29
- Branch: `main`
- HEAD at audit start: `19e7a04 docs: record CV anonymizer review`
- Current HEAD at last committed validation: `76725a5 docs: record final audit commit`
- Current Git status: scoped files committed and pushed; unrelated untracked files remain and are intentionally not staged.
- Scope: verify that CV filenames are not sent to the model, protect the server-side CV profile cache key, and make model fallback retry transient/model-response failures.

## Findings

- The PDF file itself and `file.name` are not included in the `createProfile` request body. The filename is used only for local UI display.
- In anonymized mode, extracted text is passed through `anonymizeText` before `POST /api/profile`.
- The server previously trusted a client-provided hash for Redis cache reads. The server now derives the cache key from the received text and only logs a mismatched client hash.
- The frontend previously treated `timeout`, `network_error`, and `bad_ai_response` as non-fallback errors. These are now retryable model failures; provider/auth/quota errors remain non-fallback.
- A retry can send the same CV text to up to three model attempts and may cross from OpenRouter to EdenAI. This applies to anonymized text and to deliberately non-anonymized text.

## Validation

- `npx vitest run src/api.test.ts src/lib/anonymize.test.ts src/App.test.tsx` — PASS (111 tests)
- `node --check api/profile.mjs` — PASS
- `git diff --check` — PASS
- API profile-cache regression `npx vitest run tests/api/profile-cache.test.mjs` — PASS (5 tests, including client-hash mismatch isolation)
- `npx vitest run tests/api/profile-cache.test.mjs src/api.test.ts` — PASS (18 tests)
- Updated full suite result after audit corrections: `npm test -- --run` — PASS (847 passed, 5 skipped)
- Updated `npm run build` — PASS
- Updated all API syntax checks — PASS
- `npm test -- --run` — PASS (846 passed, 5 skipped)
- `npm run build` — PASS (`tsc -b` + Vite build)
- `find api -name '*.mjs' -print0 | xargs -0 -n1 node --check` — PASS
- `git diff --check` — PASS

## AI / privacy / data-flow assessment

- Privacy impact: positive. Cache reads can no longer be selected by an unrelated client-supplied hash; filenames remain local-only.
- AI impact: positive. A failed model request can retry with another available model without changing the selected model permanently.
- No new destination, dependency, secret, or raw-CV persistence was introduced.
- Terraform checks: not applicable; this repository contains no Terraform changes for this task.

## Changed files

- `src/api.ts`
- `src/api.test.ts`
- `api/profile.mjs`
- `tests/api/profile-cache.test.mjs`
- `docs/ARCHITECTURE.md`
- this execution log
- `docs/AI_AUDITLOG.md`
- `docs/ARCHITECTURE.md`
- `AGENTS.md`
- `docs/COMPONENT_GUIDE.md`
- `docs/CHANGELOG.md`

## Open questions / risks

- The explicit “not anonymized” option still intentionally sends extracted names in the text. If names must never reach a provider, that option needs a separate product decision.
- The anonymizer remains heuristic for unusual PII formats.
- Unrelated untracked files remain in the workspace (privacy drafts, Cognito notes/assets, and `main.tsx`); they were intentionally not included in this fix.

## Resume point

- Resume point: none. Audit corrections are on `main` and `origin/main`; no deployment was performed.
