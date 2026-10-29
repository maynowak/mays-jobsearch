import { describe, expect, it } from 'vitest';
import type { Profile } from '../types';
import { buildCvSearchProfile } from './cvSearchConfig';

const parent: Profile = {
  skills: 'AWS, Python',
  targetRoles: ['Cloud Engineer'],
  city: 'Berlin',
  radiusKm: 25,
  workModes: ['remote'],
  employmentTypes: ['full_time'],
};

describe('buildCvSearchProfile', () => {
  it('keeps SearchProfile-only configuration unchanged', () => {
    expect(buildCvSearchProfile(parent, null)).toBe(parent);
  });

  it('uses ATS skills and roles while retaining parent search filters', () => {
    expect(
      buildCvSearchProfile(parent, {
        skills: ['Terraform', 'Docker'],
        targetRoles: ['DevOps Engineer'],
      })
    ).toEqual({
      skills: 'Terraform, Docker',
      targetRoles: ['DevOps Engineer'],
      city: 'Berlin',
      radiusKm: 25,
      workModes: ['remote'],
      employmentTypes: ['full_time'],
    });
  });
});
