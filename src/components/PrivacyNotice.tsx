export function PrivacyNotice({
  provider,
  privacyStatus,
}: {
  provider?: string;
  privacyStatus?: string;
}) {
  if (!provider) return null;

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <h4 className="font-semibold text-yellow-800 mb-2">AI Optimization Notice</h4>
      <p className="text-sm text-yellow-700 mb-2">
        We offer AI-powered suggestions for your CV. Only minimal data is sent:
      </p>
      <ul className="text-sm text-yellow-700 mb-2 list-disc list-inside">
        <li>Job requirement (public)</li>
        <li>Your matched skill keyword</li>
      </ul>
      <p className="text-xs text-yellow-600">
        Provider: {provider} | Status: {privacyStatus || "Unknown"}
      </p>
    </div>
  );
}
