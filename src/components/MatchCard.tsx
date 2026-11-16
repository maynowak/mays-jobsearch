import { useRef, useState } from "react";
import type { Job, Match } from "../types";
import ScoreBadge from "./ScoreBadge";
import SourceBadge from "./SourceBadge";
import { useLang } from "../i18n";
import { formatGermanLocation } from "../lib/location";
import { renderSanitizedHtml } from "../lib/safeHtml";
import { hasSufficientJobDescription, loadJobDescriptionForAts } from "../lib/atsJobHandoff";

interface Props {
  match: Match;
  index: number;
  onGenerateLetter: (job: Job, prepare: string) => void;
  onAtsEvaluate?: (job: Job, descriptionOrigin?: "original" | "reloaded") => void;
  analyzing?: boolean;
}

function renderHtmlContent(html: string) {
  return renderSanitizedHtml(html);
}

export default function MatchCard({ match, index, onGenerateLetter, onAtsEvaluate, analyzing }: Props) {
  const { t } = useLang();
  const [atsLoading, setAtsLoading] = useState(false);
  const atsLoadingRef = useRef(false);
  const job = match.job ?? ({} as Partial<Job>);
  const m = (job as Job) || {};

  const handleAtsEvaluate = async () => {
    if (!onAtsEvaluate || atsLoadingRef.current) return;
    if (hasSufficientJobDescription(m as Job) || !(m.source ?? []).includes("arbeitsagentur")) {
      onAtsEvaluate(m as Job);
      return;
    }
    atsLoadingRef.current = true;
    setAtsLoading(true);
    const loaded = await loadJobDescriptionForAts(m as Job);
    atsLoadingRef.current = false;
    setAtsLoading(false);
    if (loaded) {
      onAtsEvaluate(loaded, "reloaded");
    } else {
      onAtsEvaluate(m as Job);
    }
  };

  const location =
    formatGermanLocation(m.location ?? []) || (m.remote ? t("match.remote") : t("match.locationNotStated"));

  return (
    <li className={`match-card${analyzing ? " match-card--analyzing" : ""}`}>
      <span className="rank">#{index + 1}</span>
      {analyzing && <span className="match-analyzing-badge" title={t("match.analyzing")}>🔍</span>}
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

        {match.why && renderHtmlContent(match.why)}

        {match.prepare && (
          <div className="prepare">
            <strong>{t("match.prepare")} </strong>
            {renderHtmlContent(match.prepare)}
          </div>
        )}

        <div className="job-actions">
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

          {onAtsEvaluate && (
            <button
              type="button"
              className="ats-evaluate-btn"
              onClick={() => void handleAtsEvaluate()}
              aria-label={atsLoading ? t("match.atsLoadingDescription") : t("match.atsEvaluate")}
              aria-busy={atsLoading}
              disabled={atsLoading}
            >
              {atsLoading ? t("match.atsLoadingDescription") : t("match.atsEvaluate")}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}