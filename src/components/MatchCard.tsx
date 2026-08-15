import type { Job, Match } from "../types";
import ScoreBadge from "./ScoreBadge";
import SourceBadge from "./SourceBadge";
import { useLang } from "../i18n";

interface Props {
  match: Match;
  index: number;
  onGenerateLetter: (job: Job, prepare: string) => void;
}

export default function MatchCard({ match, index, onGenerateLetter }: Props) {
  const { t } = useLang();
  const job = match.job ?? ({} as Partial<Job>);
  const m = (job as Job) || {};

  const location =
    (m.location ?? []).join(", ") || (m.remote ? t("match.remote") : t("match.locationNotStated"));

  return (
    <li className="match-card">
      <span className="rank">#{index + 1}</span>
      <ScoreBadge score={match.score} />

      <div className="match-body">
        <div className="match-head">
          <h3>{m.title ?? t("match.unknownRole")}</h3>
          {m.company_name && <span className="company">{m.company_name}</span>}
        </div>

        <div className="meta">
          <span>{location}</span>
          {m.remote && <span className="badge badge-remote">{t("match.remote")}</span>}
          <span className="badge badge-evaluated">{t("results.evaluatedBadge")}</span>
          <SourceBadge sources={m.source} />
        </div>

        {(m.tags ?? []).length > 0 && (
          <div className="tags">
            {(m.tags ?? []).slice(0, 8).map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        )}

        {match.why && <p className="why">{match.why}</p>}

        {match.prepare && (
          <p className="prepare">
            <strong>{t("match.prepare")} </strong>
            {match.prepare}
          </p>
        )}

        {m.url && (
          <a
            className="apply-link"
            href={m.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("match.viewPosting")}
          </a>
        )}

        <button
          type="button"
          className="letter-btn"
          onClick={() => onGenerateLetter(m as Job, match.prepare || "")}
        >
          {t("match.generateLetter")}
        </button>
      </div>
    </li>
  );
}