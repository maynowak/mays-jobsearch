import { useState } from "react";
import type { FormEvent } from "react";
import { useLang } from "../i18n";
import { useAuth } from "react-oidc-context";

interface FieldErrors {
  email?: string;
  password?: string;
  passwordRepeat?: string;
  privacy?: string;
  terms?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

// REGISTRATION-UI-01: reine GUI-Maske als funktionale Komponente (Hooks only).
// Bewusst NICHT verdrahtet: kein fetch, kein Cognito, keine API, keine
// Persistenz, keine Session. Submit validiert nur und zeigt einen
// Placeholder-Zustand ("Registrierung vorbereitet").
export default function RegisterForm() {
  const { t } = useLang();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [prepared, setPrepared] = useState(false);

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      next.email = t("auth.errorEmailRequired");
    } else if (!EMAIL_RE.test(trimmedEmail)) {
      next.email = t("auth.errorEmailInvalid");
    }
    if (!password) {
      next.password = t("auth.errorPasswordRequired");
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      next.password = t("auth.errorPasswordShort");
    }
    if (passwordRepeat !== password) {
      next.passwordRepeat = t("auth.errorPasswordMismatch");
    }
    if (!privacy) {
      next.privacy = t("auth.errorPrivacyRequired");
    }
    if (!terms) {
      next.terms = t("auth.errorTermsRequired");
    }
    return next;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    // Redirect to Cognito Hosted UI for registration via Authorization Code + PKCE
    try {
      auth.signinRedirect({ extraQueryParams: { prompt: "login" } });
    } catch {
      setPrepared(true);
    }
  };

  if (prepared) {
    return (
      <section className="card auth-card" aria-label={t("auth.registerTitle")}>
        <h2>{t("auth.preparedTitle")}</h2>
        <p className="alert-status ok" role="status">
          {t("auth.preparedText")}
        </p>
        <nav className="auth-links" aria-label={t("auth.registerTitle")}>
          <a href="/anmelden">{t("auth.toLogin")}</a>
          <a href="/search">{t("auth.backToMatcher")}</a>
        </nav>
      </section>
    );
  }

  return (
    <section className="card auth-card" aria-label={t("auth.registerTitle")}>
      <h2>{t("auth.registerTitle")}</h2>
      <p className="auth-lead">{t("auth.registerLead")}</p>
      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="reg-email">{t("auth.email")}</label>
          <input
            id="reg-email"
            type="email"
            autoComplete="email"
            placeholder={t("auth.emailPh")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "reg-email-error" : undefined}
          />
          {errors.email && (
            <p className="field-error" id="reg-email-error" role="alert">
              {errors.email}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="reg-password">{t("auth.password")}</label>
          <input
            id="reg-password"
            type="password"
            autoComplete="new-password"
            placeholder={t("auth.passwordPh")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "reg-password-error" : undefined}
          />
          {errors.password && (
            <p className="field-error" id="reg-password-error" role="alert">
              {errors.password}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="reg-password-repeat">{t("auth.passwordRepeat")}</label>
          <input
            id="reg-password-repeat"
            type="password"
            autoComplete="new-password"
            placeholder={t("auth.passwordRepeatPh")}
            value={passwordRepeat}
            onChange={(e) => setPasswordRepeat(e.target.value)}
            aria-invalid={errors.passwordRepeat ? true : undefined}
            aria-describedby={errors.passwordRepeat ? "reg-password-repeat-error" : undefined}
          />
          {errors.passwordRepeat && (
            <p className="field-error" id="reg-password-repeat-error" role="alert">
              {errors.passwordRepeat}
            </p>
          )}
        </div>
        <div className="field">
          <label className="auth-check" htmlFor="reg-privacy">
            <input
              id="reg-privacy"
              type="checkbox"
              checked={privacy}
              onChange={(e) => setPrivacy(e.target.checked)}
              aria-describedby={errors.privacy ? "reg-privacy-error" : undefined}
            />
            <span>{t("auth.privacy")}</span>
          </label>
          {errors.privacy && (
            <p className="field-error" id="reg-privacy-error" role="alert">
              {errors.privacy}
            </p>
          )}
        </div>
        <div className="field">
          <label className="auth-check" htmlFor="reg-terms">
            <input
              id="reg-terms"
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              aria-describedby={errors.terms ? "reg-terms-error" : undefined}
            />
            <span>{t("auth.terms")}</span>
          </label>
          {errors.terms && (
            <p className="field-error" id="reg-terms-error" role="alert">
              {errors.terms}
            </p>
          )}
        </div>
        <button type="submit" className="auth-submit">
          <span className="btn-label">{t("auth.submitRegister")}</span>
        </button>
      </form>
      <nav className="auth-links" aria-label={t("auth.registerTitle")}>
        <a href="/anmelden">{t("auth.toLogin")}</a>
        <a href="/search">{t("auth.backToMatcher")}</a>
      </nav>
    </section>
  );
}
