import type { Profile } from '../types';

export interface AtsSearchOverride {
  skills: string[];
  targetRoles: string[];
}

// ATS search is an exclusive override for the parent's content fields. The
// parent remains the source for location and other search constraints because
// ATS entries intentionally store only skills and target roles.
export function buildCvSearchProfile(
  parent: Profile,
  ats: AtsSearchOverride | null | undefined
): Profile {
  if (!ats) return parent;
  return {
    ...parent,
    skills: ats.skills.join(', '),
    targetRoles: [...ats.targetRoles],
  };
}
