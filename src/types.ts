export type JobSource = "existing" | "apify-arbeitsagentur";

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
  jobTypes?: string[];
  contractType?: string;
  salary?: string;
  startDate?: string;
}

export interface Profile {
  skills: string;
  targetRole: string;
  city: string;
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
