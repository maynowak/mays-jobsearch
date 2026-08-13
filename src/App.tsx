import { useState } from "react";
import type { Job, Match, Profile, StatusMessage } from "./types";
import { fetchJobs, fetchMatches } from "./api";
import Hero from "./components/Hero";
import SearchForm from "./components/SearchForm";
import ModelInfo from "./components/ModelInfo";
import Status from "./components/Status";
import Results from "./components/Results";
import AlertCard from "./components/AlertCard";
import LetterModal from "./components/LetterModal";

type Phase = "idle" | "searching" | "scoring";

export default function App() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [evaluated, setEvaluated] = useState(0);
  const [profile, setProfile] = useState<Profile>({ skills: "", targetRole: "", city: "" });
  const [letterJob, setLetterJob] = useState<{ job: Job; prepare: string } | null>(null);

  const runSearch = async (submitted: Profile) => {
    setProfile(submitted);
    setStatus(null);
    setMatches([]);

    if (!submitted.skills && !submitted.targetRole) {
      setStatus({ type: "error", message: "Add at least a skill or a target role so we know what to look for." });
      return;
    }

    setPhase("searching");
    try {
      const board = await fetchJobs(submitted);

      if (!board.jobs.length) {
        setStatus({
          type: "warn",
          message: submitted.city
            ? `No jobs matched "${submitted.skills || submitted.targetRole}" near "${submitted.city}". Try broader skills or leave the city empty.`
            : `No jobs matched "${submitted.skills || submitted.targetRole}". Try broader keywords or different skills.`,
        });
        return;
      }

      setPhase("scoring");
      const matchResult = await fetchMatches(submitted, board.jobs);

      if (!matchResult.matches.length) {
        setStatus({
          type: "warn",
          message: matchResult.meta?.note || "We found jobs but the AI couldn't score them. Please try again.",
        });
        return;
      }

      setMatches(matchResult.matches);
      setEvaluated(matchResult.meta?.evaluated ?? matchResult.matches.length);
      setStatus({
        type: "info",
        message: `Found ${board.meta?.totalFiltered ?? board.jobs.length} relevant jobs, scored your best ones.`,
      });
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message || "Something went wrong. Please try again." });
    } finally {
      setPhase("idle");
    }
  };

  return (
    <>
      <Hero />

      <main className="container">
        <section className="card search-card">
          <SearchForm phase={phase} onSubmit={runSearch} />
          <ModelInfo />
        </section>

        <AlertCard profile={profile} />
        <Status status={status} />
        <Results
          matches={matches}
          evaluated={evaluated}
          onGenerateLetter={(job, prepare) => setLetterJob({ job, prepare })}
        />
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
          Job listings &copy;{" "}
          <a href="https://www.arbeitnow.com" target="_blank" rel="noopener noreferrer">
            Arbeitnow
          </a>
          . Scores are AI-generated suggestions &mdash; always check the original posting.
        </p>
      </footer>
    </>
  );
}