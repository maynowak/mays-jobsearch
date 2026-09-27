import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CV_LISTS_TTL_MS,
  purgeLegacyCvListsFromLocalStorage,
  readCvProfileLists,
  resetCvProfileLists,
  saveCvAtsProfile,
  saveCvSearchProfile,
} from "./cvProfileStore";
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
  resetCvProfileLists();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("cvProfileStore (CV-PROFILE-LISTS-01/02)", () => {
  it("speichert und liest benannte Suchprofile je CV-Hash (Session-Speicher)", () => {
    expect(readCvProfileLists("h1").searchProfiles).toEqual([]);
    const entry = saveCvSearchProfile("h1", "  Frontend Berlin  ", profile);
    expect(entry?.name).toBe("Frontend Berlin");
    const lists = readCvProfileLists("h1");
    expect(lists.searchProfiles).toHaveLength(1);
    expect(lists.searchProfiles[0].profile).toEqual(profile);
  });

  it("trennt Listen strikt pro Hash (CV A sieht CV B nicht)", () => {
    saveCvSearchProfile("h1", "Profil A", profile);
    saveCvAtsProfile("h1", "ATS A", ["React"], "Frontend");
    expect(readCvProfileLists("h2").searchProfiles).toEqual([]);
    expect(readCvProfileLists("h2").atsProfiles).toEqual([]);
  });

  it("ATS-Profile: neueste zuerst, Default-Name = erster Skill", () => {
    saveCvAtsProfile("h1", "React ATS", ["React"], "Frontend");
    const second = saveCvAtsProfile("h1", "  ", ["React", "TypeScript"], "Frontend");
    expect(second?.name).toBe("React");
    expect(readCvProfileLists("h1").atsProfiles.map((e) => e.name)).toEqual(["React", "React ATS"]);
  });

  it("Default-Name des Suchprofils ist die Zielrolle", () => {
    expect(saveCvSearchProfile("h1", "", profile)?.name).toBe("Frontend");
  });

  it("ohne Hash wird nichts gespeichert (kein Throw)", () => {
    expect(saveCvSearchProfile(null, "x", profile)).toBeNull();
    expect(readCvProfileLists(undefined).atsProfiles).toEqual([]);
  });

  it("CV-PROFILE-LISTS-02 (Privacy): Listen werden 12 h nach Verarbeitung automatisch geleert", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    saveCvSearchProfile("h1", "Profil1", profile);
    saveCvAtsProfile("h1", "ATS-Profil1", ["React"], "Frontend");

    // kurz vor Ablauf: noch da
    vi.setSystemTime(1_000_000 + CV_LISTS_TTL_MS - 1000);
    expect(readCvProfileLists("h1").searchProfiles).toHaveLength(1);

    // nach Ablauf: geleert (Lazy-Purge beim lesenden Zugriff)
    vi.setSystemTime(1_000_000 + CV_LISTS_TTL_MS + 1000);
    expect(readCvProfileLists("h1").searchProfiles).toEqual([]);
    expect(readCvProfileLists("h1").atsProfiles).toEqual([]);
  });

  it("CV-PROFILE-LISTS-02: das 12h-Fenster wird durch weitere Saves NICHT verlaengert", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    saveCvSearchProfile("h1", "Profil1", profile);
    // 11 h spaeter noch gespeichert -> laeuft trotzdem zum Original-Fenster ab
    vi.setSystemTime(1_000_000 + 11 * 60 * 60 * 1000);
    saveCvSearchProfile("h1", "Profil2", profile);
    vi.setSystemTime(1_000_000 + CV_LISTS_TTL_MS + 1);
    expect(readCvProfileLists("h1").searchProfiles).toEqual([]);
  });

  it("CV-PROFILE-LISTS-02: purgeLegacyCvListsFromLocalStorage entfernt v1-Altlasten", () => {
    localStorage.setItem("mj-cv-lists:abc", "{}");
    localStorage.setItem("mj-cv-lists:def", "{}");
    localStorage.setItem("mj-other", "keep");
    expect(purgeLegacyCvListsFromLocalStorage()).toBe(2);
    expect(localStorage.getItem("mj-cv-lists:abc")).toBeNull();
    expect(localStorage.getItem("mj-cv-lists:def")).toBeNull();
    expect(localStorage.getItem("mj-other")).toBe("keep");
  });

  it("resetCvProfileLists leert alles sofort", () => {
    saveCvSearchProfile("h1", "Profil1", profile);
    resetCvProfileLists();
    expect(readCvProfileLists("h1").searchProfiles).toEqual([]);
  });
});
