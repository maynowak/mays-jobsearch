import { useEffect, useRef, useState } from "react";
import type { Job, Match, Profile, StatusMessage, CvDocument, CvProcessingState, AnonymizationMode, ProcessingGoal } from "./types";
import { fetchJobs, fetchMatches, isFreeQuotaExceeded, isModelUnavailable, withModelFallback, createProfile, analyzeATS, applyCvImprovement } from "./api";
import { useLang } from "./i18n";
import { modelDisplayName } from "./lib/modelDisplayName";
import { extractPdfText } from "./lib/pdf";
import { anonymizeText } from "./lib/anonymize";
import Navbar from "./components/Navbar";
import type { NavbarRoute } from "./components/Navbar";
import LandingHero from "./components/LandingHero";
import Hero from "./components/Hero";
import SearchForm from "./components/SearchForm";
import JobSources from "./components/JobSources";
import ModelSelector from "./components/ModelSelector";
import Status from "./components/Status";
import Results from "./components/Results";
import AlertCard from "./components/AlertCard";
import Footer from "./components/Footer";
import LetterModal from "./components/LetterModal";
import ATSModal from "./components/AtsOverlay";
import CvDocumentList from "./components/CvDocumentList";
import CvConsentGate from "./components/CvConsentGate";
import CvProcessingStatus from "./components/CvProcessingStatus";
import CvProcessingSteps from "./components/CvProcessingSteps";
import CvGoalSelection from "./components/CvGoalSelection";
import CvModelSelector from "./components/CvModelSelector";
import CvAnonymizationChoice from "./components/CvAnonymizationChoice";
import CvProfileResult from "./components/CvProfileResult";
import { useAvailableModels } from "./hooks/useAvailableModels";

type Phase = "idle" | "searching" | "scoring" | "matching";

function arraysEqual<T>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

interface JobDataset {
  jobs: Job[];
  profile: Profile;
}

