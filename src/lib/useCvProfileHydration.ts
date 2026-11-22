import { useEffect, useMemo, useRef, useState } from "react";
import type { CvProfileLists } from "./cvProfileStore";
import type { ATSSearchProfileV1 } from "./profiles/contractTypes";
import type { PersistentSearchProfiles } from "./usePersistentSearchProfiles";
import { mapPersistentCvProfiles } from "./cvProfileHydration";

export interface CvProfileHydrationState {
  byCvId: Record<string, CvProfileLists>;
  loading: boolean;
  error: string | null;
}

/**
 * Loads the durable CV-search profiles and their ATS children for the existing
 * CV dropdowns. This is read-only: it uses the already-authenticated RIS list
 * endpoints, never creates profiles and never starts a search or AI call.
 */
export async function loadPersistentCvProfileLists(
  profiles: Pick<PersistentSearchProfiles, "listCv" | "listAts">,
  cvId: string
): Promise<CvProfileLists> {
  const parents = await profiles.listCv(cvId);
  const atsResults = await Promise.allSettled(
    parents.map((parent) => profiles.listAts(parent.searchProfileId))
  );
  const atsByParent: Record<string, ATSSearchProfileV1[]> = {};
  parents.forEach((parent, index) => {
    const result = atsResults[index];
    if (result?.status === "fulfilled") {
      atsByParent[parent.searchProfileId] = result.value;
    }
  });
  return mapPersistentCvProfiles(cvId, parents, atsByParent);
}

export function useCvProfileHydration(
  cvIds: string[],
  profiles: PersistentSearchProfiles,
  identityKey: string | null,
  refreshToken: number
): CvProfileHydrationState {
  const [byCvId, setByCvId] = useState<Record<string, CvProfileLists>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const identityRef = useRef(identityKey);
  const cvKey = useMemo(
    () => [...new Set(cvIds.filter(Boolean))].sort().join("|"),
    [cvIds]
  );

  useEffect(() => {
    if (!profiles.active || !cvKey) {
      setByCvId({});
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const identityChanged = identityRef.current !== identityKey;
    identityRef.current = identityKey;
    setLoading(true);
    setError(null);
    // Keep already-hydrated lists during a refresh; clear them only when the
    // authenticated identity changes.
    if (identityChanged) setByCvId({});

    const ids = cvKey.split("|").filter(Boolean);
    void Promise.allSettled(
      ids.map(async (cvId) => {
        const lists = await loadPersistentCvProfileLists(profiles, cvId);
        return [cvId, lists] as const;
      })
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, CvProfileLists> = {};
      let failed = false;
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          next[result.value[0]] = result.value[1];
        } else {
          failed = true;
        }
      });
      setByCvId(next);
      setError(failed ? "search_profiles_unavailable" : null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [profiles.active, profiles.listAts, profiles.listCv, cvKey, identityKey, refreshToken]);

  return { byCvId, loading, error };
}
