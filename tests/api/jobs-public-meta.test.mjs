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
  SESSION_COOKIE: "mj_session",
  readCookie: () => undefined,
  clearSessionCookieHeader: () => "mj_session=; Path=/; Max-Age=0",
}));

import { fetchAllJobs } from "../../api/_lib/sources/index.mjs";

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

  it("logs no raw search values on an unexpected error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(fetchAllJobs).mockRejectedValueOnce(new Error("upstream failed"));
    const { default: handler } = await import("../../api/jobs.mjs");
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
    };

    await handler(
      {
        method: "GET",
        query: {
          skills: "secret-skill-value",
          targetRole: "secret-role-value",
          city: "secret-city-value",
          radiusKm: "25",
          workMode: "remote",
          employmentType: "full_time",
        },
      },
      response
    );

    expect(response.status).toHaveBeenCalledWith(500);
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).not.toContain("secret-skill-value");
    expect(logged).not.toContain("secret-role-value");
    expect(logged).not.toContain("secret-city-value");
    expect(logged).toContain("presentParams");
    errorSpy.mockRestore();
  });
});
