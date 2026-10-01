import type { Job, JobSource } from "../types";
import { useLang } from "../i18n";

const SOURCE_LABEL_KEYS: Partial<Record<JobSource, string>> = {
  arbeitnow: "source.arbeitnow",
  arbeitsagentur: "source.arbeitsagentur",
  greenhouse: "source.greenhouse",
  adzuna: "source.adzuna",
  jobspipe: "source.jobspipe",
  theirstack: "source.theirstack",
};

function sourceLabel(source: JobSource, t: (key: string) => string): string {
  const key = SOURCE_LABEL_KEYS[source];
  return key ? t(key) : source;
}

interface Props {
  jobs: Job[];
  // Roh-Treffer je Source (meta.sources der letzten Suche). Quellen, die
  // geliefert haben, aber aus dem Anzeige-Pool fielen, erscheinen zusätzlich
  // als abgesetzte Zeilen — keine liefernde Quelle bleibt unsichtbar.
  deliveredCounts?: Partial<Record<string, number>> | null;
  // Deaktivierte/nicht konfigurierte Quellen (meta.disabledSources) — werden
  // als inaktive Zeilen gezeigt, damit fehlende Quellen nicht kommentarlos
  // fehlen (JOB-SOURCES-01: Docker-Suche lieferte nur 2 Quellen).
  disabledSources?: string[] | null;
  // Laufzeit-Gründe je abgefragter Quelle (meta.sourceReasons, null = ok).
  // Nicht-nulle Gründe werden als Hinweis-Zeilen gezeigt.
  sourceReasons?: Partial<Record<string, string | null>> | null;
}

const NOT_CONFIGURED_REASONS = new Set([
  "missing_config",
  "no_boards_configured",
  "no_countries_configured",
  "disabled",
]);

const LIMIT_REASONS = new Set(["limit_reached", "user_limit_reached"]);

function reasonLabel(reason: string, t: (key: string) => string): string {
  if (NOT_CONFIGURED_REASONS.has(reason)) return t("sources.reasonNotConfigured");
  if (LIMIT_REASONS.has(reason)) return t("sources.reasonLimitReached");
  return reason;
}

export default function JobSources({ jobs, deliveredCounts, disabledSources, sourceReasons }: Props) {
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

  const shown = new Set(rows.map(([source]) => source));
  const cutRows: Array<[string, number]> = [];
  for (const [source, raw] of Object.entries(deliveredCounts ?? {})) {
    if (typeof raw === "number" && raw > 0 && !shown.has(source as JobSource)) {
      cutRows.push([source, raw]);
    }
  }
  cutRows.sort((a, b) => b[1] - a[1]);

  // Inaktive Quellen (deaktiviert oder nicht konfiguriert) + Quellen mit
  // Laufzeit-Problem — jeweils nur, wenn sie nicht bereits als liefernd
  // angezeigt werden.
  const inactiveRows: Array<[string, string]> = [];
  for (const source of disabledSources ?? []) {
    if (!shown.has(source as JobSource) && !inactiveRows.some(([s]) => s === source)) {
      inactiveRows.push([source, t("sources.inactive")]);
    }
  }
  for (const [source, reason] of Object.entries(sourceReasons ?? {})) {
    if (
      typeof reason === "string" &&
      reason &&
      !shown.has(source as JobSource) &&
      !inactiveRows.some(([s]) => s === source)
    ) {
      inactiveRows.push([source, reasonLabel(reason, t)]);
    }
  }
  inactiveRows.sort((a, b) => a[0].localeCompare(b[0]));

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
        {cutRows.map(([source, raw]) => (
          <li key={source} className="job-sources-row job-sources-row--cut">
            <span className="job-sources-name">{sourceLabel(source as JobSource, t)}</span>
            <span className="job-sources-count">
              {raw} {t("sources.unit")}{" "}
              <span className="job-sources-muted">({t("sources.notShown")})</span>
            </span>
          </li>
        ))}
        {inactiveRows.map(([source, note]) => (
          <li key={source} className="job-sources-row job-sources-row--inactive">
            <span className="job-sources-name">{sourceLabel(source as JobSource, t)}</span>
            <span className="job-sources-count">
              <span className="job-sources-muted">({note})</span>
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
