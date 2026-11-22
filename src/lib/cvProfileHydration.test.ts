import { describe, expect, it } from "vitest";
import type { ATSSearchProfileV1, CVSearchProfileV1 } from "./profiles/contractTypes";
import { mapPersistentCvProfiles, mergeCvProfileLists } from "./cvProfileHydration";

const parent: CVSearchProfileV1 = {
  schemaVersion: 1,
  searchProfileId: "sp-1",
  cvId: "cv-1",
  name: "Cloud",
  origin: "cv",
  searchConfig: {
    skills: "AWS, Kubernetes",
    targetRoles: ["Cloud Engineer"],
    city: "Berlin",
    radiusKm: 25,
    workModes: ["hybrid"],
    employmentTypes: ["full_time"],
  },
  createdAt: "2026-11-20T10:00:00.000Z",
  updatedAt: "2026-11-21T10:00:00.000Z",
  version: 2,
};

const ats: ATSSearchProfileV1 = {
  schemaVersion: 1,
  atsSearchProfileId: "ats-1",
  searchProfileId: "sp-1",
  name: "AWS Fokus",
  targetRoles: ["Cloud Engineer"],
  skills: ["AWS", "Terraform"],
  createdAt: "2026-11-20T10:00:00.000Z",
  updatedAt: "2026-11-21T10:00:00.000Z",
  version: 1,
};

describe("JM-CV-SEARCH-PROFILE-HYDRATION-01 mapping", () => {
  it("maps durable CV search and ATS profiles into the existing dropdown shape", () => {
    const lists = mapPersistentCvProfiles("cv-1", [parent], { "sp-1": [ats] });
    expect(lists.searchProfiles).toHaveLength(1);
    expect(lists.searchProfiles[0]).toMatchObject({
      id: "sp-1",
      name: "Cloud",
      origin: "persistent",
      profile: {
        skills: "AWS, Kubernetes",
        targetRoles: ["Cloud Engineer"],
        city: "Berlin",
        radiusKm: 25,
        workModes: ["hybrid"],
        employmentTypes: ["full_time"],
      },
    });
    expect(lists.atsProfiles[0]).toMatchObject({
      id: "ats-1",
      name: "AWS Fokus",
      searchProfileId: "sp-1",
      skills: ["AWS", "Terraform"],
      origin: "persistent",
    });
  });

  it("rejects profiles belonging to another CV and keeps only valid ATS parents", () => {
    const foreign = { ...parent, searchProfileId: "sp-foreign", cvId: "cv-2" };
    const orphan = { ...ats, atsSearchProfileId: "ats-orphan", searchProfileId: "missing" };
    const lists = mapPersistentCvProfiles("cv-1", [parent, foreign], {
      "sp-1": [ats],
      missing: [orphan],
    });
    expect(lists.searchProfiles.map((entry) => entry.id)).toEqual(["sp-1"]);
    expect(lists.atsProfiles.map((entry) => entry.id)).toEqual(["ats-1"]);
  });

  it("lets durable entries win over same-name session entries without mutating session data", () => {
    const persistent = mapPersistentCvProfiles("cv-1", [parent], { "sp-1": [ats] });
    const session = {
      searchProfiles: [
        {
          id: "session-1",
          name: "Cloud",
          savedAt: 1,
          profile: parent.searchConfig,
        },
        {
          id: "session-2",
          name: "Session only",
          savedAt: 2,
          profile: parent.searchConfig,
        },
      ],
      atsProfiles: [
        {
          id: "session-ats-1",
          name: "AWS Fokus",
          savedAt: 1,
          targetRoles: ["Cloud Engineer"],
          skills: ["AWS"],
          searchProfileId: "sp-1",
        },
        {
          id: "session-ats-2",
          name: "Session ATS",
          savedAt: 2,
          targetRoles: ["Cloud Engineer"],
          skills: ["AWS"],
          searchProfileId: "sp-1",
        },
      ],
    };

    const merged = mergeCvProfileLists(session, persistent);
    expect(merged.searchProfiles.map((entry) => entry.id)).toEqual([
      "sp-1",
      "session-2",
    ]);
    expect(merged.atsProfiles.map((entry) => entry.id)).toEqual([
      "ats-1",
      "session-ats-2",
    ]);
    expect(session.searchProfiles).toHaveLength(2);
    expect(session.atsProfiles).toHaveLength(2);
  });
});
