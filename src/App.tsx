import { useEffect, useRef, useState } from "react";
import type { Job, Match, Profile, StatusMessage, CvDocument, CvProcessingState, AnonymizationMode, ProcessingGoal } from "./types";
import { fetchJobs, fetchMatches, isFreeQuotaExceeded, isModelUnavailable, withModelFallback } from "./api";
import { useLang } from "./i18n";
import { modelDisplayName } from "./lib/modelDisplayName";
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

  // CV Processing State (Phases 6.1/6.2)
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
    isProcessing: false,
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

    // Consent already given - proceed to next steps (6.3+)
    // For now, just set step to profile creation (placeholder for 6.3+)
    setCvState((prev) => ({
      ...prev,
      step: "creating-profile",
      isProcessing: true,
    }));
  };

  const handleCvConsentAccept = () => {
    setCvState((prev) => ({
      ...prev,
      consentGiven: true,
      step: "creating-profile",
      isProcessing: true,
    }));
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

  const handleCvModelChange = (model: string) => {
    setCvState((prev) => ({ ...prev, selectedModel: model }));
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
        </>
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