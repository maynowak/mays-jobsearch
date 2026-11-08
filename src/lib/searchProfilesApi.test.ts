import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAtsProfile,
  createCvSearchProfile,
  createManualSearchProfile,
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

  it("links ATS profiles to the persistent search profile", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(201, { atsSearchProfileId: "ats-1" }));
    vi.stubGlobal("fetch", fetchMock);
    await createAtsProfile("token", "sp-1", {
      name: "ATS",
      targetRoles: ["DevOps"],
      skills: ["Terraform"],
    });
    const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/api/ris/search-profiles?type=ats&searchProfileId=sp-1");
  });

  it("keeps a DRAFT consent non-grantable and exposes the text state", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, {
      consent: null,
      noticeVersion: "1.0",
      noticeState: "DRAFT",
      noticeApproved: false,
      acceptedForNewGrant: true,
      grantAllowed: false,
      textVersion: "search-profile-storage-consent-2026-11-08-v1",
      textHash: "926d1b9bbeefac4b97a5c51e3b6e6c1ed33a3affc3698e07456132be39b0f0f8",
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
