import { useLang } from "../i18n";
import { useAuth } from "react-oidc-context";

// REGISTRATION-UI-01: Registrierung über Cognito Managed Login.
// Keine lokale Passworteingabe, keine Validierung, keine Speicherung.
export default function RegisterForm() {
  const { t } = useLang();
  const auth = useAuth();

  const handleRegister = () => {
    // Startet Cognito Hosted UI mit Registrierungsseite
    auth.signinRedirect({ extraQueryParams: { screen_hint: "signup" } });
  };

  return (
    <section className="card auth-card" aria-label={t("auth.registerTitle")}>
      <h2>{t("auth.registerTitle")}</h2>
      <p className="auth-lead">{t("auth.registerLead")}</p>
      <button type="button" className="auth-submit" onClick={handleRegister}>
        <span className="btn-label">{t("auth.submitRegister")}</span>
      </button>
      <nav className="auth-links" aria-label={t("auth.registerTitle")}>
        <a href="/anmelden">{t("auth.toLogin")}</a>
        <a href="/search">{t("auth.backToMatcher")}</a>
      </nav>
    </section>
  );
}
