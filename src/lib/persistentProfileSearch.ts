import type { Profile } from '../types';
import type {
  ATSSearchProfileV1,
  CVSearchProfileV1,
} from './profiles/contractTypes';
import { searchConfigurationToProfile } from './profiles/profileMappers';
import { buildCvSearchProfile } from './cvSearchConfig';

export type PersistentProfileSearchErrorCode =
  | 'invalid_cv'
  | 'invalid_parent'
  | 'missing_criteria';

export class PersistentProfileSearchError extends Error {
  readonly code: PersistentProfileSearchErrorCode;

  constructor(code: PersistentProfileSearchErrorCode) {
    super(code);
    this.name = 'PersistentProfileSearchError';
    this.code = code;
  }
}

/**
 * Builds the existing search profile from a durable CV search profile and an
 * optional ATS child. IDs are checked against the current CV and the actual
 * parent ID; a name is never used for the relationship.
 */
export function buildPersistentProfileSearch(
  cvId: string,
  parent: CVSearchProfileV1,
  ats?: ATSSearchProfileV1
): Profile {
  if (parent.cvId !== cvId) {
    throw new PersistentProfileSearchError('invalid_cv');
  }
  if (ats && ats.searchProfileId !== parent.searchProfileId) {
    throw new PersistentProfileSearchError('invalid_parent');
  }

  const parentProfile = searchConfigurationToProfile(parent.searchConfig);
  const searchProfile = buildCvSearchProfile(parentProfile, ats ?? null);
  if (
    searchProfile.skills.trim().length === 0 &&
    !searchProfile.targetRoles.some((role) => role.trim().length > 0)
  ) {
    throw new PersistentProfileSearchError('missing_criteria');
  }
  return searchProfile;
}
