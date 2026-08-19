import { useEffect, useRef, useState } from "react";
import type { Job, Match, Profile, StatusMessage } from "./types";
import { fetchJobs, fetchMatches, isFreeQuotaExceeded, isModelUnavailable, withModelFallback } from "./api";
import { useLang } from "./i18n";
import Navbar from "./components/Navbar";
import type { NavbarRoute } from "./components/Navbar";
import Hero from "./components/Hero";
import LandingHero from "./components/LandingHero";
import SearchForm from "./components/SearchForm";
import JobSources from "./components/JobSources";
import ModelSelector from "./components/ModelSelector";
import Status from "./components/Status";
import Results from "./components/Results";
import AlertCard from "./components/AlertCard";
import Footer from "./components/Footer";
import LetterModal from "./components/LetterModal";
import { useAvailableModels } from "./hooks/useAvailableModels";

type Phase = "idle" | "searching" | "scoring";

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
  const [profile, setProfile] = useState<Profile>({ skills: "", targetRole: "", city: "" });
  const [letterJob, setLetterJob] = useState<{ job: Job; prepare: string } | null>(null);
  const [dataset, setDataset] = useState<JobDataset | null>(null);
  const busyRef = useRef(false);

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
    a.skills === b.skills && a.targetRole === b.targetRole && a.city === b.city;

  const describeError = (err: unknown): string =>
    isFreeQuotaExceeded(err)
      ? t("model.quotaExceeded")
      : isModelUnavailable(err)
        ? t("model.unavailable")
        : (err as Error).message || t("status.genericError");

  const performMatch = async (nextDataset: JobDataset, model: string | null) => {
    setStatus(null);
    setPhase("scoring");
    try {
      const { data: matchResult, usedFallback } = await withModelFallback({
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

      if (matchResult.matches.length) {
        const found = t("status.found", {
          count: nextDataset.jobs.length,
          evaluated: matchResult.meta?.evaluated ?? matchResult.matches.length,
        });
        setStatus({
          type: "info",
          message: usedFallback ? `${found} ${t("model.fallbackNote")}` : found,
        });
      } else {
        setStatus({
          type: "warn",
          message: matchResult.meta?.note || t("status.noMatches"),
        });
      }
    } catch (err) {
      setStatus({ type: "error", message: describeError(err) });
    } finally {
      setPhase("idle");
    }
  };

  const runSearch = async (submitted: Profile) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setProfile(submitted);
    setStatus(null);

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
      await performMatch(nextDataset, effectiveModel);
    } catch (err) {
      setStatus({ type: "error", message: describeError(err) });
    } finally {
      busyRef.current = false;
      setPhase("idle");
    }
  };

  const handleProfileChange = (next: Profile) => {
    setProfile(next);
    if (dataset && !profilesEqual(next, dataset.profile)) {
      setDataset(null);
    }
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    if (busyRef.current) return;
    if (dataset && profilesEqual(dataset.profile, profile)) {
      busyRef.current = true;
      void performMatch(dataset, model).finally(() => {
        busyRef.current = false;
      });
    }
  };

  const isSearching = phase === "searching" || phase === "scoring";

  if (route === "landing" && !isSearching) {
    return (
      <div className="landing">
        <Navbar route="landing" />
        <LandingHero />
      </div>
    );
  }

  // matches/foundJobs are the DISPLAYED results. They are not cleared when a new
  // search starts, so the previous results stay visible while the new search runs.
  const hasResults = matches.length > 0 || foundJobs.length > 0;
  const showResults = hasResults;

  const searchCard = (
    <section className="card search-card">
      <SearchForm
        phase={phase}
        value={profile}
        onChange={handleProfileChange}
        onSubmit={runSearch}
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
        disabled={isSearching}
      />
      <Status status={status} />
    </section>
  );

  return (
    <>
      <Navbar route="matcher" />

      {showResults ? (
        <Hero />
      ) : (
        <section className="search-hero">
          <div className="search-hero-inner">
            <div className="search-hero-text">
              <h1>May&rsquo;s Job Matcher</h1>
              <p className="tagline">{t("hero.tagline")}</p>
            </div>
            {searchCard}
          </div>
        </section>
      )}

      {showResults && (
        <main className="container layout-split">
          <aside className="sidebar">
            {searchCard}
            <AlertCard profile={profile} />
          </aside>

          <div className="content">
            <Results
              matches={matches}
              foundJobs={foundJobs}
              onGenerateLetter={(job, prepare) => setLetterJob({ job, prepare })}
            />
          </div>
        </main>
      )}

      {!showResults && (
        <section className="alerts-section">
          <AlertCard profile={profile} />
        </section>
      )}

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

      <Footer />
    </>
  );
}