import { useLang } from "../i18n";
import { useAuth } from "react-oidc-context";

// REGISTRATION-UI-01: minimale Login-Maske für Cognito Managed Login.
// Keine lokale Passworteingabe, keine Validierung, keine Speicherung.
export default function LoginForm() {
  const { t } = useLang();
  const auth = useAuth();

  const handleSignIn = () => {
    auth.signinRedirect();
  };

  return (
    <section className="card auth-card" aria-label={t("auth.loginTitle")}>
      <h2>{t("auth.loginTitle")}</h2>
      <p className="auth-lead">{t("auth.loginLead")}</p>
      <button type="button" className="auth-submit" onClick={handleSignIn}>
        <span className="btn-label">{t("auth.submitLogin")}</span>
      </button>
      <div className="auth-divider" aria-hidden="true" />
      <nav className="auth-links" aria-label={t("auth.loginTitle")}>
        <a href="/registrieren">{t("auth.toRegister")}</a>
        <a href="/search">{t("auth.backToMatcher")}</a>
      </nav>
    </section>
  );
}
