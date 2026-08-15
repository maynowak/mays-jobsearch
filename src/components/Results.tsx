import { useEffect, useState } from "react";
import type { Job, Match } from "../types";
import { computeRemainingJobs } from "../lib/jobPool";
import MatchCard from "./MatchCard";
import RemainingCard from "./RemainingCard";
import { useLang } from "../i18n";

const INITIAL_MATCHES = 5;

interface Props {
  matches: Match[];
  foundJobs: Job[];
  onGenerateLetter: (job: Job, prepare: string) => void;
}

export default function Results({ matches, foundJobs, onGenerateLetter }: Props) {
  const { t } = useLang();
  const [expanded, setExpanded] = useState(false);
  const [moreOpen, setMoreOpen] = useState<boolean>(() => matches.length === 0);

  const remainingJobs = computeRemainingJobs(foundJobs, matches);

  useEffect(() => {
    setMoreOpen(matches.length === 0);
  }, [matches.length]);

  if (matches.length === 0 && remainingJobs.length === 0) return null;

  const hasMore = matches.length > INITIAL_MATCHES;
  const visible = hasMore && !expanded ? matches.slice(0, INITIAL_MATCHES) : matches;

  const heading =
    matches.length > 0
      ? hasMore
        ? t("results.yourBest")
        : matches.length === 1
          ? t("results.yourTop")
          : t("results.yourTopN", { count: matches.length })
      : null;

  const subline =
    matches.length > 0 && hasMore
      ? expanded
        ? t("results.allEvaluated", { count: matches.length })
        : t("results.topOf", { shown: INITIAL_MATCHES, total: matches.length })
      : null;

  return (
    <section id="matches" className="results" aria-label={t("results.aria")}>
      {matches.length > 0 && (
        <div className="results-header">
          <h2>{heading}</h2>
          {subline && <p className="results-sub">{subline}</p>}
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
      )}

      {matches.length > 0 && (
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
      )}

      {remainingJobs.length > 0 && (
        <div className="results-remaining">
          {matches.length === 0 && (
            <p className="results-remaining-note">{t("results.evaluatedUnavailable")}</p>
          )}
          <div className="results-remaining-head">
            <button
              type="button"
              className="results-remaining-toggle"
              aria-expanded={moreOpen}
              aria-controls="remaining-jobs"
              onClick={() => setMoreOpen((value) => !value)}
            >
              {moreOpen
                ? matches.length === 0
                  ? t("results.hideFound")
                  : t("results.hideMore")
                : matches.length === 0
                  ? t("results.viewFound", { count: remainingJobs.length })
                  : t("results.moreFound")}
            </button>
            {matches.length > 0 && (
              <span className="results-remaining-count">
                {t("results.remaining", { count: remainingJobs.length })}
              </span>
            )}
          </div>

          {moreOpen && (
            <ol id="remaining-jobs" className="remaining-list">
              {remainingJobs.map((job) => (
                <RemainingCard key={job.slug} job={job} />
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
