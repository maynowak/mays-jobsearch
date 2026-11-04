import { describe, expect, it } from "vitest";
import {
  createCertificateEntry,
  createEducationEntry,
  createEmptyCvBuilderDraft,
  createExperienceEntry,
  createLanguageEntry,
  createProjectEntry,
  type CvBuilderDraftV1,
} from "./contractTypes";
import { cvBuilderToAnonymizedText } from "./toAnonymizedText";

function fullDraft(): CvBuilderDraftV1 {
  const draft = createEmptyCvBuilderDraft();
  draft.personal = {
    fullName: "Ada Beispiel",
    email: "ada@example.invalid",
    phone: "+49 30 123456",
    location: "Berlin",
  };
  draft.profile = {
    headline: "Senior Frontend Engineer",
    summary: "Ada Beispiel entwickelt React-Anwendungen. Kontakt: ada@example.invalid.",
  };
  const experience = createExperienceEntry();
  experience.position = "Frontend Engineer";
  experience.employer = "Example GmbH";
  experience.startMonth = "2020-03";
  experience.current = true;
  experience.description = "React und TypeScript. Telefon +49 30 999999.";
  draft.experience = [experience];
  const education = createEducationEntry();
  education.degree = "B.Sc. Informatik";
  education.institution = "Beispiel-Universität";
  education.startMonth = "2015-10";
  education.endMonth = "2019-09";
  draft.education = [education];
  draft.skills = ["React", "TypeScript", "Cloud"];
  const project = createProjectEntry();
  project.name = "Job Matcher";
  project.technologies = ["React", "Node.js"];
  project.description = "Barrierefreie Jobsuche.";
  draft.projects = [project];
  const certificate = createCertificateEntry();
  certificate.name = "AWS Cloud Practitioner";
  certificate.issuer = "Amazon";
  certificate.date = "2023-05";
  draft.certificates = [certificate];
  const language = createLanguageEntry();
  language.language = "Deutsch";
  language.level = "native";
  draft.languages = [language];
  draft.links = [{
    id: "link-1",
    kind: "portfolio",
    label: "Portfolio",
    url: "https://example.invalid/ada",
  }];
  return draft;
}

describe("cvBuilderToAnonymizedText", () => {
  it("serializes professional data deterministically and excludes contact/links", () => {
    const draft = fullDraft();
    const first = cvBuilderToAnonymizedText(draft, "de");
    const second = cvBuilderToAnonymizedText(draft, "de");
    expect(first).toBe(second);
    expect(first).toContain("Senior Frontend Engineer");
    expect(first).toContain("Frontend Engineer @ Example GmbH");
    expect(first).toContain("B.Sc. Informatik @ Beispiel-Universität");
    expect(first).toContain("React, TypeScript, Cloud");
    expect(first).toContain("Job Matcher");
    expect(first).toContain("AWS Cloud Practitioner");
    expect(first).toContain("Deutsch (native)");
    expect(first).not.toContain("Ada Beispiel");
    expect(first).not.toContain("ada@example.invalid");
    expect(first).not.toContain("+49 30 123456");
    expect(first).not.toContain("Berlin");
    expect(first).not.toContain("https://example.invalid/ada");
    expect(first).toContain("[NAME]");
    expect(first).toContain("[E-MAIL]");
    expect(first).toContain("[TELEFON]");
  });

  it("supports English labels and empty/partial drafts", () => {
    const empty = createEmptyCvBuilderDraft();
    expect(cvBuilderToAnonymizedText(empty)).toBe("");
    const partial = createEmptyCvBuilderDraft();
    partial.skills = ["React"];
    expect(cvBuilderToAnonymizedText(partial, "en")).toContain("Skills");
    expect(cvBuilderToAnonymizedText(partial, "en")).toContain("React");
  });

  it("handles long text, special characters and unknown fields without truncation or leakage", () => {
    const draft = createEmptyCvBuilderDraft();
    draft.profile.summary = `${"Ä".repeat(2000)} & <script>alert(1)</script>`;
    draft.skills = ["C++", "C#", "Node.js", "日本語"];
    (draft as unknown as Record<string, unknown>).unknownField = "must not leak";
    const result = cvBuilderToAnonymizedText(draft);
    expect(result).toContain("Ä".repeat(2000));
    expect(result).toContain("C++");
    expect(result).toContain("日本語");
    expect(result).not.toContain("must not leak");
  });

  it("keeps nested entries separated and skips empty entries", () => {
    const draft = createEmptyCvBuilderDraft();
    const first = createExperienceEntry();
    first.position = "Engineer";
    first.employer = "One";
    first.startMonth = "2020-01";
    const empty = createExperienceEntry();
    const second = createExperienceEntry();
    second.position = "Lead";
    second.employer = "Two";
    second.startMonth = "2022-02";
    second.endMonth = "2024-03";
    draft.experience = [first, empty, second];
    const result = cvBuilderToAnonymizedText(draft);
    expect(result).toContain("Engineer @ One");
    expect(result).toContain("Lead @ Two · 02/2022 – 03/2024");
    expect(result.match(/Berufserfahrung/g)).toHaveLength(1);
  });

  it("does not invent missing dates or include unsafe links", () => {
    const draft = createEmptyCvBuilderDraft();
    const experience = createExperienceEntry();
    experience.position = "Engineer";
    experience.employer = "Example";
    experience.startMonth = "not-a-month";
    draft.experience = [experience];
    draft.links = [{
      id: "link-1",
      kind: "other",
      label: "Unsafe",
      url: "javascript:alert(1)",
    }];
    const result = cvBuilderToAnonymizedText(draft);
    expect(result).toContain("Engineer @ Example");
    expect(result).not.toContain("not-a-month");
    expect(result).not.toContain("javascript:");
  });
});
