# MAYS-CV-ANONYMIZATION-04-R3 — Execution Log

- Status: COMPLETE — full validation green; browser PDF matrix NOT VERIFIED
- Date: 2026-10-30
- Branch: `main`
- HEAD at audit start: `c9716fd`
- Scope: close the repeated-header all-caps → mixed-case main-name leak while preserving R1/R2 technical-content and contact fixes.

## Cause

- The all-caps header rule replaced `MAY NOWAK` but discarded the candidate.
- The mixed-case first-line rule could identify a first-line name, but the real
  all-caps PDF header did not seed that context; the following `May Nowak` was
  therefore correctly left untouched by the anti-overmasking rules.
- The former global capitalized-pair matcher was intentionally not restored.

## Fix

- Collect full names from unchanged first-line and all-caps-header text before
  replacement.
- Replace all exact, case-insensitive, word-bounded occurrences of each known
  full name. Individual `May` or `Nowak` tokens are never replaced.
- Preserve explicit author context, apostrophes, product names, contacts,
  periods, document tokens, and technical phrase handling.

## Synthetic regression

```text
MAY NOWAK · PROFESSIONAL CV 1
May Nowak
Senior Software Architect
under the author name Maymilly Nowak.
```

Expected/current:

```text
[NAME] · PROFESSIONAL CV 1
[NAME]
Senior Software Architect
under the author name [NAME].
```

## Verification

- `npx vitest run src/lib/anonymize.test.ts` — PASS (11 tests)
- Actual App payload/document-context tests remain green and synthetic.
- `npm test -- --run` — PASS (864 passed, 5 skipped)
- `npm run build` — PASS
- All API syntax checks — PASS
- `git diff --check` — PASS
- Browser multi-page synthetic PDF with intercepted request: NOT VERIFIED
- Online deployment: not performed; online behavior not verified in this task.

## Boundaries

- Names without reliable header, label, title, apostrophe, or author context
  may remain undetected; complete anonymity is not claimed.
- No new API, storage, model, provider, or infrastructure behavior.
