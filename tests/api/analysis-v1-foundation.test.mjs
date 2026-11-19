// @vitest-environment node
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createSignedToken,
} from "../../api/_lib/analysis/security.mjs";
import atsRequirementsHandler from "../../api/_lib/analysis/handlers/atsRequirements.mjs";
import atsAnalyzeHandler from "../../api/_lib/analysis/handlers/atsAnalyze.mjs";
import matchHandler from "../../api/_lib/analysis/handlers/match.mjs";
import cvParseHandler from "../../api/_lib/analysis/handlers/cvParse.mjs";
import legacyAtsHandler from "../../api/ats-analysis.mjs";
import analysisRouter from "../../api/ats-analysis.mjs";

const serviceSecret = "test-analysis-service-secret";
const consentSecret = "test-analysis-consent-secret";
const issuer = "test-ris";
const audience = "test-jobsearch-analysis";
const tenantId = "tenant-1";
const subject = "service-agent-1";
const noticeVersion = "analysis-test-v1";
const now = Math.floor(Date.now() / 1000);

function serviceToken({ scopes = ["cv:parse", "ats:requirements", "ats:analyze", "match:evaluate"], tenant = tenantId, user = "user-1" } = {}) {
  return createSignedToken("service", {
    iss: issuer,
    aud: audience,
    sub: subject,
    tenantId: tenant,
    userId: user,
    scopes,
    iat: now,
    exp: now + 300,
    jti: `svc-${Math.random().toString(36).slice(2)}`,
  }, serviceSecret);
}

function consentToken({ tenant = tenantId, user = "user-1", purpose = "analysis", notice = noticeVersion } = {}) {
  return createSignedToken("consent", {
    iss: issuer,
    aud: audience,
    sub: subject,
    tenantId: tenant,
    userId: user,
    purpose,
    noticeVersion: notice,
    iat: now,
    exp: now + 300,
    jti: `consent-${Math.random().toString(36).slice(2)}`,
  }, consentSecret);
}

function request(body, { token = serviceToken(), consent = consentToken(), headers = {} } = {}) {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-schema-version": "1",
      "x-analysis-token": token,
      "x-analysis-consent": consent,
      ...headers,
    },
    body,
  };
}

