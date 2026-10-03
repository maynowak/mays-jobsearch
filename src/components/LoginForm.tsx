import { useState } from "react";
import type { FormEvent } from "react";
import { useLang } from "../i18n";

interface FieldErrors {
  email?: string;
  password?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// REGISTRATION-UI-01: minimale Login-Maske NUR als Navigationsziel der
// Registrierung (Login ↔ Registrierung, visuell konsistent im selben
// Auth-Layout). Wie die Registrierung bewusst NICHT verdrahtet: kein fetch,
// kein Cognito, keine API, keine Persistenz, keine Session.
export default function LoginForm() {
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [prepared, setPrepared] = useState(false);
  // AUTH-UI-01: UI-only Hinweis (kein Backend, kein Reset-Flow).
  const [showForgotHint, setShowForgotHint] = useState(false);

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
    }
    return next;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    // Placeholder statt Backend: UI-Zustand "vorbereitet", sonst nichts.
    setPrepared(true);
  };

  if (prepared) {
    return (
      <section className="card auth-card" aria-label={t("auth.loginTitle")}>
        <h2>{t("auth.loginPreparedTitle")}</h2>
        <p className="alert-status ok" role="status">
          {t("auth.loginPreparedText")}
        </p>
        <nav className="auth-links" aria-label={t("auth.loginTitle")}>
          <a href="/registrieren">{t("auth.toRegister")}</a>
          <a href="/top">{t("auth.backToMatcher")}</a>
        </nav>
      </section>
    );
  }

  return (
    <section className="card auth-card" aria-label={t("auth.loginTitle")}>
      <h2>{t("auth.loginTitle")}</h2>
      <p className="auth-lead">{t("auth.loginLead")}</p>
      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="login-email">{t("auth.email")}</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder={t("auth.emailPh")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "login-email-error" : undefined}
          />
          {errors.email && (
            <p className="field-error" id="login-email-error" role="alert">
              {errors.email}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="login-password">{t("auth.password")}</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder={t("auth.passwordPh")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "login-password-error" : undefined}
          />
          {errors.password && (
            <p className="field-error" id="login-password-error" role="alert">
              {errors.password}
            </p>
          )}
        </div>
        <button type="submit" className="auth-submit">
          <span className="btn-label">{t("auth.submitLogin")}</span>
        </button>
      </form>
      <div className="auth-forgot">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setShowForgotHint((prev) => !prev)}
          aria-expanded={showForgotHint}
        >
          {t("auth.forgotPassword")}
        </button>
        {showForgotHint && (
          <p className="auth-hint" role="status">
            {t("auth.forgotHint")}
          </p>
        )}
      </div>
      <div className="auth-divider" aria-hidden="true" />
      <nav className="auth-links" aria-label={t("auth.loginTitle")}>
        <a href="/registrieren">{t("auth.toRegister")}</a>
        <a href="/top">{t("auth.backToMatcher")}</a>
      </nav>
    </section>
  );
}
