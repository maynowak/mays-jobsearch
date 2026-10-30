// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("../../api/_lib/sources/index.mjs", () => ({
  fetchAllJobs: vi.fn(async () => ({
    jobs: [],
    meta: {
      sources: { arbeitnow: 0 },
      sourceReasons: { jobspipe: "limit_reached" },
      disabledSources: ["greenhouse"],
      sourceDetails: [{ id: "greenhouse", enabled: false }],
      apify: { enabled: false, reason: "disabled" },
    },
  })),
}));

vi.mock("../../api/_lib/identity.mjs", () => ({
  anonymousIdentity: () => ({ sessionId: "test-session" }),
  sessionCookieHeader: () => "session=test",
}));

describe("GET /api/jobs public metadata boundary", () => {
  it("does not expose operational source diagnostics", async () => {
    const { default: handler } = await import("../../api/jobs.mjs");
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
    };

    await handler({ method: "GET", query: { skills: "aws" } }, response);

    const payload = response.json.mock.calls[0][0];
    expect(payload.meta.sources).toEqual({ arbeitnow: 0 });
    expect(payload.meta).not.toHaveProperty("sourceReasons");
    expect(payload.meta).not.toHaveProperty("disabledSources");
    expect(payload.meta).not.toHaveProperty("sourceDetails");
    expect(payload.meta).not.toHaveProperty("apify");
  });
});
