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
  const { t: trans } = useLang();
  const isDev = import.meta.env.DEV;

  // Allow override for testing/dev mode
  const user = overrideUser || auth.user?.profile;
  const isAuthenticated = !!overrideUser || auth.isAuthenticated;

  if (auth.isLoading && !overrideUser) {
    return (
      <div className="aurora-dashboard-loading">
        <div className="aurora-spinner" />
        <p>Lade Benutzerdaten...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="aurora-dashboard-error">
        <h2>Profil</h2>
        <p>Du bist nicht angemeldet.</p>
        <a href="/anmelden" className="aurora-btn aurora-btn-primary">
          {trans("auth.login")}
        </a>
      </div>
    );
  }

  return (
    <div className="aurora-dashboard">
      {/* Dev Mode Badge */}
      {isDev && overrideUser && (
        <div className="aurora-dev-badge">
          DEV-MODUS: Demo-Daten
        </div>
      )}

      {/* Aurora Header - Professional */}
      <section className="aurora-header">
        <div className="aurora-header-content">
          <h1 className="aurora-title">Profil</h1>
          <p className="aurora-subtitle">
            Willkommen! Verwalte dein Konto.
          </p>
        </div>
      </section>

      {/* Aurora Content Grid - with Sidebar */}
      <section className="aurora-content-wrapper">
        {/* Sidebar */}
        <aside className="aurora-sidebar">
          <div className="aurora-sidebar-content">
            <div className="aurora-sidebar-section">
              <h3 className="aurora-sidebar-title">Navigieren</h3>
              <ul className="aurora-sidebar-list">
                <li className="aurora-sidebar-item aurora-sidebar-active">
                  <span className="aurora-sidebar-icon">✓</span>
                  <span>Übersicht</span>
                </li>
                <li className="aurora-sidebar-item">
                  <span className="aurora-sidebar-icon">👤</span>
                  <span>Mein Profil</span>
                </li>
                <li className="aurora-sidebar-item">
                  <span className="aurora-sidebar-tag">In Vorbereitung</span>
                  <span>Lebenslauf</span>
                </li>
                <li className="aurora-sidebar-item">
                  <span className="aurora-sidebar-tag">In Vorbereitung</span>
                  <span>Bewerbungen</span>
                </li>
                <li className="aurora-sidebar-item">
                  <span className="aurora-sidebar-tag">In Vorbereitung</span>
                  <span>Job-Präferenzen</span>
                </li>
                <li className="aurora-sidebar-item">
                  <span className="aurora-sidebar-tag">In Vorbereitung</span>
                  <span>Einstellungen</span>
                </li>
              </ul>
            </div>

            {/* Demo Status Note */}
            {isDev && overrideUser && (
              <div className="aurora-demo-note">
                <strong>Hinweis:</strong> Demo-Status (nicht authentifiziert)
              </div>
            )}

            {/* Logout Button - nur in echtem Modus anzeigen */}
            {!overrideUser && (
              <button
                type="button"
                className="aurora-btn aurora-btn-danger aurora-sidebar-logout"
                onClick={() => void signOut(auth)}
              >
                Logout
              </button>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="aurora-dashboard-main">
          <div className="aurora-content-grid">
            {/* Profile Card */}
            <div className="aurora-card aurora-card-primary">
              <h2 className="aurora-section-title">Persönliche Daten</h2>
              <div className="aurora-profile-info aurora-compact">
                <div className="aurora-info-item">
                  <label>E-Mail</label>
                  <span className="aurora-info-value">{user?.email || "-"}</span>
                </div>
                <div className="aurora-info-item">
                  <label>Benutzer-ID</label>
                  <span className="aurora-info-value user-id">{user?.sub || "-"}</span>
                </div>
                <div className="aurora-info-item">
                  <label>Name</label>
                  <span className="aurora-info-value">{user?.name || "-"}</span>
                </div>
              </div>
            </div>

            {/* Account Status Card */}
            <div className="aurora-card">
              <h2 className="aurora-section-title">Konto-Status</h2>
              <div className="aurora-status-grid">
                <div className="aurora-status-item">
                  <div className="aurora-status-icon">✓</div>
                  <div>
                    <p className="aurora-status-label">Authentifiziert</p>
                    <p className="aurora-status-value-demo">
                      {isDev && overrideUser ? "Demo-Modus" : "Aktiv"}
                    </p>
                  </div>
                </div>
                <div className="aurora-status-item">
                  <div className="aurora-status-icon">📅</div>
                  <div>
                    <p className="aurora-status-label">Modalität</p>
                    <p className="aurora-status-value">Online</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Future Features Card */}
            <div className="aurora-card aurora-card--features">
              <h2 className="aurora-section-title">Zukünftige Funktionen</h2>
              <div className="aurora-feature-grid">
                <div className="aurora-feature-item">
                  <span className="aurora-feature-tag">In Vorbereitung</span>
                  <p>CV-Verwaltung</p>
                </div>
                <div className="aurora-feature-item">
                  <span className="aurora-feature-tag">In Vorbereitung</span>
                  <p>Bewerbungsverwaltung</p>
                </div>
                <div className="aurora-feature-item">
                  <span className="aurora-feature-tag">In Vorbereitung</span>
                  <p>Job-Präferenzen</p>
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