function response() {
  const res = {
    statusCode: 0,
    body: null,
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return res;
}

function expectEnvelope(res, status) {
  expect(res.statusCode).toBe(status);
  expect(res.body.schemaVersion).toBe(1);
  expect(typeof res.body.requestId).toBe("string");
}

beforeEach(() => {
  process.env.ANALYSIS_API_ENABLED = "true";
  process.env.ANALYSIS_SERVICE_SECRET = serviceSecret;
  process.env.ANALYSIS_SERVICE_ISSUER = issuer;
  process.env.ANALYSIS_SERVICE_AUDIENCE = audience;
  process.env.ANALYSIS_CONSENT_SECRET = consentSecret;
  process.env.ANALYSIS_CONSENT_ISSUER = issuer;
  process.env.ANALYSIS_CONSENT_AUDIENCE = audience;
  process.env.ANALYSIS_CONSENT_NOTICE_VERSION = noticeVersion;
});

afterEach(() => {
  for (const key of [
    "ANALYSIS_API_ENABLED", "ANALYSIS_SERVICE_SECRET", "ANALYSIS_SERVICE_ISSUER",
    "ANALYSIS_SERVICE_AUDIENCE", "ANALYSIS_CONSENT_SECRET", "ANALYSIS_CONSENT_ISSUER",
    "ANALYSIS_CONSENT_AUDIENCE", "ANALYSIS_CONSENT_NOTICE_VERSION",
  ]) delete process.env[key];
});

const job = {
  slug: "job-1",
  title: "Cloud Engineer",
  company_name: "Example",
  tags: ["AWS", "Terraform"],
  descriptionPlain: "We need AWS, Terraform and Kubernetes experience.",
};

describe("analysis v1 service foundation", () => {
  it("rejects missing service credentials before request processing", async () => {
    const res = response();
    await atsRequirementsHandler(request({ schemaVersion: 1, job }, { token: "" }), res);
    expectEnvelope(res, 401);
    expect(res.body.error.code).toBe("unauthenticated");
  });

  it("rejects an invalid service token", async () => {
    const res = response();
    await atsRequirementsHandler(request({ schemaVersion: 1, job }, {
      token: `v1.${Buffer.from(JSON.stringify({ iss: "wrong", aud: audience })).toString("base64url")}.bad`,
    }), res);
    expectEnvelope(res, 401);
  });

  it("rejects a missing scope", async () => {
    const res = response();
    await atsAnalyzeHandler(request({ schemaVersion: 1, job }, {
      token: serviceToken({ scopes: ["ats:requirements"] }),
    }), res);
    expectEnvelope(res, 403);
    expect(res.body.error.code).toBe("forbidden");
  });

  it("rejects tenant spoofing", async () => {
    const res = response();
    await atsRequirementsHandler(request({
      schemaVersion: 1,
      tenantId: "tenant-2",
      job,
    }), res);
    expectEnvelope(res, 403);
    expect(res.body.error.code).toBe("tenant_mismatch");
  });

  it("requires verified analysis consent", async () => {
    const res = response();
    await atsRequirementsHandler(request({ schemaVersion: 1, job }, { consent: "" }), res);
    expectEnvelope(res, 403);
    expect(res.body.error.code).toBe("consent_required");
  });

  it("rejects an invalid consent notice", async () => {
    const res = response();
    await atsRequirementsHandler(request({ schemaVersion: 1, job }, {
      consent: consentToken({ notice: "other-notice" }),
    }), res);
    expectEnvelope(res, 403);
    expect(res.body.error.code).toBe("consent_required");
  });

  it("rejects unsupported schema versions", async () => {
    const res = response();
    await atsRequirementsHandler(request({ schemaVersion: 2, job }), res);
    expectEnvelope(res, 422);
    expect(res.body.error.code).toBe("schema_version_unsupported");
  });

  it("rejects invalid request bodies", async () => {
    const res = response();
    await atsRequirementsHandler(request({ schemaVersion: 1, job: { descriptionPlain: "no title" } }), res);
    expectEnvelope(res, 422);
    expect(res.body.error.code).toBe("validation_error");
  });

  it("enforces the JSON body limit", async () => {
    const res = response();
    await atsRequirementsHandler(request({
      schemaVersion: 1,
      job: { title: "x".repeat(70_000), descriptionPlain: "x" },
    }), res);
    expectEnvelope(res, 413);
    expect(res.body.error.code).toBe("payload_too_large");
  });

  it("returns deterministic ATS requirements", async () => {
    const res = response();
    await atsRequirementsHandler(request({ schemaVersion: 1, job, profile: { skills: "AWS" } }), res);
    expectEnvelope(res, 200);
    expect(res.body.data.requirements.some((item) => item.text === "AWS")).toBe(true);
  });

  it("returns the expanded job metadata and requirement priority through v1", async () => {
    const res = response();
    await atsRequirementsHandler(request({
      schemaVersion: 1,
      job: {
        ...job,
        company_name: "Example",
        location: ["Darmstadt"],
        remote: true,
        descriptionPlain: "You will design secure AWS platforms. AWS is required. Kubernetes is preferred.",
      },
    }), res);
    expectEnvelope(res, 200);
    expect(res.body.data.metadata.companyName).toBe("Example");
    expect(res.body.data.metadata.location).toEqual(["Darmstadt"]);
    expect(res.body.data.metadata.remote).toBe(true);
    expect(res.body.data.metadata.responsibilities).toContain("You will design secure AWS platforms.");
    expect(res.body.data.metadata.requiredSkills).toContain("AWS");
    expect(res.body.data.metadata.preferredSkills).toContain("Kubernetes");
    const aws = res.body.data.requirements.find((item) => item.normalized === "aws");
    expect(aws.priority).toBe("required");
    expect(aws.importance).toBe("high");
  });

  it("dispatches versioned endpoints through the single API function router", async () => {
    const res = response();
    await analysisRouter({
      ...request({ schemaVersion: 1, job, profile: { skills: "AWS" } }),
      query: { __analysis: "ats-requirements" },
    }, res);
    expectEnvelope(res, 200);
    expect(res.body.data.requirements.length).toBeGreaterThan(0);
  });

  it("returns deterministic ATS analysis without AI", async () => {
    const res = response();
    await atsAnalyzeHandler(request({ schemaVersion: 1, job, profile: { skills: "AWS, Terraform" } }), res);
    expectEnvelope(res, 200);
    expect(res.body.data.ai.executed).toBe(false);
    expect(res.body.data.analysis.requirements.length).toBeGreaterThan(0);
  });

  it("rejects malformed match jobs without calling the matching engine", async () => {
    const res = response();
    await matchHandler(request({ schemaVersion: 1, profile: { skills: "AWS" }, jobs: [] }), res);
    expectEnvelope(res, 422);
    expect(res.body.error.code).toBe("validation_error");
  });

  it("rejects PDF requests without the PDF content type", async () => {
    const res = response();
    await cvParseHandler({
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-schema-version": "1",
        "x-analysis-token": serviceToken({ scopes: ["cv:parse"] }),
        "x-analysis-consent": consentToken(),
      },
      body: Buffer.from("%PDF-test"),
    }, res);
    expectEnvelope(res, 415);
    expect(res.body.error.code).toBe("unsupported_media_type");
  });

  it("rejects an oversized PDF before parsing", async () => {
    const res = response();
    await cvParseHandler({
      method: "POST",
      headers: {
        "content-type": "application/pdf",
        "x-schema-version": "1",
        "x-analysis-token": serviceToken({ scopes: ["cv:parse"] }),
        "x-analysis-consent": consentToken(),
      },
      body: Buffer.alloc(4 * 1024 * 1024 + 1),
    }, res);
    expectEnvelope(res, 413);
    expect(res.body.error.code).toBe("payload_too_large");
  });

  it("routes every HTTP adapter through the shared analysis service", () => {
    for (const file of [
      "api/ats-analysis.mjs",
      "api/match.mjs",
      "api/_lib/analysis/handlers/cvParse.mjs",
      "api/_lib/analysis/handlers/atsRequirements.mjs",
      "api/_lib/analysis/handlers/atsAnalyze.mjs",
      "api/_lib/analysis/handlers/match.mjs",
    ]) {
      expect(readFileSync(file, "utf8")).toMatch(/service\.mjs/);
    }
  });

  it("uses the same ATS service for the legacy UI adapter and the versioned endpoint", async () => {
    const legacyRes = response();
    await legacyAtsHandler({
      method: "POST",
      body: { job, profile: { skills: "AWS, Terraform" } },
      headers: {},
    }, legacyRes);
    expect(legacyRes.statusCode).toBe(200);

    const versionedRes = response();
    await atsAnalyzeHandler(request({
      schemaVersion: 1,
      job,
      profile: { skills: "AWS, Terraform" },
    }), versionedRes);
    expect(versionedRes.statusCode).toBe(200);

    expect(versionedRes.body.data.analysis.score).toBe(legacyRes.body.analysis.score);
    expect(versionedRes.body.data.analysis.requirements).toEqual(
      legacyRes.body.analysis.requirements
    );
  });

  it("chains the CV parser result into ATS requirements and ATS analysis", async () => {
    const buffer = await readFile("tests/fixtures/cv/synthetic-cv.pdf");
    const parsedRes = response();
    await cvParseHandler({
      method: "POST",
      headers: {
        "content-type": "application/pdf",
        "x-schema-version": "1",
        "x-analysis-token": serviceToken({ scopes: ["cv:parse"] }),
        "x-analysis-consent": consentToken(),
      },
      body: buffer,
    }, parsedRes);
    expectEnvelope(parsedRes, 200);
    expect(Object.values(parsedRes.body.data.sectionConfidence).every(
      (value) => ["confirmed", "partial", "uncertain"].includes(value)
    )).toBe(true);

    const profile = {
      skills: parsedRes.body.data.draft.skills.join(", "),
      targetRoles: [parsedRes.body.data.draft.profile.headline].filter(Boolean),
    };
    const requirementsRes = response();
    await atsRequirementsHandler(request({ schemaVersion: 1, job, profile }), requirementsRes);
    expectEnvelope(requirementsRes, 200);
    expect(requirementsRes.body.data.requirements.length).toBeGreaterThan(0);

    const analysisRes = response();
    await atsAnalyzeHandler(request({ schemaVersion: 1, job, profile }), analysisRes);
    expectEnvelope(analysisRes, 200);
    expect(analysisRes.body.data.analysis.requirements.map((item) => item.id)).toEqual(
      requirementsRes.body.data.requirements.map((item) => item.id)
    );
  });

  it("returns ATS requirement objects with the RIS/ATS reusable contract fields", async () => {
    const res = response();
    await atsRequirementsHandler(request({ schemaVersion: 1, job, profile: { skills: "AWS" } }), res);
    expectEnvelope(res, 200);
    for (const requirement of res.body.data.requirements) {
      expect(typeof requirement.id).toBe("string");
      expect(typeof requirement.text).toBe("string");
      expect(typeof requirement.category).toBe("string");
      expect(["critical", "high", "medium", "low"]).toContain(requirement.importance);
      expect(["title", "tags", "description", "criteria"]).toContain(requirement.source);
    }
  });

  it("parses the synthetic CV without returning the raw PDF/text or personal data by default", async () => {
    const buffer = await readFile("tests/fixtures/cv/synthetic-cv.pdf");
    const res = response();
    await cvParseHandler({
      method: "POST",
      headers: {
        "content-type": "application/pdf",
        "x-schema-version": "1",
        "x-analysis-token": serviceToken({ scopes: ["cv:parse"] }),
        "x-analysis-consent": consentToken(),
      },
      body: buffer,
    }, res);
    expectEnvelope(res, 200);
    expect(res.body.data.document.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(res.body.data.draft.personal).toEqual({});
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("%PDF");
    expect(serialized).not.toContain("Synthetic Test CV");
  });
});
