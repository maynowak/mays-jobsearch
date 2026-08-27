export type JobSource = "arbeitnow" | "arbeitsagentur";

export interface SourceInfo {
  id: string;
  displayName: string;
  provider: string;
  enabled: boolean;
  actorId?: string;
}

export interface Job {
  slug: string;
  title: string;
  company_name: string;
  location: string[];
  remote: boolean;
  tags: string[];
  url: string;
  created_at?: number | string;
  source?: JobSource[];
  description?: string;
  descriptionPlain?: string;
  jobTypes?: string[];
  contractType?: string;
  salary?: string;
  startDate?: string;
}

export type WorkMode = "remote" | "hybrid" | "onsite";

export type EmploymentType = "full_time" | "part_time";

export const RADIUS_KM_OPTIONS = [10, 25, 50, 100] as const;

export const WORK_MODES: WorkMode[] = ["remote", "hybrid", "onsite"];

export const EMPLOYMENT_TYPES: EmploymentType[] = ["full_time", "part_time"];

export interface Profile {
  skills: string;
  targetRole: string;
  city: string;
  radiusKm: number | null;
  workModes: WorkMode[];
  employmentTypes: EmploymentType[];
}

export interface SuggestedProfile {
  skills: string[];
  experienceLevel: string;
  targetRoles: string[];
  location: string;
}

export interface Match {
  score: number;
  why: string;
  prepare: string;
  job: Job | null;
}

export interface JobsResponse {
  jobs: Job[];
  meta?: {
    totalScanned?: number;
    totalFiltered?: number;
    city?: string[];
    keywords?: string[];
    sources?: Partial<Record<JobSource, number>>;
    sourceCounts?: Partial<Record<JobSource, number>>;
    disabledSources?: string[];
    sourceDetails?: SourceInfo[];
    jobsCombined?: number;
    apify?: { enabled?: boolean };
  };
}

export interface MatchResponse {
  matches: Match[];
  meta?: {
    evaluated?: number;
    note?: string;
    totalFound?: number;
    displayedInitially?: number;
  };
}

export interface ModelProvider {
  id: string;
  name: string;
}

export interface ModelOption {
  id: string;
  name: string;
  provider?: ModelProvider;
}

export interface ModelsResponse {
  models: ModelOption[];
  providers?: ModelProvider[];
  defaultModel?: string;
  fallbackModel?: string | null;
  recommendedModel?: string | null;
  fallbackMaxAttempts?: number;
}

export type StatusType = "error" | "info" | "warn";

export interface StatusMessage {
  type: StatusType;
  message: string;
}
