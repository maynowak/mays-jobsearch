import type { Profile } from '../../types';
import {
  applyManualSearchProfileDraft,
  createManualSearchProfile,
  createManualSearchProfileRepository,
  type ManualSearchProfile,
  type ManualSearchProfileDraft,
  type ManualSearchProfileRepository,
} from '../manualSearchProfiles';
import {
  deleteCvAtsProfile,
  deleteCvSearchProfile,
  readCvProfileLists,
  saveCvAtsProfile,
  saveCvSearchProfile,
  updateCvAtsProfile,
  updateCvSearchProfile,
} from '../cvProfileStore';
import type {
  CreateCVSearchProfileInputV1,
  CreateManualSearchProfileInputV1,
  UpdateManualSearchProfileInputV1,
} from './contractTypes';
import { validateATSCriteria, validateCreateATSProfile, validateCreateCVSearchProfile, validateCreateManualSearchProfile, validateSearchConfiguration, ProfileValidationError } from './profileValidation';
import type {
  SessionAtsSearchProfile,
  SessionCvSearchProfile,
  SessionManualSearchProfile,
  SessionProfileRepositories,
} from './repositoryTypes';

function missing(message: string): never {
  throw new ProfileValidationError(message, 'invalid_parent');
}

function cvSearchEntry(hash: string, id: string): SessionCvSearchProfile {
  const entry = readCvProfileLists(hash).searchProfiles.find((candidate) => candidate.id === id);
  if (!entry) throw new ProfileValidationError('CV search profile was not found', 'invalid_parent');
  return { sessionId: entry.id, cvHash: hash, name: entry.name, ...(entry.description === undefined ? {} : { description: entry.description }), savedAt: entry.savedAt, profile: { ...entry.profile, targetRoles: [...entry.profile.targetRoles], workModes: [...entry.profile.workModes], employmentTypes: [...entry.profile.employmentTypes] } };
}

function atsEntry(hash: string, searchProfileId: string, id: string): SessionAtsSearchProfile {
  const lists = readCvProfileLists(hash);
  if (!lists.searchProfiles.some((entry) => entry.id === searchProfileId)) {
    return missing('ATS parent search profile was not found');
  }
  const entry = lists.atsProfiles.find((candidate) => candidate.id === id && candidate.searchProfileId === searchProfileId);
  if (!entry) throw new ProfileValidationError('ATS search profile was not found', 'invalid_parent');
  return { sessionId: entry.id, cvHash: hash, searchProfileId, name: entry.name, savedAt: entry.savedAt, skills: [...entry.skills], targetRoles: [...entry.targetRoles], ...(entry.criteria ? { criteria: { ...entry.criteria, requiredSkills: entry.criteria.requiredSkills ? [...entry.criteria.requiredSkills] : undefined, preferredSkills: entry.criteria.preferredSkills ? [...entry.criteria.preferredSkills] : undefined, excludedTerms: entry.criteria.excludedTerms ? [...entry.criteria.excludedTerms] : undefined } } : {}) };
}

function profileFromSearchInput(input: CreateCVSearchProfileInputV1): Profile {
  return { ...input.searchConfig, targetRoles: [...input.searchConfig.targetRoles], workModes: [...input.searchConfig.workModes], employmentTypes: [...input.searchConfig.employmentTypes] };
}

function manualDraftFromInput(input: CreateManualSearchProfileInputV1): ManualSearchProfileDraft {
  return {
    name: input.name,
    description: input.description ?? '',
    searchConfig: profileFromSearchInput({ name: input.name, searchConfig: input.searchConfig }),
    matchingPreferences: {
      requiredSkills: [...input.matchingPreferences.requiredSkills],
      preferredSkills: [...input.matchingPreferences.preferredSkills],
      excludedTerms: [...input.matchingPreferences.excludedTerms],
    },
  };
}

function manualEntry(entry: ManualSearchProfile): SessionManualSearchProfile {
  return { sessionId: entry.id, entry };
}

function mergeManualInput(current: ManualSearchProfile, input: UpdateManualSearchProfileInputV1): CreateManualSearchProfileInputV1 {
  return {
    name: input.name ?? current.name,
    description: input.description ?? current.description ?? '',
    searchConfig: input.searchConfig ?? current.searchConfig,
    matchingPreferences: input.matchingPreferences ?? current.matchingPreferences,
  };
}

export interface SessionRepositoryOptions {
  manualRepository?: ManualSearchProfileRepository;
}

