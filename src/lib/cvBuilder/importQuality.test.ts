import { describe, expect, it } from "vitest";
import { createEmptyCvBuilderDraft } from "./contractTypes";
import {
  applyImportReviewItem,
  updateCvBuilderImportReviewItem,
  type CvBuilderImportReviewItem,
  type CvBuilderImportReviewSummary,
} from "./importQuality";

function item(overrides: Partial<CvBuilderImportReviewItem>): CvBuilderImportReviewItem {
  return {
    id: "review-0-1",
    index: 0,
    text: "Synthetic",
    original: "Synthetic",
    edited: false,
    target: "skills",
    status: "pending",
    reason: "ambiguous",
    suggestedTarget: "skills",
    ...overrides,
  };
}

function report(items: CvBuilderImportReviewItem[]): CvBuilderImportReviewSummary {
  return { total: items.length, pending: items.length, accepted: 0, ignored: 0, items };
}

describe("CV-BUILDER-03B review integrity", () => {
  it("applies skills, projects and certificates idempotently", () => {
    for (const [target, key] of [["skills", "skills"], ["projects", "projects"], ["certificates", "certificates"]] as const) {
      const draft = createEmptyCvBuilderDraft();
      const review = item({ target, text: `Synthetic ${target}` });
      const first = applyImportReviewItem(draft, review);
      const second = applyImportReviewItem(first.draft, review);
      expect(first.applied).toBe(true);
      expect(second.applied).toBe(true);
      expect(second.draft[key]).toHaveLength(1);
    }
  });

  it("requires complete experience and education mappings", () => {
    const draft = createEmptyCvBuilderDraft();
    const invalidExperience = applyImportReviewItem(draft, item({ target: "experience", text: "Only a role" }));
    const invalidEducation = applyImportReviewItem(draft, item({ target: "education", text: "Only a degree" }));
    const invalidLink = applyImportReviewItem(draft, item({ target: "links", text: "not a url" }));
    expect(invalidExperience).toMatchObject({ applied: false, error: "invalid-experience" });
    expect(invalidEducation).toMatchObject({ applied: false, error: "invalid-education" });
    expect(invalidLink).toMatchObject({ applied: false, error: "invalid-link" });
    expect(draft.experience).toEqual([]);
    expect(draft.education).toEqual([]);
    expect(draft.links).toEqual([]);
  });

  it("applies a complete experience and education item once", () => {
    const draft = createEmptyCvBuilderDraft();
    const experience = applyImportReviewItem(draft, item({ target: "experience", text: "Senior Engineer | Acme GmbH" }));
    const education = applyImportReviewItem(draft, item({ target: "education", text: "B.Sc. Computer Science | Hochschule Musterstadt" }));
    expect(experience.draft.experience[0]).toMatchObject({ position: "Senior Engineer", employer: "Acme GmbH" });
    expect(education.draft.education[0]).toMatchObject({ degree: "B.Sc. Computer Science", institution: "Hochschule Musterstadt" });
    expect(applyImportReviewItem(experience.draft, item({ target: "experience", text: "Senior Engineer | Acme GmbH" })).draft.experience).toHaveLength(1);
  });

  it("resets applied when an item is edited and keeps counts consistent", () => {
    const review = item({ applied: true, status: "accepted" });
    const updated = updateCvBuilderImportReviewItem(report([review]), review.id, { text: "Changed" });
    expect(updated.items?.[0].applied).toBe(false);
    expect(updated.items?.[0].edited).toBe(true);
    expect(updated.accepted).toBe(1);
  });
});

describe("CV-BUILDER-03B profile review store", () => {
  it("keeps reports isolated per profile and removes deleted profiles", async () => {
    const { createCvBuilderImportReviewStore } = await import("./importQuality");
    const store = createCvBuilderImportReviewStore();
    const reportA = report([item({ id: "review-a" })]);
    const reportB = report([item({ id: "review-b" })]);
    store.set("cv-a", reportA);
    store.set("cv-b", reportB);
    expect(store.get("cv-a")?.items?.[0].id).toBe("review-a");
    expect(store.get("cv-b")?.items?.[0].id).toBe("review-b");
    store.delete("cv-a");
    expect(store.get("cv-a")).toBeNull();
    expect(store.get("cv-b")?.items?.[0].id).toBe("review-b");
    store.clear();
    expect(store.get("cv-b")).toBeNull();
  });
});
