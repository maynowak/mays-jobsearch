import type { JobSource } from "../types";
import { useLang } from "../i18n";

const SOURCE_LABEL_KEYS: Record<JobSource, string> = {
  arbeitnow: "source.arbeitnow",
  arbeitsagentur: "source.arbeitsagentur",
};

function sourceLabels(sources: JobSource[] | undefined, t: (key: string) => string): string[] {
  const list: JobSource[] = Array.isArray(sources) && sources.length ? sources : ["arbeitnow"];
  return list.map((source) => {
    const key = SOURCE_LABEL_KEYS[source];
    return key ? t(key) : source;
  });
}

export default function SourceBadge({ sources }: { sources?: JobSource[] }) {
  const { t } = useLang();
  return (
    <span className="badge badge-source">
      {t("source.label")} {sourceLabels(sources, t).join(" · ")}
    </span>
  );
}