export function createSessionProfileRepositories(options: SessionRepositoryOptions = {}): SessionProfileRepositories {
  const manualRepository = options.manualRepository ?? createManualSearchProfileRepository();

  return {
    cvSearchProfiles: {
      async list(cvHash) {
        return readCvProfileLists(cvHash).searchProfiles.map((entry) => ({
          sessionId: entry.id,
          cvHash,
          name: entry.name,
          ...(entry.description === undefined ? {} : { description: entry.description }),
          savedAt: entry.savedAt,
          profile: { ...entry.profile, targetRoles: [...entry.profile.targetRoles], workModes: [...entry.profile.workModes], employmentTypes: [...entry.profile.employmentTypes] },
        }));
      },
      async get(cvHash, sessionId) {
        const entry = readCvProfileLists(cvHash).searchProfiles.find((candidate) => candidate.id === sessionId);
        return entry ? cvSearchEntry(cvHash, entry.id) : null;
      },
      async create(cvHash, input) {
        validateCreateCVSearchProfile(input);
        const entry = saveCvSearchProfile(cvHash, input.name, profileFromSearchInput(input), input.description);
        if (!entry) throw new ProfileValidationError('CV hash is required for a session profile', 'invalid_parent');
        return cvSearchEntry(cvHash, entry.id);
      },
      async update(cvHash, sessionId, input) {
        const current = await this.get(cvHash, sessionId);
        if (!current) throw new ProfileValidationError('CV search profile was not found', 'invalid_parent');
        if (input.searchConfig) validateSearchConfiguration(input.searchConfig);
        const updated = updateCvSearchProfile(cvHash, sessionId, input.name ?? current.name, input.searchConfig ? profileFromSearchInput({ name: input.name ?? current.name, searchConfig: input.searchConfig }) : current.profile, input.description ?? current.description);
        if (!updated) throw new ProfileValidationError('CV search profile was not found', 'invalid_parent');
        return cvSearchEntry(cvHash, updated.id);
      },
      async delete(cvHash, sessionId) {
        if (!deleteCvSearchProfile(cvHash, sessionId)) throw new ProfileValidationError('CV search profile was not found', 'invalid_parent');
      },
    },
    atsSearchProfiles: {
      async list(cvHash, searchProfileId) {
        const lists = readCvProfileLists(cvHash);
        if (!lists.searchProfiles.some((entry) => entry.id === searchProfileId)) return missing('ATS parent search profile was not found');
        return lists.atsProfiles.filter((entry) => entry.searchProfileId === searchProfileId).map((entry) => atsEntry(cvHash, searchProfileId, entry.id));
      },
      async get(cvHash, searchProfileId, sessionId) {
        const lists = readCvProfileLists(cvHash);
        if (!lists.searchProfiles.some((entry) => entry.id === searchProfileId)) return null;
        return lists.atsProfiles.some((entry) => entry.id === sessionId && entry.searchProfileId === searchProfileId) ? atsEntry(cvHash, searchProfileId, sessionId) : null;
      },
      async create(cvHash, searchProfileId, input) {
        if (!readCvProfileLists(cvHash).searchProfiles.some((entry) => entry.id === searchProfileId)) return missing('ATS parent search profile was not found');
        validateCreateATSProfile(input);
        const entry = saveCvAtsProfile(cvHash, input.name, input.skills, input.targetRoles, searchProfileId, input.criteria);
        if (!entry) throw new ProfileValidationError('ATS profile could not be created in the session context', 'validation_error');
        return atsEntry(cvHash, searchProfileId, entry.id);
      },
      async update(cvHash, searchProfileId, sessionId, input) {
        const current = await this.get(cvHash, searchProfileId, sessionId);
        if (!current) throw new ProfileValidationError('ATS search profile was not found', 'invalid_parent');
        const merged = { name: input.name ?? current.name, skills: input.skills ?? current.skills, targetRoles: input.targetRoles ?? current.targetRoles, ...(input.criteria ? { criteria: input.criteria } : current.criteria ? { criteria: current.criteria } : {}) };
        validateCreateATSProfile(merged);
        if (input.criteria) validateATSCriteria(input.criteria);
        const entry = updateCvAtsProfile(cvHash, sessionId, merged.name, merged.skills, merged.targetRoles, searchProfileId, merged.criteria);
        if (!entry) throw new ProfileValidationError('ATS search profile could not be updated', 'invalid_parent');
        return atsEntry(cvHash, searchProfileId, entry.id);
      },
      async delete(cvHash, searchProfileId, sessionId) {
        if (!(await this.get(cvHash, searchProfileId, sessionId)) || !deleteCvAtsProfile(cvHash, sessionId)) throw new ProfileValidationError('ATS search profile was not found', 'invalid_parent');
      },
    },
    manualSearchProfiles: {
      async list() {
        return manualRepository.list().map(manualEntry);
      },
      async get(sessionId) {
        const entry = manualRepository.get(sessionId);
        return entry ? manualEntry(entry) : null;
      },
      async create(input) {
        validateCreateManualSearchProfile(input);
        return manualEntry(manualRepository.save(createManualSearchProfile(manualDraftFromInput(input))));
      },
      async update(sessionId, input) {
        const current = manualRepository.get(sessionId);
        if (!current) throw new ProfileValidationError('Manual search profile was not found', 'invalid_parent');
        const merged = mergeManualInput(current, input);
        validateCreateManualSearchProfile(merged);
        const updated = applyManualSearchProfileDraft(current, manualDraftFromInput(merged));
        return manualEntry(manualRepository.save(updated));
      },
      async delete(sessionId) {
        if (!manualRepository.delete(sessionId)) throw new ProfileValidationError('Manual search profile was not found', 'invalid_parent');
      },
    },
  };
}
