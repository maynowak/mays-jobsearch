export interface Job {
  slug: string;
  title: string;
  company_name: string;
  location: string[];
  remote: boolean;
  tags: string[];
  url: string;
  created_at?: number;
}

export interface Profile {
  skills: string;
  targetRole: string;
  city: string;
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
  };
}

export interface MatchResponse {
  matches: Match[];
  meta?: {
    evaluated?: number;
    note?: string;
  };
}

export type StatusType = "error" | "info" | "warn";

export interface StatusMessage {
  type: StatusType;
  message: string;
}
