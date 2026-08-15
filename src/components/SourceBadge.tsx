import type { JobSource } from "../types";
import { useLang } from "../i18n";

const SOURCE_LABEL_KEYS: Record<JobSource, string> = {
  "existing": "source.existing",
  "apify-arbeitsagentur": "source.apify",
};

function sourceKeys(sources: JobSource[] | undefined): string[] {
  const list: JobSource[] = Array.isArray(sources) && sources.length ? sources : ["existing"];
  return list.map((s) => SOURCE_LABEL_KEYS[s] ?? "source.existing");
}

export default function SourceBadge({ sources }: { sources?: JobSource[] }) {
  const { t } = useLang();
  return (
    <span className="badge badge-source">
      {t("source.label")} {sourceKeys(sources).map((key) => t(key)).join(" · ")}
    </span>
  );
}
