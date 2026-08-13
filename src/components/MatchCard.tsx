import type { Job, Match } from "../types";
import ScoreBadge from "./ScoreBadge";

interface Props {
  match: Match;
  index: number;
  onGenerateLetter: (job: Job, prepare: string) => void;
}

export default function MatchCard({ match, index, onGenerateLetter }: Props) {
  const job = match.job ?? ({} as Partial<Job>);
  const m = (job as Job) || {};

  const location =
    (m.location ?? []).join(", ") || (m.remote ? "Remote" : "Location not stated");

  return (
    <li className="match-card">
      <span className="rank">#{index + 1}</span>
      <ScoreBadge score={match.score} />

      <div className="match-body">
        <div className="match-head">
          <h3>{m.title ?? "Unknown role"}</h3>
          {m.company_name && <span className="company">{m.company_name}</span>}
        </div>

        <div className="meta">
          <span>{location}</span>
          {m.remote && <span className="badge badge-remote">Remote</span>}
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
            <strong>Prepare: </strong>
            {match.prepare}
          </p>
        )}

        <a
          className="apply-link"
          href={m.url || "#"}
          target="_blank"
          rel="noopener noreferrer"
        >
          View original posting →
        </a>

        <button
          type="button"
          className="letter-btn"
          onClick={() => onGenerateLetter(m as Job, match.prepare || "")}
        >
          Bewerbung generieren
        </button>
      </div>
    </li>
  );
}