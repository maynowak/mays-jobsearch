import type { Job, Match } from "../types";
import MatchCard from "./MatchCard";
import { useLang } from "../i18n";

interface Props {
  matches: Match[];
  evaluated: number;
  onGenerateLetter: (job: Job, prepare: string) => void;
}

export default function Results({ matches, evaluated, onGenerateLetter }: Props) {
  const { t } = useLang();
  if (matches.length === 0) return null;

  return (
    <section id="matches" className="results" aria-label={t("results.aria")}>
      <div className="results-header">
        <h2>{matches.length === 1 ? t("results.yourTop") : t("results.yourTopN", { count: matches.length })}</h2>
        <p className="results-sub">
          {evaluated > 0 && t("results.scored", { count: evaluated })}
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