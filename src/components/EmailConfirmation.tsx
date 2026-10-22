import { useLang } from "../i18n";
import { useState } from "react";
import AuthCard from "./AuthCard";
import {
  CognitoAuthError,
  cognitoConfirmSignUp,
  cognitoResendConfirmationCode,
} from "../lib/cognitoAuthApi";

/**
 * JOBMATCHER-RIS-COGNITO-INTEGRATION-04 — E-Mail-Bestätigung (ConfirmSignUp).
 *
 * Bestätigungscode eingeben, Code erneut senden, verständliche Fehler.
 * Nach erfolgreicher Bestätigung → /anmelden. Der Code wird ausschließlich
 * an Cognito übertragen — nie geloggt.
 */
export default function EmailConfirmation() {
  const { t } = useLang();
  const params = new URLSearchParams(window.location.search);
  const username = params.get("username") || "";
  const [code, setCode] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  function errorMessage(err: CognitoAuthError): string {
    switch (err.code) {
      case "code-mismatch":
        return t("auth.errorInvalidCode");
      case "code-expired":
        return t("auth.errorExpiredCode");
      case "too-many-requests":
      case "limit-exceeded":
        return t("auth.errorTooManyAttempts");
      case "not-authorized":
        return t("auth.errorAlreadyConfirmed");
      case "network":
        return t("auth.errorNetwork");
      case "config":
        return t("auth.errorConfig");
      default:
        return t("auth.errorUnknown");
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setNotice(null);
    if (!code.trim()) {
      setServerError(t("auth.errorCodeRequired"));
      return;
    }
    setSubmitting(true);
    try {
      await cognitoConfirmSignUp({ username, code: code.trim() });
      setConfirmed(true);
    } catch (err) {
      const cae = err instanceof CognitoAuthError ? err : new CognitoAuthError("unknown", "");
      setServerError(errorMessage(cae));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setServerError(null);
    setNotice(null);
    setResending(true);
    try {
      await cognitoResendConfirmationCode({ username });
      setNotice(t("auth.confirmResent"));
    } catch (err) {
      const cae = err instanceof CognitoAuthError ? err : new CognitoAuthError("unknown", "");
      setServerError(errorMessage(cae));
    } finally {
      setResending(false);
    }
  }

  if (!username) {
    return (
      <AuthCard label={t("auth.confirmTitle")}>
        <h2>{t("auth.confirmTitle")}</h2>
        <p className="auth-error" role="alert">{t("auth.errorMissingUsername")}</p>
        <nav className="auth-links" aria-label={t("auth.confirmTitle")}>
          <a href="/registrieren">{t("auth.toRegister")}</a>
        </nav>
      </AuthCard>
    );
  }

  return (
    <AuthCard label={t("auth.confirmTitle")}>
      <h2>{t("auth.confirmTitle")}</h2>
      <p className="auth-lead">{t("auth.confirmLead")}</p>
      {confirmed ? (
        <div className="auth-confirm-success">
          <p role="status">{t("auth.confirmSuccess")}</p>
          <button
            type="button"
            className="auth-submit"
            onClick={() => window.location.assign("/anmelden")}
          >
            <span className="btn-label">{t("auth.toLoginAfterConfirm")}</span>
          </button>
        </div>
      ) : (
        <>
          {serverError && (
            <p className="auth-error" role="alert">{serverError}</p>
          )}
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          <form onSubmit={handleConfirm} noValidate>
            <div className="auth-field">
              <label htmlFor="confirm-code">{t("auth.confirmCode")}</label>
              <input
                id="confirm-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                aria-invalid={Boolean(serverError)}
              />
            </div>
            <button type="submit" className="auth-submit" disabled={submitting}>
              <span className="btn-label">
                {submitting ? t("auth.submitting") : t("auth.confirmSubmit")}
              </span>
            </button>
          </form>
          <div className="auth-divider" aria-hidden="true" />
          <button
            type="button"
            className="auth-resend"
            onClick={handleResend}
            disabled={resending}
          >
            <span className="btn-label">
              {resending ? t("auth.submitting") : t("auth.confirmResend")}
            </span>
          </button>
        </>
      )}
      <nav className="auth-links" aria-label={t("auth.confirmTitle")}>
        <a href="/anmelden">{t("auth.toLogin")}</a>
        <a href="/search">{t("auth.backToMatcher")}</a>
      </nav>
    </AuthCard>
  );
}
