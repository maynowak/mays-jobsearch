import type {
  CreateATSProfileInputV1,
  CreateCVSearchProfileInputV1,
  CreateManualSearchProfileInputV1,
  ATSCriteriaV1,
  Profile,
  UpdateATSProfileInputV1,
  UpdateCVSearchProfileInputV1,
  UpdateManualSearchProfileInputV1,
} from './contractTypes';

export interface SessionCvSearchProfile {
  sessionId: string;
  cvHash: string;
  name: string;
  description?: string;
  savedAt: number;
  profile: Profile;
}

export interface SessionAtsSearchProfile {
  sessionId: string;
  cvHash: string;
  searchProfileId: string;
  name: string;
  savedAt: number;
  skills: string[];
  targetRoles: string[];
  criteria?: ATSCriteriaV1;
}

/** ATS profile without a parent search profile (session-only). */
export interface SessionUnassignedAtsProfile {
  sessionId: string;
  cvHash: string;
  name: string;
  savedAt: number;
  skills: string[];
  targetRoles: string[];
  criteria?: ATSCriteriaV1;
}

export interface SessionManualSearchProfile {
  sessionId: string;
  entry: import('../manualSearchProfiles').ManualSearchProfile;
}

export interface SessionCvSearchProfileRepository {
  list(cvHash: string): Promise<SessionCvSearchProfile[]>;
  get(cvHash: string, sessionId: string): Promise<SessionCvSearchProfile | null>;
  create(cvHash: string, input: CreateCVSearchProfileInputV1): Promise<SessionCvSearchProfile>;
  update(cvHash: string, sessionId: string, input: UpdateCVSearchProfileInputV1): Promise<SessionCvSearchProfile>;
  delete(cvHash: string, sessionId: string): Promise<void>;
}

export interface SessionAtsSearchProfileRepository {
  list(cvHash: string, searchProfileId: string): Promise<SessionAtsSearchProfile[]>;
  get(cvHash: string, searchProfileId: string, sessionId: string): Promise<SessionAtsSearchProfile | null>;
  create(cvHash: string, searchProfileId: string, input: CreateATSProfileInputV1): Promise<SessionAtsSearchProfile>;
  update(cvHash: string, searchProfileId: string, sessionId: string, input: UpdateATSProfileInputV1): Promise<SessionAtsSearchProfile>;
  delete(cvHash: string, searchProfileId: string, sessionId: string): Promise<void>;
  listUnassigned(cvHash: string): Promise<SessionUnassignedAtsProfile[]>;
  assignUnassigned(
    cvHash: string,
    atsSessionId: string,
    targetSearchProfileId: string
  ): Promise<SessionAtsSearchProfile>;
}

export interface SessionManualSearchProfileRepository {
  list(): Promise<SessionManualSearchProfile[]>;
  get(sessionId: string): Promise<SessionManualSearchProfile | null>;
  create(input: CreateManualSearchProfileInputV1): Promise<SessionManualSearchProfile>;
  update(sessionId: string, input: UpdateManualSearchProfileInputV1): Promise<SessionManualSearchProfile>;
  delete(sessionId: string): Promise<void>;
}

export interface SessionProfileRepositories {
  cvSearchProfiles: SessionCvSearchProfileRepository;
  atsSearchProfiles: SessionAtsSearchProfileRepository;
  manualSearchProfiles: SessionManualSearchProfileRepository;
}
