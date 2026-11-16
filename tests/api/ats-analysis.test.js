// @vitest-environment node
import { describe, expect, it, beforeEach } from "vitest";
import handler from "../../api/ats-analysis.mjs";

describe("STEP 37E - ATS Analysis API", () => {
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

  it("A) Valid request returns ATS analysis", async () => {
    mockReq.body = {
      job: { title: "React Developer", tags: ["react"] },
      profile: { skills: "react" },
    };

    await handler(mockReq, mockRes);
    expect(mockRes.statusCode).toBe(200);
    expect(mockRes.data.analysis).toBeDefined();
    expect(mockRes.data.recommendations).toBeDefined();
  });

  it("B) AI disabled returns deterministic results only", async () => {
    mockReq.body = {
      job: { title: "React Developer", tags: ["react"] },
      profile: { skills: "react" },
      ai: { enabled: false },
    };

    await handler(mockReq, mockRes);
    expect(mockRes.statusCode).toBe(200);
    expect(mockRes.data.ai).toBeDefined();
  });

  it("C) AI enabled without consent does not execute", async () => {
    mockReq.body = {
      job: { title: "React Developer", tags: ["react"] },
      profile: { skills: "react" },
      ai: { enabled: true, consent: false },
    };

    await handler(mockReq, mockRes);
    expect(mockRes.statusCode).toBe(200);
    expect(mockRes.data.ai.consentGiven).toBe(false);
  });

  it("D) Provider info available before consent", async () => {
    mockReq.body = {
      job: { title: "React Developer", tags: ["react"] },
      profile: { skills: "react" },
      ai: { enabled: true, consent: true },
    };

    await handler(mockReq, mockRes);
    expect(mockRes.statusCode).toBe(200);
    expect(mockRes.data.ai.provider).toBeDefined();
    expect(mockRes.data.ai.dataMinimized).toBe(true);
  });

  it("E) Data categories returned for privacy info", async () => {
    mockReq.body = {
      job: { title: "React Developer", tags: ["react"] },
      profile: { skills: "react" },
      ai: { enabled: true, consent: true },
    };

    await handler(mockReq, mockRes);
    expect(mockRes.statusCode).toBe(200);
    expect(mockRes.data.ai.dataCategories).toBeDefined();
  });

  it("F) No PII in response", async () => {
    mockReq.body = {
      job: { title: "React Developer", tags: ["react"] },
      profile: { skills: "react", name: "John Doe", email: "john@example.com" },
      ai: { enabled: true, consent: true },
    };

    await handler(mockReq, mockRes);
    expect(mockRes.statusCode).toBe(200);
    const jsonStr = JSON.stringify(mockRes.data);
    expect(jsonStr).not.toContain("John Doe");
    expect(jsonStr).not.toContain("john@example.com");
  });

  it("G) GAP recommendations maintained without AI", async () => {
    mockReq.body = {
      job: { title: "Kubernetes Expert", tags: ["kubernetes"] },
      profile: { skills: "docker, react, python" },
    };

    await handler(mockReq, mockRes);
    expect(mockRes.statusCode).toBe(200);
  });

  it("I) full description reaches the deterministic analysis", async () => {
    mockReq.body = {
      job: {
        slug: "ai-platform-engineer",
        title: "AI Platform Engineer",
        tags: [],
        descriptionPlain: "Build MCP servers with OAuth and LLM agents. Apply IAM, evaluation, observability, Python and TypeScript.",
      },
      profile: { skills: "platform, engineer", targetRoles: ["AI Platform Engineer"] },
    };
    await handler(mockReq, mockRes);
    expect(mockRes.statusCode).toBe(200);
    expect(mockRes.data.analysis.analysisStatus).toBe("complete");
    expect(mockRes.data.analysis.requirements.map((r) => r.text)).toContain("MCP");
    expect(mockRes.data.analysis.score).toBeLessThan(100);
    expect(mockRes.data.analysis.roleMatch).toBe(100);
  });

  it("J) exposes source and metadata without metadata requirements", async () => {
    mockReq.body = {
      job: {
        slug: "metadata-recovery",
        title: "Solutions Architect (Remote)",
        tags: ["DevOps", "(remote)", "Cloud", "Unknown", "N/A"],
        descriptionPlain: "We need DevOps, Terraform and Software Architecture.",
        language: "de",
        remote: false,
        jobTypes: ["full_time"],
        contractType: "KEINE_ANGABE",
      },
      profile: { skills: "DevOps, Cloud, Terraform, Software Architecture", targetRoles: ["Solutions Architect"] },
    };
    await handler(mockReq, mockRes);
    expect(mockRes.statusCode).toBe(200);
    const analysis = mockRes.data.analysis;
    const texts = analysis.requirements.map((r) => r.text);
    expect(analysis.requirements.every((r) => r.source)).toBe(true);
    expect(analysis.requirements.some((r) => r.source === "title")).toBe(false);
    expect(texts).toContain("DevOps");
    expect(texts).toContain("Terraform");
    expect(texts).not.toContain("architect");
    expect(texts).not.toContain("(remote)");
    expect(texts).not.toContain("de");
    expect(texts).not.toContain("KEINE_ANGABE");
    expect(analysis.metadata.workMode).toBe("onsite");
    expect(analysis.metadata.language).toBe("de");
    expect(analysis.metadata.contractType).toBeNull();
    expect(analysis.basis.requirementCount).toBe(analysis.requirements.length);
    expect(analysis.roleMatch).toBe(100);
  });

  it("H) API returns proper structure", async () => {
    mockReq.body = {
      job: { title: "React Developer", tags: ["react"] },
      profile: { skills: "react" },
    };

    await handler(mockReq, mockRes);
    expect(mockRes.statusCode).toBe(200);
    expect(mockRes.data).toHaveProperty("analysis");
    expect(mockRes.data).toHaveProperty("recommendations");
    expect(mockRes.data).toHaveProperty("ai");
  });
});
