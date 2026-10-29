import { useAuth } from "react-oidc-context";
import { useLang } from "../i18n";
import { signOut } from "../lib/authFlow";

// Aurora Glass Dashboard - Modernes Dashboard mit Glassmorphismus
export interface DashboardProps {
  /** Override user profile - for testing/dev only */
  user?: { sub: string; email: string; name: string };
}

export default function Dashboard({ user: overrideUser }: DashboardProps = {}) {
  const auth = useAuth();
  const { t } = useLang();
  const isDev = import.meta.env.DEV;

  // Allow override for testing/dev mode
  const user = overrideUser || auth.user?.profile;
  const isAuthenticated = !!overrideUser || auth.isAuthenticated;

  if (auth.isLoading && !overrideUser) {
    return (
      <div className="aurora-dashboard-loading">
        <div className="aurora-spinner" />
        <p>{t("dashboard.loading")}</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="aurora-dashboard-error">
        <h2>{t("profile.title")}</h2>
        <p>{t("profile.notAuthenticated")}</p>
        <a href="/anmelden" className="aurora-btn aurora-btn-primary">
          {t("auth.loginTitle")}
        </a>
      </div>
    );
  }

  return (
    <div className="aurora-dashboard">
      {/* Dev Mode Badge */}
      {isDev && overrideUser && (
        <div className="aurora-dev-badge">
          {t("dashboard.devBadge")}
        </div>
      )}

      {/* Aurora Header - Professional */}
      <section className="aurora-header">
        <div className="aurora-header-content">
          <h1 className="aurora-title">{t("profile.title")}</h1>
          <p className="aurora-subtitle">
            {t("dashboard.subtitle")}
          </p>
        </div>
      </section>

      {/* Aurora Content Grid - with Sidebar */}
      <section className="aurora-content-wrapper">
        {/* Sidebar */}
        <aside className="aurora-sidebar">
          <div className="aurora-sidebar-content">
            <div className="aurora-sidebar-section">
              <h3 className="aurora-sidebar-title">{t("dashboard.sidebarTitle")}</h3>
              <ul className="aurora-sidebar-list">
                <li className="aurora-sidebar-item aurora-sidebar-active">
                  <span className="aurora-sidebar-icon">✓</span>
                  <span>{t("dashboard.nav.overview")}</span>
                </li>
                <li className="aurora-sidebar-item">
                  <span className="aurora-sidebar-icon">👤</span>
                  <span>{t("dashboard.nav.myProfile")}</span>
                </li>
                <li className="aurora-sidebar-item">
                  <span className="aurora-sidebar-tag">{t("dashboard.soon")}</span>
                  <span>{t("dashboard.nav.cv")}</span>
                </li>
                <li className="aurora-sidebar-item">
                  <span className="aurora-sidebar-tag">{t("dashboard.soon")}</span>
                  <span>{t("dashboard.nav.applications")}</span>
                </li>
                <li className="aurora-sidebar-item">
                  <span className="aurora-sidebar-tag">{t("dashboard.soon")}</span>
                  <span>{t("dashboard.nav.jobPrefs")}</span>
                </li>
                <li className="aurora-sidebar-item">
                  <span className="aurora-sidebar-tag">{t("dashboard.soon")}</span>
                  <span>{t("dashboard.nav.settings")}</span>
                </li>
              </ul>
            </div>

            {/* Demo Status Note */}
            {isDev && overrideUser && (
              <div className="aurora-demo-note">
                <strong>{t("dashboard.demoNote.title")}</strong> {t("dashboard.demoNote.text")}
              </div>
            )}

            {/* Logout Button - nur in echtem Modus anzeigen */}
            {!overrideUser && (
              <button
                type="button"
                className="aurora-btn aurora-btn-danger aurora-sidebar-logout"
                onClick={() => void signOut(auth)}
              >
                {t("auth.logout")}
              </button>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="aurora-dashboard-main">
          <div className="aurora-content-grid">
            {/* Profile Card */}
            <div className="aurora-card aurora-card-primary">
              <h2 className="aurora-section-title">{t("dashboard.personalData")}</h2>
              <div className="aurora-profile-info aurora-compact">
                <div className="aurora-info-item">
                  <label>{t("profile.email")}</label>
                  <span className="aurora-info-value">{user?.email || "-"}</span>
                </div>
                <div className="aurora-info-item">
                  <label>{t("profile.sub")}</label>
                  <span className="aurora-info-value user-id">{user?.sub || "-"}</span>
                </div>
                <div className="aurora-info-item">
                  <label>{t("profile.name")}</label>
                  <span className="aurora-info-value">{user?.name || "-"}</span>
                </div>
              </div>
            </div>

            {/* Account Status Card */}
            <div className="aurora-card">
              <h2 className="aurora-section-title">{t("dashboard.accountStatus")}</h2>
              <div className="aurora-status-grid">
                <div className="aurora-status-item">
                  <div className="aurora-status-icon">✓</div>
                  <div>
                    <p className="aurora-status-label">{t("dashboard.authStatus")}</p>
                    <p className="aurora-status-value-demo">
                      {isDev && overrideUser ? t("dashboard.demoMode") : t("dashboard.active")}
                    </p>
                  </div>
                </div>
                <div className="aurora-status-item">
                  <div className="aurora-status-icon">📅</div>
                  <div>
                    <p className="aurora-status-label">{t("dashboard.modality")}</p>
                    <p className="aurora-status-value">{t("dashboard.online")}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Future Features Card */}
            <div className="aurora-card aurora-card--features">
              <h2 className="aurora-section-title">{t("dashboard.upcomingFeatures")}</h2>
              <div className="aurora-feature-grid">
                <div className="aurora-feature-item">
                  <span className="aurora-feature-tag">{t("dashboard.soon")}</span>
                  <p>{t("dashboard.featureCv")}</p>
                </div>
                <div className="aurora-feature-item">
                  <span className="aurora-feature-tag">{t("dashboard.soon")}</span>
                  <p>{t("dashboard.featureApplications")}</p>
                </div>
                <div className="aurora-feature-item">
                  <span className="aurora-feature-tag">{t("dashboard.soon")}</span>
                  <p>{t("dashboard.nav.jobPrefs")}</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </section>
    </div>
  );
}

// Export a dev-only wrapper
export function DashboardDevPreview() {
  const mockUser = {
    sub: "dev-demo-user-123",
    email: "dev@example.com",
    name: "Dev Demo User",
  };

  return (
    <Dashboard user={mockUser} />
  );
}