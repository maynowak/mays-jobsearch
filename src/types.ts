export type JobSource = "existing" | "apify-arbeitsagentur";

export interface Job {
  slug: string;
  title: string;
  company_name: string;
  location: string[];
  remote: boolean;
  tags: string[];
  url: string;
  created_at?: number;
  source?: JobSource[];
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
  };
}

export interface ModelOption {
  id: string;
  name: string;
}

export interface ModelsResponse {
  models: ModelOption[];
  defaultModel?: string;
  fallbackModel?: string | null;
  recommendedModel?: string | null;
}

export type StatusType = "error" | "info" | "warn";

export interface StatusMessage {
  type: StatusType;
  message: string;
}
