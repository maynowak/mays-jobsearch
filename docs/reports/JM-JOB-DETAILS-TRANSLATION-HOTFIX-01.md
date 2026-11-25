# JM-JOB-DETAILS-TRANSLATION-HOTFIX-01

**Status: READY FOR HOTFIX RELEASE APPROVAL**

- Repository: `maynowak/mays-jobsearch`
- Branch: `hotfix/jm-job-details-translation-01`
- Base: `origin/main` `b4157e5`
- PR: [#70](https://github.com/maynowak/mays-jobsearch/pull/70) (draft)
- No main merge, no production deployment, no RIS/AWS/Terraform/Cognito/consent change.

## 1. Cause

`parseTranslation()` in `api/job-details.mjs` attempted strict JSON parsing
only when it found a `{...}` slice. On any parse failure it returned the raw
model text, including the full wrapper:

```js
return text.slice(0, MAX_TRANSLATION_OUTPUT);
```

A malformed or truncated wrapper such as
`{"translation":"Er sagte: "Hallo"."}` therefore became visible as translation
text. The client rendered the API result directly through the sanitized HTML
path, so the wrapper was displayed instead of the original description.

## 2. Reproduced cases

Synthetic model outputs (no real AI call):

| Case | Before | After |
| --- | --- | --- |
| Valid JSON | `Wir suchen ...` | `Wir suchen ...` |
| Escaped quotes | `Er sagte: "Hallo".` | `Er sagte: "Hallo".` |
| Malformed inner quotes `{"translation":"Er sagte: "Hallo"."}` | raw wrapper visible | `Er sagte: "Hallo".` |
| Unescaped newline | raw/parse failure | `Zeile 1\nZeile 2` |
| Truncated `{"translation":"Hallo` | raw wrapper visible | `""` → 502, original remains |
| Truncated but complete string `{"translation":"Hallo"` | raw wrapper | `Hallo` |
| Double-encoded JSON | wrapper visible | inner translation |
| Plain text | plain text | plain text |
| Empty / invalid object | empty / wrapper | `""` → 502 |
| >30k translation | silently truncated | `""` → 502 (no silent truncation) |

## 3. Changes

### Server — `api/job-details.mjs`

- Strict JSON parse first (including fenced JSON).
- Bounded extraction of a clearly recognizable `translation` wrapper only.
- Escape recovery limited to `\n`, `\r`, `\t`, `\"`, `\\`, `\uXXXX`; no general
  JSON repair.
- Last unescaped quote before the closing brace handles malformed inner
  quotes and unescaped newlines.
- Double-encoded JSON handled with a depth limit of 2.
- Truncated/unusable wrappers return `""` and the handler returns
  `502 bad_ai_response`; the original description remains with the client.
- Non-translation JSON objects / JSON-like arrays are rejected rather than
  rendered.
- Plain-text fallback only for answers that are not wrappers.
- Output length > `MAX_TRANSLATION_OUTPUT` fails instead of truncating.
- `parseTranslation` exported for direct regression tests.

### Client — `src/components/RemainingCard.tsx`

- Uses `normalizeTranslationForDisplay()` from `src/lib/translationText.ts`.
- Rejects empty or obviously unprocessed wrappers before setting the ready
  state; shows the existing translation error, keeps the original, and starts
  no second model request.
- Does not change valid translation text; translated HTML still goes through
  the existing `renderSanitizedHtml`/DOMPurify path.

### Tests

- `tests/api/job-translation.test.js`: parser variants, malformed quotes,
  newlines, truncation, double encoding, plain text, invalid object, oversized
  output, handler 200/502 behavior.
- `src/lib/translationText.test.ts`: wrapper guard, empty, legitimate JSON-like
  text later in a sentence.
- `src/components/RemainingCard.test.tsx`: wrapper error keeps original,
  translated HTML is sanitized and cannot execute.
- `tests/e2e/jm-job-details-translation-hotfix-01.mjs`: synthetic search with
  two remaining cards; first returns a wrapper → error + original; second
  returns clean/sanitized HTML → success; no unexpected calls, no browser
  errors.

## 4. Verification

| Check | Result |
| --- | --- |
| `npx tsc -b` | PASS |
| `npm run build` | PASS |
| Focused translation/security suites | **94 PASS** (5 files) |
| Browser translation hotfix E2E | PASS |
| Existing job display/security E2E | PASS |
| Full serial suite `npx vitest run --maxWorkers=1` | **2182 PASS / 5 skipped** (207 files) |
| `git diff --check` | PASS |
| Secret scan | clean |

Focused suites:
`tests/api/job-translation.test.js`, `tests/api/job-details.test.mjs`,
`src/components/RemainingCard.test.tsx`, `src/lib/translationText.test.ts`,
`src/lib/safeHtml.test.ts`.

The browser flow asserts:

- wrapper response → visible alert, original English text retained, no
  `{"translation"` string;
- clean response with `<img onerror>`/`<script>` → text rendered, no
  `img`/`script`, no `window.__xss`;
- only the two expected translation POSTs; no other API calls;
- no console/page errors.

## 5. HTML / security regression

- Translated content still uses `renderSanitizedHtml` (DOMPurify).
- The server parser does not inject HTML; it only extracts text.
- The client guard adds no HTML rendering path and no `dangerouslySetInnerHTML`
  outside the existing sanitizer.
- Script/style/event-handler payloads are stripped; the E2E checks the live DOM
  and `window.__xss`.
- No new model request on a rejected wrapper; the original description is
  preserved.

## 6. Before/after evidence

- `docs/reports/assets/JM-JOB-DETAILS-TRANSLATION-HOTFIX-01/before-translation-1440.png`
- `.../after-wrapper-error-1440.png`
- `.../after-clean-translation-1440.png`

The before screenshot shows the original English description before the
translation action. The wrapper-error screenshot shows the error state with the
original text still visible and no JSON wrapper. The clean screenshot shows the
sanitized German translation.

## 7. Known limitations

- The parser intentionally does not repair arbitrary broken JSON. If a wrapper
  cannot be unambiguously reconstructed, the API fails closed (502) instead of
  guessing.
- Malformed inner quotes are recoverable when the closing quote/brace remains
  recognizable; a severely corrupted string is rejected.
- The client guard recognises an obvious wrapper at the start of the string; it
  is a defense-in-depth layer, not a second full parser.
- Translations larger than 30,000 characters now fail rather than being
  silently shortened.
- No real provider call was made; all cases are synthetic.
- Full suite passed on the hotfix branch: 2182 PASS / 5 skipped (207 files).

## 8. Git

- Implementation commit: `21aa4bd`
- Documentation/audit commit: this commit
- Branch pushed: `hotfix/jm-job-details-translation-01`
- Draft PR: #70; no merge, no deployment.

`JM-JOB-DETAILS-TRANSLATION-HOTFIX-01 — READY FOR HOTFIX RELEASE APPROVAL`
