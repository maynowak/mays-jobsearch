import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

function git(command: string): string | null {
  try {
    const out = execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return out || null;
  } catch {
    return null;
  }
}

export function buildInfo() {
  const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
  const appVersion = String(pkg.version);
  const appEnv = process.env.VERCEL_ENV ?? "development";
  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  const vercelRef = process.env.VERCEL_GIT_COMMIT_REF ?? null;
  const commitSha = (vercelSha ?? git("git rev-parse --short=7 HEAD") ?? "dev").slice(0, 7);
  const branch = vercelRef ?? git("git rev-parse --abbrev-ref HEAD") ?? "dev";

  return {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_ENV__: JSON.stringify(appEnv),
    __APP_COMMIT_SHA__: JSON.stringify(commitSha),
    __APP_BRANCH__: JSON.stringify(branch),
  };
}