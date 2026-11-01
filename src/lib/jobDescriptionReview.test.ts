import { describe, expect, it } from "vitest";
import type { Job } from "../types";
import {
  MAX_DESCRIPTION_INPUT_LENGTH,
  buildDescriptionReview,
  checkPlausibility,
  evaluateDescription,
  normalizeDescriptionText,
} from "./jobDescriptionReview";

const fullOriginal =
  "Du entwickelst React-Anwendungen und betreust unsere Frontend-Plattform. " +
  "Du hast mindestens 3 Jahre Erfahrung mit TypeScript und React. " +
  "Kenntnisse in CSS und barrierefreiem Webdesign sind erforderlich.";

const job: Job = {
  slug: "frontend-role",
  title: "Frontend Engineer",
  company_name: "Example GmbH",
  location: ["Berlin"],
  remote: false,
  tags: ["React", "TypeScript"],
  url: "https://example.invalid/jobs/frontend-role",
  source: ["arbeitnow"],
  description: `<p>${fullOriginal}</p>`,
  descriptionPlain: fullOriginal,
};

describe("JM-COVER-LETTER-02: deterministic description review", () => {
  it("classifies a full description as sufficient", () => {
    expect(evaluateDescription(fullOriginal).completeness).toBe("sufficient");
  });

  it("classifies a short, low-information text as limited", () => {
    expect(evaluateDescription("Great team. Apply now.").completeness).toBe("limited");
  });

  it("classifies an empty description as missing", () => {
    expect(evaluateDescription("").completeness).toBe("missing");
    expect(evaluateDescription("   ").completeness).toBe("missing");
  });

  it("recognizes a few precise requirements as sufficient", () => {
    const text = "Du hast 3 Jahre Erfahrung mit React und TypeScript.";
    expect(evaluateDescription(text).completeness).toBe("sufficient");
  });

  it("does not treat a marketing-only text as sufficient", () => {
    const text = "Wir bieten ein tolles Team, Obstkorb und Team Events. ".repeat(8);
    expect(evaluateDescription(text).completeness).not.toBe("sufficient");
  });

  it("detects placeholders and repetition as limited/missing", () => {
    expect(evaluateDescription("Lorem ipsum TODO").completeness).toBe("missing");
    expect(evaluateDescription("React React React React React React React React React React React React React React React React React React React React React React React React React React React React").completeness).not.toBe("sufficient");
  });

  it("marks a matching enrichment as plausible", () => {
    const result = checkPlausibility(
      job,
      "Position als Frontend Engineer bei Example GmbH in Berlin. Du entwickelst React-Anwendungen und hast Erfahrung mit TypeScript."
    );
    expect(result.status).toBe("plausible");
    expect(result.companyMatch).toBe(true);
    expect(result.titleMatch).toBe(true);
    expect(result.locationMatch).toBe(true);
    expect(result.tagMatches).toBeGreaterThan(0);
  });

  it("does not require an employer name for a plausible match", () => {
    const result = checkPlausibility(
      job,
      "Frontend Engineer in Berlin. Du entwickelst React-Anwendungen und hast Erfahrung mit TypeScript."
    );
    expect(result.status).toBe("plausible");
    expect(result.companyMatch).toBe(false);
  });

  it("flags a clearly different employer as mismatch", () => {
    const result = checkPlausibility(
      job,
      "Position als Frontend Engineer bei Other AG in Berlin. Du entwickelst React-Anwendungen."
    );
    expect(result.status).toBe("mismatch");
    expect(result.explicitCompanyMismatch).toBe(true);
  });

  it("flags a clearly different role as mismatch", () => {
    const result = checkPlausibility(
      job,
      "Position als Backend Engineer bei Example GmbH. Du entwickelst Java-Anwendungen."
    );
    expect(result.status).toBe("mismatch");
    expect(result.explicitRoleMismatch).toBe(true);
  });

  it("returns uncertain when there are not enough signals", () => {
    const result = checkPlausibility(job, "Wir suchen eine motivierte Person mit Erfahrung und Teamgeist.");
    expect(result.status).toBe("uncertain");
  });

  it("selects the original description on a mismatch", () => {
    const review = buildDescriptionReview({
      job,
      enrichedInput: "Position als Backend Engineer bei Other AG. Du entwickelst Java-Anwendungen.",
    });
    expect(review.selected?.origin).toBe("original");
    expect(review.selected?.text).toBe(fullOriginal);
    expect(review.confirmation).toBe("none");
  });

  it("requires confirmation for an uncertain enrichment", () => {
    const review = buildDescriptionReview({
      job,
      enrichedInput: "Wir suchen eine motivierte Person mit Erfahrung und Teamgeist.",
    });
    expect(review.confirmation).toBe("required");
    expect(review.selected?.origin).toBe("original");
  });

  it("uses a confirmed uncertain enrichment as user-supplied", () => {
    const review = buildDescriptionReview({
      job,
      enrichedInput: "Wir suchen eine motivierte Person mit Erfahrung und Teamgeist.",
      confirmed: true,
    });
    expect(review.confirmation).toBe("confirmed");
    expect(review.selected?.origin).toBe("user_supplied");
  });

  it("returns insufficient when both texts lack a usable description", () => {
    const emptyJob = { ...job, description: "", descriptionPlain: "" };
    const review = buildDescriptionReview({ job: emptyJob, enrichedInput: "Kurz." });
    expect(review.insufficient).toBe(true);
    expect(review.selected).toBeNull();
  });

  it("normalizes and strips HTML/script content without executing it", () => {
    const normalized = normalizeDescriptionText(
      "<p>Frontend Engineer bei Example GmbH</p><script>alert('x')</script><img src=x onerror=alert(1)>"
    );
    expect(normalized).toContain("Frontend Engineer");
    expect(normalized).not.toContain("<script");
    expect(normalized).not.toContain("alert");
    expect(normalized).not.toContain("<img");
    expect(normalized.length).toBeLessThanOrEqual(MAX_DESCRIPTION_INPUT_LENGTH);
  });

  it("handles a multilingual description", () => {
    const result = checkPlausibility(
      job,
      "Frontend Engineer / Frontend-Entwickler in Berlin. You will develop React applications and have experience with TypeScript. Du entwickelst React-Anwendungen."
    );
    expect(result.status).toBe("plausible");
  });
});
