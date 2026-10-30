import { describe, expect, it } from "vitest";
import type { Job, Profile } from "../types";
import {
  MANUAL_SEARCH_PROFILE_SCHEMA_VERSION,
  applyManualSearchProfileDraft,
  containsJobTerm,
  createManualSearchProfile,
  createManualSearchProfileRepository,
  duplicateManualSearchProfile,
  evaluateManualProfileMatch,
  formatManualProfileTermList,
  normalizeManualProfileTerms,
  parseManualProfileTermList,
  toSearchProfile,
  validateManualSearchProfileDraft,
} from "./manualSearchProfiles";
import type { ManualSearchProfileDraft } from "./manualSearchProfiles";

const searchConfig: Profile = {
  skills: 'AWS, Terraform, "Cloud Architecture"',
  targetRoles: ["Cloud Engineer", "AWS Solutions Architect"],
  city: "Darmstadt",
  radiusKm: 50,
  workModes: ["remote", "hybrid"],
  employmentTypes: ["full_time"],
};

const draft = (overrides: Partial<ManualSearchProfileDraft> = {}): ManualSearchProfileDraft => ({
  name: "AWS Cloud Engineer",
  description: "Independent manual profile",
  searchConfig,
  matchingPreferences: {
    requiredSkills: ["AWS", "Terraform"],
    preferredSkills: ["Python", "Cloud Architecture"],
    excludedTerms: ["Shift work"],
  },
  ...overrides,
});

let idCounter = 0;
const fixedOptions = () => ({
  now: () => 1_700_000_000_000,
  createId: () => `manual-test-${++idCounter}`,
});

const job: Job = {
  slug: "aws-role",
  title: "Senior Cloud Engineer",
  company_name: "Acme",
  location: ["Darmstadt"],
  remote: true,
  tags: ["AWS", "Terraform", "Cloud Architecture"],
  url: "https://example.com/job",
  descriptionPlain: "We build platforms with AWS and Terraform. Python is a plus.",
};

describe("MAYS-SEARCH-PROFILE-MANUAL-01: data model", () => {
  it("creates a manual profile without any CV or CV hash", () => {
    const profile = createManualSearchProfile(draft(), fixedOptions());

    expect(profile.origin).toBe("manual");
    expect(profile.schemaVersion).toBe(MANUAL_SEARCH_PROFILE_SCHEMA_VERSION);
    expect(profile.name).toBe("AWS Cloud Engineer");
    expect(profile.searchConfig).toEqual(searchConfig);
    // Kein kuenstlicher CV-Eintrag, kein Hash.
    expect(Object.keys(profile)).not.toContain("cvHash");
    expect(Object.keys(profile)).not.toContain("hash");
    expect(Object.keys(profile)).not.toContain("documentId");
    expect(JSON.stringify(profile)).not.toContain("cv-");
  });

  it("keeps multi-word terms intact in the structured lists", () => {
    const profile = createManualSearchProfile(
      draft({
        matchingPreferences: {
          requiredSkills: ["Cloud Architecture", "ISO 27001", "C++", "C#", ".NET", "CI/CD"],
          preferredSkills: ["Machine Learning", "Amazon Web Services"],
          excludedTerms: ["Senior Java Developer"],
        },
      }),
      fixedOptions()
    );

    expect(profile.matchingPreferences.requiredSkills).toEqual([
      "Cloud Architecture",
      "ISO 27001",
      "C++",
      "C#",
      ".NET",
      "CI/CD",
    ]);
    expect(profile.matchingPreferences.preferredSkills).toEqual([
      "Machine Learning",
      "Amazon Web Services",
    ]);
    expect(profile.matchingPreferences.excludedTerms).toEqual(["Senior Java Developer"]);
  });

  it("keeps id and createdAt stable on edit and refreshes updatedAt", () => {
    const created = createManualSearchProfile(draft(), fixedOptions());
    const edited = applyManualSearchProfileDraft(
      created,
      draft({ name: "AWS Cloud Engineer (Senior)", description: "changed" }),
      1_700_000_500_000
    );

    expect(edited.id).toBe(created.id);
    expect(edited.createdAt).toBe(created.createdAt);
    expect(edited.updatedAt).not.toBe(created.updatedAt);
    expect(edited.name).toBe("AWS Cloud Engineer (Senior)");
    expect(edited.description).toBe("changed");
  });

  it("duplicates with a new id and fresh timestamps", () => {
    const created = createManualSearchProfile(draft(), fixedOptions());
    const copy = duplicateManualSearchProfile(created, "AWS Cloud Engineer (Kopie)", {
      now: () => 1_700_001_000_000,
      createId: () => "manual-copy-1",
    });

    expect(copy.id).not.toBe(created.id);
    expect(copy.name).toBe("AWS Cloud Engineer (Kopie)");
    expect(copy.createdAt).not.toBe(created.createdAt);
    expect(copy.searchConfig).toEqual(created.searchConfig);
    expect(copy.matchingPreferences).toEqual(created.matchingPreferences);
  });

  it("validates name and searchable content", () => {
    expect(validateManualSearchProfileDraft(draft())).toBeNull();
    expect(validateManualSearchProfileDraft(draft({ name: "   " }))).toBe("name");
    expect(
      validateManualSearchProfileDraft(
        draft({ searchConfig: { ...searchConfig, skills: "", targetRoles: [] } })
      )
    ).toBe("search");
    expect(
      validateManualSearchProfileDraft(
        draft({ searchConfig: { ...searchConfig, skills: "", targetRoles: ["DevOps"] } })
      )
    ).toBeNull();
  });
});

