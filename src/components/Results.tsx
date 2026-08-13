import type { Job, Match } from "../types";
import MatchCard from "./MatchCard";

interface Props {
  matches: Match[];
  evaluated: number;
  onGenerateLetter: (job: Job, prepare: string) => void;
}

export default function Results({ matches, evaluated, onGenerateLetter }: Props) {
  if (matches.length === 0) return null;

  return (
    <section className="results" aria-label="Matches">
      <div className="results-header">
        <h2>{matches.length === 1 ? "Your top match" : `Your top ${matches.length} matches`}</h2>
        <p className="results-sub">
          {evaluated > 0 && `Scored ${evaluated} jobs by AI against your profile.`}
        </p>
      </div>
      <ol className="match-list">
        {matches.map((match, index) => (
          <MatchCard
            key={match.job?.slug ?? index}
            match={match}
            index={index}
            onGenerateLetter={onGenerateLetter}
          />
        ))}
      </ol>
    </section>
  );
}