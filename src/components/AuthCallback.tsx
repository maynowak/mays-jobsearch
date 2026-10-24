import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";

export default function AuthCallback() {
  const auth = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (auth.isLoading) return;
    if (auth.error) {
      const msg = auth.error?.message || "auth-error-unknown";
      setErrorMessage(msg);
      return;
    }
    if (auth.isAuthenticated) {
      window.location.replace("/");
    }
  }, [auth.isLoading, auth.error, auth.isAuthenticated]);

  if (auth.isLoading) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <h2>Anmeldung läuft...</h2>
        <p>Bitte warten.</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div style={{ padding: 24, maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
        <h2>Anmeldung fehlgeschlagen</h2>
        <p>
          Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut.
        </p>
        <p style={{ fontSize: "0.9rem", opacity: 0.7 }}>
          Fehler: {errorMessage}
        </p>
        <div style={{ marginTop: 16, display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            onClick={() => window.location.assign("/anmelden")}
            style={{ padding: "8px 16px", cursor: "pointer" }}
          >
            Zurück zur Anmeldung
          </button>
          <button
            onClick={() => window.location.assign("/search")}
            style={{ padding: "8px 16px", cursor: "pointer" }}
          >
            Zur Jobsuche
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, textAlign: "center" }}>
      <h2>Anmeldung läuft...</h2>
      <p>Bitte warten.</p>
    </div>
  );
}
