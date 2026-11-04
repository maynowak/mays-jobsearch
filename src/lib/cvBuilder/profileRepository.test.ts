import { describe, expect, it } from "vitest";
import {
  beginNewCvBuilderSession,
  createCvBuilderProfileRepository,
} from "./profileRepository";
import {
  CvBuilderProfileError,
  type CvBuilderProfileV1,
} from "./profileTypes";
import {
  createEducationEntry,
  createEmptyCvBuilderDraft,
  createExperienceEntry,
  createProjectEntry,
} from "./contractTypes";

function makeRepo(initial?: CvBuilderProfileV1[]) {
  let tick = 0;
  return createCvBuilderProfileRepository({
    initial,
    idFactory: () => `cvb-${++tick}`,
    now: () => `2026-11-04T10:0${tick}:00.000Z`,
  });
}

function populatedProfile(repo: ReturnType<typeof makeRepo>) {
  const draft = createEmptyCvBuilderDraft();
  draft.personal.fullName = "Ada Beispiel";
  const experience = createExperienceEntry();
  experience.employer = "Example GmbH";
  experience.position = "Engineer";
  experience.startMonth = "2024-01";
  draft.experience = [experience];
  const education = createEducationEntry();
  education.institution = "Example University";
  education.degree = "BSc";
  education.startMonth = "2020-10";
  draft.education = [education];
  draft.skills = ["TypeScript"];
  const project = createProjectEntry();
  project.name = "Project A";
  project.technologies = ["React"];
  draft.projects = [project];
  return repo.create({ name: "Java-Entwicklerin", cvData: draft, template: "modern" });
}

describe("CvBuilderProfileRepository", () => {
  it("creates, lists, gets and returns defensive copies", () => {
    const repo = makeRepo();
    const profile = populatedProfile(repo);
    expect(profile.version).toBe(1);
    expect(profile.createdAt).toBe(profile.updatedAt);
    const list = repo.list();
    expect(list).toHaveLength(1);
    list[0].name = "mutated";
    list[0].cvData.experience[0].employer = "mutated";
    expect(repo.get(profile.cvId)?.name).toBe("Java-Entwicklerin");
    expect(repo.get(profile.cvId)?.cvData.experience[0].employer).toBe("Example GmbH");
  });

  it("updates with expectedVersion and isolates profiles", () => {
    const repo = makeRepo();
    const first = populatedProfile(repo);
    const second = repo.create({ name: "AWS Cloud Engineer" });
    const updated = repo.update(first.cvId, 1, {
      name: "Java Senior",
      template: "compact",
    });
    expect(updated.name).toBe("Java Senior");
    expect(updated.template).toBe("compact");
    expect(updated.version).toBe(2);
    expect(updated.createdAt).toBe(first.createdAt);
    expect(repo.get(second.cvId)?.name).toBe("AWS Cloud Engineer");
    expect(repo.get(second.cvId)?.template).toBe("classic");
  });

  it("rejects stale versions, missing profiles and invalid names/templates", () => {
    const repo = makeRepo();
    const profile = populatedProfile(repo);
    expect(() => repo.update(profile.cvId, 99, { name: "stale" }))
      .toThrowError(/changed/);
    expect(() => repo.get("missing")).not.toThrow();
    expect(repo.get("missing")).toBeNull();
    expect(() => repo.rename("missing", 1, "x"))
      .toThrowError(/not found/);
    expect(() => repo.create({ name: "   " }))
      .toThrowError(/name/);
    expect(() => repo.create({ name: "Valid", template: "unknown" as never }))
      .toThrowError(/template/);
  });

  it("renames without changing the cvId", () => {
    const repo = makeRepo();
    const profile = populatedProfile(repo);
    const renamed = repo.rename(profile.cvId, 1, "Architektin");
    expect(renamed.cvId).toBe(profile.cvId);
    expect(renamed.name).toBe("Architektin");
    expect(renamed.version).toBe(2);
  });

  it("duplicates with a deep clone and independent version", () => {
    const repo = makeRepo();
    const original = populatedProfile(repo);
    const duplicate = repo.duplicate(original.cvId, 1);
    expect(duplicate.cvId).not.toBe(original.cvId);
    expect(duplicate.name).toBe("Java-Entwicklerin (Kopie)");
    expect(duplicate.template).toBe("modern");
    expect(duplicate.version).toBe(1);
    expect(duplicate.cvData).toEqual(original.cvData);

    duplicate.cvData.experience[0].employer = "Mutated";
    duplicate.cvData.education[0].institution = "Mutated University";
    duplicate.cvData.skills.push("Mutated");
    duplicate.cvData.projects[0].technologies.push("Mutated");

    const storedOriginal = repo.get(original.cvId)!;
    expect(storedOriginal.cvData.experience[0].employer).toBe("Example GmbH");
    expect(storedOriginal.cvData.education[0].institution).toBe("Example University");
    expect(storedOriginal.cvData.skills).toEqual(["TypeScript"]);
    expect(storedOriginal.cvData.projects[0].technologies).toEqual(["React"]);
    expect(repo.get(duplicate.cvId)?.cvData.experience[0].employer).toBe("Example GmbH");

    const updatedDuplicate = repo.update(duplicate.cvId, 1, {
      cvData: duplicate.cvData,
    });
    expect(updatedDuplicate.cvData.experience[0].employer).toBe("Mutated");
    expect(repo.get(original.cvId)?.cvData.experience[0].employer).toBe("Example GmbH");
  });

  it("deletes only the selected profile and clears all", () => {
    const repo = makeRepo();
    const first = populatedProfile(repo);
    const second = repo.create({ name: "Second" });
    expect(repo.delete(first.cvId, 1)).toEqual({ deleted: true });
    expect(repo.list().map((profile) => profile.cvId)).toEqual([second.cvId]);
    repo.clear();
    expect(repo.list()).toEqual([]);
  });

  it("invalidates repositories after a session generation change", () => {
    const repo = makeRepo();
    populatedProfile(repo);
    beginNewCvBuilderSession();
    expect(() => repo.list()).toThrowError(CvBuilderProfileError);
    expect(() => repo.list()).toThrowError(/session has ended/);
    const next = makeRepo();
    expect(next.list()).toEqual([]);
  });
});
