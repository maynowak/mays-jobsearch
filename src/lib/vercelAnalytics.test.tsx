import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@vercel/analytics/react", () => ({
  Analytics: () => <div data-testid="vercel-analytics" />,
}));

import { VercelAnalytics, isVercelAnalyticsEnabled } from "./vercelAnalytics";

afterEach(() => cleanup());

describe("JM-VERCEL-ANALYTICS-01", () => {
  it("does not render or transmit when the activation flag is disabled", () => {
    render(<VercelAnalytics enabled={false} />);
    expect(screen.queryByTestId("vercel-analytics")).toBeNull();
  });

  it("renders exactly one Analytics instance when explicitly enabled", () => {
    render(<VercelAnalytics enabled />);
    expect(screen.getAllByTestId("vercel-analytics")).toHaveLength(1);
  });

  it("is disabled by default without an explicit build flag", () => {
    expect(isVercelAnalyticsEnabled()).toBe(false);
  });

  it("mounts one Analytics component in the central entry point only", () => {
    const main = readFileSync(resolve(process.cwd(), "src/main.tsx"), "utf8");
    expect(main.match(/<VercelAnalytics\s*\/>/g)).toHaveLength(1);
    expect(main).toContain('from "./lib/vercelAnalytics"');
  });

  it("contains no custom tracking calls or CV/profile payloads", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/vercelAnalytics.tsx"), "utf8");
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/\btrack\s*\(/);
    expect(code).not.toMatch(/cv|profile|application|email|token/i);
    expect(code).toContain("<Analytics />");
  });
});
