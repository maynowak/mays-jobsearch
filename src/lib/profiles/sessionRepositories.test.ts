import { beforeEach, describe, expect, it } from 'vitest';
import { deleteCvSearchProfile, resetCvProfileLists, saveCvAtsProfile } from '../cvProfileStore';
import { createManualSearchProfileRepository } from '../manualSearchProfiles';
import {
  beginNewProfileSession,
  createSessionProfileRepositories,
  ProfileSessionEndedError,
} from './sessionRepositories';
import type { SearchConfigurationV1 } from './contractTypes';
import { ProfileValidationError } from './profileValidation';

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
    const search = await repositories.cvSearchProfiles.create('cv-hash-a', { name: 'Cloud', description: 'Saved description', searchConfig });
    expect(search.description).toBe('Saved description');
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

  it('rejects writes from a repository instance of an ended session', async () => {
    const repositories = createSessionProfileRepositories();
    beginNewProfileSession();

    await expect(
      repositories.manualSearchProfiles.create({
        name: 'Late profile',
        searchConfig,
        matchingPreferences: { requiredSkills: [], preferredSkills: [], excludedTerms: [] },
      })
    ).rejects.toBeInstanceOf(ProfileSessionEndedError);

    await expect(
      repositories.cvSearchProfiles.create('cv-hash-late', { name: 'Late CV', searchConfig })
    ).rejects.toBeInstanceOf(ProfileSessionEndedError);
  });

  it('rejects a delayed CV/ATS write after the session changed', async () => {
    const repositories = createSessionProfileRepositories();
    const search = await repositories.cvSearchProfiles.create('cv-hash-late', { name: 'CV', searchConfig });
    beginNewProfileSession();

    await expect(
      repositories.cvSearchProfiles.update('cv-hash-late', search.sessionId, { name: 'Changed' })
    ).rejects.toBeInstanceOf(ProfileSessionEndedError);
    await expect(
      repositories.atsSearchProfiles.create('cv-hash-late', search.sessionId, {
        name: 'Late ATS',
        targetRoles: ['DevOps Engineer'],
        skills: ['Terraform'],
      })
    ).rejects.toBeInstanceOf(ProfileSessionEndedError);
  });

  it('keeps ATS children and lists them as unassigned after parent deletion', async () => {
    const repositories = createSessionProfileRepositories();
    const search = await repositories.cvSearchProfiles.create('cv-unassigned', { name: 'Parent', searchConfig });
    const ats = await repositories.atsSearchProfiles.create('cv-unassigned', search.sessionId, {
      name: 'Orphan ATS',
      targetRoles: ['DevOps Engineer'],
      skills: ['Terraform', 'Cloud Architecture'],
      criteria: { schemaVersion: 1, requiredSkills: ['Terraform'] },
    });

    expect(deleteCvSearchProfile('cv-unassigned', search.sessionId)).toBe(true);
    const unassigned = await repositories.atsSearchProfiles.listUnassigned('cv-unassigned');
    expect(unassigned).toHaveLength(1);
    expect(unassigned[0].sessionId).toBe(ats.sessionId);
    expect(unassigned[0].skills).toEqual(['Terraform', 'Cloud Architecture']);
    expect(unassigned[0].criteria).toEqual({ schemaVersion: 1, requiredSkills: ['Terraform'] });
  });

  it('re-assigns an unassigned ATS profile without changing identity or content', async () => {
    const repositories = createSessionProfileRepositories();
    const target = await repositories.cvSearchProfiles.create('cv-reassign', { name: 'Target', searchConfig });
    const orphan = saveCvAtsProfile('cv-reassign', 'Orphan', ['AWS'], ['Cloud Engineer'], null);
    expect(orphan).not.toBeNull();

    const assigned = await repositories.atsSearchProfiles.assignUnassigned(
      'cv-reassign',
      orphan!.id,
      target.sessionId
    );
    expect(assigned.sessionId).toBe(orphan!.id);
    expect(assigned.searchProfileId).toBe(target.sessionId);
    expect(assigned.skills).toEqual(['AWS']);
    expect(await repositories.atsSearchProfiles.listUnassigned('cv-reassign')).toEqual([]);
    expect((await repositories.atsSearchProfiles.list('cv-reassign', target.sessionId))).toHaveLength(1);
  });

  it('rejects invalid unassigned assignments without mutating the store', async () => {
    const repositories = createSessionProfileRepositories();
    const target = await repositories.cvSearchProfiles.create('cv-invalid', { name: 'Target', searchConfig });
    const orphan = saveCvAtsProfile('cv-invalid', 'Orphan', ['AWS'], ['Cloud Engineer'], null)!;

    await expect(
      repositories.atsSearchProfiles.assignUnassigned('other-hash', orphan.id, target.sessionId)
    ).rejects.toBeInstanceOf(ProfileValidationError);
    await expect(
      repositories.atsSearchProfiles.assignUnassigned('cv-invalid', orphan.id, 'missing-parent')
    ).rejects.toBeInstanceOf(ProfileValidationError);
    expect(await repositories.atsSearchProfiles.listUnassigned('cv-invalid')).toHaveLength(1);
  });

  it('rejects assignment into a full parent and to an already assigned ATS profile', async () => {
    const repositories = createSessionProfileRepositories();
    const full = await repositories.cvSearchProfiles.create('cv-capacity', { name: 'Full', searchConfig });
    for (let index = 0; index < 5; index += 1) {
      await repositories.atsSearchProfiles.create('cv-capacity', full.sessionId, {
        name: `ATS ${index}`,
        targetRoles: ['Cloud Engineer'],
        skills: ['AWS'],
      });
    }
    const orphan = saveCvAtsProfile('cv-capacity', 'Orphan', ['AWS'], ['Cloud Engineer'], null)!;

    await expect(
      repositories.atsSearchProfiles.assignUnassigned('cv-capacity', orphan.id, full.sessionId)
    ).rejects.toMatchObject({ code: 'capacity_exceeded' });

    const assigned = (await repositories.atsSearchProfiles.list('cv-capacity', full.sessionId))[0];
    await expect(
      repositories.atsSearchProfiles.assignUnassigned('cv-capacity', assigned.sessionId, full.sessionId)
    ).rejects.toMatchObject({ code: 'validation_error' });
  });

  it('enforces the two-search-profile limit with capacity_exceeded', async () => {
    const repositories = createSessionProfileRepositories();
    await repositories.cvSearchProfiles.create('cv-limit', { name: 'One', searchConfig });
    await repositories.cvSearchProfiles.create('cv-limit', { name: 'Two', searchConfig });

    await expect(
      repositories.cvSearchProfiles.create('cv-limit', { name: 'Three', searchConfig })
    ).rejects.toMatchObject({ code: 'capacity_exceeded' });
    expect(await repositories.cvSearchProfiles.list('cv-limit')).toHaveLength(2);

    const existing = (await repositories.cvSearchProfiles.list('cv-limit'))[0];
    await expect(
      repositories.cvSearchProfiles.update('cv-limit', existing.sessionId, { name: 'One updated' })
    ).resolves.toMatchObject({ sessionId: existing.sessionId });

    const upsert = await repositories.cvSearchProfiles.create('cv-limit', {
      name: 'One updated',
      searchConfig,
    });
    expect(upsert.sessionId).toBe(existing.sessionId);

    await repositories.cvSearchProfiles.delete('cv-limit', existing.sessionId);
    await expect(
      repositories.cvSearchProfiles.create('cv-limit', { name: 'Three', searchConfig })
    ).resolves.toBeTruthy();
  });

  it('does not expose reads from an ended session repository', async () => {
    const repositories = createSessionProfileRepositories();
    const created = await repositories.manualSearchProfiles.create({
      name: 'Session A profile',
      searchConfig,
      matchingPreferences: { requiredSkills: [], preferredSkills: [], excludedTerms: [] },
    });
    const cv = await repositories.cvSearchProfiles.create('cv-hash-a', { name: 'CV A', searchConfig });
    beginNewProfileSession();

    await expect(repositories.manualSearchProfiles.list()).rejects.toBeInstanceOf(ProfileSessionEndedError);
    await expect(repositories.manualSearchProfiles.get(created.sessionId)).rejects.toBeInstanceOf(
      ProfileSessionEndedError
    );
    await expect(repositories.cvSearchProfiles.list('cv-hash-a')).rejects.toBeInstanceOf(ProfileSessionEndedError);
    await expect(repositories.cvSearchProfiles.get('cv-hash-a', cv.sessionId)).rejects.toBeInstanceOf(
      ProfileSessionEndedError
    );
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
