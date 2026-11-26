import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ATSSearchProfileV1,
  CVSearchProfileV1,
  CreateATSProfileInputV1,
  CreateCVSearchProfileInputV1,
  CreateManualSearchProfileInputV1,
  ManualSearchProfileV1,
} from "./profiles/contractTypes";
import {
  createAtsProfile,
  createCvSearchProfile,
  createManualSearchProfile,
  deleteAtsProfile,
  deleteCvSearchProfile,
  deleteManualSearchProfile,
  fetchSearchProfileConsent,
  grantSearchProfileConsent,
  isRisSearchProfileStorageEnabled,
  listAtsProfiles,
  listCvSearchProfiles,
  listManualSearchProfiles,
  updateAtsProfile,
  updateCvSearchProfile,
  updateManualSearchProfile,
  withdrawSearchProfileConsent,
  isSearchProfileVersionConflict,
  requireSearchProfileVersion,
  SearchProfilesApiError,
  type SearchProfileConsent,
  type SearchProfileConsentState,
  type VersionedUpdateATSProfileInputV1,
  type VersionedUpdateCVSearchProfileInputV1,
} from "./searchProfilesApi";
import type { ManualSearchProfile, ManualSearchProfileDraft } from "./manualSearchProfiles";

async function reloadAfterConflict(refresh: () => Promise<void>): Promise<void> {
  try {
    await refresh();
  } catch {
    // Keep the original 409 as the primary error; the next manual refresh can
    // retry the reload.
  }
}

function versionRequirement(version: number | undefined): number {
  return requireSearchProfileVersion(version);
}

function mapManual(profile: ManualSearchProfileV1): ManualSearchProfile {
  return {
    id: profile.manualSearchProfileId,
    schemaVersion: 1,
    name: profile.name,
    ...(profile.description ? { description: profile.description } : {}),
    origin: "manual",
    searchConfig: {
      ...profile.searchConfig,
      targetRoles: [...profile.searchConfig.targetRoles],
      workModes: [...profile.searchConfig.workModes],
      employmentTypes: [...profile.searchConfig.employmentTypes],
    },
    matchingPreferences: {
      requiredSkills: [...profile.matchingPreferences.requiredSkills],
      preferredSkills: [...profile.matchingPreferences.preferredSkills],
      excludedTerms: [...profile.matchingPreferences.excludedTerms],
    },
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    ...(typeof profile.version === "number" ? { version: profile.version } : {}),
  };
}

function manualInput(
  draft: ManualSearchProfileDraft
): CreateManualSearchProfileInputV1 {
  return {
    name: draft.name,
    ...(draft.description.trim() ? { description: draft.description } : {}),
    searchConfig: draft.searchConfig,
    matchingPreferences: draft.matchingPreferences,
  };
}

export interface PersistentSearchProfiles {
  available: boolean;
  active: boolean;
  persistentView: boolean;
  loading: boolean;
  error: string | null;
  consent: SearchProfileConsentState | null;
  manualProfiles: ManualSearchProfile[];
  refresh: () => Promise<void>;
  grantConsent: () => Promise<SearchProfileConsent>;
  withdrawConsent: () => Promise<SearchProfileConsent>;
  saveManual: (
    draft: ManualSearchProfileDraft,
    existingId: string | null,
    version?: number
  ) => Promise<void>;
  deleteManual: (id: string, version?: number) => Promise<void>;
  duplicateManual: (id: string) => Promise<void>;
  listCv: (cvId: string) => Promise<CVSearchProfileV1[]>;
  createCv: (cvId: string, input: CreateCVSearchProfileInputV1) => Promise<CVSearchProfileV1>;
  updateCv: (
    cvId: string,
    id: string,
    input: VersionedUpdateCVSearchProfileInputV1
  ) => Promise<CVSearchProfileV1>;
  deleteCv: (cvId: string, id: string, version: number) => Promise<void>;
  listAts: (searchProfileId: string) => Promise<ATSSearchProfileV1[]>;
  createAts: (searchProfileId: string, input: CreateATSProfileInputV1) => Promise<ATSSearchProfileV1>;
  updateAts: (
    searchProfileId: string,
    id: string,
    input: VersionedUpdateATSProfileInputV1
  ) => Promise<ATSSearchProfileV1>;
  deleteAts: (searchProfileId: string, id: string, version: number) => Promise<void>;
}

