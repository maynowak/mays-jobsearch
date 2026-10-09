import { useEffect } from "react";
import { useAuth } from "react-oidc-context";

export default function AuthCallback() {
  const auth = useAuth();

  useEffect(() => {
    if (auth.isLoading) return;
    if (auth.error) {
      // Fehlerbehandlung: zurück zur Startseite
      window.location.replace("/");
      return;
    }
    if (auth.isAuthenticated) {
      // Erfolgreiche Authentifizierung → Profilseite
      window.location.replace("/profil");
    }
  }, [auth.isLoading, auth.error, auth.isAuthenticated]);

  return (
    <div style={{ padding: 24, textAlign: "center" }}>
      <h2>Anmeldung läuft...</h2>
      <p>Bitte warten.</p>
    </div>
  );
}
