import { describe, expect, it } from 'vitest';
import { ProfileValidationError, validateATSCriteria, validateCreateManualSearchProfile, validateSearchConfiguration } from './profileValidation';

const searchConfig = {
  skills: 'AWS, "Cloud Architecture"',
  targetRoles: ['Cloud Engineer'],
  city: '',
  radiusKm: null,
  workModes: ['remote', 'hybrid'],
  employmentTypes: ['full_time', 'part_time'],
};

describe('JM-PROFILE-CONTRACT-02: runtime validation', () => {
  it('accepts valid optional search values and rejects unknown fields', () => {
    expect(() => validateSearchConfiguration(searchConfig)).not.toThrow();
    expect(() => validateSearchConfiguration({ ...searchConfig, remoteOnly: true })).toThrow(ProfileValidationError);
  });

  it('rejects invalid radius and enum values', () => {
    expect(() => validateSearchConfiguration({ ...searchConfig, radiusKm: 15 })).toThrowError(/radius/i);
    expect(() => validateSearchConfiguration({ ...searchConfig, workModes: ['remote', 'invalid'] })).toThrowError(/work mode/i);
  });

  it('requires a profile name and searchable content', () => {
    expect(() => validateCreateManualSearchProfile({
      name: '',
      searchConfig,
      matchingPreferences: { requiredSkills: [], preferredSkills: [], excludedTerms: [] },
    })).toThrowError(/name/i);
    expect(() => validateCreateManualSearchProfile({
      name: 'Empty',
      searchConfig: { ...searchConfig, skills: '', targetRoles: [] },
      matchingPreferences: { requiredSkills: [], preferredSkills: [], excludedTerms: [] },
    })).toThrowError(/searchable/i);
  });

  it('rejects ATS scores and model output in criteria', () => {
    expect(() => validateATSCriteria({ schemaVersion: 1, overallScore: 95 })).toThrowError(/Unexpected field/);
    expect(() => validateATSCriteria({ schemaVersion: 2 })).toThrowError(/version/i);
  });
});
