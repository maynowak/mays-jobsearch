import type { CvAtsProfileEntry, CvProfileLists, CvSearchProfileEntry } from "./cvProfileStore";
import type { ATSSearchProfileV1, CVSearchProfileV1 } from "./profiles/contractTypes";
import { searchConfigurationToProfile } from "./profiles/profileMappers";

/**
 * Hydration-01: read-only projection of durable RIS CV-search and ATS profiles
 * into the shape used by the existing CV dropdowns. Nothing here creates or
 * updates a profile; the session store remains the owner of session entries.
 */
export function mapPersistentCvProfiles(
  cvId: string,
  searchProfiles: CVSearchProfileV1[],
  atsByParent: Record<string, ATSSearchProfileV1[]>
): CvProfileLists {
  const parents = searchProfiles.filter((profile) => profile.cvId === cvId);
  const parentIds = new Set(parents.map((profile) => profile.searchProfileId));

  return {
    searchProfiles: parents.map<CvSearchProfileEntry>((profile) => ({
      id: profile.searchProfileId,
      name: profile.name,
      savedAt: Date.parse(profile.updatedAt) || 0,
      profile: searchConfigurationToProfile(profile.searchConfig),
      ...(profile.description ? { description: profile.description } : {}),
      origin: "persistent",
    })),
    atsProfiles: Object.values(atsByParent)
      .flat()
      .filter((profile) => parentIds.has(profile.searchProfileId))
      .map<CvAtsProfileEntry>((profile) => ({
        id: profile.atsSearchProfileId,
        name: profile.name,
        savedAt: Date.parse(profile.updatedAt) || 0,
        targetRoles: [...profile.targetRoles],
        skills: [...profile.skills],
        searchProfileId: profile.searchProfileId,
        ...(profile.criteria ? { criteria: profile.criteria } : {}),
        origin: "persistent",
      })),
  };
}

/**
 * Durable entries win over session entries with the same name/parent. The
 * durable profile is the canonical account copy; session-only entries remain
 * visible under their own names. This keeps the existing dropdown semantics
 * without writing hydrated data back into the session store.
 */
export function mergeCvProfileLists(
  sessionLists: CvProfileLists | null | undefined,
  persistentLists: CvProfileLists | null | undefined
): CvProfileLists {
  const session = sessionLists ?? { searchProfiles: [], atsProfiles: [] };
  if (!persistentLists) return session;

  const persistentSearchNames = new Set(
    persistentLists.searchProfiles.map((entry) => entry.name.trim())
  );
  const persistentAtsKeys = new Set(
    persistentLists.atsProfiles.map((entry) =>
      `${entry.searchProfileId ?? ""}\u0000${entry.name.trim()}`
    )
  );

  return {
    searchProfiles: [
      ...persistentLists.searchProfiles,
      ...session.searchProfiles.filter(
        (entry) => !persistentSearchNames.has(entry.name.trim())
      ),
    ],
    atsProfiles: [
      ...persistentLists.atsProfiles,
      ...session.atsProfiles.filter(
        (entry) =>
          !persistentAtsKeys.has(
            `${entry.searchProfileId ?? ""}\u0000${entry.name.trim()}`
          )
      ),
    ],
  };
}

export function isPersistentProfileEntry(
  entry: CvSearchProfileEntry | CvAtsProfileEntry | null | undefined
): boolean {
  return entry?.origin === "persistent";
}
