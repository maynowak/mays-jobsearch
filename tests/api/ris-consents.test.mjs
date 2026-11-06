// @vitest-environment node
import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetJwksCache } from "../../api/_lib/ris/auth.mjs";
import handler from "../../api/ris/consents.mjs";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test-key", alg: "RS256", use: "sig" };

const ISSUER = "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_TEST";
const CLIENT = "test-client";
const CREDENTIAL = "ris_test_credential";

function b64u(value) {
  return Buffer.from(value).toString("base64url");
}

function token(overrides = {}) {
  const header = b64u(JSON.stringify({ alg: "RS256", kid: "test-key", typ: "JWT" }));
  const payload = b64u(JSON.stringify({
    iss: ISSUER, client_id: CLIENT, token_use: "access", sub: "user-1",
    exp: Math.floor(Date.now() / 1000) + 300, ...overrides,
  }));
  const signature = cryptoSign("RSA-SHA256", Buffer.from(`${header}.${payload}`), privateKey).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

function response(status, body) {
  return { ok: status < 400, status, json: async () => body };
}

function makeRes() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    end() { return this; },
  };
}

let risResponse;
let fetchMock;

function risCalls() {
  return fetchMock.mock.calls.filter(([url]) => !String(url).includes("/.well-known/jwks.json"));
}

beforeEach(() => {
  __resetJwksCache();
  process.env.RIS_APPLICATION_STORAGE_ENABLED = "true";
  process.env.RIS_API_BASE_URL = "https://ris.example.invalid";
  process.env.RIS_PARTNER_CREDENTIAL = CREDENTIAL;
  process.env.RIS_COGNITO_ISSUER = ISSUER;
  process.env.RIS_COGNITO_CLIENT_ID = CLIENT;
  process.env.RIS_TEST_USER_ALLOWLIST = `${ISSUER}|user-1`;
  delete process.env.RIS_CONSENT_NOTICE_VERSION;

  risResponse = response(200, {
    items: [{ purpose: "application-storage", status: "NOT_GRANTED", noticeVersion: null, version: 0 }],
  });
  fetchMock = vi.fn(async (url) => {
    if (String(url).includes("/.well-known/jwks.json")) return response(200, { keys: [jwk] });
    return risResponse;
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of [
    "RIS_APPLICATION_STORAGE_ENABLED", "RIS_API_BASE_URL", "RIS_PARTNER_CREDENTIAL",
    "RIS_COGNITO_ISSUER", "RIS_COGNITO_CLIENT_ID", "RIS_TEST_USER_ALLOWLIST",
    "RIS_CONSENT_NOTICE_VERSION",
  ]) delete process.env[key];
});

describe("/api/ris/consents", () => {
  it("lehnt ohne Token ab", async () => {
    const res = makeRes();
    await handler({ method: "GET", headers: {}, query: {} }, res);
    expect(res.statusCode).toBe(401);
  });

  it("lehnt fremden Issuer ab", async () => {
    const res = makeRes();
    await handler({ method: "GET", headers: { authorization: `Bearer ${token({ iss: "https://evil.invalid" })}` }, query: {} }, res);
    expect(res.statusCode).toBe(401);
  });

  it("liefert den Status aus RIS", async () => {
    const res = makeRes();
    await handler({ method: "GET", headers: { authorization: `Bearer ${token()}` }, query: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.consent.status).toBe("NOT_GRANTED");
  });

  it("blockiert Grant ohne freigegebene Erklärungsversion", async () => {
    const res = makeRes();
    await handler({ method: "POST", headers: { authorization: `Bearer ${token()}` }, query: {}, body: { purpose: "application-storage" } }, res);
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe("notice_version_not_mapped");
    expect(risCalls().length).toBe(0);
  });

  it("sendet die serverseitige Version an RIS", async () => {
    process.env.RIS_CONSENT_NOTICE_VERSION = "1.0";
    risResponse = response(200, { consent: { purpose: "application-storage", status: "GRANTED", noticeVersion: "1.0", version: 1 } });
    const res = makeRes();
    await handler({ method: "POST", headers: { authorization: `Bearer ${token()}` }, query: {}, body: { purpose: "application-storage", noticeVersion: "9.9" } }, res);
    expect(res.statusCode).toBe(200);
    const [, init] = risCalls()[0];
    const sent = JSON.parse(init.body);
    expect(sent.noticeVersion).toBe("1.0");
    expect(sent.noticeVersion).not.toBe("9.9");
  });

  it("leitet den Widerruf weiter", async () => {
    risResponse = response(200, { consent: { purpose: "application-storage", status: "WITHDRAWN", version: 2 } });
    const res = makeRes();
    await handler({ method: "POST", headers: { authorization: `Bearer ${token()}` }, query: {}, body: { purpose: "application-storage" } }, res);
    // withdraw is action-based; exercise the action path explicitly
    const res2 = makeRes();
    await handler({ method: "POST", headers: { authorization: `Bearer ${token()}` }, query: { action: "withdraw" }, body: { purpose: "application-storage" } }, res2);
    expect(res2.statusCode).toBe(200);
    expect(String(risCalls().at(-1)[0])).toContain("/consents/withdraw");
  });

  it("weist unbekannte Zwecke ab", async () => {
    const res = makeRes();
    await handler({ method: "POST", headers: { authorization: `Bearer ${token()}` }, query: {}, body: { purpose: "marketing" } }, res);
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe("unknown_purpose");
  });
});
