# RIS Parser Library (shared, versioned)

**Contract:** RIS-JM-AGENT-STANDARDIZATION-01
**Library version:** `1.0.0`
**Module:** `api/_lib/parsers/ris.mjs`
**CLI adapter:** `scripts/ris-parser-cli.mjs`
**Status:** LOCAL VERIFIED · no deployment

The library is the single job/CV parsing implementation used by RIS agents.
It reuses the existing ATS requirement engine (`api/_lib/ats.mjs`) and adds no
second parser engine, no new npm dependency and no AI provider call.

## Capabilities

| Capability | Input | Output |
|---|---|---|
| `parse.job` | `{ job: { title, company, descriptionPlain, tags, location, remote, jobTypes, contractType, language } }` | stable ID, title/company/location, required/preferred requirements, skills, experience years, metadata, per-field confidence |
| `parse.cv` | `{ text }` | name/email/phone, skills, experienceLevel, targetRoles (`[]`), education, languages, experience entries, total years, per-field confidence |

Both return:

```json
{
  "schemaVersion": "1.0",
  "capability": "parse.cv",
  "parserVersion": "1.0.0",
  "data": { },
  "confidence": { }
}
```

`stableId` is a SHA-256 over normalized inputs, so re-parsing identical input
yields the identical ID.

## Determinism and safety

- No network, no file writes, no environment secrets.
- Input limit: 100,000 characters (CLI stdin limit 200,000 bytes).
- CV fields remain compatible with the existing job-search profile
  (`skills`, `experienceLevel`, `targetRoles`, `location`); education/
  experience and confidence are additive.
- No event emission. The library cannot trigger follow-up jobs, cost or data
  transfer.

## CLI adapter (cross-runtime)

```
echo '{"input":{"text":"..."}}' \
  | node scripts/ris-parser-cli.mjs --capability parse.cv
```

Exit codes: `0` success, `2` invalid input/capability, `3` internal error.
The CLI returns a JSON error object on failure.

The RIS agents call this adapter through `agents/parsers/node_adapter.py`
(configurable via `RIS_PARSER_CLI`, optional `RIS_PARSER_NODE`).

## Runtime note (PENDING)

AWS Lambda Python runtimes do not ship a Node binary. Production use therefore
requires one of:

1. **PENDING (recommended):** deploy the CLI as a small Node Lambda/container
   and let the Python agent invoke it over the internal API, or
2. **PENDING:** switch the two parser agents to a Node runtime, or
3. vendor a statically linked Node runtime into the RIS bundle.

Until one of these is approved, the parser agents are **LOCAL VERIFIED only**
and must not be enabled in ris-dev2. No new public HTTP endpoint is introduced
for this; an internal invocation path is required.

## Tests

```
node --test tests/parsers/ris-parser.test.mjs
```

6 tests: determinism, requirement split, CV fields, error cases, CLI exit
codes.

## Fixed pre-existing defect

`extractExperience` and `extractAgeRequirements` in `api/_lib/ats.mjs` used
non-global regexes inside `while (exec())` loops, which loops forever when the
text contains "years" or a degree word. Both patterns now use the `g` flag.
This also removes a hang risk from `POST /api/ats-analysis`.
