// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  extractJobMetadata,
  extractRequirementsFromJob,
} from "../../api/_lib/ats.mjs";
import { extractAtsRequirements } from "../../api/_lib/analysis/service.mjs";

const job = {
  slug: "job-quality-1",
  title: "Senior Cloud Engineer",
  company_name: "Example GmbH",
  location: ["Darmstadt", "Remote"],
  remote: true,
  jobTypes: ["full_time"],
  contractType: "permanent",
  descriptionPlain: [
    "We are looking for a Senior Cloud Engineer.",
    "You will design and operate secure AWS platforms.",
    "AWS is required. Kubernetes is nice to have.",
    "Amazon Web Services and K8s experience is welcome.",
    "Bachelor in Informatik or a comparable qualification.",
  ].join("\n"),
};

describe("JM-CV-JOB-PARSER-QUALITY-01 job parser quality", () => {
  it("exposes employer, location, work mode and responsibilities as metadata", () => {
    const metadata = extractJobMetadata(job);
    expect(metadata.title).toBe("Senior Cloud Engineer");
    expect(metadata.companyName).toBe("Example GmbH");
    expect(metadata.location).toEqual(["Darmstadt", "Remote"]);
    expect(metadata.remote).toBe(true);
    expect(metadata.workMode).toBe("remote");
    expect(metadata.contractType).toBe("permanent");
    expect(metadata.responsibilities).toContain(
      "You will design and operate secure AWS platforms."
    );
  });

  it("distinguishes required and preferred requirements in German and English", () => {
    const requirements = extractRequirementsFromJob(job);
    const aws = requirements.find((item) => item.normalized === "aws");
    const kubernetes = requirements.find((item) => item.normalized === "kubernetes");
    expect(aws?.priority).toBe("required");
    expect(aws?.importance).toBe("high");
    expect(kubernetes?.priority).toBe("preferred");
    expect(kubernetes?.importance).toBe("medium");

    const german = extractRequirementsFromJob({
      title: "Cloud Engineer",
      descriptionPlain: "AWS ist erforderlich. Kubernetes ist wünschenswert.",
    });
    expect(german.find((item) => item.normalized === "aws")?.priority).toBe("required");
    expect(german.find((item) => item.normalized === "kubernetes")?.priority).toBe("preferred");
  });

  it("does not turn a negated requirement into a required skill", () => {
    const requirements = extractRequirementsFromJob({
      title: "Cloud Engineer",
      descriptionPlain: "AWS is not required. Kubernetes is preferred.",
    });
    expect(requirements.find((item) => item.normalized === "aws")?.priority).toBe("unspecified");
    expect(requirements.find((item) => item.normalized === "kubernetes")?.priority).toBe("preferred");
  });

  it("normalizes common skill synonyms without changing requirement IDs", () => {
    const requirements = extractRequirementsFromJob({
      title: "Cloud Engineer",
      descriptionPlain: "Amazon Web Services and K8s are required.",
    });
    expect(requirements.some((item) => item.normalized === "aws")).toBe(true);
    expect(requirements.some((item) => item.normalized === "kubernetes")).toBe(true);
    expect(new Set(requirements.map((item) => item.id)).size).toBe(requirements.length);

    const first = extractRequirementsFromJob(job);
    const second = extractRequirementsFromJob(job);
    expect(first.map((item) => item.id)).toEqual(second.map((item) => item.id));
  });

  it("groups required and preferred skills for the versioned parser response", () => {
    const result = extractAtsRequirements(job, { skills: "AWS, Kubernetes" });
    expect(result.metadata.requiredSkills).toContain("AWS");
    expect(result.metadata.preferredSkills).toContain("Kubernetes");
    expect(result.requirements.every((item) => item.priority)).toBe(true);
    expect(result.analysisStatus).toBe("complete");
  });

  it("extracts education requirements in German and English", () => {
    const requirements = extractRequirementsFromJob(job);
    expect(requirements.some((item) => item.category === "education")).toBe(true);
    expect(requirements.some((item) => /informatik/i.test(item.text))).toBe(true);
  });
});
