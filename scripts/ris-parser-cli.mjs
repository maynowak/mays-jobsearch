#!/usr/bin/env node
/**
 * RIS parser CLI — cross-runtime adapter for the shared parser library.
 *
 * Usage:
 *   node scripts/ris-parser-cli.mjs --capability parse.cv < input.json
 *   echo '{"input":{"text":"..."}}' | node scripts/ris-parser-cli.mjs --capability parse.cv
 *
 * Input (stdin, JSON): {"input": <capability input>}
 * Output (stdout, JSON): the parser result.
 * Exit: 0 success, 2 invalid input/capability, 3 internal error.
 *
 * No network, no file writes, no environment secrets.
 */
import { parse, ParserError, PARSER_LIBRARY_VERSION } from "../api/_lib/parsers/ris.mjs";

const MAX_STDIN_BYTES = 200000;

function fail(code, message) {
  process.stdout.write(JSON.stringify({
    error: { code, message },
    parserVersion: PARSER_LIBRARY_VERSION,
  }) + "\n");
  process.exit(code === "internal_error" ? 3 : 2);
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    let bytes = 0;
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      bytes += Buffer.byteLength(chunk, "utf8");
      if (bytes > MAX_STDIN_BYTES) {
        reject(new ParserError("too_large", "stdin exceeds the size limit"));
        process.stdin.destroy();
        return;
      }
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

async function main() {
  const index = process.argv.indexOf("--capability");
  const capability = index >= 0 ? process.argv[index + 1] : "";
  if (!capability) fail("invalid_input", "missing --capability");

  let raw;
  try {
    raw = await readStdin();
  } catch (err) {
    return fail(err.code || "invalid_input", err.message);
  }
  let payload;
  try {
    payload = JSON.parse(raw || "{}");
  } catch {
    return fail("invalid_input", "stdin is not valid JSON");
  }

  try {
    const result = parse({ capability, input: payload.input });
    process.stdout.write(JSON.stringify(result) + "\n");
  } catch (err) {
    if (err instanceof ParserError) return fail(err.code, err.message);
    fail("internal_error", "parser failed");
  }
}

main();
