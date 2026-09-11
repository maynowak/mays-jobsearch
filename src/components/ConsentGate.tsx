import { useState } from "react";

export interface ConsentGateProps {
  onAccept: () => void;
  provider: string;
  privacyStatus: string;
}

export function ConsentGate({ onAccept, provider, privacyStatus }: ConsentGateProps) {
  const [consent, setConsent] = useState(false);

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border mb-4">
      <h4 className="font-semibold mb-2">Enable AI Optimization</h4>
      <p className="text-sm text-gray-600 mb-3">
        The AI will receive:
      </p>
      <ul className="text-sm text-gray-600 mb-3">
        <li>• Job requirement information</li>
        <li>• Your matched skill keywords</li>
      </ul>
      <p className="text-xs text-gray-500 mb-3">
        Provider: {provider} | Status: {privacyStatus}
      </p>
      
      <label className="flex items-center gap-2 mb-3">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.currentTarget.checked)}
          className="rounded border-gray-300"
        />
        <span className="text-sm">I consent to AI processing</span>
      </label>
      
      <button
        onClick={onAccept}
        disabled={!consent}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Continue
      </button>
    </div>
  );
}
