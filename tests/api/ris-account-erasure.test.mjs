// @vitest-environment node
import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetJwksCache } from "../../api/_lib/ris/auth.mjs";
import handler from "../../api/_lib/ris/accountErasureHandler.mjs";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test-key", alg: "RS256", use: "sig" };
const ISSUER = "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_TEST";
const CLIENT = "test-client";
const CREDENTIAL = "ris_test_credential";
const KERNEL = "https://kernel.example.invalid";

function b64u(value) { return Buffer.from(value).toString("base64url"); }
function token(overrides = {}) {
  const header = b64u(JSON.stringify({ alg: "RS256", kid: "test-key", typ: "JWT" }));
  const payload = b64u(JSON.stringify({
    iss: ISSUER, client_id: CLIENT, token_use: "access", sub: "user-1",
    exp: Math.floor(Date.now() / 1000) + 300, ...overrides,
  }));
  const signature = cryptoSign("RSA-SHA256", Buffer.from(`${header}.${payload}`), privateKey)
    .toString("base64url");
  return `${header}.${payload}.${signature}`;
}
function response(status, body) { return { ok: status < 400, status, json: async () => body }; }
function makeRes() {
  return { statusCode: 200, headers: {}, body: null,
    setHeader(k,v){this.headers[k]=v}, status(c){this.statusCode=c;return this},
    json(p){this.body=p;return this}, end(){return this} };
}
let fetchMock;
beforeEach(() => {
  __resetJwksCache();
  process.env.RIS_ACCOUNT_ERASURE_ENABLED = "true";
  process.env.RIS_ERASURE_API_BASE_URL = KERNEL;
  process.env.RIS_API_BASE_URL = "https://partner.example.invalid";
  process.env.RIS_PARTNER_CREDENTIAL = CREDENTIAL;
  process.env.RIS_COGNITO_ISSUER = ISSUER;
  process.env.RIS_COGNITO_CLIENT_ID = CLIENT;
  process.env.RIS_TEST_USER_ALLOWLIST = `${ISSUER}|user-1`;
  fetchMock = vi.fn(async (url) => {
    if (String(url).includes("/.well-known/jwks.json")) return response(200, { keys: [jwk] });
    return response(200, { complete: true, searchProfilesDeleted: 3, documentsDeleted: 0 });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ["RIS_ACCOUNT_ERASURE_ENABLED", "RIS_ERASURE_API_BASE_URL",
    "RIS_API_BASE_URL", "RIS_PARTNER_CREDENTIAL", "RIS_COGNITO_ISSUER",
    "RIS_COGNITO_CLIENT_ID", "RIS_TEST_USER_ALLOWLIST"]) delete process.env[key];
});
function req(overrides = {}) {
  return { method: "POST", headers: { authorization: `Bearer ${token()}` }, body: {}, ...overrides };
}
describe("/api/ris/erasure", () => {
  it("is closed by default", async () => {
    process.env.RIS_ACCOUNT_ERASURE_ENABLED = "false";
    const res = makeRes();
    await handler(req(), res);
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe("account_erasure_disabled");
    expect(risCalls()).toHaveLength(0);
  });
  it("uses the existing kernel /me/erasure endpoint", async () => {
    const res = makeRes();
    await handler(req(), res);
    expect(res.statusCode).toBe(200);
    expect(risCalls()[0][0]).toBe(`${KERNEL}/me/erasure`);
    expect(risCalls()[0][1].method).toBe("POST");
  });
  it("rejects non-POST without calling RIS", async () => {
    const res = makeRes();
    await handler(req({ method: "GET" }), res);
    expect(res.statusCode).toBe(405);
    expect(risCalls()).toHaveLength(0);
  });
  it("rejects a non-allowlisted identity before RIS", async () => {
    process.env.RIS_TEST_USER_ALLOWLIST = `${ISSUER}|someone-else`;
    const res = makeRes();
    await handler(req(), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("test_user_not_allowed");
    expect(risCalls()).toHaveLength(0);
  });
});
function risCalls() {
  return fetchMock.mock.calls.filter(([url]) => !String(url).includes("/.well-known/jwks.json"));
}
