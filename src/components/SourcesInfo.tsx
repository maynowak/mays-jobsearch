import { useLang } from "../i18n";

export default function SourcesInfo() {
  const { t } = useLang();

  return (
    <div className="sources-info" title={t("sources.infoTooltip")}>
      <span className="sources-info-icon" aria-label={t("sources_info.label")}>ⓘ</span>
    </div>
  );
}
