# MAYS-CV-ANONYMIZATION-03 — Execution Log

- Status: COMPLETE — full validation green; browser PDF matrix NOT VERIFIED
- Date: 2026-10-30
- Branch: `main`
- HEAD at audit start: `31ba99c`
- Scope: contact-data masking and reduction of technical/period overmasking in the existing local anonymization path.

## Data path and findings

`extractPdfText` → `anonymizeText` → normalized text/hash → `createProfile` request.

- Preview and request use the same `processedText`/`normalized` value in
  `createProfileFromPdf`; the model boundary is after local anonymization.
- The phone regex `/\+?\d[\d\s\-()]{8,}\d/` treated year ranges such as
  `2023–2025` as long numeric strings. The date-range protection now runs
  before phone matching and restores the original range.
- The broad two-capitalized-word name heuristic could mask technical headings
  and qualifications. Targeted role/qualification phrase protection now runs
  before the heuristic; it is not presented as complete anonymity or an
  exhaustive technology allowlist.
- Email detection now accepts PDF whitespace around `@` and dots while still
  requiring an email-shaped domain. German street/address blocks are masked
  only when a street suffix, house number, PLZ, and city structure are present.

## Synthetic comparison matrix

| Synthetic original | Previous failure shape | Expected/current result | Rule |
|---|---|---|---|
| `bewerbung.test @ example.com` | local/domain fragments remained | `[E-MAIL]` | whitespace-tolerant email pattern |
| `Beispielstraße 12b\n12345 Musterstadt` | PLZ/city remained | `[ADRESSE]` | German street/PLZ block |
| `2023–2025 Senior Software Architect` | `[TELEFON] Senior [NAME]` | date and role retained | protected date range + protected role phrase |
| `AWS Solutions Architect – Associate` | possible `[NAME] – Associate` | full qualification retained | phrase protection, punctuation preserved |
| `Full-Stack Developer` / `Event-Driven Architecture` | suffix could become `[NAME]` | full technical phrases retained | phrase protection |
| `May's Job Matcher` / `May’s Job Matcher` | apostrophe name false positive | product phrase retained | protected product phrase |

The reference PDF supplied in the task is not present in the checkout and was
not copied into fixtures, logs, screenshots, or payloads. The matrix uses only
synthetic, structurally equivalent values.

## Regression and integration evidence

- Synthetic App privacy-boundary test verifies the actual `createProfile`
  payload, including spaced email/address masking and technical-term retention.
- Synthetic document A/B test verifies the request contains only the selected
  document B text.
- `src/lib/anonymize.test.ts` covers contact variants, date ranges, names,
  apostrophes, product negative, and technical negatives.

## Validation

- `npm test -- --run` — PASS (862 passed, 5 skipped)
- `npm run build` — PASS
- All API syntax checks — PASS
- `git diff --check` — PASS
- Browser Chromium/Firefox PDF preview and request interception: NOT VERIFIED
- Online production behavior: NOT VERIFIED/NOT DEPLOYED in this task

## Boundaries

- Address formats outside the supported German street/PLZ pattern may remain
  unmasked; no complete PII guarantee is made.
- Name detection remains heuristic. Ambiguous names, employer names, public
  project names, and locations follow the existing mask scope and are not
  globally classified as personal names.
- No new storage, API, model, provider, consent, selection, hash, or search
  behavior was introduced.

## Resume point

- Commit scoped changes only. No push/deployment in this task.
