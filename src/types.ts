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
  language?: string;
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

export type AtsCategory =
  | "keyword"
  | "skill"
  | "requirement"
  | "experience"
  | "education"
  | "certification"
  | "location"
  | "workmode"
  | "employment";

export type AtsMatchStatus = "MATCHED" | "PARTIAL" | "GAP" | "UNKNOWN";

export type AtsConfidence = "HIGH" | "MEDIUM" | "LOW";

export type AtsImportance = "critical" | "high" | "medium" | "low";

export type AtsSourceType = "title" | "tags" | "description" | "contractType" | "jobTypes" | "location" | "remote";

export type AtsEvidenceType = "direct" | "indirect" | "none";

export type AtsSourceKey = "skills" | "experience" | "education" | "certification" | "location" | "workmode";

export interface AtsRequirement {
  id: string;
  text: string;
  category: AtsCategory;
  importance: AtsImportance;
  source: AtsSourceType;
  explicitness: "explicit" | "implicit";
  normalized: string;
}

export interface AtsEvidence {
  requirementId: string;
  source: AtsSourceKey;
  text: string;
  normalized: string;
  evidenceType: AtsEvidenceType;
  confidence: AtsConfidence;
}

export interface AtsMatchResult {
  requirementId: string;
  status: AtsMatchStatus;
  confidence: AtsConfidence;
}

export interface AtsRecommendation {
  requirementId: string;
  changeType: "KEYWORD_REINFORCEMENT" | "EVIDENCE_CLARIFICATION" | "GAP_FLAG" | "UNKNOWN_REVIEW" | "MISSING_CERTIFICATE";
  priority: AtsImportance;
  proposedChange: string;
  rationale: string;
  relatedCVEvidence?: string | null;
}

export interface AtsAnalysisResult {
  job: {
    slug: string;
    title: string;
    company: string;
  };
  requirements: AtsRequirement[];
  evidence: AtsEvidence[];
  matches: AtsMatchResult[];
  scores: {
    keywordMatch: number;
    skillMatch: number;
    locationMatch: number;
    workmodeMatch: number;
    employmentMatch: number;
    overall: number;
  };
  summary: {
    matched: number;
    partial: number;
    gap: number;
    unknown: number;
  };
  criticalGaps: AtsRequirement[];
  recommendations: AtsRecommendation[];
}

export interface RequirementDelta {
  requirementId: string;
  requirementText: string;
  beforeStatus: "MATCHED" | "PARTIAL" | "GAP" | "UNKNOWN";
  afterStatus: "MATCHED" | "PARTIAL" | "GAP" | "UNKNOWN";
  beforeConfidence: string;
  afterConfidence: string;
  category: "improved" | "unchanged" | "regressed";
}

export interface ImprovementDelta {
  scoreDelta: number;
  coverageDelta: number;
  matchedDelta?: number;
  partialDelta?: number;
  gapDelta?: number;
  unknownDelta?: number;
  requirementsImproved?: number;
  requirementsUnchanged?: number;
  requirementsRegressed?: number;
  requirementsImprovedDetails?: string[];
  requirementsUnchangedDetails?: string[];
  requirementsRegressedDetails?: string[];
  requirementDeltas?: RequirementDelta[];
}

export interface AtsAnalysisSummary {
  score: number;
  keywordCoverage: { overall: number };
  criticalGaps: Array<{ id: string; text: string }>;
  requirements: Array<{
    id: string;
    text: string;
    category: string;
    importance: string;
  }>;
  matches: Array<{
    requirementId: string;
    status: string;
    confidence: string;
  }>;
}

export interface AtsReanalysisResult {
  before: AtsAnalysisSummary;
  after: AtsAnalysisSummary;
  delta: ImprovementDelta;
}

export type CvProcessingStep =
  | "reading"
  | "target"
  | "idle"
  | "document-selected"
  | "consent-required"
  | "consent-given"
  | "model-selection"
  | "creating-profile"
  | "anonymizing"
  | "goal-selection"
  | "skill-selection"
  | "ats-processing"
  | "ats-complete"
  | "ai-searching"
  | "ai-complete"
  | "success"
  | "error"
  | "profile-ready"
  | "improving"
  | "improved"
  | "improvement-selection"
  | "reanalysis"
  | "comparison"
  | "match-impact-select";

export interface CvDocument {
  id: string;
  name: string;
  size: number;
  selected: boolean;
  file: File;
}

export type AnonymizationMode = "anonymized" | "not-anonymized";

export type ProcessingGoal = "ats" | "ai-search";

import type { AtsAnalysisResponse, CvImprovementRecommendation } from "./api";

export interface Match {
  score: number;
  why: string;
  prepare: string;
  job: Job | null;
}

export interface MatchImpactBefore {
  score: number;
  coverage: number;
}

export interface MatchImpactAfter {
  score: number;
  coverage: number;
}

export interface MatchImpactDelta {
  score: number;
  coverage: number;
}

export interface MatchImpactChanges {
  improved: string[];
  unchanged: string[];
  regressed: string[];
}

export interface MatchImpactResult {
  before: MatchImpactBefore;
  after: MatchImpactAfter;
  delta: MatchImpactDelta;
  changes: MatchImpactChanges;
}

export interface CvProcessingState {
  step: CvProcessingStep;
  documents: CvDocument[];
  selectedDocumentId: string | null;
  consentGiven: boolean;
  anonymizationMode: AnonymizationMode;
  processingGoal: ProcessingGoal;
  error: string | null;
  profile: Profile | null;
  suggestedProfile: SuggestedProfile | null;
  fallbackNote: boolean;
  isProcessing: boolean;
  atsResult: AtsAnalysisResponse | null;
  aiSearchResult: JobsResponse | null;
  improvementRecommendations: CvImprovementRecommendation[] | null;
  selectedImprovementIds: string[];
  improvementResult: {
    improvedProfile: Profile;
    appliedCount: number;
    appliedRecommendations: string[];
  } | null;
  originalProfile: Profile | null;
  beforeAtsResult: AtsAnalysisSummary | null;
  afterAtsResult: AtsAnalysisSummary | null;
  reanalysisResult: AtsReanalysisResult | null;
  matchImpactBefore: MatchImpactBefore | null;
  matchImpactAfter: MatchImpactAfter | null;
  matchImpactDelta: MatchImpactDelta | null;
  matchImpactChanges: MatchImpactChanges | null;
  matchImpactJob: Job | null;
  selectedSkills: string[];
}
