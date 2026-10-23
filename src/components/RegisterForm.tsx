import { useLang } from "../i18n";
import { useState } from "react";
import AuthCard from "./AuthCard";
import {
  CognitoAuthError,
  cognitoSignUp,
} from "../lib/cognitoAuthApi";

/**
 * EMAIL-ONLY-REGISTRATION-01 — Registrierung mit lokalem Formular.
 *
 * Pflichtfelder: E-Mail, Passwort. Die E-Mail-Adresse ist der Cognito-Username;
 * ein separates Benutzername-Feld gibt es nicht mehr. Frontend-Validierung
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const errors: Record<string, string> = {};
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
    const normalizedEmail = email.trim();
    try {
      const result = await cognitoSignUp({
        email: normalizedEmail,
        password,
      });
      // Cognito-Standard nach SignUp: UNCONFIRMED → E-Mail-Bestätigung.
      // (Sollte der Pool auto-confirmieren, führt der Weg über die
      // Bestätigungsseite trotzdem zum Ziel: ConfirmSignUp auf bereits
      // bestätigte Accounts antwortet mit einem klaren Hinweis.)
      void result;
      window.location.assign(
        `/email-bestaetigen?email=${encodeURIComponent(normalizedEmail)}`
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
          <label htmlFor="register-email">{t("auth.email")}</label>
          <div className="auth-input-wrap">
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder={t("auth.emailPh")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "register-email-error" : undefined}
            />
          </div>
          {fieldErrors.email && (
            <p id="register-email-error" className="auth-error" role="alert">
              {fieldErrors.email}
            </p>
          )}
        </div>
        <div className="auth-field">
          <label htmlFor="register-password">{t("auth.password")}</label>
          <div className="auth-input-wrap">
            <input
              id="register-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "register-password-error" : undefined}
            />
            <button
              type="button"
              className="auth-toggle-password"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
              aria-pressed={showPassword}
            >
              {showPassword ? (
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
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
