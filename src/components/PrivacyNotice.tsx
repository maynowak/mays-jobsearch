export function PrivacyNotice({
  provider,
  privacyStatus,
}: {
  provider?: string;
  privacyStatus?: string;
}) {
  if (!provider) return null;

  return (
    <div className="privacy-notice">
      <h4 className="privacy-notice__title">AI Optimization Notice</h4>
      <p className="privacy-notice__description">
        We offer AI-powered suggestions for your CV. Only minimal data is sent:
      </p>
      <ul className="privacy-notice__list">
        <li>Job requirement (public)</li>
        <li>Your matched skill keyword</li>
      </ul>
      <p className="privacy-notice__meta">
        Provider: {provider} | Status: {privacyStatus || "Unknown"}
      </p>
    </div>
  );
}
