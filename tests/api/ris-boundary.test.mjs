// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SCANNED_ROOT = ["src", "api"];
const CODE_EXT = /\.(ts|tsx|mjs|js)$/;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else if (CODE_EXT.test(entry)) out.push(full);
  }
  return out;
}

function files() {
  return SCANNED_ROOT.flatMap((root) => walk(join(ROOT, root))).map((file) => ({
    path: relative(ROOT, file).replace(/\\/g, "/"),
    content: readFileSync(file, "utf8"),
  }));
}

describe("Mays-RIS boundary (static proof)", () => {
  it("imports no RIS repository code and no AWS SDK", () => {
    for (const file of files()) {
      expect(file.content, file.path).not.toMatch(/@aws-sdk|aws-sdk/);
      expect(file.content, file.path).not.toMatch(/Mays-Recruiting|partner-applications|apiprofiles/);
      expect(file.content, file.path).not.toMatch(/dynamodb/i);
    }
  });

  it("contains no hardcoded RIS execute-api endpoint", () => {
    for (const file of files()) {
      expect(file.content, file.path).not.toMatch(/execute-api\.[a-z0-9-]+\.amazonaws\.com/i);
      if (file.path.startsWith("src/")) {
        expect(file.content, file.path).not.toMatch(/RIS_API_BASE_URL|RIS_PARTNER_CREDENTIAL/);
      }
    }
  });

  it("keeps the partner credential server-side only", () => {
    for (const file of files()) {
      const isServerRis = file.path.startsWith("api/_lib/ris/") || file.path.startsWith("api/ris/");
      const credentialUse = /RIS_PARTNER_CREDENTIAL|X-Api-Credential/.test(file.content);
      if (credentialUse) {
        expect(isServerRis, `${file.path} must not reference the RIS credential`).toBe(true);
      }
    }
  });

  it("has exactly one browser-facing RIS egress path", () => {
    const client = files().find((file) => file.path === "src/lib/applications/risRemoteRepository.ts");
    expect(client).toBeTruthy();
    expect(client.content).toContain('const DEFAULT_BASE_URL = "/api/ris/applications"');
    expect(client.content).not.toMatch(/https?:\/\//);
  });

  it("documents that RIS is external in AGENTS.md", () => {
    const agents = readFileSync(join(ROOT, "AGENTS.md"), "utf8");
    expect(agents).toContain("Mays-RIS is a separately operated external service");
    expect(agents).toContain("Never inspect, read, clone, or modify the Mays-RIS repository");
  });
});
