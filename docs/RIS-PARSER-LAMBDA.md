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

## Artifact build (deterministic)

The artifact is built by the RIS tooling from the pinned jobsearch commit, not
by `Compress-Archive` (which embeds timestamps):

```powershell
python tools/build_analysis_parser_artifact.py `
  --jobsearch-root <jobsearch> --expected-commit c40bf78 `
  --canvas-platform-dir "@napi-rs/canvas-linux-arm64-gnu=<extracted>" `
  --out lambda/dist/analysis-parser.zip
```

- Fixed entry timestamps and sorted names make the zip byte-reproducible.
- Includes `lambda/ris_parser_handler.mjs`, `scripts/ris-parser-cli.mjs`,
  `api/_lib/**` and `node_modules/pdfjs-dist/**` (no `web/`, no maps, no tests).
- `pdfjs-dist` needs the native optional dependency `@napi-rs/canvas`. The
  Lambda is `linux-arm64`, so `@napi-rs/canvas-linux-arm64-gnu@1.0.6` (the
  version pinned in `package-lock.json`) is packaged. Local verification adds
  the host package only to an extracted staging copy.
- The manifest (sidecar `.manifest.json`) records SHA-256, size, file count and
  source commit; Terraform pins the zip through `filebase64sha256`.

Built reference: 412 files, 17 937 176 bytes, SHA-256
`fb741fb25e7cd29232a43a63137a6e2a8ca0e948cc2efdf6764b8779119f301a`
(jobsearch `c40bf78`).

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
