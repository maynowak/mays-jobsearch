import { describe, expect, it } from "vitest";
import {
  MANUAL_COMPANY_FALLBACK,
  MANUAL_TITLE_FALLBACK,
  buildManualJob,
  createManualJobId,
  isManualJob,
} from "./manualJob";

const validDescription =
  "Du entwickelst React-Anwendungen und bringst Erfahrung mit TypeScript und barrierefreien Oberflächen mit.";

describe("manual job contract", () => {
  it("accepts a manual job without a URL", () => {
    const result = buildManualJob({ description: validDescription }, "manual:test-1");
    expect(result.errors).toEqual({});
    expect(result.job?.url).toBe("");
    expect(result.reference?.jobOrigin).toBe("manual");
    expect(result.reference?.source).toEqual(["manual"]);
    expect(result.reference?.originalUrl).toBeUndefined();
    expect(result.reference?.jobId).toBe("manual:test-1");
  });

  it("accepts a real http(s) URL and keeps manual origin", () => {
    const result = buildManualJob({
      description: validDescription,
      url: "https://example.com/jobs/42",
    });
    expect(result.errors).toEqual({});
    expect(result.reference?.originalUrl).toBe("https://example.com/jobs/42");
    expect(result.reference?.jobOrigin).toBe("manual");
    expect(result.job?.url).toBe("https://example.com/jobs/42");
  });

  it("rejects an invalid URL", () => {
    const result = buildManualJob({
      description: validDescription,
      url: "javascript:alert(1)",
    });
    expect(result.errors.url).toBe("invalid");
    expect(result.job).toBeNull();
    expect(result.reference).toBeNull();
  });

  it("uses neutral fallbacks for missing title and company", () => {
    const result = buildManualJob({ description: validDescription });
    expect(result.job?.title).toBe(MANUAL_TITLE_FALLBACK);
    expect(result.job?.company_name).toBe(MANUAL_COMPANY_FALLBACK);
    expect(result.reference?.title).toBe(MANUAL_TITLE_FALLBACK);
    expect(result.reference?.companyName).toBe(MANUAL_COMPANY_FALLBACK);
  });

  it("rejects an empty description", () => {
    const result = buildManualJob({ description: "   " });
    expect(result.errors.description).toBe("required");
    expect(result.job).toBeNull();
  });

  it("rejects an oversized description instead of silently truncating it", () => {
    const result = buildManualJob({ description: "x".repeat(20001) });
    expect(result.errors.description).toBe("too_long");
    expect(result.job).toBeNull();
  });

  it("removes HTML and script content from the description", () => {
    const result = buildManualJob({
      description: `<p>${validDescription}</p><script>alert('x')</script>`,
    });
    expect(result.job?.description).toContain("React-Anwendungen");
    expect(result.job?.description).not.toContain("<");
    expect(result.job?.description).not.toContain("alert");
  });

  it("uses edited description text and keeps a stable manual ID", () => {
    const first = buildManualJob({ description: validDescription }, "manual:stable");
    const second = buildManualJob(
      { description: `${validDescription} Zusätzliche Anforderung: Deutsch.` },
      "manual:stable"
    );
    expect(second.job?.slug).toBe("manual:stable");
    expect(second.job?.description).toContain("Zusätzliche Anforderung");
    expect(second.job?.description).not.toBe(first.job?.description);
  });

  it("splits optional locations and identifies manual jobs", () => {
    const result = buildManualJob({
      description: validDescription,
      location: "Berlin; Potsdam",
    });
    expect(result.job?.location).toEqual(["Berlin", "Potsdam"]);
    expect(isManualJob(result.job)).toBe(true);
    expect(isManualJob({ source: ["arbeitnow"] })).toBe(false);
  });

  it("creates a namespaced opaque ID", () => {
    const id = createManualJobId();
    expect(id).toMatch(/^manual:/);
    expect(id.length).toBeGreaterThan(10);
  });
});