describe("MAYS-SEARCH-PROFILE-MANUAL-01: term lists", () => {
  it("parses one term per line without splitting multi-word terms", () => {
    expect(parseManualProfileTermList("Cloud Architecture\nMachine Learning\nC++\n.NET")).toEqual([
      "Cloud Architecture",
      "Machine Learning",
      "C++",
      ".NET",
    ]);
  });

  it("keeps commas inside a line as part of the term", () => {
    expect(parseManualProfileTermList("ISO 27001, Information Security")).toEqual([
      "ISO 27001, Information Security",
    ]);
  });

  it("trims, drops empties and deduplicates case-insensitively", () => {
    expect(normalizeManualProfileTerms(["  AWS ", "aws", "", "Terraform"])).toEqual([
      "AWS",
      "Terraform",
    ]);
  });

  it("round-trips through the textarea format", () => {
    const terms = ["Cloud Architecture", "C#"];
    expect(parseManualProfileTermList(formatManualProfileTermList(terms))).toEqual(terms);
  });
});

describe("MAYS-SEARCH-PROFILE-MANUAL-01: session repository", () => {
  it("creates, lists, updates and deletes profiles", () => {
    const store = createManualSearchProfileRepository(fixedOptions());
    const created = store.save(createManualSearchProfile(draft(), fixedOptions()));

    expect(store.list()).toHaveLength(1);
    expect(store.get(created.id)?.name).toBe("AWS Cloud Engineer");

    store.save(applyManualSearchProfileDraft(created, draft({ name: "Renamed" }), 1_700_000_100_000));
    expect(store.list()).toHaveLength(1);
    expect(store.get(created.id)?.name).toBe("Renamed");
    expect(store.get(created.id)?.createdAt).toBe(created.createdAt);

    expect(store.delete(created.id)).toBe(true);
    expect(store.get(created.id)).toBeNull();
    expect(store.list()).toHaveLength(0);
    expect(store.delete(created.id)).toBe(false);
  });

  it("returns defensive copies (immutable updates)", () => {
    const store = createManualSearchProfileRepository(fixedOptions());
    const created = store.save(createManualSearchProfile(draft(), fixedOptions()));

    const listed = store.list();
    listed[0].name = "mutated outside";
    listed[0].searchConfig.targetRoles.push("Hacked");

    const reloaded = store.get(created.id);
    expect(reloaded?.name).toBe("AWS Cloud Engineer");
    expect(reloaded?.searchConfig.targetRoles).toEqual(["Cloud Engineer", "AWS Solutions Architect"]);
  });

  it("does not override createdAt or id when saving an existing profile", () => {
    const store = createManualSearchProfileRepository(fixedOptions());
    const created = store.save(createManualSearchProfile(draft(), fixedOptions()));

    store.save({ ...created, id: created.id, createdAt: "1999-01-01T00:00:00.000Z" });
    expect(store.get(created.id)?.createdAt).toBe(created.createdAt);
  });

  it("ends the collection when the session store is recreated (reload)", () => {
    const first = createManualSearchProfileRepository(fixedOptions());
    first.save(createManualSearchProfile(draft(), fixedOptions()));
    expect(first.list()).toHaveLength(1);

    // Ein Reload erzeugt eine neue In-Memory-Sammlung.
    const afterReload = createManualSearchProfileRepository(fixedOptions());
    expect(afterReload.list()).toHaveLength(0);
  });

  it("keeps manual profiles fully separate from the CV profile store", () => {
    const store = createManualSearchProfileRepository(fixedOptions());
    const created = store.save(createManualSearchProfile(draft(), fixedOptions()));
    // Kein CV-Bezug: kein Hash, kein Dokument, keine ATS-Elternzuordnung.
    expect(created).not.toHaveProperty("searchProfileId");
    expect(created).not.toHaveProperty("atsProfiles");
    expect(created.matchingPreferences).not.toHaveProperty("atsScore");
  });
});

