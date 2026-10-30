# MAYS-CV-ANONYMIZATION-04-R1 — Execution Log

- Status: COMPLETE — full validation green; browser PDF matrix NOT VERIFIED
- Date: 2026-10-30
- Branch: `main`
- HEAD at audit start: `31ba99c`
- Scope: repair overmasking of professional periods/technical content while retaining contact masking in the existing local anonymization path.

## Reference availability

The original three-page personal PDF from the report is not present in the
checkout and was not copied into fixtures, logs, screenshots, or payloads. The
provided masked output was not used to reconstruct missing text. A synthetic,
structurally equivalent CV fixture was used instead.

## Root causes

1. The phone pattern accepted long digit/space/hyphen sequences, so employment
   ranges such as `2023–2025` could be classified as `[TELEFON]`.
2. The global capitalized-pair name matcher treated arbitrary CV phrases such
   as `Computer Science`, `Software Development`, and role/qualification
   fragments as names. The resulting replacement was direct, not a later
   placeholder cascade.
3. The technical phrase protection list was incomplete, so hyphenated and
   certification phrases could expose the generic matcher to partial pairs.

## Fixes

- Protect date ranges before phone replacement; restore them unchanged.
- Replace the global name-pair rule with contextual signals: explicit name
  labels, first-header context, title names, apostrophe-name forms, and the
  existing protected product/role context.
- Extend targeted phrase protection for technical role/certification/heading
  structures, without claiming an exhaustive technology allowlist.
- Keep email/address masking and the existing pre-model payload path intact.

## Synthetic comparison matrix

| Original synthetic text | Prior failure class | Current expected result |
|---|---|---|
| `2023–2025 Senior Software Architect` | `[TELEFON]` / `[NAME]` | date and complete role retained |
| `10/2019–07/2020 AWS Cloud Practitioner` | phone/date or partial name | range and certification retained |
| `AWS Solutions Architect – Associate` | `AWS [NAME] Architect` | complete qualification retained |
| `Full-Stack Developer` | `Full-[NAME]`/suffix masking | complete role retained |
| `Event-Driven Architecture` | `Driven [NAME]` | complete architecture term retained |
| `Name: Ada Example` | name context | `[NAME]` |
| `Ada Example` in a technical paragraph | arbitrary pair | no global name replacement |
| `anna.test @ example.com` | email fragment | `[E-MAIL]` |
| `Beispielstraße 12b\n12345 Musterstadt` | address remainder | `[ADRESSE]` |

## Payload and integration evidence

The existing App privacy-boundary regression feeds synthetic contact data and
technical phrases through `extractPdfText` → `anonymizeText` → `createProfile`.
It asserts the model-bound payload contains placeholders, not synthetic
contact values, and retains technical phrases. Existing document A/B tests
assert the selected B payload excludes A's marker.

## Verification

- Targeted anonymizer/contact/payload tests — PASS
- `npm test -- --run` — PASS (862 passed, 5 skipped)
- `npm run build` — PASS
- All API syntax checks — PASS
- `git diff --check` — PASS
- Browser multi-page synthetic PDF + intercepted request: NOT VERIFIED
- Chromium/Firefox, DE/EN, 390/1440 runtime matrix: NOT VERIFIED
- Online production behavior: NOT VERIFIED; no deployment in this task

## Boundaries

- Anonymization remains heuristic; it is not full anonymity.
- Original personal reference PDF was not available locally and no personal
  values were logged or committed.
- Ambiguous real names without contextual signals may remain a limitation;
  arbitrary technical phrases are no longer globally classified as names.

## AI / privacy assessment

- No new external PII detector, model request, API, storage, or infrastructure.
- The anonymized text remains the only text passed to the existing profile model
  call when anonymization is selected.