export default function App() {
  const { t } = useLang();
  const [route] = useState<NavbarRoute>(() =>
    window.location.pathname === "/top" ? "matcher" : "landing"
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [foundJobs, setFoundJobs] = useState<Job[]>([]);
  const [profile, setProfile] = useState<Profile>({
    skills: "",
    targetRole: "",
    city: "",
    radiusKm: null,
    workModes: [],
    employmentTypes: ["full_time"],
  });
  const [letterJob, setLetterJob] = useState<{ job: Job; prepare: string } | null>(null);
  const [atsJob, setAtsJob] = useState<Job | null>(null);
  const [dataset, setDataset] = useState<JobDataset | null>(null);
  const [modelExhausted, setModelExhausted] = useState(false);
  const busyRef = useRef(false);

  // CV Processing State (Phases 6.1/6.2/6.3/6.4/6.5/6.6/6.7/6.8)
  const [cvState, setCvState] = useState<CvProcessingState>({
    step: "idle",
    documents: [],
    selectedDocumentId: null,
    consentGiven: false,
    anonymizationMode: "anonymized",
    processingGoal: "ats",
    selectedModel: null,
    error: null,
    profile: null,
    suggestedProfile: null,
    fallbackNote: false,
    isProcessing: false,
    atsResult: null,
    aiSearchResult: null,
    improvementRecommendations: null,
    selectedImprovementIds: [],
    improvementResult: null,
  });

  const {
    state: modelsState,
    models,
    defaultModel,
    fallbackModel,
    recommendedModel,
  } = useAvailableModels();
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const effectiveModel =
    modelsState === "ready"
      ? selectedModel && models.some((m) => m.id === selectedModel)
        ? selectedModel
        : models.some((m) => m.id === defaultModel)
          ? defaultModel
          : fallbackModel && models.some((m) => m.id === fallbackModel)
            ? fallbackModel
            : (models[0]?.id ?? null)
      : selectedModel;

  useEffect(() => {
    if (window.location.hash) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
  }, []);

  const profilesEqual = (a: Profile, b: Profile) =>
    a.skills === b.skills &&
    a.targetRole === b.targetRole &&
    a.city === b.city &&
    a.radiusKm === b.radiusKm &&
    arraysEqual(a.workModes, b.workModes) &&
    arraysEqual(a.employmentTypes, b.employmentTypes);

  const modelLabel = (id: string | null | undefined): string => {
    if (!id) return t("model.none");
    return modelDisplayName(models.find((m) => m.id === id) ?? null) || id;
  };

  const describeError = (err: unknown): string =>
    isFreeQuotaExceeded(err)
      ? t("model.quotaExceeded")
      : isModelUnavailable(err)
        ? t("model.unavailable")
        : (err as Error).message || t("status.genericError");

  const performMatch = async (nextDataset: JobDataset, model: string | null, isExplicitMatch = false) => {
    setStatus(null);
    if (!isExplicitMatch) {
      setPhase("scoring");
    } else if (phase !== "matching") {
      setPhase("matching");
    }
    try {
      const { data: matchResult, usedFallback, attempts } = await withModelFallback({
        initialModel: model,
        availableModels: models.map((m) => m.id),
        recommendedModel,
        request: (m, attempt) =>
          fetchMatches(nextDataset.profile, nextDataset.jobs, m, attempt),
      });

      // The old displayed results stay visible until the new search is complete.
      // Only now do we replace them (even for the zero-evaluation case).
      setFoundJobs(nextDataset.jobs);
      setMatches(matchResult.matches);
      setModelExhausted(false);

      if (matchResult.matches.length) {
        const found = t("status.found", {
          count: nextDataset.jobs.length,
          evaluated: matchResult.meta?.evaluated ?? matchResult.matches.length,
        });
        const message = usedFallback
          ? `${found} ${t("model.fallbackSuccess", {
              failed: modelLabel(attempts.filter((a) => !a.ok).at(-1)?.model ?? null),
              used: modelLabel(attempts.find((a) => a.ok)?.model ?? null),
            })}`
          : found;
        setStatus({ type: "info", message });
      } else {
        setStatus({
          type: "warn",
          message: matchResult.meta?.note || t("status.noMatches"),
        });
      }
    } catch (err) {
      if (isModelUnavailable(err)) {
        setModelExhausted(true);
        setStatus({ type: "error", message: t("model.fallbackExhausted") });
      } else {
        setModelExhausted(false);
        setStatus({ type: "error", message: describeError(err) });
      }
    } finally {
      setPhase("idle");
    }
  };

  const runSearch = async (submitted: Profile) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setProfile(submitted);
    setStatus(null);
    setModelExhausted(false);
    setDataset(null);
    setFoundJobs([]);
    setMatches([]);

    if (!submitted.skills && !submitted.targetRole) {
      setStatus({ type: "error", message: t("status.noSkills") });
      busyRef.current = false;
      return;
    }

    setPhase("searching");
    try {
      const board = await fetchJobs(submitted);

      if (!board.jobs.length) {
        const query = submitted.skills || submitted.targetRole;
        setStatus({
          type: "warn",
          message: submitted.city
            ? t("status.noJobsCity", { q: query, city: submitted.city })
            : t("status.noJobs", { q: query }),
        });
        return;
      }

      const nextDataset: JobDataset = { jobs: board.jobs, profile: submitted };
      setDataset(nextDataset);
      setFoundJobs(board.jobs);
    } catch (err) {
      setStatus({ type: "error", message: describeError(err) });
    } finally {
      busyRef.current = false;
      setPhase("idle");
    }
  };

  const handleMatchWithAI = async () => {
    if (busyRef.current || !dataset) return;
    busyRef.current = true;
    setStatus(null);
    setModelExhausted(false);
    setPhase("matching");
    try {
      await performMatch(dataset, effectiveModel, true);
    } finally {
      busyRef.current = false;
      setPhase("idle");
    }
  };

  const handleProfileChange = (next: Profile) => {
    setProfile(next);
    if (dataset && !profilesEqual(next, dataset.profile)) {
      setDataset(null);
      setModelExhausted(false);
    }
  };

  const handleModelChange = (model: string) => {
    if (busyRef.current) return;
    setSelectedModel(model);
    setModelExhausted(false);
  };

  // CV Processing Handlers (Phases 6.1/6.2)
  const generateDocumentId = () => `cv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  function normalizeText(text: string): string {
    return text.replace(/\s+/g, " ").trim();
  }

  async function sha256Hex(text: string): Promise<string | null> {
    try {
      if (!crypto?.subtle) return null;
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      return null;
    }
  }

  const handleAddCvFiles = (files: FileList) => {
    const newDocuments: CvDocument[] = Array.from(files).map((file) => ({
      id: generateDocumentId(),
      name: file.name,
      size: file.size,
      selected: false,
      file,
    }));
    setCvState((prev) => ({
      ...prev,
      documents: [...prev.documents, ...newDocuments],
      step: "document-selected",
    }));
  };

  const handleSelectCvDocument = (id: string) => {
    setCvState((prev) => ({
      ...prev,
      documents: prev.documents.map((doc) => ({ ...doc, selected: doc.id === id })),
      selectedDocumentId: id,
      step: "document-selected",
    }));
  };

  const handleRemoveCvDocument = (id: string) => {
    setCvState((prev) => {
      const remaining = prev.documents.filter((doc) => doc.id !== id);
      const wasSelected = prev.selectedDocumentId === id;
      return {
        ...prev,
        documents: remaining,
        selectedDocumentId: wasSelected ? (remaining[0]?.id ?? null) : prev.selectedDocumentId,
        step: remaining.length > 0 ? "document-selected" : "idle",
      };
    });
  };

  const handleCvProcess = () => {
    const selectedDoc = cvState.documents.find((d) => d.selected);
    if (!selectedDoc) return;

    // First-Use Recognition: Check if consent already given
    if (!cvState.consentGiven) {
      setCvState((prev) => ({
        ...prev,
        step: "consent-required",
      }));
      return;
    }

    // Consent already given - proceed to creating-profile step (user selects options)
    setCvState((prev) => ({
      ...prev,
      step: "creating-profile",
      isProcessing: false,
    }));
  };

  const handleCvConsentAccept = () => {
    const selectedDoc = cvState.documents.find((d) => d.selected);
    if (!selectedDoc) return;

    setCvState((prev) => ({
      ...prev,
      consentGiven: true,
      step: "creating-profile",
      isProcessing: false,
    }));
  };

  const handleCvContinue = (doc: CvDocument) => {
    createProfileFromPdf(doc);
  };

  const createProfileFromPdf = async (doc: CvDocument) => {
    const { t } = useLang();
    setCvState((prev) => ({
      ...prev,
      step: "anonymizing",
      isProcessing: true,
      error: null,
    }));

    try {
      // Extract text from PDF
      const text = await extractPdfText(doc.file);
      if (text.replace(/\s/g, "").length < 20) {
        setCvState((prev) => ({
          ...prev,
          step: "error",
          isProcessing: false,
          error: t("cv.scannedError"),
        }));
        return;
      }

      // Apply anonymization if selected
      let processedText = text;
      if (cvState.anonymizationMode === "anonymized") {
        processedText = anonymizeText(text);
      }

      const normalized = normalizeText(processedText);
      const hash = await sha256Hex(normalized);

      // Determine model to use
      const modelToUse = cvState.selectedModel || effectiveModel;

      // Create profile using existing API with model fallback
      const { data: suggestedProfile, usedFallback } = await withModelFallback({
        initialModel: modelToUse,
        availableModels: models.map((m) => m.id),
        recommendedModel,
        request: (m, attempt) => createProfile(normalized, m, hash ?? undefined, attempt),
      });

      setCvState((prev) => ({
        ...prev,
        suggestedProfile,
        step: "profile-ready",
        isProcessing: false,
        fallbackNote: usedFallback,
      }));
    } catch (err) {
      setCvState((prev) => ({
        ...prev,
        step: "error",
        isProcessing: false,
        error:
          isFreeQuotaExceeded(err)
            ? t("model.quotaExceeded")
            : isModelUnavailable(err)
            ? t("model.unavailable")
            : t("cv.processError"),
      }));
    }
  };

  const handleCvConsentCancel = () => {
    setCvState((prev) => ({
      ...prev,
      step: "document-selected",
    }));
  };

  const handleAnonymizationChange = (mode: string) => {
    setCvState((prev) => ({ ...prev, anonymizationMode: mode as AnonymizationMode }));
  };

  const handleGoalChange = (goal: ProcessingGoal) => {
    setCvState((prev) => ({ ...prev, processingGoal: goal }));
  };

  const handleGoalExecute = () => {
    const { t } = useLang();
    const goal = cvState.processingGoal;
    const nextStep = goal === "ats" ? "ats-processing" : "ai-searching";
    setCvState((prev) => ({
      ...prev,
      step: nextStep,
      isProcessing: true,
    }));

    if (goal === "ats") {
      runAtsProcessing(t);
    } else if (goal === "ai-search") {
      runAiSearch(t);
    }
  };

  const runAiSearch = async (t: (key: string, vars?: Record<string, string | number>) => string) => {
    if (!cvState.profile || !cvState.profile.skills) {
      setCvState((prev) => ({
        ...prev,
        step: "error",
        isProcessing: false,
        error: t("cv.aiSearchNoProfile"),
      }));
      return;
    }

    try {
      // Use the existing profile for job search
      const searchProfile = cvState.profile;

      // First, search for jobs using the existing job search API
      const jobsResponse = await fetchJobs(searchProfile);

      if (!jobsResponse.jobs.length) {
        setCvState((prev) => ({
          ...prev,
          step: "ai-complete",
          isProcessing: false,
          aiSearchResult: { jobs: [], meta: { totalScanned: 0, totalFiltered: 0 } },
        }));
        return;
      }

      // Then, use AI to match/score the jobs
      const { data: matchResult } = await withModelFallback({
        initialModel: cvState.selectedModel || effectiveModel,
        availableModels: models.map((m) => m.id),
        recommendedModel,
        request: (m, attempt) => fetchMatches(searchProfile, jobsResponse.jobs, m, attempt),
      });

      // Create a compatible JobsResponse meta from matchResult
      const aiSearchMeta = {
        totalScanned: jobsResponse.meta?.totalScanned,
        totalFiltered: jobsResponse.meta?.totalFiltered,
        city: jobsResponse.meta?.city,
        keywords: jobsResponse.meta?.keywords,
        sources: jobsResponse.meta?.sources,
        sourceCounts: jobsResponse.meta?.sourceCounts,
        disabledSources: jobsResponse.meta?.disabledSources,
        sourceDetails: jobsResponse.meta?.sourceDetails,
        jobsCombined: jobsResponse.meta?.jobsCombined,
        apify: jobsResponse.meta?.apify,
        evaluated: matchResult.meta?.evaluated,
        note: matchResult.meta?.note,
        totalFound: matchResult.meta?.totalFound,
        displayedInitially: matchResult.meta?.displayedInitially,
      };

      setCvState((prev) => ({
        ...prev,
        step: "ai-complete",
        isProcessing: false,
        aiSearchResult: { jobs: jobsResponse.jobs, meta: aiSearchMeta },
        matches: matchResult.matches,
        foundJobs: jobsResponse.jobs,
      }));
    } catch (err) {
      setCvState((prev) => ({
        ...prev,
        step: "error",
        isProcessing: false,
        error:
          isFreeQuotaExceeded(err)
            ? t("model.quotaExceeded")
            : isModelUnavailable(err)
            ? t("model.unavailable")
            : t("cv.aiSearchError"),
      }));
    }
  };

  const runAtsProcessing = async (t: (key: string, vars?: Record<string, string | number>) => string) => {
    const selectedDoc = cvState.documents.find((d) => d.id === cvState.selectedDocumentId);
    const jobForAts = selectedDoc ? {
      title: cvState.suggestedProfile?.targetRoles[0] || cvState.profile?.targetRole || "",
      tags: cvState.suggestedProfile?.skills || cvState.profile?.skills?.split(",") || [],
      slug: "cv-ats-" + Date.now(),
    } : null;

    if (!cvState.profile || !cvState.profile.skills) {
      setCvState((prev) => ({
        ...prev,
        step: "error",
        isProcessing: false,
        error: t("cv.atsNoProfile"),
      }));
      return;
    }

    try {
      const result = await analyzeATS(
        jobForAts || { title: "", tags: [], slug: "" },
        { skills: cvState.profile.skills },
        { enabled: false }
      );

      setCvState((prev) => ({
        ...prev,
        step: "ats-complete",
        isProcessing: false,
        atsResult: result,
      }));
    } catch (err) {
      setCvState((prev) => ({
        ...prev,
        step: "error",
        isProcessing: false,
        error:
          isFreeQuotaExceeded(err)
            ? t("model.quotaExceeded")
            : isModelUnavailable(err)
            ? t("model.unavailable")
            : t("cv.atsProcessError"),
      }));
    }
  };

  const handleCvModelChange = (model: string) => {
    setCvState((prev) => ({ ...prev, selectedModel: model }));
  };

  const handleImprovementSelectionChange = (ids: string[]) => {
    setCvState((prev) => ({ ...prev, selectedImprovementIds: ids }));
  };

  const handleImprovementExecute = async () => {
    const { t } = useLang();
    const selectedIds = cvState.selectedImprovementIds;
    if (selectedIds.length === 0) {
      setCvState((prev) => ({
        ...prev,
        step: "error",
        isProcessing: false,
        error: t("cv.improvementNoSelectionError"),
      }));
      return;
    }

    if (!cvState.improvementRecommendations || cvState.improvementRecommendations.length === 0) {
      setCvState((prev) => ({
        ...prev,
        step: "error",
        isProcessing: false,
        error: t("cv.improvementNoSelectionError"),
      }));
      return;
    }

    setCvState((prev) => ({
      ...prev,
      step: "improving",
      isProcessing: true,
    }));

    try {
      const result = await applyCvImprovement({
        profile: cvState.profile!,
        selectedRecommendationIds: cvState.selectedImprovementIds,
        allRecommendations: cvState.improvementRecommendations!,
      });

      if (result.data.appliedCount === 0) {
        setCvState((prev) => ({
          ...prev,
          step: "improved",
          isProcessing: false,
          improvementResult: {
            improvedProfile: cvState.profile!,
            appliedCount: 0,
            appliedRecommendations: [],
          },
        }));
      } else {
        const improvedProfile = result.data.improvedProfile;
        setCvState((prev) => ({
          ...prev,
          step: "improved",
          isProcessing: false,
          improvementResult: {
            improvedProfile: improvedProfile,
            appliedCount: result.data.appliedCount,
            appliedRecommendations: result.data.appliedRecommendations,
          },
          profile: improvedProfile,
        }));
      }
    } catch (err) {
      setCvState((prev) => ({
        ...prev,
        step: "error",
        isProcessing: false,
        error: t("cv.improvementError"),
      }));
    }
  };

  const handleImprovementBack = () => {
    setCvState((prev) => ({
      ...prev,
      step: "goal-selection",
      improvementRecommendations: null,
      selectedImprovementIds: [],
      improvementResult: null,
    }));
  };

  const handleSubmit = (submitted: Profile) => {
    if (busyRef.current) return;
    if (dataset && profilesEqual(submitted, dataset.profile)) {
      // This case should not happen anymore since rematch is now explicit via "Mit KI bewerten"
      // But keep for safety - treat as new search
      void runSearch(submitted);
    } else {
      void runSearch(submitted);
    }
  };

  const isSearching = phase === "searching" || phase === "scoring";
  const isMatching = phase === "matching";
  const canRematch = !!dataset && profilesEqual(dataset.profile, profile);
  const hasFoundJobs = !!dataset && foundJobs.length > 0;

  const hasResults = matches.length > 0 || foundJobs.length > 0;

  if (route === "landing" && !isSearching) {
    return (
      <div className="landing">
        <Navbar route="landing" />
        <LandingHero />
      </div>
    );
  }

  const searchCard = (
    <section className="card search-card">
      <SearchForm
        phase={phase}
        value={profile}
        onChange={handleProfileChange}
        onSubmit={handleSubmit}
        onCvSubmit={runSearch}
        onMatch={handleMatchWithAI}
        matching={isMatching}
        hasJobs={hasFoundJobs}
        rematch={canRematch}
        model={effectiveModel}
        availableModels={models.map((model) => model.id)}
        recommendedModel={recommendedModel}
      />
      <JobSources jobs={foundJobs} />
      <div className="model-divider" aria-hidden="true" />
      <ModelSelector
        state={modelsState}
        models={models}
        defaultModel={defaultModel}
        recommendedModel={recommendedModel}
        value={effectiveModel}
        onChange={handleModelChange}
        disabled={isSearching || isMatching}
        attention={modelExhausted}
      />
      <Status status={status} />
    </section>
  );

  // CV Processing UI - rendered when CV flow is active
  const cvProcessingUI = cvState.step !== "idle" && (
    <section className="card cv-processing-card" aria-labelledby="cv-processing-title">
      <h2 id="cv-processing-title" className="cv-processing-title">{t("cv.statusTitle")}</h2>

      <CvProcessingStatus step={cvState.step} error={cvState.error} documentName={cvState.documents.find((d) => d.id === cvState.selectedDocumentId)?.name ?? null} />

      <CvProcessingSteps currentStep={
        cvState.step === "document-selected" ? "document" :
        cvState.step === "consent-required" || cvState.step === "consent-given" ? "consent" :
        cvState.step === "creating-profile" ? "profile" :
        cvState.step === "anonymizing" ? "anonymization" :
        cvState.step === "goal-selection" ? "goal" :
        cvState.step === "ats-processing" ? "target" :
        cvState.step === "ai-searching" ? "processing" :
        cvState.step === "success" ? "complete" : "document"
      } />

      {cvState.step === "document-selected" && (
        <CvDocumentList
          documents={cvState.documents}
          selectedId={cvState.selectedDocumentId}
          onSelect={handleSelectCvDocument}
          onRemove={handleRemoveCvDocument}
          onAddFiles={handleAddCvFiles}
          onProcess={handleCvProcess}
          disabled={cvState.isProcessing}
          processing={cvState.isProcessing}
        />
      )}

      {cvState.step === "consent-required" && (
        <CvConsentGate
          fileName={cvState.documents.find((d) => d.id === cvState.selectedDocumentId)?.name ?? ""}
          onAccept={handleCvConsentAccept}
          onCancel={handleCvConsentCancel}
          processingInfo={cvState.processingGoal === "ats" ? t("cv.goalATSLabel") : t("cv.goalAISearchLabel")}
          externalAI={true}
          disabled={cvState.isProcessing}
        />
      )}

      {cvState.step === "creating-profile" && (
        <>
          <CvAnonymizationChoice
            value={cvState.anonymizationMode}
            onChange={handleAnonymizationChange}
            disabled={cvState.isProcessing}
          />
          <CvGoalSelection
            value={cvState.processingGoal}
            onChange={handleGoalChange}
            disabled={cvState.isProcessing}
          />
          <CvModelSelector
            value={cvState.selectedModel}
            onChange={handleCvModelChange}
            disabled={cvState.isProcessing}
            recommendedModel={recommendedModel}
          />
          <div className="cv-continue-actions">
            <button
              type="button"
              className="cv-continue-btn"
              onClick={() => {
                const selectedDoc = cvState.documents.find((d) => d.id === cvState.selectedDocumentId);
                if (selectedDoc) handleCvContinue(selectedDoc);
              }}
              disabled={cvState.isProcessing}
            >
              {cvState.isProcessing ? t("cv.continueProcessing") : t("cv.continue")}
              {cvState.isProcessing && <span className="spinner" />}
            </button>
          </div>
        </>
      )}

      {cvState.step === "anonymizing" && (
        <div className="cv-anonymizing" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <p>{cvState.anonymizationMode === "anonymized" ? t("cv.anonymizingText") : t("cv.preparingProfile")}</p>
        </div>
      )}

      {cvState.step === "profile-ready" && cvState.suggestedProfile && (
        <CvProfileResult
          suggested={cvState.suggestedProfile}
          busy={cvState.isProcessing}
          loadingLabel={t("cv.savingProfile")}
          onConfirm={(profile) => {
            setProfile(profile);
            setCvState((prev) => ({
              ...prev,
              step: "goal-selection",
              profile,
              suggestedProfile: null,
              fallbackNote: false,
            }));
          }}
          onBack={() => {
            setCvState((prev) => ({
              ...prev,
              step: "document-selected",
              suggestedProfile: null,
              fallbackNote: false,
            }));
          }}
        />
      )}

      {cvState.step === "goal-selection" && (
        <div className="cv-goal-execution" role="region" aria-labelledby="cv-goal-execution-title">
          <h3 id="cv-goal-execution-title" className="cv-goal-execution__title">
            {t("cv.goalExecutionTitle")}
          </h3>
          <p className="cv-goal-execution__description">{t("cv.goalExecutionDescription")}</p>
          <CvGoalSelection
            value={cvState.processingGoal}
            onChange={handleGoalChange}
            disabled={cvState.isProcessing}
          />
          <div className="cv-goal-execution__actions">
            <button
              type="button"
              className="cv-continue-btn"
              onClick={handleGoalExecute}
              disabled={cvState.isProcessing}
            >
              {cvState.isProcessing ? t("cv.executingGoal") : t("cv.executeGoal")}
              {cvState.isProcessing && <span className="spinner" />}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setCvState((prev) => ({ ...prev, step: "profile-ready" }))}
              disabled={cvState.isProcessing}
            >
              {t("cv.backToProfile")}
            </button>
          </div>
        </div>
      )}

      {cvState.step === "improvement-selection" && cvState.improvementRecommendations && (
        <div className="cv-improvement-execution" role="region" aria-labelledby="cv-improvement-title">
          <h3 id="cv-improvement-title" className="cv-improvement__title">
            {t("cv.improvementTitle")}
          </h3>
          <p className="cv-improvement__description">{t("cv.improvementDescription")}</p>
          <p className="cv-improvement__select-label">{t("cv.improvementSelectLabel")}</p>
          <div className="cv-improvement__options" role="listbox" aria-label={t("cv.improvementSelectLabel")}>
            {cvState.improvementRecommendations.map((rec) => (
              <label
                key={rec.requirementId}
                className={`cv-improvement__option${cvState.selectedImprovementIds.includes(rec.requirementId) ? " selected" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={cvState.selectedImprovementIds.includes(rec.requirementId)}
                  onChange={() => {
                    const newIds = cvState.selectedImprovementIds.includes(rec.requirementId)
                      ? cvState.selectedImprovementIds.filter((id) => id !== rec.requirementId)
                      : [...cvState.selectedImprovementIds, rec.requirementId];
                    handleImprovementSelectionChange(newIds);
                  }}
                  disabled={cvState.isProcessing}
                  className="cv-improvement__checkbox"
                  aria-label={`${rec.changeTypeLabel}: ${rec.proposedChange}`}
                />
                <div className="cv-improvement__option-content">
                  <span className="cv-improvement__label">{rec.changeTypeLabel}</span>
                  <span className="cv-improvement__description">{rec.proposedChange}</span>
                  <span className="cv-improvement__rationale">{rec.rationale}</span>
                </div>
              </label>
            ))}
          </div>
          <div className="cv-improvement__actions">
            <button
              type="button"
              className="cv-continue-btn"
              onClick={handleImprovementExecute}
              disabled={cvState.isProcessing || cvState.selectedImprovementIds.length === 0}
            >
              {cvState.isProcessing ? t("cv.applyingImprovement") : t("cv.applyImprovement")}
              {cvState.isProcessing && <span className="spinner" />}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={handleImprovementBack}
              disabled={cvState.isProcessing}
            >
              {t("cv.backToGoalSelection")}
            </button>
          </div>
        </div>
      )}

      {cvState.step === "ats-processing" && (
        <div className="cv-ats-processing" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <p>{t("cv.atsProcessing")}</p>
        </div>
      )}

      {cvState.step === "ats-complete" && cvState.atsResult && (
        <ATSModal
          job={{
            title: "CV ATS Analysis",
            company_name: "",
            location: [],
            remote: false,
            tags: [],
            url: "",
            slug: "cv-ats-analysis",
          }}
          profile={cvState.profile!}
          onClose={() => setCvState((prev) => ({ ...prev, step: "goal-selection", atsResult: null }))}
        />
      )}

      {cvState.step === "ai-searching" && (
        <div className="cv-ai-searching" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <p>{t("cv.aiSearching")}</p>
        </div>
      )}

      {cvState.step === "ai-complete" && cvState.aiSearchResult && (
        <div className="cv-ai-complete">
          {cvState.aiSearchResult.jobs.length > 0 ? (
            <p className="cv-ai-complete__message">{t("cv.aiSearchComplete", { count: cvState.aiSearchResult.jobs.length })}</p>
          ) : (
            <p className="cv-ai-complete__message">{t("cv.aiSearchNoResults")}</p>
          )}
          <div className="cv-ai-complete__actions">
            <button
              type="button"
              className="cv-continue-btn"
              onClick={() => setCvState((prev) => ({ ...prev, step: "goal-selection", aiSearchResult: null, matches: [], foundJobs: [] }))}
            >
              {t("cv.backToGoalSelection")}
            </button>
          </div>
        </div>
      )}

      {cvState.step === "error" && cvState.error && (
        <div className="cv-error-state" role="alert">
          <p className="alert alert-error">{cvState.error}</p>
          <button type="button" className="btn-ghost" onClick={() => setCvState((prev) => ({ ...prev, step: "document-selected", error: null }))}>
            {t("cv.backToDocuments")}
          </button>
        </div>
      )}
    </section>
  );

  return (
    <>
      <Navbar route="matcher" />
      <Hero />

      <main className="container layout-search">
        <aside className="search-sidebar">
          {searchCard}
          {cvProcessingUI}
        </aside>

        {hasResults ? (
          <section className="results-workspace">
            <Results
              matches={matches}
              foundJobs={foundJobs}
              onGenerateLetter={(job, prepare) => setLetterJob({ job, prepare })}
              onAtsEvaluate={(job) => setAtsJob(job)}
            />
          </section>
        ) : (
          <section className="alerts-section">
            <AlertCard profile={profile} />
          </section>
        )}
      </main>

      {letterJob && (
        <LetterModal
          job={letterJob.job}
          prepare={letterJob.prepare}
          profile={profile}
          model={effectiveModel}
          availableModels={models.map((model) => model.id)}
          recommendedModel={recommendedModel}
          onClose={() => setLetterJob(null)}
        />
      )}

      {atsJob && profile && (
        <ATSModal
          job={atsJob}
          profile={profile}
          onClose={() => setAtsJob(null)}
        />
      )}

      <Footer />
    </>
  );
}