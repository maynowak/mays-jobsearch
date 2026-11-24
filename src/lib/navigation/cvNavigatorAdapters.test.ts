import { describe, expect, it } from "vitest";
import {
  CV_EDITOR_NAVIGATOR_SECTIONS,
  createCvImportTarget,
  createCvSectionTarget,
  type CvEditorNavigatorAdapter,
  type CvImportNavigatorAdapter,
} from "./cvNavigatorAdapters";

describe("CORE-01 CV adapter contracts", () => {
  it("models every CV editor section with a deterministic kind and status", () => {
    expect(CV_EDITOR_NAVIGATOR_SECTIONS).toContain("profile");
    expect(createCvSectionTarget("experience", "Berufserfahrung", "experience")).toMatchObject({
      kind: "section",
      status: "normal",
    });
    expect(createCvSectionTarget("validation", "Validierung", "validation", { status: "warning" })).toMatchObject({
      kind: "error",
      status: "warning",
    });
    expect(createCvSectionTarget("actions", "Speichern", "actions")).toMatchObject({
      kind: "action",
      status: "normal",
    });
  });

  it("supports synthetic import targets without touching CV data", () => {
    const element = document.createElement("section");
    const target = createCvImportTarget("review-1", "Prüfkandidat", "review", {
      status: "pending",
      element,
      activate: () => undefined,
    });
    expect(target).toMatchObject({
      id: "review-1",
      kind: "review",
      status: "pending",
      element,
    });
  });

  it("exposes the future import/editor provider shape", () => {
    const element = document.createElement("section");
    const importAdapter: CvImportNavigatorAdapter = {
      regionSelector: "#cv-import-review",
      getTargets: () => [createCvImportTarget("import-section", "Abschnitt", "section", { element })],
    };
    const editorAdapter: CvEditorNavigatorAdapter = {
      regionSelector: "#cv-builder-sections",
      getTargets: () => [createCvSectionTarget("skills", "Fähigkeiten", "skills", { element })],
    };
    expect(importAdapter.getTargets()[0].id).toBe("import-section");
    expect(editorAdapter.getTargets()[0].id).toBe("skills");
  });
});
