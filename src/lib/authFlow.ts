import type { AuthContextProps } from "react-oidc-context";
import { CLIENT_ID, POST_LOGOUT_REDIRECT_URI } from "./oidcConfig";

// JOBMATCHER-OIDC-LOGIN-PARAMETER-FIX-01:
// Login und Logout strikt trennen. Cognito /logout erwartet client_id +
// logout_uri (kein post_logout_redirect_uri, kein doppelter client_id).
// Der Login-Request bekommt KEINE dieser Parameter — sonst HTTP 400.
export const LOGOUT_QUERY_PARAMS = {
  client_id: CLIENT_ID,
  logout_uri: POST_LOGOUT_REDIRECT_URI,
} as const;

type SigninRedirectOnly = Pick<AuthContextProps, "signinRedirect">;
type SignoutRedirectOnly = Pick<AuthContextProps, "signoutRedirect">;

/** Login: keine extra Query-Parameter, PKCE kommt von oidc-client-ts. */
export const signIn = async (auth: SigninRedirectOnly): Promise<void> => {
  await auth.signinRedirect();
};

/** Logout: ausschließlich client_id + logout_uri für Cognito. */
export const signOut = async (auth: SignoutRedirectOnly): Promise<void> => {
  await auth.signoutRedirect({ extraQueryParams: { ...LOGOUT_QUERY_PARAMS } });
};
