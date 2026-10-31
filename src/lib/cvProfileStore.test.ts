import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CV_LISTS_TTL_MS,
  MAX_SEARCH_PROFILES_PER_CV,
  canCreateCvSearchProfile,
  deleteCvSearchProfile,
  findSavedSearchProfile,
  purgeLegacyCvListsFromLocalStorage,
  readCvProfileLists,
  resetCvProfileLists,
  saveCvAtsProfile,
  saveCvSearchProfile,
} from "./cvProfileStore";
import type { Profile } from "../types";

const profile: Profile = {
  skills: "React, TypeScript",
  targetRoles: ["Frontend"],
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
    saveCvAtsProfile("h1", "ATS A", ["React"], ["Frontend"]);
    expect(readCvProfileLists("h2").searchProfiles).toEqual([]);
    expect(readCvProfileLists("h2").atsProfiles).toEqual([]);
  });

  it("ATS-Profile: neueste zuerst, Default-Name = erste Zielrolle (Fallback: erster Skill)", () => {
    saveCvAtsProfile("h1", "React ATS", ["React"], ["Frontend"]);
    const second = saveCvAtsProfile("h1", "  ", ["React", "TypeScript"], ["Frontend"]);
    expect(second?.name).toBe("Frontend");
    expect(readCvProfileLists("h1").atsProfiles.map((e) => e.name)).toEqual(["Frontend", "React ATS"]);
  });

  it("Default-Name des Suchprofils ist die Zielrolle", () => {
    expect(saveCvSearchProfile("h1", "", profile)?.name).toBe("Frontend");
  });

  it("ohne Hash wird nichts gespeichert (kein Throw)", () => {
    expect(saveCvSearchProfile(null, "x", profile)).toBeNull();
    expect(readCvProfileLists(undefined).atsProfiles).toEqual([]);
  });

  it("CV-UPLOAD-UX-08: gleicher Name ueberschreibt den Eintrag (kein Duplikat)", () => {
    const first = saveCvSearchProfile("h1", "Meins", profile);
    saveCvSearchProfile("h1", "Meins", { ...profile, city: "Hamburg" });
    const lists = readCvProfileLists("h1");
    expect(lists.searchProfiles).toHaveLength(1);
    expect(lists.searchProfiles[0].profile.city).toBe("Hamburg");
    expect(lists.searchProfiles[0].id).toBe(first!.id); // ID stabil

    saveCvAtsProfile("h1", "A1", ["React"], ["Frontend"]);
    const overwritten = saveCvAtsProfile("h1", "A1", ["React", "Node.js"], ["Frontend"]);
    const listsAts = readCvProfileLists("h1");
    expect(listsAts.atsProfiles).toHaveLength(1);
    expect(listsAts.atsProfiles[0].skills).toEqual(["React", "Node.js"]);
    expect(overwritten?.savedAt).toBeGreaterThanOrEqual(first!.savedAt);
  });

  it("CV-PROFILE-LISTS-02 (Privacy): Listen werden 12 h nach Verarbeitung automatisch geleert", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    saveCvSearchProfile("h1", "Profil1", profile);
    saveCvAtsProfile("h1", "ATS-Profil1", ["React"], ["Frontend"]);

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

  it("findSavedSearchProfile findet Eintrag per ID (für stille-Start-Verhinderung)", () => {
    const entry = saveCvSearchProfile("h1", "Meins", profile);
    const lists = readCvProfileLists("h1");
    expect(findSavedSearchProfile(lists, entry!.id)).toEqual(entry);
  });

  it("JM-PROFILE-CAPACITY-02-LIMIT: allows two CV search profiles and blocks a third", () => {
    expect(MAX_SEARCH_PROFILES_PER_CV).toBe(2);
    expect(saveCvSearchProfile("h1", "Eins", profile)).not.toBeNull();
    expect(saveCvSearchProfile("h1", "Zwei", profile)).not.toBeNull();
    expect(saveCvSearchProfile("h1", "Drei", profile)).toBeNull();
    expect(readCvProfileLists("h1").searchProfiles.map((entry) => entry.name)).toEqual([
      "Zwei",
      "Eins",
    ]);
  });

  it("keeps same-name upsert and existing updates possible at the limit", () => {
    const first = saveCvSearchProfile("h1", "Eins", profile)!;
    saveCvSearchProfile("h1", "Zwei", profile);
    const upserted = saveCvSearchProfile("h1", "Eins", { ...profile, city: "Hamburg" });
    expect(upserted?.id).toBe(first.id);
    expect(readCvProfileLists("h1").searchProfiles).toHaveLength(2);
    expect(readCvProfileLists("h1").searchProfiles.find((e) => e.id === first.id)?.profile.city).toBe(
      "Hamburg"
    );
  });

  it("frees capacity after deleting a search profile", () => {
    const first = saveCvSearchProfile("h1", "Eins", profile)!;
    saveCvSearchProfile("h1", "Zwei", profile);
    expect(saveCvSearchProfile("h1", "Drei", profile)).toBeNull();
    deleteCvSearchProfile("h1", first.id);
    expect(saveCvSearchProfile("h1", "Drei", profile)).not.toBeNull();
    expect(readCvProfileLists("h1").searchProfiles).toHaveLength(2);
  });

  it("applies the limit per CV hash and keeps ATS entries independent", () => {
    saveCvSearchProfile("h1", "Eins", profile);
    saveCvSearchProfile("h1", "Zwei", profile);
    expect(saveCvSearchProfile("h1", "Drei", profile)).toBeNull();
    expect(saveCvSearchProfile("h2", "Eins", profile)).not.toBeNull();
    expect(saveCvSearchProfile("h2", "Zwei", profile)).not.toBeNull();

    const parent = readCvProfileLists("h1").searchProfiles[0];
    saveCvAtsProfile("h1", "ATS 1", ["A"], ["R"], parent.id);
    saveCvAtsProfile("h1", "ATS 2", ["B"], ["R"], parent.id);
    saveCvAtsProfile("h1", "ATS 3", ["C"], ["R"], parent.id);
    expect(readCvProfileLists("h1").atsProfiles).toHaveLength(3);
  });

  it("grandfathering allows updates but no new entries when a bucket has more than two", () => {
    expect(canCreateCvSearchProfile(3, true)).toBe(true);
    expect(canCreateCvSearchProfile(3, false)).toBe(false);
    expect(canCreateCvSearchProfile(2, false)).toBe(false);
    expect(canCreateCvSearchProfile(1, false)).toBe(true);
  });

  it("findSavedSearchProfile liefert null bei unbekannter ID / leerer Liste / null", () => {
    saveCvSearchProfile("h1", "Meins", profile);
    const lists = readCvProfileLists("h1");
    expect(findSavedSearchProfile(lists, "gibt-es-nicht")).toBeNull();
    expect(findSavedSearchProfile(lists, null)).toBeNull();
    expect(findSavedSearchProfile(lists, "")).toBeNull();
    expect(findSavedSearchProfile({ searchProfiles: [], atsProfiles: [] }, "x")).toBeNull();
    expect(findSavedSearchProfile(null, "x")).toBeNull();
  });
});
