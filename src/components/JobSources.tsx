import type { Job, JobSource } from "../types";
import { useLang } from "../i18n";

const SOURCE_LABEL_KEYS: Record<JobSource, string> = {
  arbeitnow: "source.arbeitnow",
  arbeitsagentur: "source.arbeitsagentur",
};

function sourceLabel(source: JobSource, t: (key: string) => string): string {
  const key = SOURCE_LABEL_KEYS[source];
  return key ? t(key) : source;
}

interface Props {
  jobs: Job[];
}

export default function JobSources({ jobs }: Props) {
  const { t } = useLang();
  if (jobs.length === 0) return null;

  const counts = new Map<JobSource, number>();
  for (const job of jobs) {
    for (const source of job.source ?? []) {
      counts.set(source, (counts.get(source) ?? 0) + 1);
    }
  }

  const rows = [...counts.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => (a[0] === "arbeitnow" ? -1 : 1) - (b[0] === "arbeitnow" ? -1 : 1));

  if (rows.length === 0) return null;

  return (
    <div className="job-sources" aria-label={t("sources.heading")}>
      <span className="job-sources-title">{t("sources.heading")}</span>
      <ul className="job-sources-list">
        {rows.map(([source, count]) => (
          <li key={source} className="job-sources-row">
            <span className="job-sources-name">{sourceLabel(source, t)}</span>
            <span className="job-sources-count">
              {count} {t("sources.unit")}
            </span>
          </li>
        ))}
      </ul>
      <div className="job-sources-total">
        <span>{t("sources.total")}</span>
        <span>
          {jobs.length} {t("sources.unit")}
        </span>
      </div>
    </div>
  );
}
