import { useLang } from "../i18n";
import type { SessionApplicationV1 } from "../lib/applications/sessionApplications";
import {
  followUpShortLabel,
  getFollowUpViewState,
} from "../lib/applications/followUp";

interface Props {
  application: SessionApplicationV1;
  selected: boolean;
  onSelect: () => void;
}

function formatDate(value: string, locale: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

function formatApplicationDate(value: string, locale: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return formatDate(value, locale);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

export default function ApplicationCard({ application, selected, onSelect }: Props) {
  const { t, lang } = useLang();
  const locale = lang === "de" ? "de-DE" : "en-GB";
  const status = t(`applications.status.${application.status}`);
  const followUp = application.followUp;
  const followUpState = followUp ? getFollowUpViewState(followUp) : null;
  const location = application.job.location.join(", ");
  const dateLabel = application.applicationDate
    ? `${t("applications.applied")}: ${formatApplicationDate(application.applicationDate, locale)}`
    : `${t("applications.created")}: ${formatDate(application.createdAt, locale)}`;
  const ariaLabel = [
    application.job.title,
    application.job.companyName,
    status,
    location,
    dateLabel,
    ...(followUp ? [followUpShortLabel(followUp, locale, t)] : []),
  ]
    .filter(Boolean)
    .join(" — ");

  return (
    <button
      type="button"
      className={`applications-card applications-list__item${selected ? " applications-list__item--active applications-card--selected" : ""}`}
      onClick={onSelect}
      aria-label={ariaLabel}
      aria-current={selected ? "true" : undefined}
    >
      <span className="applications-card__head">
        <strong title={application.job.title}>{application.job.title}</strong>
        {selected && (
          <span className="applications-card__selected-mark" aria-hidden="true">
            ✓
          </span>
        )}
      </span>
      <span className="applications-card__company">{application.job.companyName}</span>
      {location && <span className="applications-card__location">{location}</span>}
      <span className={`applications-card__status applications-card__status--${application.status}`}>
        {status}
      </span>
      <span className="applications-card__date">{dateLabel}</span>
      {followUp && followUpState && (
        <span className={`applications-card__followup applications-card__followup--${followUpState}`}>
          <span aria-hidden="true">↗</span> {followUpShortLabel(followUp, locale, t)}
        </span>
      )}
    </button>
  );
}
