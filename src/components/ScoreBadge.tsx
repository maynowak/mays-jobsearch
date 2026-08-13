export default function ScoreBadge({ score }: { score: number }) {
  const className = score >= 75 ? "score-high" : score >= 50 ? "score-mid" : "score-low";
  return (
    <span className={`score ${className}`} title={`${score}/100 match`}>
      {score}
    </span>
  );
}