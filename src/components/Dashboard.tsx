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

  // Allow override for testing/dev mode
  const user = overrideUser || auth.user?.profile;
  const isAuthenticated = !!overrideUser || auth.isAuthenticated;

  if (auth.isLoading) {
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
        <h2>Nicht angemeldet</h2>
        <p>Du musst angemeldet sein, um das Dashboard zu sehen.</p>
        <a href="/anmelden" className="aurora-btn aurora-btn-primary">
          {trans("auth.login")}
        </a>
      </div>
    );
  }

  return (
    <div className="aurora-dashboard">
      <main className="aurora-dashboard-main">
        {/* Aurora Header */}
        <section className="aurora-header">
          <div className="aurora-header-content">
            <h1 className="aurora-title">Willkommen im Dashboard</h1>
            <p className="aurora-subtitle">
              {user?.name ? `Hallo, ${user.name}!` : "Verwalte dein Profil hier"}
            </p>
          </div>
        </section>

        {/* Aurora Content Grid */}
        <section className="aurora-content-grid">
          {/* Profile Card */}
          <div className="aurora-card aurora-card-primary">
            <h2 className="aurora-section-title">Persönliche Daten</h2>
            <div className="aurora-profile-info">
              <div className="aurora-info-item">
                <label>E-Mail</label>
                <span className="aurora-info-value">{user?.email || "-"}</span>
              </div>
              <div className=" Aurora-info-item">
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
                  <p className="aurora-status-value">Aktiv</p>
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
          <div className="aurora-card">
            <h2 className="aurora-section-title">Zukünftige Funktionen</h2>
            <div className="aurora-feature-list">
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

          {/* Action Card */}
          <div className="aurora-card">
            <h2 className="aurora-section-title">Konto verwalten</h2>
            <button
              type="button"
              className="aurora-btn aurora-btn-danger"
              onClick={() => void signOut(auth)}
            >
              Logout
            </button>
          </div>
        </section>
      </main>
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
