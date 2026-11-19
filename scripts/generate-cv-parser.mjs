import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Keep the server artifact byte-for-byte derived from the frontend parser
// source. The generated file is committed because serverless functions cannot
// execute TypeScript directly.
const root = process.cwd();
const input = "src/lib/cvBuilder/pdfImport.ts";
const output = "api/_lib/analysis/cvParser.mjs";
const bin = process.platform === "win32"
  ? join(root, "node_modules", ".bin", "rolldown.cmd")
  : join(root, "node_modules", ".bin", "rolldown");
const tempDir = mkdtempSync(join(tmpdir(), "mays-cv-parser-"));
const tempOutput = join(tempDir, "cvParser.mjs");
const header = [
  "// Generated from src/lib/cvBuilder/pdfImport.ts, documentStructure.ts and contractTypes.ts.",
  "// Do not hand-edit; source files remain the source of truth.",
  "",
].join("\n");

try {
  execFileSync(bin, [
    input,
    "-f", "esm",
    "-p", "node",
    "-o", tempOutput,
    "--no-codeSplitting",
  ], { cwd: root, stdio: "inherit" });
  writeFileSync(join(root, output), header + readFileSync(tempOutput, "utf8"));
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
