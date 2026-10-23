import { useAuth } from "react-oidc-context";
import { useLang } from "../i18n";
import { signOut } from "../lib/authFlow";

export default function Profile() {
  const { t } = useLang();
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <section className="card">
        <h2>{t("profile.title")}</h2>
        <p>Lade Profil...</p>
      </section>
    );
  }

  if (auth.error) {
    return (
      <section className="card">
        <h2>{t("profile.title")}</h2>
        <p>Fehler beim Laden des Profils.</p>
      </section>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <section className="card">
        <h2>{t("profile.title")}</h2>
        <p>{t("profile.notAuthenticated")}</p>
      </section>
    );
  }

  const user = auth.user?.profile;

  return (
    <section className="card">
      <h2>{t("profile.title")}</h2>
      <dl>
        <dt>{t("profile.sub")}</dt>
        <dd>{user?.sub ?? "-"}</dd>
        <dt>{t("profile.email")}</dt>
        <dd>{user?.email ?? "-"}</dd>
        <dt>{t("profile.name")}</dt>
        <dd>{user?.name ?? "-"}</dd>
      </dl>
      <button
        type="button"
        onClick={() => void signOut(auth)}
      >
        {t("auth.logout")}
      </button>
    </section>
  );
}
