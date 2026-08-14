import { useState } from "react";
import type { Job, Match } from "../types";
import MatchCard from "./MatchCard";
import { useLang } from "../i18n";

const INITIAL_MATCHES = 5;

interface Props {
  matches: Match[];
  evaluated: number;
  onGenerateLetter: (job: Job, prepare: string) => void;
}

export default function Results({ matches, evaluated, onGenerateLetter }: Props) {
  const { t } = useLang();
  const [expanded, setExpanded] = useState(false);

  if (matches.length === 0) return null;

  const hasMore = matches.length > INITIAL_MATCHES;
  const visible = hasMore && !expanded ? matches.slice(0, INITIAL_MATCHES) : matches;

  const heading = hasMore
    ? expanded
      ? t("results.allMatches")
      : t("results.yourBest")
    : matches.length === 1
      ? t("results.yourTop")
      : t("results.yourTopN", { count: matches.length });

  return (
    <section id="matches" className="results" aria-label={t("results.aria")}>
      <div className="results-header">
        <h2>{heading}</h2>
        <p className="results-sub">
          {evaluated > 0 && t("results.scored", { count: evaluated })}
          {hasMore &&
            !expanded &&
            ` · ${t("results.topOf", { shown: INITIAL_MATCHES, total: matches.length })}`}
        </p>
        {hasMore && (
          <button
            type="button"
            className="results-toggle"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? t("results.collapse") : t("results.expandAll", { count: matches.length })}
          </button>
        )}
      </div>
      <ol className="match-list">
        {visible.map((match, index) => (
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