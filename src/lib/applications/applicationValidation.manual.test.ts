import { describe, expect, it } from "vitest";
import { createSessionApplication } from "./sessionApplications";
import type { ApplicationJobReferenceV1 } from "./contractTypes";

const NOW = "2026-11-04T10:00:00.000Z";

function create(job: ApplicationJobReferenceV1) {
  return createSessionApplication({
    localId: "local-manual",
    now: NOW,
    coverLetter: "",
    job,
  });
}

const manual: ApplicationJobReferenceV1 = {
  jobId: "manual:test-1",
  title: "Initiativbewerbung",
  companyName: "Unternehmen nicht angegeben",
  location: [],
  source: ["manual"],
  jobOrigin: "manual",
};

describe("manual ApplicationJobReferenceV1", () => {
  it("accepts a manual job without an original URL", () => {
    const application = create(manual);
    expect(application.job.jobOrigin).toBe("manual");
    expect(application.job.originalUrl).toBeUndefined();
    expect(application.job.source).toEqual(["manual"]);
  });

  it("accepts a manual job with a real URL", () => {
    const application = create({
      ...manual,
      originalUrl: "https://example.com/job/1",
    });
    expect(application.job.originalUrl).toBe("https://example.com/job/1");
    expect(application.job.jobOrigin).toBe("manual");
  });

  it("rejects an invalid manual URL", () => {
    expect(() => create({
      ...manual,
      originalUrl: "javascript:alert(1)",
    })).toThrowError(/Invalid URL/);
  });

  it("keeps the original URL required for imported source jobs", () => {
    const sourceJob: ApplicationJobReferenceV1 = {
      jobId: "job-1",
      title: "Engineer",
      companyName: "Example GmbH",
      location: ["Berlin"],
      source: ["arbeitnow"],
    };
    expect(() => create(sourceJob)).toThrowError(/originalUrl is required/);
  });
});