describe("MAYS-SEARCH-PROFILE-MANUAL-01: search handover", () => {
  it("passes the existing Profile contract to the search path", () => {
    const profile = createManualSearchProfile(draft(), fixedOptions());
    const handedOver = toSearchProfile(profile);

    expect(handedOver).toEqual(searchConfig);
    // Defensive Kopie: die Suche kann das Profil nicht mutieren.
    handedOver.targetRoles.push("Mutated");
    expect(profile.searchConfig.targetRoles).toHaveLength(2);
  });
});

describe("MAYS-SEARCH-PROFILE-MANUAL-01: deterministic criteria check", () => {
  it("matches when all required terms are present and nothing is excluded", () => {
    const profile = createManualSearchProfile(draft(), fixedOptions());
    const result = evaluateManualProfileMatch(profile, job);

    expect(result.status).toBe("match");
    expect(result.matchedRequired).toEqual(["AWS", "Terraform"]);
    expect(result.missingRequired).toEqual([]);
    expect(result.excludedFound).toEqual([]);
    expect(result.preferredFound).toEqual(["Python", "Cloud Architecture"]);
  });

  it("reports a mismatch when a required term is missing", () => {
    const profile = createManualSearchProfile(
      draft({
        matchingPreferences: {
          requiredSkills: ["AWS", "Kubernetes"],
          preferredSkills: [],
          excludedTerms: [],
        },
      }),
      fixedOptions()
    );
    const result = evaluateManualProfileMatch(profile, job);

    expect(result.status).toBe("mismatch");
    expect(result.missingRequired).toEqual(["Kubernetes"]);
  });

  it("reports a mismatch on excluded terms", () => {
    const profile = createManualSearchProfile(
      draft({
        matchingPreferences: { requiredSkills: ["AWS"], preferredSkills: [], excludedTerms: ["Terraform"] },
      }),
      fixedOptions()
    );
    const result = evaluateManualProfileMatch(profile, job);

    expect(result.status).toBe("mismatch");
    expect(result.excludedFound).toEqual(["Terraform"]);
  });

  it("returns unknown without hard criteria and never invents percentages", () => {
    const profile = createManualSearchProfile(
      draft({
        matchingPreferences: { requiredSkills: [], preferredSkills: ["Python"], excludedTerms: [] },
      }),
      fixedOptions()
    );
    const result = evaluateManualProfileMatch(profile, job);

    expect(result.status).toBe("unknown");
    expect(result).not.toHaveProperty("score");
  });

  it("handles technical multi-word and symbol terms without false positives", () => {
    expect(containsJobTerm("we use c++ and .net daily", "C++")).toBe(true);
    expect(containsJobTerm("we use c++ and .net daily", ".NET")).toBe(true);
    expect(containsJobTerm("we build cloud architecture", "Cloud Architecture")).toBe(true);
    expect(containsJobTerm("awsome projects", "AWS")).toBe(false);
    expect(containsJobTerm("ci/cd pipelines", "CI/CD")).toBe(true);
  });
});
