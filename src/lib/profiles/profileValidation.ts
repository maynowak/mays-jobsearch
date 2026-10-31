import type {
  CreateATSProfileInputV1,
  CreateCVSearchProfileInputV1,
  ATSCriteriaV1,
  CreateManualSearchProfileInputV1,
  MatchingPreferencesV1,
  SearchConfigurationV1,
} from './contractTypes';
import { EMPLOYMENT_TYPES, RADIUS_KM_OPTIONS, WORK_MODES } from '../../types';

export type ProfileValidationCode =
  | 'validation_error'
  | 'invalid_parent'
  | 'invalid_enum'
  | 'invalid_radius';

export class ProfileValidationError extends Error {
  readonly code: ProfileValidationCode;

  constructor(message: string, code: ProfileValidationCode = 'validation_error') {
    super(message);
    this.name = 'ProfileValidationError';
    this.code = code;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const assertKeys = (value: Record<string, unknown>, allowed: readonly string[]): void => {
  const allowedSet = new Set(allowed);
  const unexpected = Object.keys(value).find((key) => !allowedSet.has(key));
  if (unexpected) throw new ProfileValidationError(`Unexpected field: ${unexpected}`);
};

const readString = (value: unknown, field: string, allowEmpty = false, maxLength = 2000): string => {
  if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0) || value.length > maxLength) {
    throw new ProfileValidationError(`Invalid string field: ${field}`);
  }
  return value;
};

export const validatePhraseList = (value: unknown, field: string): string[] => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new ProfileValidationError(`Invalid phrase list: ${field}`);
  }
  const values = [...value] as string[];
  if (values.some((item) => item.length > 200)) throw new ProfileValidationError(`Phrase is too long: ${field}`);
  if (new Set(values.map((item) => item.toLowerCase())).size !== values.length) {
    throw new ProfileValidationError(`Duplicate phrase: ${field}`);
  }
  return values;
};

export function validateSearchConfiguration(value: unknown): asserts value is SearchConfigurationV1 {
  if (!isRecord(value)) throw new ProfileValidationError('Search configuration must be an object');
  assertKeys(value, ['skills', 'targetRoles', 'city', 'radiusKm', 'workModes', 'employmentTypes']);
  readString(value.skills, 'skills', true, 4000);
  validatePhraseList(value.targetRoles, 'targetRoles');
  readString(value.city, 'city', true, 200);
  if (value.radiusKm !== null && !RADIUS_KM_OPTIONS.includes(value.radiusKm as (typeof RADIUS_KM_OPTIONS)[number])) {
    throw new ProfileValidationError('Invalid radius', 'invalid_radius');
  }
  if (!Array.isArray(value.workModes) || value.workModes.some((mode) => !WORK_MODES.includes(mode as typeof WORK_MODES[number]))) {
    throw new ProfileValidationError('Invalid work mode', 'invalid_enum');
  }
  if (!Array.isArray(value.employmentTypes) || value.employmentTypes.length === 0 || value.employmentTypes.some((type) => !EMPLOYMENT_TYPES.includes(type as typeof EMPLOYMENT_TYPES[number]))) {
    throw new ProfileValidationError('Invalid employment type', 'invalid_enum');
  }
}

export function validateMatchingPreferences(value: unknown): asserts value is MatchingPreferencesV1 {
  if (!isRecord(value)) throw new ProfileValidationError('Matching preferences must be an object');
  assertKeys(value, ['requiredSkills', 'preferredSkills', 'excludedTerms']);
  validatePhraseList(value.requiredSkills, 'requiredSkills');
  validatePhraseList(value.preferredSkills, 'preferredSkills');
  validatePhraseList(value.excludedTerms, 'excludedTerms');
}

export function validateATSCriteria(value: unknown): asserts value is ATSCriteriaV1 {
  if (!isRecord(value)) throw new ProfileValidationError('ATS criteria must be an object');
  assertKeys(value, ['schemaVersion', 'requiredSkills', 'preferredSkills', 'excludedTerms']);
  if (value.schemaVersion !== 1) throw new ProfileValidationError('Unsupported ATS criteria schema version');
  if (value.requiredSkills !== undefined) validatePhraseList(value.requiredSkills, 'requiredSkills');
  if (value.preferredSkills !== undefined) validatePhraseList(value.preferredSkills, 'preferredSkills');
  if (value.excludedTerms !== undefined) validatePhraseList(value.excludedTerms, 'excludedTerms');
}

export function validateCreateCVSearchProfile(value: unknown): asserts value is CreateCVSearchProfileInputV1 {
  if (!isRecord(value)) throw new ProfileValidationError('CV search profile input must be an object');
  assertKeys(value, ['name', 'description', 'searchConfig']);
  readString(value.name, 'name');
  if (value.description !== undefined) readString(value.description, 'description', true);
  validateSearchConfiguration(value.searchConfig);
}

export function validateCreateATSProfile(value: unknown): asserts value is CreateATSProfileInputV1 {
  if (!isRecord(value)) throw new ProfileValidationError('ATS profile input must be an object');
  assertKeys(value, ['name', 'targetRoles', 'skills', 'criteria']);
  readString(value.name, 'name');
  validatePhraseList(value.targetRoles, 'targetRoles');
  validatePhraseList(value.skills, 'skills');
  if (value.criteria !== undefined) validateATSCriteria(value.criteria);
}

export function validateCreateManualSearchProfile(value: unknown): asserts value is CreateManualSearchProfileInputV1 {
  if (!isRecord(value)) throw new ProfileValidationError('Manual profile input must be an object');
  assertKeys(value, ['name', 'description', 'searchConfig', 'matchingPreferences']);
  readString(value.name, 'name');
  if (value.description !== undefined) readString(value.description, 'description', true);
  validateSearchConfiguration(value.searchConfig);
  validateMatchingPreferences(value.matchingPreferences);
  if (!value.searchConfig.skills.trim() && value.searchConfig.targetRoles.length === 0) {
    throw new ProfileValidationError('A searchable profile needs skills or target roles');
  }
}

export function assertSessionParent(expectedCvHash: string, actualCvHash: string | null | undefined): void {
  if (!expectedCvHash || expectedCvHash !== actualCvHash) {
    throw new ProfileValidationError('Profile does not belong to the requested CV session', 'invalid_parent');
  }
}
