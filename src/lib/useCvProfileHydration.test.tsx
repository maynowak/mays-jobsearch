import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { PersistentSearchProfiles } from "./usePersistentSearchProfiles";
import { useCvProfileHydration } from "./useCvProfileHydration";

const parent = {
  schemaVersion: 1 as const,
  searchProfileId: "sp-1",
  cvId: "cv-1",
  name: "Cloud",
  origin: "cv" as const,
  searchConfig: {
    skills: "AWS",
    targetRoles: ["Cloud Engineer"],
    city: "Berlin",
    radiusKm: null,
    workModes: [] as [],
    employmentTypes: ["full_time" as const],
  },
  createdAt: "2026-11-20T10:00:00.000Z",
  updatedAt: "2026-11-21T10:00:00.000Z",
  version: 1,
};

const ats = {
  schemaVersion: 1 as const,
  atsSearchProfileId: "ats-1",
  searchProfileId: "sp-1",
  name: "AWS Fokus",
  targetRoles: ["Cloud Engineer"],
  skills: ["AWS"],
  createdAt: "2026-11-20T10:00:00.000Z",
  updatedAt: "2026-11-21T10:00:00.000Z",
};

function fakeProfiles(active: boolean) {
  const listCv = vi.fn(async () => [parent]);
  const listAts = vi.fn(async () => [ats]);
  return {
    profiles: {
      active,
      listCv,
      listAts,
    } as unknown as PersistentSearchProfiles,
    listCv,
    listAts,
  };
}

describe("JM-CV-SEARCH-PROFILE-HYDRATION-01 hook", () => {
  it("loads durable profiles only through list calls when consent is active", async () => {
    const fake = fakeProfiles(true);
    const { result } = renderHook(() =>
      useCvProfileHydration(["cv-1"], fake.profiles, "issuer:sub", 0)
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fake.listCv).toHaveBeenCalledWith("cv-1");
    expect(fake.listAts).toHaveBeenCalledWith("sp-1");
    expect(result.current.byCvId["cv-1"].searchProfiles[0].name).toBe("Cloud");
    expect(result.current.byCvId["cv-1"].atsProfiles[0].name).toBe("AWS Fokus");
  });

  it("keeps search profiles when only an ATS child list fails", async () => {
    const fake = fakeProfiles(true);
    fake.listAts.mockRejectedValueOnce(new Error("ats unavailable"));
    const { result } = renderHook(() =>
      useCvProfileHydration(["cv-1"], fake.profiles, "issuer:sub", 0)
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.byCvId["cv-1"].searchProfiles[0].name).toBe("Cloud");
    expect(result.current.byCvId["cv-1"].atsProfiles).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("does not call the RIS list endpoints without consent", () => {
    const fake = fakeProfiles(false);
    const { result } = renderHook(() =>
      useCvProfileHydration(["cv-1"], fake.profiles, "issuer:sub", 0)
    );

    expect(fake.listCv).not.toHaveBeenCalled();
    expect(fake.listAts).not.toHaveBeenCalled();
    expect(result.current.byCvId).toEqual({});
  });

  it("clears hydrated data when the authenticated identity changes", async () => {
    const fake = fakeProfiles(true);
    const { result, rerender } = renderHook(
      ({ identity }: { identity: string }) =>
        useCvProfileHydration(["cv-1"], fake.profiles, identity, 0),
      { initialProps: { identity: "issuer:one" } }
    );
    await waitFor(() => expect(result.current.byCvId["cv-1"]).toBeTruthy());

    rerender({ identity: "issuer:two" });
    expect(result.current.byCvId).toEqual({});
    await waitFor(() => expect(result.current.byCvId["cv-1"]).toBeTruthy());
  });
});
