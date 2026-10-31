import type { EmploymentType, Profile, WorkMode } from '../../types';

export type SchemaVersion = 1;
export type ISODateTime = string;
export type OpaqueId = string;

export type { EmploymentType, Profile, WorkMode };

export interface SearchConfigurationV1 {
  skills: string;
  targetRoles: string[];
  city: string;
  radiusKm: number | null;
  workModes: WorkMode[];
  employmentTypes: EmploymentType[];
}

export interface MatchingPreferencesV1 {
  requiredSkills: string[];
  preferredSkills: string[];
  excludedTerms: string[];
}

export interface ATSCriteriaV1 {
  schemaVersion: SchemaVersion;
  requiredSkills?: string[];
  preferredSkills?: string[];
  excludedTerms?: string[];
}

export interface UserProfileV1 {
  schemaVersion: SchemaVersion;
  userId: string;
  tenantId?: string;
  nickname?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  status: 'active' | 'disabled' | 'pending';
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  version: number;
}

export interface CVDocumentV1 {
  schemaVersion: SchemaVersion;
  cvId: string;
  documentId: string;
  filename: string;
  contentType: 'application/pdf';
  sizeBytes: number;
  processingStatus: 'pending' | 'ready' | 'failed' | 'deleted';
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  version: number;
  metadata?: {
    pageCount?: number;
    language?: string;
  };
}

export interface CVSearchProfileV1 {
  schemaVersion: SchemaVersion;
  searchProfileId: string;
  cvId: string;
  name: string;
  description?: string;
  origin: 'cv';
  searchConfig: SearchConfigurationV1;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  version: number;
}

export interface ATSSearchProfileV1 {
  schemaVersion: SchemaVersion;
  atsSearchProfileId: string;
  searchProfileId: string;
  name: string;
  targetRoles: string[];
  skills: string[];
  criteria?: ATSCriteriaV1;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  version: number;
}

export interface ManualSearchProfileV1 {
  schemaVersion: SchemaVersion;
  manualSearchProfileId: string;
  name: string;
  description?: string;
  origin: 'manual';
  searchConfig: SearchConfigurationV1;
  matchingPreferences: MatchingPreferencesV1;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  version: number;
}

export interface UserProfilePatchV1 {
  nickname?: string;
  firstName?: string;
  lastName?: string;
}

export interface CreateCVInputV1 {
  documentId: string;
  filename: string;
  contentType: 'application/pdf';
  sizeBytes: number;
}

export interface UpdateCVInputV1 {
  filename?: string;
}

export interface CreateCVSearchProfileInputV1 {
  name: string;
  description?: string;
  searchConfig: SearchConfigurationV1;
}

export interface UpdateCVSearchProfileInputV1 {
  name?: string;
  description?: string;
  searchConfig?: SearchConfigurationV1;
}

export interface CreateATSProfileInputV1 {
  name: string;
  targetRoles: string[];
  skills: string[];
  criteria?: ATSCriteriaV1;
}

export interface UpdateATSProfileInputV1 {
  name?: string;
  targetRoles?: string[];
  skills?: string[];
  criteria?: ATSCriteriaV1;
}

export interface CreateManualSearchProfileInputV1 {
  name: string;
  description?: string;
  searchConfig: SearchConfigurationV1;
  matchingPreferences: MatchingPreferencesV1;
}

export interface UpdateManualSearchProfileInputV1 {
  name?: string;
  description?: string;
  searchConfig?: SearchConfigurationV1;
  matchingPreferences?: MatchingPreferencesV1;
}
