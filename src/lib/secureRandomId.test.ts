import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { secureRandomIdSuffix } from "./secureRandomId";
import { createManualSearchProfile } from "./manualSearchProfiles";

const SOURCE = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const draft = {
  name: "Frontend",
  description: "",
  matchingPreferences: {
    requiredSkills: [],
    preferredSkills: [],
    excludedTerms: [],
  },
  searchConfig: {
    skills: "React",
    targetRoles: ["Frontend Engineer"],
    city: "Berlin",
    radiusKm: 30,
    workModes: [],
    employmentTypes: [],
    languages: [],
    excludeTerms: [],
    minSalary: null,
    maxSalary: null,
  },
} as unknown as Parameters<typeof createManualSearchProfile>[0];

describe("secureRandomIdSuffix", () => {
  it("returns the requested length from a base36 alphabet", () => {
    const suffix = secureRandomIdSuffix();
    expect(suffix).toMatch(/^[0-9a-z]{7}$/);
    expect(secureRandomIdSuffix(12)).toHaveLength(12);
  });

  it("produces different values across calls", () => {
    const values = new Set(Array.from({ length: 50 }, () => secureRandomIdSuffix()));
    expect(values.size).toBe(50);
  });
});

describe("session profile ids use a secure random source", () => {
  it("keeps the documented manual profile id format", () => {
    const profile = createManualSearchProfile(draft);
    expect(profile.id).toMatch(/^manual-\d+-[0-9a-z]{7}$/);
  });

  it("does not use Math.random in the session id generators", () => {
    for (const file of ["./manualSearchProfiles.ts", "./cvProfileStore.ts", "./profiles/sessionRepositories.ts"]) {
      expect(SOURCE(file)).not.toContain("Math.random");
    }
  });
});
