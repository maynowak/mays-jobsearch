import { describe, expect, it } from "vitest";
import {
  createEmptyCvBuilderDraft,
  createExperienceEntry,
  createLinkEntry,
  hasCvBuilderContent,
  isCvBuilderEntryEmpty,
} from "./contractTypes";
import { validateCvBuilderDraft } from "./validation";

describe("CV-BUILDER-01A domain validation", () => {
  it("accepts an empty draft", () => {
    const draft = createEmptyCvBuilderDraft();
    expect(draft.schemaVersion).toBe(1);
    expect(validateCvBuilderDraft(draft)).toEqual([]);
    expect(hasCvBuilderContent(draft)).toBe(false);
  });

  it("accepts personal details and unicode content without requiring private data", () => {
    const draft = createEmptyCvBuilderDraft();
    draft.personal = {
      fullName: "Zoë Beispiel-Ćurić",
      email: "zoe@example.invalid",
      location: "München",
    };
    draft.profile.headline = "Senior Frontend Entwicklerin";
    expect(validateCvBuilderDraft(draft)).toEqual([]);
    expect(hasCvBuilderContent(draft)).toBe(true);
  });

  it("recognises a completely empty dynamic entry without assigning required-field errors", () => {
    const draft = createEmptyCvBuilderDraft();
    const entry = createExperienceEntry();
    draft.experience = [entry];
    expect(validateCvBuilderDraft(draft)).toEqual([]);
    expect(isCvBuilderEntryEmpty(entry as unknown as Record<string, unknown>)).toBe(true);

    draft.experience = [{
      ...entry,
      employer: "Beispiel GmbH",
      position: "Entwicklerin",
      startMonth: "2020-03",
      current: true,
      description: "React und TypeScript",
    }];
    expect(validateCvBuilderDraft(draft)).toEqual([]);
  });

  it("requires core fields inside a partially filled experience entry", () => {
    const draft = createEmptyCvBuilderDraft();
    draft.experience = [{ ...createExperienceEntry(), employer: "Beispiel GmbH" }];
    expect(validateCvBuilderDraft(draft).map((error) => error.path)).toEqual(
      expect.arrayContaining(["experience.0.position", "experience.0.startMonth"])
    );
  });

  it("rejects current entries with an end date and reversed periods", () => {
    const draft = createEmptyCvBuilderDraft();
    draft.experience = [{
      ...createExperienceEntry(),
      employer: "A",
      position: "B",
      startMonth: "2024-10",
      endMonth: "2025-01",
      current: true,
    }];
    expect(validateCvBuilderDraft(draft).some((error) => error.code === "current_with_end")).toBe(true);

    draft.experience[0] = {
      ...draft.experience[0],
      current: false,
      startMonth: "2025-03",
      endMonth: "2024-12",
    };
    expect(validateCvBuilderDraft(draft).some((error) => error.code === "end_before_start")).toBe(true);
  });

  it("validates month format and permits month/year only", () => {
    const draft = createEmptyCvBuilderDraft();
    draft.education = [{
      id: "edu-1",
      institution: "Beispiel-Universität",
      degree: "B.Sc.",
      startMonth: "2020-10",
      endMonth: "2024-09",
      current: false,
    }];
    expect(validateCvBuilderDraft(draft)).toEqual([]);

    draft.education[0].startMonth = "2020-10-01";
    expect(validateCvBuilderDraft(draft).some((error) => error.path === "education.0.startMonth")).toBe(true);
  });

  it("validates email only when provided", () => {
    const draft = createEmptyCvBuilderDraft();
    draft.personal.email = "not-an-email";
    expect(validateCvBuilderDraft(draft)).toContainEqual({
      path: "personal.email",
      code: "invalid_email",
    });

    draft.personal.email = "person@example.invalid";
    expect(validateCvBuilderDraft(draft)).toEqual([]);
  });

  it("rejects unsafe or malformed links and accepts http(s)", () => {
    const draft = createEmptyCvBuilderDraft();
    const link = createLinkEntry();
    draft.links = [{ ...link, label: "Portfolio", url: "javascript:alert(1)" }];
    expect(validateCvBuilderDraft(draft).some((error) => error.path === "links.0.url" && error.code === "invalid_url")).toBe(true);

    draft.links[0].url = "https://example.invalid/portfolio";
    expect(validateCvBuilderDraft(draft)).toEqual([]);
  });

  it("detects duplicate skills case-insensitively", () => {
    const draft = createEmptyCvBuilderDraft();
    draft.skills = ["React", "TypeScript", "react"];
    expect(validateCvBuilderDraft(draft).some((error) => error.code === "duplicate")).toBe(true);
  });

  it("enforces text limits without deleting input", () => {
    const draft = createEmptyCvBuilderDraft();
    draft.personal.fullName = "x".repeat(201);
    draft.profile.summary = "y".repeat(4001);
    expect(validateCvBuilderDraft(draft).map((error) => error.path)).toEqual(
      expect.arrayContaining(["personal.fullName", "profile.summary"])
    );
  });

  it("does not treat completely empty dynamic entries as validation errors", () => {
    const draft = createEmptyCvBuilderDraft();
    draft.experience = [createExperienceEntry()];
    expect(validateCvBuilderDraft(draft)).toEqual([]);
    expect(isCvBuilderEntryEmpty(draft.experience[0] as unknown as Record<string, unknown>)).toBe(true);
  });

  it("hasCvBuilderContent becomes true for dynamic entries and skills", () => {
    const draft = createEmptyCvBuilderDraft();
    draft.skills = ["React"];
    expect(hasCvBuilderContent(draft)).toBe(true);
    draft.skills = [];
    draft.projects = [{ id: "p1", name: "Projekt", technologies: [] }];
    expect(hasCvBuilderContent(draft)).toBe(true);
  });
});
