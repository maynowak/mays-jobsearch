import { useState } from "react";

export interface ConsentGateProps {
  onAccept: () => void;
  provider: string;
  privacyStatus: string;
}

export function ConsentGate({ onAccept, provider, privacyStatus }: ConsentGateProps) {
  const [consent, setConsent] = useState(false);

  return (
    <div className="consent-gate">
      <h4 className="consent-gate__title">Enable AI Optimization</h4>
      <p className="consent-gate__description">
        The AI will receive:
      </p>
      <ul className="consent-gate__list">
        <li>• Job requirement information</li>
        <li>• Your matched skill keywords</li>
      </ul>
      <p className="consent-gate__meta">
        Provider: {provider} | Status: {privacyStatus}
      </p>
      
      <label className="consent-gate__consent">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.currentTarget.checked)}
          className="consent-gate__checkbox"
        />
        <span className="consent-gate__consent-text">I consent to AI processing</span>
      </label>
      
      <button
        onClick={onAccept}
        disabled={!consent}
        className="consent-gate__action"
      >
        Continue
      </button>
    </div>
  );
}
