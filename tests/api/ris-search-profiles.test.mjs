// @vitest-environment node
import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetJwksCache } from "../../api/_lib/ris/auth.mjs";
import handler from "../../api/_lib/ris/searchProfilesHandler.mjs";
import consentsHandler from "../../api/_lib/ris/consentsHandler.mjs";
import {
  SEARCH_PROFILE_CONSENT_TEXT_SHA256,
  SEARCH_PROFILE_CONSENT_TEXT_VERSION,
} from "../../api/_lib/ris/searchProfileConsentText.mjs";

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
  const signature = cryptoSign("RSA-SHA256", Buffer.from(`${header}.${payload}`), privateKey)
    .toString("base64url");
  return `${header}.${payload}.${signature}`;
}

function response(status, body) {
  return { ok: status < 400, status, json: async () => body };
}

function makeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, value) { this.headers[key] = value; },
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

function request(method, { query = {}, body } = {}) {
  return { method, headers: { authorization: `Bearer ${token()}` }, query, body };
}

beforeEach(() => {
  __resetJwksCache();
  process.env.RIS_SEARCH_PROFILE_STORAGE_ENABLED = "true";
  process.env.RIS_CONSENT_SERVICE_ENABLED = "false";
  process.env.RIS_API_BASE_URL = "https://ris.example.invalid";
  process.env.RIS_PARTNER_CREDENTIAL = CREDENTIAL;
  process.env.RIS_COGNITO_ISSUER = ISSUER;
  process.env.RIS_COGNITO_CLIENT_ID = CLIENT;
  process.env.RIS_TEST_USER_ALLOWLIST = `${ISSUER}|user-1`;
  risResponse = response(200, { items: [], nextCursor: null });
  fetchMock = vi.fn(async (url) => {
    if (String(url).includes("/.well-known/jwks.json")) return response(200, { keys: [jwk] });
    return risResponse;
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of [
    "RIS_SEARCH_PROFILE_STORAGE_ENABLED", "RIS_CONSENT_SERVICE_ENABLED",
    "RIS_API_BASE_URL", "RIS_PARTNER_CREDENTIAL", "RIS_COGNITO_ISSUER",
    "RIS_COGNITO_CLIENT_ID", "RIS_TEST_USER_ALLOWLIST",
    "RIS_SEARCH_PROFILE_CONSENT_NOTICE_VERSION",
    "RIS_SEARCH_PROFILE_CONSENT_TEXT_VERSION",
    "RIS_SEARCH_PROFILE_CONSENT_TEXT_SHA256",
    "RIS_SEARCH_PROFILE_CONSENT_TEXT_STATE",
    "RIS_SEARCH_PROFILE_CONSENT_SYNTHETIC",
  ]) delete process.env[key];
});

describe("/api/ris/search-profiles", () => {
  it("ist ohne explizite Aktivierung geschlossen", async () => {
    process.env.RIS_SEARCH_PROFILE_STORAGE_ENABLED = "false";
    const res = makeRes();
    await handler(request("GET", { query: { type: "manual" } }), res);
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe("search_profile_storage_disabled");
  });

  it("nutzt den bestehenden manuellen RIS-Vertrag", async () => {
    const res = makeRes();
    await handler(request("GET", { query: { type: "manual", limit: "10" } }), res);
    expect(res.statusCode).toBe(200);
    expect(risCalls()[0][0]).toContain("/v1/partner/me/manual-search-profiles?limit=10");
  });

  it("verlangt eine dauerhafte RIS-cvId für CV-Suchprofile", async () => {
    const res = makeRes();
    await handler(request("GET", { query: { type: "cv" } }), res);
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe("invalid_request");
    expect(risCalls()).toHaveLength(0);
  });

  it("nutzt den CV-Pfad nur mit cvId und sendet den Body unverändert", async () => {
    risResponse = response(201, { searchProfileId: "sp-1", name: "Cloud" });
    const body = { name: "Cloud", searchConfig: { skills: "aws", targetRoles: ["Cloud"] } };
    const res = makeRes();
    await handler(request("POST", { query: { type: "cv", cvId: "cv-1" }, body }), res);
    expect(res.statusCode).toBe(201);
    expect(risCalls()[0][0]).toContain("/v1/partner/me/cvs/cv-1/search-profiles");
    expect(JSON.parse(risCalls()[0][1].body)).toEqual(body);
  });

  it("nutzt den ATS-Pfad unter dem persistenten Suchprofil", async () => {
    const res = makeRes();
    await handler(request("GET", {
      query: { type: "ats", searchProfileId: "sp-1", id: "ats-1" },
    }), res);
    expect(res.statusCode).toBe(200);
    expect(risCalls()[0][0]).toContain(
      "/v1/partner/me/search-profiles/sp-1/ats-profiles/ats-1"
    );
  });

  it("weist unbekannte Typen fail-closed ab", async () => {
    const res = makeRes();
    await handler(request("GET", { query: { type: "application" } }), res);
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe("invalid_type");
    expect(risCalls()).toHaveLength(0);
  });
});

describe("/api/ris/search-profile-consents", () => {
  it("verwendet den separaten Purpose und blockiert DRAFT ohne synthetische Freigabe", async () => {
    process.env.RIS_CONSENT_SERVICE_ENABLED = "true";
    process.env.RIS_SEARCH_PROFILE_CONSENT_NOTICE_VERSION = "1.0";
    process.env.RIS_SEARCH_PROFILE_CONSENT_TEXT_VERSION = SEARCH_PROFILE_CONSENT_TEXT_VERSION;
    process.env.RIS_SEARCH_PROFILE_CONSENT_TEXT_SHA256 = SEARCH_PROFILE_CONSENT_TEXT_SHA256;
    process.env.RIS_SEARCH_PROFILE_CONSENT_TEXT_STATE = "DRAFT";
    risResponse = response(200, {
      items: [],
      catalog: [{
        purpose: "search-profile-storage", noticeVersion: "1.0", noticeState: "APPROVED",
        noticeApproved: true, acceptedForNewGrant: true,
      }],
    });
    const res = makeRes();
    await consentsHandler({
      method: "POST",
      headers: { authorization: `Bearer ${token()}` },
      query: { purpose: "search-profile-storage" },
      body: { purpose: "search-profile-storage" },
    }, res);
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("consent_text_not_approved");
    expect(risCalls().some(([url, init]) => init.method === "POST")).toBe(false);
  });

  it("erlaubt den synthetischen DRAFT-Grant nur mit explizitem Testschalter", async () => {
    process.env.RIS_CONSENT_SERVICE_ENABLED = "true";
    process.env.RIS_SEARCH_PROFILE_CONSENT_NOTICE_VERSION = "1.0";
    process.env.RIS_SEARCH_PROFILE_CONSENT_TEXT_VERSION = SEARCH_PROFILE_CONSENT_TEXT_VERSION;
    process.env.RIS_SEARCH_PROFILE_CONSENT_TEXT_SHA256 = SEARCH_PROFILE_CONSENT_TEXT_SHA256;
    process.env.RIS_SEARCH_PROFILE_CONSENT_TEXT_STATE = "DRAFT";
    process.env.RIS_SEARCH_PROFILE_CONSENT_SYNTHETIC = "true";
    risResponse = response(200, {
      items: [],
      catalog: [{
        purpose: "search-profile-storage", noticeVersion: "1.0", noticeState: "DRAFT",
        noticeApproved: false, acceptedForNewGrant: true,
      }],
    });
    const res = makeRes();
    await consentsHandler({
      method: "POST",
      headers: { authorization: `Bearer ${token()}` },
      query: { purpose: "search-profile-storage" },
      body: { purpose: "search-profile-storage" },
    }, res);
    expect(res.statusCode).toBe(200);
    const grantCall = risCalls().find(([url]) => String(url).endsWith("/consents"));
    expect(grantCall).toBeDefined();
    const sent = JSON.parse(grantCall[1].body);
    expect(sent.purpose).toBe("search-profile-storage");
    expect(sent.specialCategoriesConsent).toBe(false);
    expect(sent.externalTextVersion).toBe(SEARCH_PROFILE_CONSENT_TEXT_VERSION);
  });
});
