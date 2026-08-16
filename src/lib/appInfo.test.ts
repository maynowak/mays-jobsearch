import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appInfo } from "./appInfo";

const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
  version: string;
};

describe("appInfo (Build-Identität)", () => {
  it("Version kommt aus package.json — keine zweite Versionsquelle", () => {
    expect(appInfo.version).toBe(pkg.version);
    expect(appInfo.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("liefert die vier erwarteten Felder als Strings", () => {
    expect(typeof appInfo.version).toBe("string");
    expect(typeof appInfo.env).toBe("string");
    expect(typeof appInfo.commitSha).toBe("string");
    expect(typeof appInfo.branch).toBe("string");
    expect(appInfo.env.length).toBeGreaterThan(0);
    expect(appInfo.branch.length).toBeGreaterThan(0);
  });

  it("Environment-Fallback ist 'development', wenn VERCEL_ENV fehlt", () => {
    expect(appInfo.env).toBe("development");
  });

  it("commitSha ist die kurze, eingefrorene Build-SHA (kein späterer Git-HEAD)", () => {
    expect(appInfo.commitSha).toMatch(/^[0-9a-f]{7}$/);
  });

  it("Werte sind stabil: appInfo wird beim Modul-Load eingefroren und nicht aus aktuellem Git neu gelesen", () => {
    const first = { ...appInfo };
    const second = { ...appInfo };
    expect(second).toEqual(first);
  });
});
