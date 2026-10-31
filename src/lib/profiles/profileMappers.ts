import type { Profile } from '../../types';
import type {
  SearchConfigurationV1,
  CreateManualSearchProfileInputV1,
  ManualSearchProfileV1,
  MatchingPreferencesV1,
} from './contractTypes';

const cloneStrings = (values: readonly string[] | undefined): string[] => [...(values ?? [])];

export function profileToSearchConfiguration(profile: Profile): SearchConfigurationV1 {
  return {
    skills: profile.skills ?? '',
    targetRoles: cloneStrings(profile.targetRoles),
    city: profile.city ?? '',
    radiusKm: profile.radiusKm ?? null,
    workModes: [...(profile.workModes ?? [])],
    employmentTypes: [...(profile.employmentTypes ?? [])],
  };
}

export function searchConfigurationToProfile(configuration: SearchConfigurationV1): Profile {
  return {
    skills: configuration.skills,
    targetRoles: cloneStrings(configuration.targetRoles),
    city: configuration.city,
    radiusKm: configuration.radiusKm,
    workModes: [...configuration.workModes],
    employmentTypes: [...configuration.employmentTypes],
  };
}

export function cloneSearchConfiguration(configuration: SearchConfigurationV1): SearchConfigurationV1 {
  return profileToSearchConfiguration(searchConfigurationToProfile(configuration));
}

export function manualInputToV1(
  input: CreateManualSearchProfileInputV1,
  id: string,
  timestamps: { createdAt: string; updatedAt: string },
  version = 1
): ManualSearchProfileV1 {
  return {
    schemaVersion: 1,
    manualSearchProfileId: id,
    name: input.name,
    ...(input.description === undefined ? {} : { description: input.description }),
    origin: 'manual',
    searchConfig: cloneSearchConfiguration(input.searchConfig),
    matchingPreferences: cloneMatchingPreferences(input.matchingPreferences),
    ...timestamps,
    version,
  };
}

export function cloneMatchingPreferences(preferences: MatchingPreferencesV1): MatchingPreferencesV1 {
  return {
    requiredSkills: cloneStrings(preferences.requiredSkills),
    preferredSkills: cloneStrings(preferences.preferredSkills),
    excludedTerms: cloneStrings(preferences.excludedTerms),
  };
}

export function cloneManualSearchProfileV1(profile: ManualSearchProfileV1): ManualSearchProfileV1 {
  return {
    ...profile,
    ...(profile.description === undefined ? {} : { description: profile.description }),
    searchConfig: cloneSearchConfiguration(profile.searchConfig),
    matchingPreferences: cloneMatchingPreferences(profile.matchingPreferences),
  };
}
