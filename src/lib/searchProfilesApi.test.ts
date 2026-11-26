import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAtsProfile,
  createCvSearchProfile,
  createManualSearchProfile,
  deleteAtsProfile,
  deleteCvSearchProfile,
  deleteManualSearchProfile,
  isSearchProfileVersionConflict,
  updateAtsProfile,
  updateCvSearchProfile,
  updateManualSearchProfile,
  fetchSearchProfileConsent,
  listManualSearchProfiles,
  SearchProfilesApiError,
} from "./searchProfilesApi";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("search-profiles BFF client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the manual contract with a generic type parameter", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { items: [], nextCursor: null }));
    vi.stubGlobal("fetch", fetchMock);
    await listManualSearchProfiles("token");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/api/ris/search-profiles?type=manual");
    expect(init.method).toBe("GET");
  });

  it("uses a durable cvId and no session hash for CV profiles", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(201, { searchProfileId: "sp-1" }));
    vi.stubGlobal("fetch", fetchMock);
    await createCvSearchProfile("token", "cv-1", {
      name: "Cloud",
      searchConfig: {
        skills: "aws",
        targetRoles: ["Cloud"],
        city: "Berlin",
        radiusKm: 25,
        workModes: ["remote"],
        employmentTypes: ["full_time"],
      },
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/api/ris/search-profiles?type=cv&cvId=cv-1");
    expect(JSON.parse(String(init.body)).name).toBe("Cloud");
  });

  it("links ATS profiles to the persistent search profile and normalizes the payload", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(201, { atsSearchProfileId: "ats-1" }));
    vi.stubGlobal("fetch", fetchMock);
    await createAtsProfile("token", "sp-1", {
      name: "  ATS  ",
      targetRoles: ["DevOps", " DevOps "],
      skills: ["Terraform", " Terraform "],
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/api/ris/search-profiles?type=ats&searchProfileId=sp-1");
    expect(JSON.parse(String(init.body))).toEqual({
      name: "ATS",
      targetRoles: ["DevOps"],
      skills: ["Terraform"],
    });
  });

  it("normalizes duplicate ATS payloads on update without merging casing", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { atsSearchProfileId: "ats-1" }));
    vi.stubGlobal("fetch", fetchMock);
    await updateAtsProfile("token", "sp-1", "ats-1", {
      name: "  ATS Cloud  ",
      targetRoles: [" DevOps ", "DevOps"],
      skills: [" Terraform ", "Terraform", "cloud architecture", "Cloud architecture"],
      version: 3,
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/api/ris/search-profiles?type=ats&id=ats-1&searchProfileId=sp-1");
    expect(JSON.parse(String(init.body))).toEqual({
      name: "ATS Cloud",
      targetRoles: ["DevOps"],
      skills: ["Terraform", "cloud architecture", "Cloud architecture"],
      version: 3,
    });
  });

  it("rejects an empty ATS name before sending a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(createAtsProfile("token", "sp-1", {
      name: "   ",
      targetRoles: ["DevOps"],
      skills: ["Terraform"],
    })).rejects.toThrow(/name/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the loaded version in manual PUT and DELETE requests", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { manualSearchProfileId: "msp-1" }));
    vi.stubGlobal("fetch", fetchMock);
    await updateManualSearchProfile("token", "msp-1", {
      name: "Cloud",
      version: 4,
    });
    let [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toMatchObject({ name: "Cloud", version: 4 });

    await deleteManualSearchProfile("token", "msp-1", 4);
    [url, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/api/ris/search-profiles?type=manual&id=msp-1&version=4");
  });

  it("sends the loaded version in CV-search PUT and DELETE requests", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { searchProfileId: "sp-1" }));
    vi.stubGlobal("fetch", fetchMock);
    await updateCvSearchProfile("token", "cv-1", "sp-1", {
      name: "Cloud",
      version: 2,
    });
    let [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toMatchObject({ name: "Cloud", version: 2 });

    await deleteCvSearchProfile("token", "cv-1", "sp-1", 2);
    [url, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/api/ris/search-profiles?type=cv");
    expect(url).toContain("cvId=cv-1");
    expect(url).toContain("id=sp-1");
    expect(url).toContain("version=2");
  });

  it("sends the loaded version in ATS PUT and DELETE requests", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { atsSearchProfileId: "ats-1" }));
    vi.stubGlobal("fetch", fetchMock);
    await updateAtsProfile("token", "sp-1", "ats-1", {
      name: "ATS",
      version: 5,
    });
    let [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toMatchObject({ name: "ATS", version: 5 });

    await deleteAtsProfile("token", "sp-1", "ats-1", 5);
    [url, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(init.method).toBe("DELETE");
    expect(url).toContain("/api/ris/search-profiles?type=ats&id=ats-1&searchProfileId=sp-1&version=5");
  });

  it("never adds a version to create requests", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(201, { schemaVersion: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    await createManualSearchProfile("token", {
      name: "Manual",
      searchConfig: {
        skills: "aws",
        targetRoles: [],
        city: "",
        radiusKm: null,
        workModes: [],
        employmentTypes: ["full_time"],
      },
      matchingPreferences: { requiredSkills: [], preferredSkills: [], excludedTerms: [] },
    });
    await createCvSearchProfile("token", "cv-1", {
      name: "CV",
      searchConfig: {
        skills: "aws",
        targetRoles: [],
        city: "",
        radiusKm: null,
        workModes: [],
        employmentTypes: ["full_time"],
      },
    });
    await createAtsProfile("token", "sp-1", {
      name: "ATS",
      targetRoles: [],
      skills: ["aws"],
    });
    for (const [, init] of fetchMock.mock.calls as unknown as Array<[string, RequestInit]>) {
      expect(JSON.parse(String(init.body))).not.toHaveProperty("version");
    }
  });

  it("classifies a 409 version conflict and refuses an update without a loaded version", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(409, {
      error: "RIS rejected the search-profile request",
      code: "version_conflict",
    })));
    const conflict = await updateCvSearchProfile("token", "cv-1", "sp-1", {
      name: "Cloud",
      version: 2,
    }).catch((error: unknown) => error);
    expect(isSearchProfileVersionConflict(conflict)).toBe(true);

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(updateManualSearchProfile("token", "msp-1", {
      name: "Cloud",
    } as never)).rejects.toMatchObject({ code: "version_required" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps a DRAFT consent non-grantable and exposes the text state", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, {
      consent: null,
      noticeVersion: "1.0",
      noticeState: "DRAFT",
      noticeApproved: false,
      acceptedForNewGrant: true,
      grantAllowed: false,
      textVersion: "search-profile-storage-consent-2026-11-08-v2",
      textHash: "75919c8bc219c938bdd2452a8bf02955997d1336ba2ca716bc691dd54eaa7ef6",
      textState: "DRAFT",
      textMapped: true,
      textApproved: false,
      textSyntheticAllowed: false,
      textReason: "consent_text_not_approved",
    })));
    const state = await fetchSearchProfileConsent("token");
    expect(state.grantAllowed).toBe(false);
    expect(state.textApproved).toBe(false);
    expect(state.textState).toBe("DRAFT");
    expect(state.noticeState).toBe("DRAFT");
  });

  it("fails closed with the server error code", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(403, {
      error: "Search-profile storage consent required",
      code: "SEARCH_PROFILE_STORAGE_CONSENT_REQUIRED",
    })));
    await expect(createManualSearchProfile("token", {
      name: "X",
      searchConfig: {
        skills: "",
        targetRoles: [],
        city: "",
        radiusKm: null,
        workModes: [],
        employmentTypes: ["full_time"],
      },
      matchingPreferences: { requiredSkills: [], preferredSkills: [], excludedTerms: [] },
    })).rejects.toBeInstanceOf(SearchProfilesApiError);
  });
});
