import { describe, expect, it, vi } from "vitest";
import { signIn, signOut, LOGOUT_QUERY_PARAMS } from "./authFlow";
import { CLIENT_ID, POST_LOGOUT_REDIRECT_URI } from "./oidcConfig";

// JOBMATCHER-OIDC-LOGIN-PARAMETER-FIX-01
// Regressionstests für beide Flows: Login ohne Logout-Parameter,
// Logout mit genau client_id + logout_uri.
describe("authFlow: Login- und Logout-Parameter strikt getrennt", () => {
  it("Login ruft signinRedirect ohne extraQueryParams auf", async () => {
    const signinRedirect = vi.fn().mockResolvedValue(undefined);

    await signIn({ signinRedirect });

    expect(signinRedirect).toHaveBeenCalledTimes(1);
    expect(signinRedirect.mock.calls[0]).toEqual([]);
  });

  it("Logout sendet ausschließlich client_id + logout_uri", async () => {
    const signoutRedirect = vi.fn().mockResolvedValue(undefined);

    await signOut({ signoutRedirect });

    expect(signoutRedirect).toHaveBeenCalledTimes(1);
    const args = signoutRedirect.mock.calls[0][0];
    expect(args.extraQueryParams).toEqual(LOGOUT_QUERY_PARAMS);
    expect(Object.keys(args.extraQueryParams).sort()).toEqual(["client_id", "logout_uri"]);
  });

  it("Logout enthält kein post_logout_redirect_uri und keinen doppelten client_id", async () => {
    const signoutRedirect = vi.fn().mockResolvedValue(undefined);

    await signOut({ signoutRedirect });

    const args = signoutRedirect.mock.calls[0][0];
    expect(args).not.toHaveProperty("post_logout_redirect_uri");
    expect(args).not.toHaveProperty("id_token_hint");
    expect(JSON.stringify(args).split("client_id").length - 1).toBe(1);
    expect(args.extraQueryParams.client_id).toBe(CLIENT_ID);
    expect(args.extraQueryParams.logout_uri).toBe(POST_LOGOUT_REDIRECT_URI);
  });
});
