// @vitest-environment node
import { describe, expect, it, beforeEach } from "vitest";
import handler from "../../api/cv-improvement.mjs";

describe("CV Improvement API", () => {
  let mockReq, mockRes;

  beforeEach(() => {
    mockReq = { method: "POST", body: null };
    mockRes = {
      status: (code) => ({
        json: (data) => {
          mockRes.statusCode = code;
          mockRes.data = data;
          return mockRes;
        },
      }),
      setHeader: () => {},
    };
  });

  it("A) Valid request returns improvement plan", async () => {
    mockReq.body = {
      job: { title: "React Developer", tags: ["react", "typescript"] },
      profile: { skills: "react, typescript, javascript" },
    };

    await handler(mockReq, mockRes);
    expect(mockRes.statusCode).toBe(200);
    expect(mockRes.data.improvement).toBeDefined();
    expect(mockRes.data.improvement.plan).toBeDefined();
    expect(mockRes.data.improvement.summary).toBeDefined();
    expect(mockRes.data.analysis).toBeDefined();
    expect(mockRes.data.meta).toBeDefined();
  });

  it("B) Returns proper structure with recommendations", async () => {
    mockReq.body = {
      job: { title: "React Developer", tags: ["react"] },
      profile: { skills: "react, javascript" },
    };

    await handler(mockReq, mockRes);
    expect(mockRes.statusCode).toBe(200);
    
    const plan = mockRes.data.improvement.plan;
    expect(Array.isArray(plan)).toBe(true);
    
    if (plan.length > 0) {
      const rec = plan[0];
      expect(rec).toHaveProperty("requirementId");
      expect(rec).toHaveProperty("changeType");
      expect(rec).toHaveProperty("changeTypeLabel");
      expect(rec).toHaveProperty("priority");
      expect(rec).toHaveProperty("priorityLabel");
      expect(rec).toHaveProperty("currentEvidence");
      expect(rec).toHaveProperty("proposedChange");
      expect(rec).toHaveProperty("rationale");
      expect(rec).toHaveProperty("safetyStatus");
      expect(rec).toHaveProperty("safetyStatusLabel");
    }
  });

  it("C) Summary contains correct counts", async () => {
    mockReq.body = {
      job: { title: "React Developer", tags: ["react", "node"] },
      profile: { skills: "react, javascript" },
    };

    await handler(mockReq, mockRes);
    expect(mockRes.statusCode).toBe(200);
    
    const summary = mockRes.data.improvement.summary;
    expect(summary).toHaveProperty("total");
    expect(summary).toHaveProperty("byType");
    expect(summary).toHaveProperty("byPriority");
    expect(summary).toHaveProperty("bySafety");
    expect(summary).toHaveProperty("actionable");
    expect(summary).toHaveProperty("requiresReview");
    expect(typeof summary.total).toBe("number");
    expect(typeof summary.actionable).toBe("number");
    expect(typeof summary.requiresReview).toBe("number");
  });

  it("D) Missing job returns 400", async () => {
    mockReq.body = {
      profile: { skills: "react" },
    };

    await handler(mockReq, mockRes);
    expect(mockRes.statusCode).toBe(400);
    expect(mockRes.data.code).toBe("bad_request");
  });

  it("E) Missing profile returns 400", async () => {
    mockReq.body = {
      job: { title: "React Developer" },
    };

    await handler(mockReq, mockRes);
    expect(mockRes.statusCode).toBe(400);
    expect(mockRes.data.code).toBe("bad_request");
  });

  it("F) Invalid method returns 405", async () => {
    mockReq.method = "GET";
    mockReq.body = {};

    await handler(mockReq, mockRes);
    expect(mockRes.statusCode).toBe(405);
    expect(mockRes.data.code).toBe("method");
  });

  it("G) Empty profile skills handled correctly", async () => {
    mockReq.body = {
      job: { title: "React Developer", tags: ["react"] },
      profile: { skills: "" },
    };

    await handler(mockReq, mockRes);
    expect(mockRes.statusCode).toBe(200);
    expect(mockRes.data.improvement).toBeDefined();
  });

  it("H) Response includes meta information", async () => {
    mockReq.body = {
      job: { title: "React Developer", tags: ["react"] },
      profile: { skills: "react" },
    };

    await handler(mockReq, mockRes);
    expect(mockRes.statusCode).toBe(200);
    expect(mockRes.data.meta).toBeDefined();
    expect(mockRes.data.meta.version).toBeDefined();
    expect(mockRes.data.meta.generatedAt).toBeDefined();
  });

  it("I) Analysis includes score and gaps", async () => {
    mockReq.body = {
      job: { title: "Kubernetes Expert", tags: ["kubernetes"] },
      profile: { skills: "docker, react" },
    };

    await handler(mockReq, mockRes);
    expect(mockRes.statusCode).toBe(200);
    expect(mockRes.data.analysis).toHaveProperty("score");
    expect(mockRes.data.analysis).toHaveProperty("keywordCoverage");
    expect(mockRes.data.analysis).toHaveProperty("criticalGaps");
    expect(mockRes.data.analysis).toHaveProperty("summary");
  });

  it("J) Recommendations have safety status", async () => {
    mockReq.body = {
      job: { title: "React Developer", tags: ["react", "kubernetes"] },
      profile: { skills: "react" },
    };

    await handler(mockReq, mockRes);
    expect(mockRes.statusCode).toBe(200);
    
    const plan = mockRes.data.improvement.plan;
    for (const rec of mockRes.data.improvement.plan) {
      expect(rec).toHaveProperty("safetyStatus");
      expect(rec).toHaveProperty("safetyStatusLabel");
      expect(rec.safetyStatus).toBeDefined();
    }
  });
});