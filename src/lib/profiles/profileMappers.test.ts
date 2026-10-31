import { describe, expect, it } from 'vitest';
import type { Profile } from '../../types';
import { profileToSearchConfiguration, searchConfigurationToProfile } from './profileMappers';

const fixture: Profile = {
  skills: 'AWS, Terraform, "Cloud Architecture"',
  targetRoles: ['Cloud Engineer', 'Solutions Architect'],
  city: '',
  radiusKm: null,
  workModes: ['remote', 'hybrid'],
  employmentTypes: ['full_time', 'part_time'],
};

describe('JM-PROFILE-CONTRACT-02: Profile/SearchConfiguration mapping', () => {
  it('round-trips every supported Profile field without loss', () => {
    const configuration = profileToSearchConfiguration(fixture);
    expect(searchConfigurationToProfile(configuration)).toEqual(fixture);
  });

  it('defensively clones arrays and keeps multi-word skills intact', () => {
    const configuration = profileToSearchConfiguration(fixture);
    configuration.targetRoles.push('Changed');
    configuration.workModes.length = 0;
    const restored = searchConfigurationToProfile(profileToSearchConfiguration(fixture));
    expect(restored).toEqual(fixture);
    expect(restored.skills).toContain('"Cloud Architecture"');
  });
});
