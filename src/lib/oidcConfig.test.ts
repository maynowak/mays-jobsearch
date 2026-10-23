import { describe, expect, it } from "vitest";
import { oidcConfig, CLIENT_ID, POST_LOGOUT_REDIRECT_URI, REGION } from "./oidcConfig";

// JOBMATCHER-OIDC-LOGIN-PARAMETER-FIX-01
// Regression: Die globale OIDC-Konfiguration darf keinerlei
// Logout-Parameter enthalten. Sonst hängt oidc-client-ts sie an den
// /login-Request, client_id erscheint doppelt und Cognito antwortet HTTP 400.
describe("oidcConfig: Login-Konfiguration ohne Logout-Parameter", () => {
  it("enthält kein extraQueryParams (keine logout_uri / kein doppelter client_id)", () => {
    expect(Object.keys(oidcConfig)).not.toContain("extraQueryParams");
    expect(JSON.stringify(oidcConfig)).not.toContain("logout_uri");
    expect(JSON.stringify(oidcConfig)).not.toContain("post_logout_redirect_uri");
    expect(JSON.stringify(oidcConfig)).not.toContain("id_token_hint");
  });

  it("nutzt client_id genau einmal", () => {
    expect(oidcConfig.client_id).toBe(CLIENT_ID);
    const occurrences = JSON.stringify(oidcConfig).split("client_id").length - 1;
    expect(occurrences).toBe(1);
  });

  it("behält die Login-Parameter unverändert", () => {
    expect(oidcConfig.authority).toBe(
      `https://cognito-idp.${REGION}.amazonaws.com/eu-central-1_ZURSMpD2O`
    );
    expect(oidcConfig.redirect_uri).toBe("https://www.mays-job-matcher.app/auth/callback");
    expect(oidcConfig.response_type).toBe("code");
    expect(oidcConfig.scope).toBe("openid email profile");
  });

  it("hält das Logout-Ziel getrennt von der Login-Konfiguration", () => {
    expect(POST_LOGOUT_REDIRECT_URI).toBe("https://www.mays-job-matcher.app/");
    expect(oidcConfig).not.toHaveProperty("post_logout_redirect_uri");
    expect(Object.values(oidcConfig)).not.toContain(POST_LOGOUT_REDIRECT_URI);
  });
});
