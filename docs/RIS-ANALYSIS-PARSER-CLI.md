# RIS Analysis Parser CLI

**Contract:** RIS-AGENT-ANALYSIS-ORCHESTRATION-04
**Branch:** `feature/ris-analysis-parser-cli-04` (from `origin/main`)
**Status:** local verified; no deployment, no new endpoint.

The CLI is the Node execution boundary for the RIS Agent Body. It wraps the
**existing** Jobsearch parser implementation; it is not a second engine.

| Capability | Implementation | Input |
|---|---|---|
| `parse.cv` | `api/_lib/analysis/service.mjs::parseCvBuffer` (`pdf.mjs` + `cvParser.mjs`) | `{ pdfBase64 }` (PDF, ≤6 MiB stdin) |
| `parse.job` | `service.mjs::extractAtsRequirements` (`api/_lib/ats.mjs`) | `{ job, profile? }` |
| `parse.ats` | `service.mjs::analyzeAts` | `{ job, profile }` |

## Contract

```
node scripts/ris-parser-cli.mjs --capability parse.cv < input.json
```

Input: `{"input": <capability input>}`
Output: `{ schemaVersion, capability, parserVersion, data, confidence }`
Exit: `0` success, `2` invalid input/capability, `3` internal error.
Errors: `{schemaVersion, error:{code,message}}`.

`data` contains the requested tags and provenance:
- CV: `stableId` (PDF SHA-256), `cvTags`, `skills`, `experience`, `education`,
  `languages`, `location`, `confidence`, `sectionConfidence`, `document`.
- Job: `stableId` (canonical job SHA-256), `jobTags`, `requiredSkills`,
  `preferredSkills`, `experienceRequirements`, `workMode`, `location`.
- ATS: `atsTags`, `requirements`, `matches`, `criticalGaps`, `score`,
  `analysisStatus`.

No network, no AI provider, no file writes. `includePersonal` stays `false`,
so CV contact fields are not returned.

## Runtime

The Python Lambda has no Node runtime. The CLI is invoked by
`agents/parsers/node_adapter.py` only when `RIS_PARSER_CLI` and `node` are
available; otherwise the agent fails closed with `ParserUnavailable`.
Enabling the RIS parser agents is a separate, approved deployment step.

## Tests

```
npm run test:parsers
```

3 tests: job tags/stableId, CV PDF fixture (AWS/Terraform/TypeScript skills),
invalid capability/input exit codes.
