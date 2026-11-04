import { describe, expect, it } from "vitest";
import { createEmptyCvBuilderDraft } from "./contractTypes";
import {
  CV_BUILDER_PROFILE_SCHEMA_VERSION,
  cloneCvBuilderProfile,
  validateCvBuilderProfile,
  validateCvBuilderProfileName,
  validateCvBuilderTemplate,
  type CvBuilderProfileV1,
} from "./profileTypes";

const NOW = "2026-11-04T10:00:00.000Z";

function validProfile(): CvBuilderProfileV1 {
  return {
    schemaVersion: CV_BUILDER_PROFILE_SCHEMA_VERSION,
    cvId: "cvb-1",
    name: "Java-Entwicklerin",
    cvData: createEmptyCvBuilderDraft(),
    template: "classic",
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  };
}

describe("CvBuilderProfileV1 contract", () => {
  it("accepts a valid profile and clones nested data", () => {
    const profile = validProfile();
    profile.cvData.skills = ["TypeScript"];
    expect(() => validateCvBuilderProfile(profile)).not.toThrow();
    const clone = cloneCvBuilderProfile(profile);
    clone.cvData.skills.push("React");
    expect(profile.cvData.skills).toEqual(["TypeScript"]);
    expect(clone.cvData.skills).toEqual(["TypeScript", "React"]);
  });

  it("rejects invalid schema, template, name, timestamps and version", () => {
    expect(() => validateCvBuilderProfile({
      ...validProfile(),
      schemaVersion: 2 as never,
    })).toThrowError(/schema/);
    expect(() => validateCvBuilderTemplate("unknown")).toThrowError(/template/);
    expect(() => validateCvBuilderProfileName("   ")).toThrowError(/name/);
    expect(() => validateCvBuilderProfile({
      ...validProfile(),
      createdAt: "not-a-date",
    })).toThrowError(/timestamp/);
    expect(() => validateCvBuilderProfile({
      ...validProfile(),
      version: 0,
    })).toThrowError(/version/);
  });
});
