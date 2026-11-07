import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import {
  RisConsentApiError,
  fetchRisConsent,
  fetchRisConsentHistory,
  grantRisConsent,
  withdrawRisConsent,
  type RisConsent,
} from "../lib/risConsentApi";
import { STORAGE_CONSENT_TEXT_VERSION } from "../lib/storageConsent";

/**
 * Live consent controls backed by the RIS consent service through the BFF.
 * Rendered only when VITE_RIS_CONSENT_UI_ENABLED=true and the identity is
 * verified, so the preparation-mode markup stays the default.
 */
export default function StorageConsentLive() {
  const auth = useAuth();
  const token = auth.user?.access_token ?? "";
  const [consent, setConsent] = useState<RisConsent | null>(null);
  const [grantAllowed, setGrantAllowed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<Record<string, unknown>> | null>(null);

  useEffect(() => {
    let active = true;
    if (!token) return;
    fetchRisConsent(token)
      .then((state) => {
        if (!active) return;
        setConsent(state.consent);
        setGrantAllowed(state.grantAllowed);
      })
      .catch((err) => { if (active) setError(messageOf(err)); });
    return () => { active = false; };
  }, [token]);

  const run = async (action: () => Promise<RisConsent>) => {
    setBusy(true);
    setError(null);
    try {
      setConsent(await action());
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const status = consent?.status ?? "NOT_GRANTED";
  const canGrant = grantAllowed && status !== "GRANTED";

  return (
    <section className="storage-consent__block" aria-labelledby="storage-consent-live-title">
      <h3 id="storage-consent-live-title">Speicherung von Bewerbungen</h3>
      <p role="status">
        Status: <strong>{label(status)}</strong>
        {consent?.noticeVersion ? ` (Textversion ${consent.noticeVersion})` : ""}
      </p>
      {error && <p role="alert">{error}</p>}
      {!grantAllowed && status !== "GRANTED" && (
        <p className="field-hint" role="note">
          Die Einwilligungs-Textversion ist noch nicht freigegeben. Die Zustimmung ist gesperrt.
        </p>
      )}
      <p className="field-hint">
        <a href="/datenschutz">Datenschutzhinweise zur Bewerbungsspeicherung</a>
        {` · Angezeigte Textfassung: ${STORAGE_CONSENT_TEXT_VERSION}`}
        {consent?.noticeVersion ? ` · RIS-Textversion: ${consent.noticeVersion}` : ""}
      </p>
      <div className="storage-consent__actions">
        <button
          type="button"
          className="btn-ghost"
          disabled={busy || !canGrant}
          onClick={() => run(() => grantRisConsent(token))}
        >
          Speicherung zustimmen
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy || status !== "GRANTED"}
          onClick={() => run(() => withdrawRisConsent(token))}
        >
          Einwilligung widerrufen
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy || !token}
          onClick={async () => {
            setBusy(true);
            try { setHistory(await fetchRisConsentHistory(token)); }
            catch (err) { setError(messageOf(err)); }
            finally { setBusy(false); }
          }}
        >
          Verlauf anzeigen
        </button>
      </div>
      {history && (
        <ul aria-label="Einwilligungsverlauf">
          {history.map((event, index) => (
            <li key={String(event.eventId ?? index)}>
              {String(event.event ?? "")} · {String(event.occurredAt ?? "")}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function label(status: string): string {
  if (status === "GRANTED") return "erteilt";
  if (status === "WITHDRAWN") return "widerrufen";
  return "nicht erteilt";
}

function messageOf(err: unknown): string {
  if (err instanceof RisConsentApiError) {
    if (err.code === "notice_version_not_mapped") {
      return "Die Einwilligungs-Textversion ist noch nicht freigegeben.";
    }
    if (err.code === "test_user_not_allowed") {
      return "Dieses Konto ist für die RIS-Testspeicherung nicht freigegeben.";
    }
  }
  return "Einwilligungsdienst ist derzeit nicht verfügbar.";
}
