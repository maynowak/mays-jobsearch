import { useLang } from "../i18n";
import { useAuth } from "react-oidc-context";
import AuthCard from "./AuthCard";

// REGISTRATION-UI-01: minimale Login-Maske für Cognito Managed Login.
// Keine lokale Passworteingabe, keine Validierung, keine Speicherung.
export default function LoginForm() {
  const { t } = useLang();
  const auth = useAuth();

  const handleSignIn = () => {
    auth.signinRedirect();
  };

  return (
    <AuthCard label={t("auth.loginTitle")}>
      <h2>{t("auth.loginTitle")}</h2>
      <p className="auth-lead">{t("auth.loginLead")}</p>
      <button type="button" className="auth-submit" onClick={handleSignIn}>
        <span className="btn-label">{t("auth.submitLogin")}</span>
      </button>
      <div className="auth-divider" aria-hidden="true" />
      <nav className="auth-links" aria-label={t("auth.loginTitle")}>
        <a href="/registrieren">
          <svg className="auth-link-icon" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t("auth.toRegister")}
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
