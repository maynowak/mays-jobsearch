import { describe, expect, it } from 'vitest';
import {
  buildPersistentProfileSearch,
  PersistentProfileSearchError,
} from './persistentProfileSearch';
import type { ATSSearchProfileV1, CVSearchProfileV1 } from './profiles/contractTypes';

function parent(overrides: Partial<CVSearchProfileV1> = {}): CVSearchProfileV1 {
  return {
    schemaVersion: 1,
    searchProfileId: 'sp-1',
    cvId: 'cv-1',
    name: 'Frontend Berlin',
    origin: 'cv',
    searchConfig: {
      skills: 'React, TypeScript',
      targetRoles: ['Frontend Developer'],
      city: 'Berlin',
      radiusKm: 25,
      workModes: ['remote', 'hybrid'],
      employmentTypes: ['full_time'],
    },
    createdAt: '2026-11-10T10:00:00Z',
    updatedAt: '2026-11-10T10:00:00Z',
    version: 1,
    ...overrides,
  };
}

function ats(overrides: Partial<ATSSearchProfileV1> = {}): ATSSearchProfileV1 {
  return {
    schemaVersion: 1,
    atsSearchProfileId: 'ats-1',
    searchProfileId: 'sp-1',
    name: 'Frontend ATS',
    targetRoles: ['Frontend Engineer'],
    skills: ['React', 'GraphQL'],
    createdAt: '2026-11-10T10:00:00Z',
    updatedAt: '2026-11-10T10:00:00Z',
    version: 1,
    ...overrides,
  };
}

describe('buildPersistentProfileSearch', () => {
  it('uses the parent configuration for a CV search profile', () => {
    expect(buildPersistentProfileSearch('cv-1', parent())).toEqual({
      skills: 'React, TypeScript',
      targetRoles: ['Frontend Developer'],
      city: 'Berlin',
      radiusKm: 25,
      workModes: ['remote', 'hybrid'],
      employmentTypes: ['full_time'],
    });
  });

  it('uses ATS skills and roles while retaining parent location and filters', () => {
    expect(buildPersistentProfileSearch('cv-1', parent(), ats())).toEqual({
      skills: 'React, GraphQL',
      targetRoles: ['Frontend Engineer'],
      city: 'Berlin',
      radiusKm: 25,
      workModes: ['remote', 'hybrid'],
      employmentTypes: ['full_time'],
    });
  });

  it('rejects a profile from another CV', () => {
    expect(() => buildPersistentProfileSearch('cv-2', parent())).toThrow(
      PersistentProfileSearchError
    );
  });

  it('rejects an ATS child with a different parent ID', () => {
    expect(() =>
      buildPersistentProfileSearch('cv-1', parent(), ats({ searchProfileId: 'sp-2' }))
    ).toThrow(PersistentProfileSearchError);
  });

  it('rejects a profile without skills or target roles', () => {
    expect(() =>
      buildPersistentProfileSearch(
        'cv-1',
        parent({
          searchConfig: {
            ...parent().searchConfig,
            skills: '',
            targetRoles: [],
          },
        })
      )
    ).toThrow(PersistentProfileSearchError);
  });
});
