import { useEffect, useState } from "react";
import type { Job, Match, Profile, StatusMessage } from "./types";
import { fetchJobs, fetchMatches, isModelUnavailable, withModelFallback } from "./api";
import { useLang } from "./i18n";
import Navbar from "./components/Navbar";
import type { NavbarRoute } from "./components/Navbar";
import Hero from "./components/Hero";
import LandingHero from "./components/LandingHero";
import SearchForm from "./components/SearchForm";
import ModelSelector from "./components/ModelSelector";
import Status from "./components/Status";
import Results from "./components/Results";
import AlertCard from "./components/AlertCard";
import LetterModal from "./components/LetterModal";
import { useAvailableModels } from "./hooks/useAvailableModels";

type Phase = "idle" | "searching" | "scoring";

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

  const runSearch = async (submitted: Profile) => {
    setProfile(submitted);
    setStatus(null);
    setMatches([]);
    setFoundJobs([]);

    if (!submitted.skills && !submitted.targetRole) {
      setStatus({ type: "error", message: t("status.noSkills") });
      return;
    }

      setPhase("searching");
      try {
        const board = await fetchJobs(submitted);
        setFoundJobs(board.jobs);

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

      setPhase("scoring");
      const { data: matchResult, usedFallback } = await withModelFallback({
        initialModel: effectiveModel,
        availableModels: models.map((model) => model.id),
        recommendedModel,
        request: (model, attempt) => fetchMatches(submitted, board.jobs, model, attempt),
      });

      if (!matchResult.matches.length) {
        setStatus({
          type: "warn",
          message: matchResult.meta?.note || t("status.noMatches"),
        });
        return;
      }

      setMatches(matchResult.matches);
      const found = t("status.found", {
        count: board.meta?.totalFiltered ?? board.jobs.length,
        evaluated: matchResult.meta?.evaluated ?? matchResult.matches.length,
      });
      setStatus({
        type: "info",
        message: usedFallback ? `${found} ${t("model.fallbackNote")}` : found,
      });
    } catch (err) {
      setStatus({
        type: "error",
        message: isModelUnavailable(err) ? t("model.unavailable") : (err as Error).message || t("status.genericError"),
      });
    } finally {
      setPhase("idle");
    }
  };

  if (route === "landing") {
    return (
      <div className="landing">
        <Navbar route="landing" />
        <LandingHero />
      </div>
    );
  }

  const hasResults = matches.length > 0 || foundJobs.length > 0;

  const searchCard = (
    <section className="card search-card">
      <SearchForm
        phase={phase}
        value={profile}
        onChange={setProfile}
        onSubmit={runSearch}
        model={effectiveModel}
        availableModels={models.map((model) => model.id)}
        recommendedModel={recommendedModel}
      />
      <div className="model-divider" aria-hidden="true" />
      <ModelSelector
        state={modelsState}
        models={models}
        defaultModel={defaultModel}
        recommendedModel={recommendedModel}
        value={effectiveModel}
        onChange={setSelectedModel}
      />
      <Status status={status} />
    </section>
  );

  return (
    <>
      <Navbar route="matcher" />

      {hasResults ? (
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

      {hasResults && (
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

      {!hasResults && (
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

      <footer className="footer">
        <p>
          {t("footer.pre")}{" "}
          <a href="https://www.arbeitnow.com" target="_blank" rel="noopener noreferrer">
            Arbeitnow
          </a>
          {" · "}
          <a href="https://www.arbeitsagentur.de" target="_blank" rel="noopener noreferrer">
            Arbeitsagentur
          </a>
          {t("footer.post")}
        </p>
      </footer>
    </>
  );
}