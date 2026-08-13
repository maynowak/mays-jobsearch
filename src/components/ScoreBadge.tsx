import { useLang } from "../i18n";

export default function ScoreBadge({ score }: { score: number }) {
  const { t } = useLang();
  const className = score >= 75 ? "score-high" : score >= 50 ? "score-mid" : "score-low";
  return (
    <span className={`score ${className}`} title={t("score.title", { score })}>
      {score}
    </span>
  );
}