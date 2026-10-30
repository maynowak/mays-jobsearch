# MAYS-CV-ANONYMIZATION-04-R2 — Execution Log

- Status: COMPLETE — full validation green; browser PDF matrix NOT VERIFIED
- Date: 2026-10-30
- Branch: `main`
- HEAD at audit start: `d663bd1`
- Scope: close remaining main-name, repeated-page-header, and explicit-author-name leaks without restoring the former global capitalized-pair overmasking.

## Reference availability

The personal three-page original PDF is not in the checkout. The supplied
masked output was not used to guess missing text. A structurally equivalent
synthetic fixture was used with a first-line name, repeated all-caps header, an
explicit `under the author name ...` context, and technical negatives.

## Cause

- The prior R1 context rule handled explicit labels and all-caps headers, but
  the mixed-case main name on the first line was not captured reliably because
  its line-boundary lookahead was anchored to the whole document.
- The author phrase had no contextual rule, so `under the author name ...`
  remained visible.
- The former global two-capitalized-word rule was intentionally not restored;
  that rule caused the reported technical overmasking.

## Fix

- Capture a plausible first-line full name and replace that exact full name at
  repeated occurrences using escaped, boundary-aware matching.
- Add explicit English/German author/pen-name contexts.
- Preserve the existing all-caps header, apostrophe, product-name, contact,
  date-range, and technical-phrase behavior.
- No isolated `May`/`Nowak` replacement and no global capitalized-pair rule.

## Synthetic before/after matrix

| Synthetic original | Prior/current gap | Expected result |
|---|---|---|
| `May Nowak` first line | main name leaked | `[NAME]` |
| `MAY NOWAK · PROFESSIONAL CV` repeated header | header rule already active | `[NAME] · PROFESSIONAL CV` |
| `under the author name Maymilly Nowak` | author name leaked | `under the author name [NAME]` |
| `Senior Software Architect` | must remain technical | unchanged |
| `Professional Training` | must remain heading | unchanged |
| `May's Job Matcher` | product, not person | unchanged |

## Verification

- `npx vitest run src/lib/anonymize.test.ts` — PASS (10 tests)
- `npm test -- --run` — PASS (863 passed, 5 skipped)
- `npm run build` — PASS
- All API syntax checks — PASS
- `git diff --check` — PASS
- Actual App model-boundary/payload test remains green and uses synthetic data.
- Browser Chromium/Firefox with the supplied multi-page original: NOT VERIFIED;
  original PDF unavailable locally and no personal file was used.
- Online deployment: not performed; online behavior not verified in this task.

## Boundaries

- Name detection remains heuristic. Names without first-line, label, title,
  apostrophe, or author-context evidence may remain a limitation.
- No complete anonymity claim; technical/public names and locations follow the
  existing documented mask scope.
- No API, storage, consent, model, or workflow change.
