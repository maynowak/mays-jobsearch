import { useEffect } from "react";
import { useAuth } from "react-oidc-context";

export default function AuthCallback() {
  const auth = useAuth();

  useEffect(() => {
    if (auth.isAuthenticated) {
      window.location.replace("/");
    }
  }, [auth]);

  return (
    <div style={{ padding: 24, textAlign: "center" }}>
      <h2>Anmeldung läuft...</h2>
      <p>Bitte warten.</p>
    </div>
  );
}