export function usePersistentSearchProfiles(
  token: string,
  enabled: boolean
): PersistentSearchProfiles {
  const baseAvailable = enabled && isRisSearchProfileStorageEnabled() && Boolean(token);
  const [denied, setDenied] = useState(false);
  const available = baseAvailable && !denied;
  const [consent, setConsent] = useState<SearchProfileConsentState | null>(null);
  const [manualProfiles, setManualProfiles] = useState<ManualSearchProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const consentStatus = consent?.consent?.status;
  const active = available && consentStatus === "GRANTED";
  const persistentView = available && (consentStatus === "GRANTED" || consentStatus === "WITHDRAWN");

  const refresh = useCallback(async () => {
    if (!baseAvailable) {
      setConsent(null);
      setManualProfiles([]);
      return;
    }
    const current = tokenRef.current;
    if (!current) return;
    setLoading(true);
    setError(null);
    try {
      const nextConsent = await fetchSearchProfileConsent(current);
      setConsent(nextConsent);
      if (nextConsent.consent?.status === "GRANTED" || nextConsent.consent?.status === "WITHDRAWN") {
        const items = await listManualSearchProfiles(current);
        setManualProfiles(items.map(mapManual));
      } else {
        setManualProfiles([]);
      }
    } catch (err) {
      if (err instanceof SearchProfilesApiError && err.status === 403) {
        setDenied(true);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : "search_profile_storage_unavailable");
      }
      setManualProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [baseAvailable]);

  useEffect(() => {
    setDenied(false);
    void refresh();
  }, [refresh, token]);

  const grantConsent = useCallback(async () => {
    const current = tokenRef.current;
    if (!current) throw new Error("search_profile_storage_unavailable");
    setLoading(true);
    setError(null);
    try {
      const granted = await grantSearchProfileConsent(current);
      await refresh();
      return granted;
    } catch (err) {
      if (err instanceof SearchProfilesApiError && err.status === 403) {
        setDenied(true);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : "search_profile_consent_failed");
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const withdrawConsent = useCallback(async () => {
    const current = tokenRef.current;
    if (!current) throw new Error("search_profile_storage_unavailable");
    setLoading(true);
    setError(null);
    try {
      const withdrawn = await withdrawSearchProfileConsent(current);
      setManualProfiles([]);
      await refresh();
      return withdrawn;
    } catch (err) {
      if (err instanceof SearchProfilesApiError && err.status === 403) {
        setDenied(true);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : "search_profile_consent_failed");
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const saveManual = useCallback(async (
    draft: ManualSearchProfileDraft,
    existingId: string | null,
    version?: number
  ) => {
    const current = tokenRef.current;
    if (!current) throw new Error("search_profile_storage_unavailable");
    try {
      if (existingId) {
        await updateManualSearchProfile(current, existingId, {
          ...manualInput(draft),
          version: versionRequirement(version),
        });
      } else {
        await createManualSearchProfile(current, manualInput(draft));
      }
    } catch (err) {
      // A stale version must not be overwritten. Reload so the user sees the
      // newer record; the caller still receives the conflict to show an error.
      if (isSearchProfileVersionConflict(err)) await reloadAfterConflict(refresh);
      throw err;
    }
    await refresh();
  }, [refresh]);

  const deleteManual = useCallback(async (id: string, version?: number) => {
    const current = tokenRef.current;
    if (!current) throw new Error("search_profile_storage_unavailable");
    try {
      await deleteManualSearchProfile(current, id, versionRequirement(version));
    } catch (err) {
      if (isSearchProfileVersionConflict(err)) await reloadAfterConflict(refresh);
      throw err;
    }
    await refresh();
  }, [refresh]);

  const duplicateManual = useCallback(async (id: string) => {
    const current = tokenRef.current;
    if (!current) throw new Error("search_profile_storage_unavailable");
    const source = manualProfiles.find((profile) => profile.id === id);
    if (!source) throw new Error("profile not found");
    await createManualSearchProfile(current, {
      name: `${source.name} (Kopie)`,
      ...(source.description ? { description: source.description } : {}),
      searchConfig: source.searchConfig,
      matchingPreferences: source.matchingPreferences,
    });
    await refresh();
  }, [manualProfiles, refresh]);

  const listCv = useCallback(async (cvId: string) => {
    const current = tokenRef.current;
    if (!current) throw new Error("search_profile_storage_unavailable");
    return listCvSearchProfiles(current, cvId);
  }, []);

  const createCv = useCallback(async (cvId: string, input: CreateCVSearchProfileInputV1) => {
    const current = tokenRef.current;
    if (!current) throw new Error("search_profile_storage_unavailable");
    return createCvSearchProfile(current, cvId, input);
  }, []);

  const updateCv = useCallback(async (
    cvId: string, id: string, input: VersionedUpdateCVSearchProfileInputV1
  ) => {
    const current = tokenRef.current;
    if (!current) throw new Error("search_profile_storage_unavailable");
    return updateCvSearchProfile(current, cvId, id, input);
  }, []);

  const deleteCv = useCallback(async (cvId: string, id: string, version: number) => {
    const current = tokenRef.current;
    if (!current) throw new Error("search_profile_storage_unavailable");
    await deleteCvSearchProfile(current, cvId, id, requireSearchProfileVersion(version));
  }, []);

  const listAts = useCallback(async (searchProfileId: string) => {
    const current = tokenRef.current;
    if (!current) throw new Error("search_profile_storage_unavailable");
    return listAtsProfiles(current, searchProfileId);
  }, []);

  const createAts = useCallback(async (
    searchProfileId: string, input: CreateATSProfileInputV1
  ) => {
    const current = tokenRef.current;
    if (!current) throw new Error("search_profile_storage_unavailable");
    return createAtsProfile(current, searchProfileId, input);
  }, []);

  const updateAts = useCallback(async (
    searchProfileId: string, id: string, input: VersionedUpdateATSProfileInputV1
  ) => {
    const current = tokenRef.current;
    if (!current) throw new Error("search_profile_storage_unavailable");
    return updateAtsProfile(current, searchProfileId, id, input);
  }, []);

  const deleteAts = useCallback(async (searchProfileId: string, id: string, version: number) => {
    const current = tokenRef.current;
    if (!current) throw new Error("search_profile_storage_unavailable");
    await deleteAtsProfile(current, searchProfileId, id, requireSearchProfileVersion(version));
  }, []);

  return {
    available,
    active,
    persistentView,
    loading,
    error,
    consent,
    manualProfiles,
    refresh,
    grantConsent,
    withdrawConsent,
    saveManual,
    deleteManual,
    duplicateManual,
    listCv,
    createCv,
    updateCv,
    deleteCv,
    listAts,
    createAts,
    updateAts,
    deleteAts,
  };
}
