import { useEffect, useState } from "react";
import type { Job, Match, Profile, StatusMessage } from "./types";
import { fetchJobs, fetchMatches } from "./api";
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

const PREFERRED_FREE_MODEL = "poolside/laguna-s-2.1:free";

export default function App() {
  const { t } = useLang();
  const [route] = useState<NavbarRoute>(() =>
    window.location.pathname === "/top" ? "matcher" : "landing"
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [evaluated, setEvaluated] = useState(0);
  const [profile, setProfile] = useState<Profile>({ skills: "", targetRole: "", city: "" });
  const [letterJob, setLetterJob] = useState<{ job: Job; prepare: string } | null>(null);

  const { state: modelsState, models, defaultModel } = useAvailableModels();
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const effectiveModel =
    modelsState === "ready"
      ? selectedModel && models.some((m) => m.id === selectedModel)
        ? selectedModel
        : models.some((m) => m.id === defaultModel)
          ? defaultModel
          : models.some((m) => m.id === PREFERRED_FREE_MODEL)
            ? PREFERRED_FREE_MODEL
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

    if (!submitted.skills && !submitted.targetRole) {
      setStatus({ type: "error", message: t("status.noSkills") });
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

      setPhase("scoring");
      const matchResult = await fetchMatches(submitted, board.jobs, effectiveModel);

      if (!matchResult.matches.length) {
        setStatus({
          type: "warn",
          message: matchResult.meta?.note || t("status.noMatches"),
        });
        return;
      }

      setMatches(matchResult.matches);
      setEvaluated(matchResult.meta?.evaluated ?? matchResult.matches.length);
      setStatus({
        type: "info",
        message: t("status.found", { count: board.meta?.totalFiltered ?? board.jobs.length }),
      });
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message || t("status.genericError") });
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

  const hasMatches = matches.length > 0;

  const searchCard = (
    <section className="card search-card">
      <ModelSelector
        state={modelsState}
        models={models}
        defaultModel={defaultModel}
        value={effectiveModel}
        onChange={setSelectedModel}
      />
      <SearchForm phase={phase} onSubmit={runSearch} model={effectiveModel} />
      <Status status={status} />
    </section>
  );

  return (
    <>
      <Navbar route="matcher" />

      {hasMatches ? (
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

      {hasMatches && (
        <main className="container layout-split">
          <aside className="sidebar">
            {searchCard}
            <AlertCard profile={profile} />
          </aside>

          <div className="content">
            <Results
              matches={matches}
              evaluated={evaluated}
              onGenerateLetter={(job, prepare) => setLetterJob({ job, prepare })}
            />
          </div>
        </main>
      )}

      {!hasMatches && (
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