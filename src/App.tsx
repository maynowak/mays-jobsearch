import { useEffect, useState } from "react";
import type { Job, Match, Profile, StatusMessage } from "./types";
import { fetchJobs, fetchMatches } from "./api";
import { useLang } from "./i18n";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import SearchForm from "./components/SearchForm";
import ModelInfo from "./components/ModelInfo";
import Status from "./components/Status";
import Results from "./components/Results";
import AlertCard from "./components/AlertCard";
import LetterModal from "./components/LetterModal";

type Phase = "idle" | "searching" | "scoring";

export default function App() {
  const { t } = useLang();
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [evaluated, setEvaluated] = useState(0);
  const [profile, setProfile] = useState<Profile>({ skills: "", targetRole: "", city: "" });
  const [letterJob, setLetterJob] = useState<{ job: Job; prepare: string } | null>(null);

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
      const matchResult = await fetchMatches(submitted, board.jobs);

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

  return (
    <>
      <Navbar />
      <Hero />

      <main className={`container${matches.length > 0 ? " layout-split" : ""}`}>
        <aside className="sidebar">
          <section className="card search-card">
            <SearchForm phase={phase} onSubmit={runSearch} />
            <Status status={status} />
            <ModelInfo />
          </section>

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

      {letterJob && (
        <LetterModal
          job={letterJob.job}
          prepare={letterJob.prepare}
          profile={profile}
          onClose={() => setLetterJob(null)}
        />
      )}

      <footer className="footer">
        <p>
          {t("footer.pre")}{" "}
          <a href="https://www.arbeitnow.com" target="_blank" rel="noopener noreferrer">
            Arbeitnow
          </a>
          {t("footer.post")}
        </p>
      </footer>
    </>
  );
}