# MAYS-CV-CONTEXT-AND-ANONYMIZATION-02 — Execution Log

- Status: COMPLETE — targeted validation green; full validation pending
- Date: 2026-10-30
- Branch: `main`
- HEAD at audit start: `8456b1d`
- Scope: stale asynchronous CV workflow protection and apostrophe-aware name masking.

## Document-context finding

- `CvDocument` carries an explicit ID and `File`; processing starts from the
  selected document and `extractPdfText(doc.file)`.
- Before this fix, an asynchronous extraction/hash/model continuation had no
  operation identity. Changing selection, removing a document, or closing the
  workflow could leave the old continuation able to set `profile-ready` for a
  newer/closed context.
- The file dialog itself only reports a confirmed browser `File`; opening it
  does not replace the active document until the upload callback runs.

## Fix

- `cvOperationRef` assigns each processing run a document-scoped operation token.
- Late results after extraction, hashing, fallback/model completion, or errors
  are ignored when the token is no longer current.
- Upload, document selection, removal, and workflow close invalidate the old
  operation. Closing a processing overlay therefore cannot resurrect it later.
- No second state/store or persistence path was introduced.

## Apostrophe finding and fix

- Existing mixed-case name patterns did not match `May's`, `May’s`, `O'Connor`,
  or `O’Connor`.
- Added Unicode-aware apostrophe name patterns for those forms.
- `May's Job Matcher` and `May’s Job Matcher` are explicitly protected as the
  product name. The modal `May` and month-like text are not globally replaced.
- Name matching remains heuristic and does not claim complete anonymity.

## Regression coverage

- Synthetic name tests cover straight/typographic apostrophes, inner-
  apostrophe names, product-name negatives, modal/month negative, and existing
  all-caps/mixed-case behavior.
- Existing App/CV workflow tests cover selection, consent, close, and saved
  profile paths. The operation-token race path is guarded in code but browser
  timing verification is not yet executed.
- `MAYS-CV-SELECTION-03` App regression uses synthetic A/B text, starts B after
  A remains in the list, and asserts the intercepted `createProfile` payload
  contains only B's text.

## Verification

- `npx vitest run src/lib/anonymize.test.ts src/lib/skills.test.ts` — PASS (16)
- `npm test -- --run` — PASS (859 passed, 5 skipped)
- `npm run build` — PASS
- All API syntax checks — PASS
- `git diff --check` — PASS
- Browser Chromium/Firefox workflow with synthetic PDFs: NOT VERIFIED in this
  correction step; no real CV/provider data used.

## Privacy / AI assessment

- No new destination, API, storage, model, provider, or persistence flow.
- Anonymization occurs at the existing pre-model boundary; stale operations
  are ignored before their result is rendered or bound to a profile.

## Resume point

- Run full suite, update this report/audit entry with final counts, then commit
  only scoped files. Do not push or deploy.
