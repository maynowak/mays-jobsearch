import { beforeEach, describe, expect, it } from 'vitest';
import { resetCvProfileLists } from '../cvProfileStore';
import { createManualSearchProfileRepository } from '../manualSearchProfiles';
import { createSessionProfileRepositories } from './sessionRepositories';
import type { SearchConfigurationV1 } from './contractTypes';

const searchConfig: SearchConfigurationV1 = {
  skills: 'AWS, "Cloud Architecture"',
  targetRoles: ['Cloud Engineer'],
  city: '',
  radiusKm: null,
  workModes: ['remote', 'hybrid'],
  employmentTypes: ['full_time', 'part_time'],
};

beforeEach(() => resetCvProfileLists());

describe('JM-PROFILE-SESSION-ADAPTER-03: session repositories', () => {
  it('keeps CV search and ATS children isolated by hash and parent', async () => {
    const repositories = createSessionProfileRepositories();
    const search = await repositories.cvSearchProfiles.create('cv-hash-a', { name: 'Cloud', searchConfig });
    const ats = await repositories.atsSearchProfiles.create('cv-hash-a', search.sessionId, {
      name: 'ATS Cloud',
      targetRoles: ['DevOps Engineer'],
      skills: ['Terraform', 'Cloud Architecture'],
      criteria: { schemaVersion: 1, requiredSkills: ['Terraform'], preferredSkills: ['Cloud Architecture'], excludedTerms: [] },
    });

    expect((await repositories.cvSearchProfiles.list('cv-hash-b'))).toEqual([]);
    expect((await repositories.atsSearchProfiles.list('cv-hash-a', search.sessionId))).toHaveLength(1);
    expect(ats.criteria?.requiredSkills).toEqual(['Terraform']);
    expect(await repositories.atsSearchProfiles.get('cv-hash-a', 'wrong-parent', ats.sessionId)).toBeNull();
    await repositories.atsSearchProfiles.delete('cv-hash-a', search.sessionId, ats.sessionId);
    expect(await repositories.atsSearchProfiles.get('cv-hash-a', search.sessionId, ats.sessionId)).toBeNull();
  });

  it('creates, updates and deletes manual profiles without a CV reference', async () => {
    const repositories = createSessionProfileRepositories({ manualRepository: createManualSearchProfileRepository() });
    const created = await repositories.manualSearchProfiles.create({
      name: 'Manual Cloud',
      searchConfig,
      matchingPreferences: { requiredSkills: ['AWS'], preferredSkills: [], excludedTerms: [] },
    });
    expect(created.entry).not.toHaveProperty('cvId');
    expect(created.entry).not.toHaveProperty('hash');

    const updated = await repositories.manualSearchProfiles.update(created.sessionId, {
      name: 'Manual Cloud Updated',
      matchingPreferences: { requiredSkills: ['AWS'], preferredSkills: ['Terraform'], excludedTerms: [] },
    });
    expect(updated.entry.name).toBe('Manual Cloud Updated');
    expect(updated.entry.matchingPreferences.preferredSkills).toEqual(['Terraform']);

    await repositories.manualSearchProfiles.delete(created.sessionId);
    expect(await repositories.manualSearchProfiles.get(created.sessionId)).toBeNull();
  });

  it('does not manufacture persistent IDs or versions for session records', async () => {
    const repositories = createSessionProfileRepositories();
    const created = await repositories.cvSearchProfiles.create('hash-only', { name: 'Session', searchConfig });
    expect(created.cvHash).toBe('hash-only');
    expect(created.sessionId).toBeTruthy();
    expect(created).not.toHaveProperty('cvId');
    expect(created).not.toHaveProperty('version');
  });
});
