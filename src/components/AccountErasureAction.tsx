import { useState } from "react";
import { useAuth } from "react-oidc-context";
import { useLang } from "../i18n";
import {
  AccountErasureApiError,
  isRisAccountErasureEnabled,
  requestAccountErasure,
  type AccountErasureResult,
} from "../lib/accountErasureApi";

/**
 * Explicit, opt-in UI for the existing RIS account-erasure lifecycle.
 *
 * It is not rendered unless the operator enables the browser flag for the
 * isolated pilot. There is no automatic deletion and no second deletion path.
 */
export default function AccountErasureAction() {
  const { t } = useLang();
  const auth = useAuth();
  const token = auth?.user?.access_token ?? "";
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AccountErasureResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isRisAccountErasureEnabled() || !token) return null;

  const confirmed = confirmation.trim().toUpperCase() === "LÖSCHEN";

  const run = async () => {
    if (!confirmed || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await requestAccountErasure(token));
    } catch (err) {
      setError(err instanceof AccountErasureApiError
        ? `${err.message}${err.code ? ` (${err.code})` : ""}`
        : t("accountErasure.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="storage-consent__block" aria-labelledby="account-erasure-title">
      <h3 id="account-erasure-title">{t("accountErasure.title")}</h3>
      <p role="note">{t("accountErasure.warning")}</p>
      <p className="field-hint">{t("accountErasure.openLimits")}</p>
      <label className="field">
        <span>{t("accountErasure.confirmLabel")}</span>
        <input
          type="text"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder={t("accountErasure.confirmPlaceholder")}
          autoComplete="off"
          disabled={busy}
        />
      </label>
      <div className="storage-consent__actions">
        <button
          type="button"
          className="btn-danger"
          disabled={busy || !confirmed}
          onClick={() => void run()}
        >
          {busy ? t("accountErasure.busy") : t("accountErasure.action")}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {result && (
        <div role="status">
          <p>{result.complete ? t("accountErasure.complete") : t("accountErasure.partial")}</p>
          <p className="field-hint">
            {`credentials=${result.credentialsRevoked ?? 0} · searchProfiles=${result.searchProfilesDeleted ?? 0} · applications=${result.applicationsDeleted ?? 0} · documents=${result.documentsDeleted ?? 0}`}
          </p>
          {result.complete && <p>{t("accountErasure.signOut")}</p>}
        </div>
      )}
    </section>
  );
}
