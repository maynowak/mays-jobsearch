# RIS Parser Lambda — Node Runtime (internal)

**Status:** code complete; AWS resources are Terraform-gated (plan only).
**Runtime:** `nodejs22.x` · **Handler:** `lambda/ris_parser_handler.handler`
**No public HTTP endpoint.** Invoked synchronously by the dedicated analysis
runtime.

## Handler contract

```
event  = { capability: "parse.cv"|"parse.job"|"parse.ats", input: {...} }
result = parser envelope, or { schemaVersion, error: { code, message } }
```

The handler reuses `scripts/ris-parser-cli.mjs::runParser` — the same code path
as the CLI and the Python adapter. No second parser.

## Artifact build (deterministic file list)

Package root = jobsearch repository root. Include:

```
lambda/ris_parser_handler.mjs
scripts/ris-parser-cli.mjs
api/_lib/analysis/*.mjs
api/_lib/analysis/handlers/*.mjs
api/_lib/ats.mjs
api/_lib/filter.mjs
api/_lib/matching.mjs
api/_lib/ai.mjs
api/_lib/config.mjs
api/_lib/model.mjs
api/_lib/models.mjs
api/_lib/providers/*
node_modules/pdfjs-dist/**        # CV PDF extraction
```

Build (Windows PowerShell, reproducible timestamp not enforced by the OS):

```powershell
Compress-Archive -Path <files> -DestinationPath lambda/dist/analysis-parser.zip -Force
Get-FileHash lambda/dist/analysis-parser.zip -Algorithm SHA256
```

Record the SHA-256 in the RIS release manifest and pass it to Terraform as
`analysis_parser_zip_sha256`. The artifact is not committed; it is rebuilt from
the pinned jobsearch commit (`aaa260c` + this branch head).

## Limits and errors

- Input limits are enforced by the shared parser: CV ≤6 MiB base64 stdin,
  job description ≤100000 chars, ATS ≤64 KiB upstream contract.
- Invalid input returns `{error:{code:"invalid_input"}}`; unsupported
  capability `unsupported_capability`; internal failure `internal_error`.
- Timeout is set by the caller (RIS adapter, default 15 s) and by the Lambda
  configuration (60 s maximum). No retries inside the handler.

## IAM

The parser Lambda gets its own dedicated role (no shared transport policy):
logs only. The analysis runtime role may invoke this function
(`lambda:InvokeFunction` on its ARN). Both roles are Terraform-gated behind
`enable_analysis_runtime` (default `false`), so the current plan remains
11/2/0.

## Tests

`npm run test:parsers` — 4 tests, including a direct handler invocation
(job parse + JSON error). The CV PDF fixture path is covered by the CLI test.
