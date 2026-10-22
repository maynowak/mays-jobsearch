import { useLang } from "../i18n";
import { useState } from "react";
import AuthCard from "./AuthCard";
import {
  CognitoAuthError,
  cognitoSignUp,
} from "../lib/cognitoAuthApi";

/**
 * JOBMATCHER-RIS-COGNITO-INTEGRATION-04 — Registrierung mit lokalem Formular.
 *
 * Pflichtfelder: Benutzername, E-Mail, Passwort. Frontend-Validierung
 * (Pflichtfelder, E-Mail-Format, Cognito-Passwort-Policy: min. 8 Zeichen,
 * Groß-/Kleinbuchstaben, Zahlen). Nach erfolgreichem SignUp (UNCONFIRMED)
 * Weiterleitung zur E-Mail-Bestätigung (/email-bestaetigen). Passwort wird
 * ausschließlich an Cognito übertragen — nie geloggt, nie gespeichert.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function meetsPasswordPolicy(pw: string): boolean {
  return pw.length >= 8 && /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /[0-9]/.test(pw);
}

export default function RegisterForm() {
  const { t } = useLang();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!username.trim()) errors.username = t("auth.errorRequired");
    if (!email.trim()) errors.email = t("auth.errorEmailRequired");
    else if (!EMAIL_RE.test(email.trim())) errors.email = t("auth.errorEmailInvalid");
    if (!password) errors.password = t("auth.errorPasswordRequired");
    else if (!meetsPasswordPolicy(password)) errors.password = t("auth.errorPasswordPolicy");
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function serverErrorMessage(err: CognitoAuthError): string {
    switch (err.code) {
      case "user-exists":
        return t("auth.errorUserExists");
      case "invalid-password":
        return t("auth.errorPasswordPolicy");
      case "invalid-parameter":
        return t("auth.errorInvalidParameter");
      case "too-many-requests":
      case "limit-exceeded":
        return t("auth.errorTooManyAttempts");
      case "network":
        return t("auth.errorNetwork");
      case "config":
        return t("auth.errorConfig");
      default:
        return t("auth.errorUnknown");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const result = await cognitoSignUp({
        username: username.trim(),
        email: email.trim(),
        password,
      });
      // Cognito-Standard nach SignUp: UNCONFIRMED → E-Mail-Bestätigung.
      // (Sollte der Pool auto-confirmieren, führt der Weg über die
      // Bestätigungsseite trotzdem zum Ziel: ConfirmSignUp auf bereits
      // bestätigte Accounts antwortet mit einem klaren Hinweis.)
      void result;
      window.location.assign(
        `/email-bestaetigen?username=${encodeURIComponent(username.trim())}`
      );
    } catch (err) {
      const cae = err instanceof CognitoAuthError ? err : new CognitoAuthError("unknown", "");
      setServerError(serverErrorMessage(cae));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard label={t("auth.registerTitle")}>
      <h2>{t("auth.registerTitle")}</h2>
      <p className="auth-lead">{t("auth.registerLead")}</p>
      {serverError && (
        <p className="auth-error" role="alert">
          {serverError}
        </p>
      )}
      <form onSubmit={handleSubmit} noValidate>
        <div className="auth-field">
          <label htmlFor="register-username">{t("auth.username")}</label>
          <input
            id="register-username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-invalid={Boolean(fieldErrors.username)}
            aria-describedby={fieldErrors.username ? "register-username-error" : undefined}
          />
          {fieldErrors.username && (
            <p id="register-username-error" className="auth-error" role="alert">
              {fieldErrors.username}
            </p>
          )}
        </div>
        <div className="auth-field">
          <label htmlFor="register-email">{t("auth.email")}</label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            placeholder={t("auth.emailPh")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "register-email-error" : undefined}
          />
          {fieldErrors.email && (
            <p id="register-email-error" className="auth-error" role="alert">
              {fieldErrors.email}
            </p>
          )}
        </div>
        <div className="auth-field">
          <label htmlFor="register-password">{t("auth.password")}</label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? "register-password-error" : undefined}
          />
          {fieldErrors.password && (
            <p id="register-password-error" className="auth-error" role="alert">
              {fieldErrors.password}
            </p>
          )}
        </div>
        <button type="submit" className="auth-submit" disabled={submitting}>
          <span className="btn-label">
            {submitting ? t("auth.submitting") : t("auth.submitRegister")}
          </span>
        </button>
      </form>
      <nav className="auth-links" aria-label={t("auth.registerTitle")}>
        <a href="/anmelden">
          <svg className="auth-link-icon" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t("auth.toLogin")}
        </a>
        <a href="/search">
          <svg className="auth-link-icon" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M11 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t("auth.backToMatcher")}
        </a>
      </nav>
    </AuthCard>
  );
}
