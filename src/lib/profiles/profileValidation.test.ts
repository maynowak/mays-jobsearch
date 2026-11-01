import { describe, expect, it } from 'vitest';
import {
  ProfileValidationError,
  validateATSCriteria,
  validateCreateCVInput,
  validateCreateManualSearchProfile,
  validateCVDocument,
  validateSearchConfiguration,
} from './profileValidation';

const searchConfig = {
  skills: 'AWS, "Cloud Architecture"',
  targetRoles: ['Cloud Engineer'],
  city: '',
  radiusKm: null,
  workModes: ['remote', 'hybrid'],
  employmentTypes: ['full_time', 'part_time'],
};

describe('JM-PROFILE-CONTRACT-02: runtime validation', () => {
  const cvBase = {
    schemaVersion: 1,
    cvId: 'cv_01EXAMPLE',
    documentId: 'doc_01EXAMPLE',
    filename: 'cv-example.pdf',
    contentType: 'application/pdf',
    createdAt: '2026-10-31T12:00:00Z',
    updatedAt: '2026-10-31T12:05:00Z',
    version: 1,
  };

  it('accepts pending, failed and deleted CVs without sizeBytes', () => {
    for (const processingStatus of ['pending', 'failed', 'deleted'] as const) {
      expect(() => validateCVDocument({ ...cvBase, processingStatus })).not.toThrow();
    }
  });

  it('requires a positive sizeBytes for ready CVs', () => {
    expect(() => validateCVDocument({ ...cvBase, processingStatus: 'ready', sizeBytes: 85000 })).not.toThrow();
    expect(() => validateCVDocument({ ...cvBase, processingStatus: 'ready' })).toThrowError(/requires sizeBytes/i);
    expect(() => validateCVDocument({ ...cvBase, processingStatus: 'ready', sizeBytes: 0 })).toThrowError(/positive/i);
    expect(() => validateCVDocument({ ...cvBase, processingStatus: 'ready', sizeBytes: -1 })).toThrowError(/positive/i);
  });

  it('keeps CreateCVInput size as a declared, positive upload hint', () => {
    expect(() => validateCreateCVInput({
      documentId: 'doc_01EXAMPLE', filename: 'cv-example.pdf',
      contentType: 'application/pdf', sizeBytes: 85000,
    })).not.toThrow();
    expect(() => validateCreateCVInput({
      documentId: 'doc_01EXAMPLE', filename: 'cv-example.pdf',
      contentType: 'application/pdf', sizeBytes: 0,
    })).toThrowError(/positive/i);
  });

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
