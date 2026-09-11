interface AtsResult {
  analysis: {
    score: number;
    keywordCoverage: { overall: number };
    criticalGaps: Array<{ id: string; text: string }>;
  };
  recommendations: Array<{
    requirementId: string;
    changeType: string;
    priority: string;
    proposedChange: string;
    rationale: string;
  }>;
}

const statusColors: Record<string, string> = {
  MATCHED: "text-green-600",
  PARTIAL: "text-yellow-600",
  GAP: "text-red-600",
  UNKNOWN: "text-gray-600",
};

const changeTypeLabels: Record<string, string> = {
  KEYWORD_REINFORCEMENT: "Keyword Reinforcement",
  EVIDENCE_CLARIFICATION: "Evidence Clarification",
  GAP_FLAG: "Gap Identified",
  UNKNOWN_REVIEW: "Review Needed",
};

export interface ATSDetailsProps {
  result: AtsResult;
}

export function ATSDetails({ result }: ATSDetailsProps) {
  const { analysis, recommendations } = result;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg p-4 shadow-sm border">
        <h3 className="text-lg font-semibold mb-2">ATS Score</h3>
        <div className="text-3xl font-bold text-blue-600">
          {Math.round(analysis.score)}/100
        </div>
        <div className="text-sm text-gray-600 mt-1">
          Keyword Coverage: {Math.round(analysis.keywordCoverage.overall * 100)}%
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <h3 className="text-lg font-semibold mb-3">Optimizations</h3>
          <div className="space-y-3">
            {recommendations.map((rec, idx) => (
              <div key={rec.requirementId || idx} className="border-l-2 pl-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{rec.changeType}</span>
                  <span className={`text-xs ${statusColors[rec.changeType.split("_")[0]] || ""}`}>
                    {changeTypeLabels[rec.changeType] || rec.changeType}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{rec.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
