import { useLang } from "../i18n";
import { useAuth } from "react-oidc-context";
import { useState } from "react";
import AuthCard from "./AuthCard";

// REGISTRATION-UI-01: Registrierung über Cognito Managed Login.
// Keine lokale Passworteingabe, keine Validierung, keine Speicherung.
export default function RegisterForm() {
  const { t } = useLang();
  const auth = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    setError(null);
    try {
      await auth.signinRedirect({ extraQueryParams: { screen_hint: "signup" } });
    } catch (e: any) {
      setError(e?.message || "auth-redirect-failed");
    }
  };

  return (
    <AuthCard label={t("auth.registerTitle")}>
      <h2>{t("auth.registerTitle")}</h2>
      <p className="auth-lead">{t("auth.registerLead")}</p>
      {error && <p className="auth-error" role="alert">Registrierung konnte nicht gestartet werden. Bitte versuche es später erneut.</p>}
      <button type="button" className="auth-submit" onClick={handleRegister}>
        <span className="btn-label">{t("auth.submitRegister")}</span>
      </button>
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
