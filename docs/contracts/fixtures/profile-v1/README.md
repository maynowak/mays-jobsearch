# Profile Contract v1 Fixtures

All values are synthetic. These fixtures are documentation and contract-test
inputs; they are not application persistence and contain no real CV data.

## Valid fixtures

| File | Schema target |
|---|---|
| `profile.user-profile.json` | `UserProfileV1` |
| `profile.cv-document.json` | `CVDocumentV1` |
| `profile.cv-search-profile.json` | `CVSearchProfileV1` |
| `profile.ats-search-profile.json` | `ATSSearchProfileV1` |
| `profile.manual-search-profile.json` | `ManualSearchProfileV1` |
| `profile.roundtrip.json` | `SearchConfigurationV1` |
| `profile.hierarchy.complete.json` | fixture manifest; referenced resources validate independently |

Create/update/patch payload examples are provided by the `profile.create-*`,
`profile.update-*` and `profile.patch-*` fixtures and validate against the
corresponding `*InputV1` definitions in the schema bundle.

## Negative fixtures

| File | Expected result | Error class | Local verification |
|---|---|---|---|
| `profile.invalid-unknown-field.json` | schema rejection | `validation_error` | VERIFIED by JSON Schema |
| `profile.invalid-ats-criteria.json` | schema rejection | `validation_error` | VERIFIED by JSON Schema |
| `profile.invalid-parent.json` | schema-valid shape, backend rejection | `not_found` or `forbidden` | NOT locally verifiable; requires ownership/parent lookup |
| `profile.conflict-stale-version.json` | schema-valid update payload with `If-Match: 1`, backend rejection when stale | `conflict` | NOT locally verifiable; requires persisted version |

Syntactic JSON validity is not contract validity. The schema requires strict
objects, allowed enums, required fields, version fields and the restricted ATS
criteria shape. Parent existence, ownership, capacity and stale-version
behavior require a backend contract test and are not inferred from JSON Schema.
