import { beforeEach, describe, expect, it } from "vitest";
import { readCvProfileLists, saveCvAtsProfile, saveCvSearchProfile } from "./cvProfileStore";
import type { Profile } from "../types";

const profile: Profile = {
  skills: "React, TypeScript",
  targetRole: "Frontend",
  city: "Berlin",
  radiusKm: 25,
  workModes: [],
  employmentTypes: ["full_time"],
};

beforeEach(() => {
  localStorage.clear();
});

describe("cvProfileStore (CV-PROFILE-LISTS-01)", () => {
  it("speichert und liest benannte Suchprofile je CV-Hash", () => {
    expect(readCvProfileLists("h1").searchProfiles).toEqual([]);
    const entry = saveCvSearchProfile("h1", "  Frontend Berlin  ", profile);
    expect(entry?.name).toBe("Frontend Berlin");
    const lists = readCvProfileLists("h1");
    expect(lists.searchProfiles).toHaveLength(1);
    expect(lists.searchProfiles[0].profile).toEqual(profile);
    expect(lists.searchProfiles[0].savedAt).toBeGreaterThan(0);
  });

  it("trennt Listen strikt pro Hash (CV A sieht CV B nicht)", () => {
    saveCvSearchProfile("h1", "Profil A", profile);
    saveCvAtsProfile("h1", "ATS A", ["React"], "Frontend");
    expect(readCvProfileLists("h2").searchProfiles).toEqual([]);
    expect(readCvProfileLists("h2").atsProfiles).toEqual([]);
    expect(readCvProfileLists("h1").atsProfiles).toHaveLength(1);
  });

  it("speichert ATS-Profile mit bestaetigten Skills, neueste zuerst", () => {
    saveCvAtsProfile("h1", "React ATS", ["React"], "Frontend");
    const second = saveCvAtsProfile("h1", "  ", ["React", "TypeScript"], "Frontend");
    // Default-Name bei leerem Namen: erster Skill
    expect(second?.name).toBe("React");
    const lists = readCvProfileLists("h1");
    expect(lists.atsProfiles.map((e) => e.name)).toEqual(["React", "React ATS"]);
    expect(lists.atsProfiles[0].skills).toEqual(["React", "TypeScript"]);
    expect(lists.atsProfiles[0].targetRole).toBe("Frontend");
  });

  it("Default-Name des Suchprofils ist die Zielrolle", () => {
    const entry = saveCvSearchProfile("h1", "", profile);
    expect(entry?.name).toBe("Frontend");
  });

  it("ohne Hash wird nichts gespeichert (kein Throw)", () => {
    expect(saveCvSearchProfile(null, "x", profile)).toBeNull();
    expect(saveCvAtsProfile(undefined, "x", ["a"], "b")).toBeNull();
    expect(readCvProfileLists(null).searchProfiles).toEqual([]);
  });

  it("kaputte Daten im Storage liefern leere Listen statt Fehler", () => {
    localStorage.setItem("mj-cv-lists:broken", "{not json");
    expect(readCvProfileLists("broken")).toEqual({ searchProfiles: [], atsProfiles: [] });
  });
});
