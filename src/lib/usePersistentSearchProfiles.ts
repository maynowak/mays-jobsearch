import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ATSSearchProfileV1,
  CVSearchProfileV1,
  CreateATSProfileInputV1,
  CreateCVSearchProfileInputV1,
  CreateManualSearchProfileInputV1,
  ManualSearchProfileV1,
  UpdateATSProfileInputV1,
  UpdateCVSearchProfileInputV1,
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
  type SearchProfileConsent,
  type SearchProfileConsentState,
} from "./searchProfilesApi";
import type { ManualSearchProfile, ManualSearchProfileDraft } from "./manualSearchProfiles";

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
  loading: boolean;
  error: string | null;
  consent: SearchProfileConsentState | null;
  manualProfiles: ManualSearchProfile[];
  refresh: () => Promise<void>;
  grantConsent: () => Promise<SearchProfileConsent>;
  withdrawConsent: () => Promise<SearchProfileConsent>;
  saveManual: (draft: ManualSearchProfileDraft, existingId: string | null) => Promise<void>;
  deleteManual: (id: string) => Promise<void>;
  duplicateManual: (id: string) => Promise<void>;
  listCv: (cvId: string) => Promise<CVSearchProfileV1[]>;
  createCv: (cvId: string, input: CreateCVSearchProfileInputV1) => Promise<CVSearchProfileV1>;
  updateCv: (cvId: string, id: string, input: UpdateCVSearchProfileInputV1) => Promise<CVSearchProfileV1>;
  deleteCv: (cvId: string, id: string) => Promise<void>;
  listAts: (searchProfileId: string) => Promise<ATSSearchProfileV1[]>;
  createAts: (searchProfileId: string, input: CreateATSProfileInputV1) => Promise<ATSSearchProfileV1>;
  updateAts: (searchProfileId: string, id: string, input: UpdateATSProfileInputV1) => Promise<ATSSearchProfileV1>;
  deleteAts: (searchProfileId: string, id: string) => Promise<void>;
}

export function usePersistentSearchProfiles(
  token: string,
  enabled: boolean
): PersistentSearchProfiles {
  const available = enabled && isRisSearchProfileStorageEnabled() && Boolean(token);
  const [consent, setConsent] = useState<SearchProfileConsentState | null>(null);
  const [manualProfiles, setManualProfiles] = useState<ManualSearchProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const active = available && consent?.consent?.status === "GRANTED";

  const refresh = useCallback(async () => {
    if (!available) {
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
      if (nextConsent.consent?.status === "GRANTED") {
        const items = await listManualSearchProfiles(current);
        setManualProfiles(items.map(mapManual));
      } else {
        setManualProfiles([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "search_profile_storage_unavailable");
      setManualProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [available]);

  useEffect(() => {
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
      setError(err instanceof Error ? err.message : "search_profile_consent_failed");
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
      setError(err instanceof Error ? err.message : "search_profile_consent_failed");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const saveManual = useCallback(async (
    draft: ManualSearchProfileDraft,
    existingId: string | null
  ) => {
    const current = tokenRef.current;
    if (!current) throw new Error("search_profile_storage_unavailable");
    if (existingId) {
      await updateManualSearchProfile(current, existingId, manualInput(draft));
    } else {
      await createManualSearchProfile(current, manualInput(draft));
    }
    await refresh();
  }, [refresh]);

  const deleteManual = useCallback(async (id: string) => {
    const current = tokenRef.current;
    if (!current) throw new Error("search_profile_storage_unavailable");
    await deleteManualSearchProfile(current, id);
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
    cvId: string, id: string, input: UpdateCVSearchProfileInputV1
  ) => {
    const current = tokenRef.current;
    if (!current) throw new Error("search_profile_storage_unavailable");
    return updateCvSearchProfile(current, cvId, id, input);
  }, []);

  const deleteCv = useCallback(async (cvId: string, id: string) => {
    const current = tokenRef.current;
    if (!current) throw new Error("search_profile_storage_unavailable");
    await deleteCvSearchProfile(current, cvId, id);
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
    searchProfileId: string, id: string, input: UpdateATSProfileInputV1
  ) => {
    const current = tokenRef.current;
    if (!current) throw new Error("search_profile_storage_unavailable");
    return updateAtsProfile(current, searchProfileId, id, input);
  }, []);

  const deleteAts = useCallback(async (searchProfileId: string, id: string) => {
    const current = tokenRef.current;
    if (!current) throw new Error("search_profile_storage_unavailable");
    await deleteAtsProfile(current, searchProfileId, id);
  }, []);

  return {
    available,
    active,
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
