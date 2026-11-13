// @vitest-environment node
import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetJwksCache } from "../../api/_lib/ris/auth.mjs";
import handler from "../../api/_lib/ris/cvBuilderProfilesHandler.mjs";
import consentsHandler from "../../api/_lib/ris/consentsHandler.mjs";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test-key", alg: "RS256", use: "sig" };
const ISSUER = "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_TEST";
const CLIENT = "test-client";
const CREDENTIAL = "ris_test_credential";
const PROFILE_ID = "cvp-12345678";

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

function response(status, body, headers = {}) {
  return {
    ok: status < 400,
    status,
    json: async () => body,
    headers: { get: (name) => headers[String(name).toLowerCase()] ?? null },
  };
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

function request(method, { query = {}, body, headers = {} } = {}) {
  return {
    method,
    headers: { authorization: `Bearer ${token()}`, ...headers },
    query,
    body,
  };
}

function profile(overrides = {}) {
  return {
    schemaVersion: 1,
    profileId: PROFILE_ID,
    name: "Synthetic CV",
    template: "classic",
    cvData: {
      schemaVersion: 1, personal: {}, profile: {}, experience: [], education: [],
      skills: [], projects: [], certificates: [], languages: [], links: [],
    },
    version: 1,
    createdAt: "2026-11-13T00:00:00Z",
    updatedAt: "2026-11-13T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  __resetJwksCache();
  process.env.RIS_CV_BUILDER_PROFILE_STORAGE_ENABLED = "true";
  process.env.RIS_API_BASE_URL = "https://ris.example.invalid";
  process.env.RIS_PARTNER_CREDENTIAL = CREDENTIAL;
  process.env.RIS_COGNITO_ISSUER = ISSUER;
  process.env.RIS_COGNITO_CLIENT_ID = CLIENT;
  process.env.RIS_TEST_USER_ALLOWLIST = `${ISSUER}|user-1`;
  risResponse = response(200, { items: [profile()], nextCursor: null }, { etag: '"v1"' });
  fetchMock = vi.fn(async (url) => {
    if (String(url).includes("/.well-known/jwks.json")) return response(200, { keys: [jwk] });
    return risResponse;
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of [
    "RIS_CV_BUILDER_PROFILE_STORAGE_ENABLED", "RIS_CONSENT_SERVICE_ENABLED",
    "RIS_API_BASE_URL", "RIS_PARTNER_CREDENTIAL", "RIS_COGNITO_ISSUER",
    "RIS_COGNITO_CLIENT_ID", "RIS_TEST_USER_ALLOWLIST",
    "RIS_CV_BUILDER_CONSENT_NOTICE_VERSION",
  ]) delete process.env[key];
});

describe("/api/ris/cv-builder-profiles auth and activation", () => {
  it("is fail-closed when disabled", async () => {
    process.env.RIS_CV_BUILDER_PROFILE_STORAGE_ENABLED = "false";
    const res = makeRes();
    await handler({ method: "GET", headers: {}, query: {} }, res);
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe("cv_builder_profile_storage_disabled");
    expect(risCalls()).toHaveLength(0);
  });

  it("requires authentication", async () => {
    const res = makeRes();
    await handler({ method: "GET", headers: {}, query: {} }, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe("unauthenticated");
  });

  it("rejects invalid JWTs and foreign identities", async () => {
    let res = makeRes();
    await handler({ method: "GET", headers: { authorization: "Bearer broken" }, query: {} }, res);
    expect(res.statusCode).toBe(401);

    process.env.RIS_TEST_USER_ALLOWLIST = `${ISSUER}|other`;
    res = makeRes();
    await handler(request("GET"), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("test_user_not_allowed");
  });

  it("reports missing configuration as 503, not a generic 500", async () => {
    process.env.RIS_API_BASE_URL = "";
    const res = makeRes();
    await handler(request("GET"), res);
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe("missing_config");
  });
});

describe("/api/ris/cv-builder-profiles CRUD transport", () => {
  it("forwards POST with a stable Idempotency-Key and no browser identity", async () => {
    risResponse = response(201, profile(), { etag: '"v1"' });
    const res = makeRes();
    await handler(request("POST", {
      headers: { "idempotency-key": "idem-1234567890abcdef" },
      body: {
        name: "Synthetic CV",
        template: "classic",
        cvData: profile().cvData,
        userId: "spoofed",
      },
    }), res);
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe("client_identity_forbidden");
    expect(risCalls()).toHaveLength(0);

    const valid = makeRes();
    await handler(request("POST", {
      headers: { "idempotency-key": "idem-1234567890abcdef" },
      body: { name: "Synthetic CV", template: "classic", cvData: profile().cvData },
    }), valid);
    expect(valid.statusCode).toBe(201);
    expect(valid.headers.ETag).toBe('"v1"');
    const [, init] = risCalls()[0];
    expect(init.headers["Idempotency-Key"]).toBe("idem-1234567890abcdef");
    expect(init.headers["X-Api-Credential"]).toBe(CREDENTIAL);
    expect(JSON.parse(init.body).userId).toBeUndefined();
  });

  it("replays POST with the same idempotency key and never auto-retries", async () => {
    risResponse = response(201, profile(), { etag: '"v1"' });
    const options = {
      method: "POST",
      headers: { "idempotency-key": "idem-replay-1234567890" },
      body: { name: "Synthetic CV", template: "classic", cvData: profile().cvData },
    };
    const first = makeRes();
    await handler(request("POST", options), first);
    const second = makeRes();
    await handler(request("POST", options), second);
    expect(risCalls()).toHaveLength(2);
    expect(risCalls().map(([, init]) => init.headers["Idempotency-Key"]))
      .toEqual(["idem-replay-1234567890", "idem-replay-1234567890"]);
  });

  it("requires a valid Idempotency-Key for create", async () => {
    const res = makeRes();
    await handler(request("POST", {
      body: { name: "Synthetic CV", template: "classic", cvData: profile().cvData },
    }), res);
    expect(res.statusCode).toBe(422);
    expect(risCalls()).toHaveLength(0);
  });

  it("forwards PATCH If-Match and preserves ETag", async () => {
    risResponse = response(200, profile({ version: 2 }), { etag: '"v2"' });
    const res = makeRes();
    await handler(request("PATCH", {
      query: { id: PROFILE_ID },
      headers: { "if-match": '"v1"' },
      body: { name: "Changed" },
    }), res);
    expect(res.statusCode).toBe(200);
    expect(res.headers.ETag).toBe('"v2"');
    expect(risCalls()[0][1].headers["If-Match"]).toBe('"v1"');
    expect(String(risCalls()[0][0])).toContain(`/cv-builder-profiles/${PROFILE_ID}`);
  });

  it("returns 428 for PATCH without If-Match and 422 for malformed proof", async () => {
    let res = makeRes();
    await handler(request("PATCH", { query: { id: PROFILE_ID }, body: { name: "x" } }), res);
    expect(res.statusCode).toBe(428);
    expect(risCalls()).toHaveLength(0);

    res = makeRes();
    await handler(request("PATCH", {
      query: { id: PROFILE_ID }, headers: { "if-match": "v1" }, body: { name: "x" },
    }), res);
    expect(res.statusCode).toBe(422);
    expect(risCalls()).toHaveLength(0);
  });

  it("maps an upstream version conflict to 409", async () => {
    risResponse = response(409, { error: "conflict", code: "VERSION_CONFLICT" });
    const res = makeRes();
    await handler(request("PATCH", {
      query: { id: PROFILE_ID }, headers: { "if-match": '"v1"' }, body: { name: "x" },
    }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("VERSION_CONFLICT");
  });

  it("supports DELETE, repeated delete and optional If-Match", async () => {
    risResponse = response(204, null);
    let res = makeRes();
    await handler(request("DELETE", { query: { id: PROFILE_ID } }), res);
    expect(res.statusCode).toBe(204);

    risResponse = response(404, { error: "not found", code: "NOT_FOUND" });
    res = makeRes();
    await handler(request("DELETE", {
      query: { id: PROFILE_ID }, headers: { "if-match": '"v1"' },
    }), res);
    expect(res.statusCode).toBe(404);
    expect(risCalls()[1][1].headers["If-Match"]).toBe('"v1"');
  });

  it("supports structured export only through the fixed action", async () => {
    risResponse = response(200, {
      schemaVersion: 1, exportedAt: "2026-11-13T00:00:00Z",
      source: "ris-structured-cv-profile", profile: profile(),
    });
    const res = makeRes();
    await handler(request("GET", { query: { id: PROFILE_ID, action: "export" } }), res);
    expect(res.statusCode).toBe(200);
    expect(String(risCalls()[0][0])).toContain(`/cv-builder-profiles/${PROFILE_ID}/export`);
    expect(res.body.profile.profileId).toBe(PROFILE_ID);
  });

  it("validates ids, actions, limits and cursors without constructing paths", async () => {
    for (const query of [
      { id: "../../other" }, { id: "cv-1" }, { action: "document" },
      { limit: "0" }, { limit: "51" }, { cursor: "x".repeat(2001) },
    ]) {
      const res = makeRes();
      await handler(request("GET", { query }), res);
      expect([422, 405]).toContain(res.statusCode);
    }
    expect(risCalls()).toHaveLength(0);
  });

  it("enforces the 300-KB body limit and rejects oversize without upstream call", async () => {
    const body = {
      name: "Large", template: "classic",
      cvData: { ...profile().cvData, profile: { summary: "x".repeat(300001) } },
    };
    const res = makeRes();
    await handler(request("POST", {
      headers: { "idempotency-key": "idem-oversize-123456" }, body,
    }), res);
    expect(res.statusCode).toBe(413);
    expect(res.body.code).toBe("payload_too_large");
    expect(risCalls()).toHaveLength(0);
  });

  it("allows a large profile below the 300-KB bound and forwards it", async () => {
    risResponse = response(201, profile(), { etag: '"v1"' });
    const body = {
      name: "Large but valid", template: "classic",
      cvData: { ...profile().cvData, profile: { summary: "x".repeat(299000) } },
    };
    const res = makeRes();
    await handler(request("POST", {
      headers: { "idempotency-key": "idem-large-valid-123456" }, body,
    }), res);
    expect(res.statusCode).toBe(201);
    expect(risCalls()).toHaveLength(1);
  });

  it("forwards 44 review items without dropping applied provenance", async () => {
    risResponse = response(201, profile(), { etag: '"v1"' });
    const items = Array.from({ length: 44 }, (_, index) => ({
      id: `review-${index}`, index, text: `text ${index}`, original: `original ${index}`,
      edited: index % 3 === 0, target: "skills",
      status: index % 2 === 0 ? "pending" : "accepted",
      applied: index % 2 === 1, page: 1, sectionHeading: "Kenntnisse",
      reason: "ambiguous", suggestedTarget: "skills",
    }));
    const res = makeRes();
    await handler(request("POST", {
      headers: { "idempotency-key": "idem-review-123456" },
      body: {
        name: "Review CV", template: "classic", cvData: profile().cvData,
        importReview: {
          schemaVersion: 1, items, total: 44, pending: 22, accepted: 22, ignored: 0,
        },
      },
    }), res);
    expect(res.statusCode).toBe(201);
    const forwarded = JSON.parse(risCalls()[0][1].body);
    expect(forwarded.importReview.items).toHaveLength(44);
    expect(forwarded.importReview.items[0].applied).toBe(false);
    expect(forwarded.importReview.items[1].applied).toBe(true);
  });

  it("does not leak credentials and does not forward browser credential headers", async () => {
    risResponse = response(403, { error: "denied", code: "CONSENT_REQUIRED" });
    const res = makeRes();
    await handler(request("GET", {
      headers: { "x-api-credential": "browser-spoof", "x-tenant-id": "spoof" },
    }), res);
    expect(res.statusCode).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain(CREDENTIAL);
    expect(risCalls()[0][1].headers["X-Api-Credential"]).toBe(CREDENTIAL);
  });

  it("keeps list pagination and ETags bounded", async () => {
    const res = makeRes();
    await handler(request("GET", { query: { limit: "2", cursor: "opaque-cursor" } }), res);
    expect(res.statusCode).toBe(200);
    const [url] = risCalls()[0];
    expect(String(url)).toContain("limit=2");
    expect(String(url)).toContain("cursor=opaque-cursor");
  });
});

describe("structured CV consent status", () => {
  it("exposes read-only DRAFT status and never grants through the BFF", async () => {
    process.env.RIS_CONSENT_SERVICE_ENABLED = "true";
    process.env.RIS_CV_BUILDER_CONSENT_NOTICE_VERSION =
      "structured-cv-profile-storage-2026-11-12-draft-1";
    risResponse = response(200, {
      items: [{
        purpose: "cv-builder-profile-storage", status: "NOT_GRANTED",
        noticeVersion: null, version: 0,
      }],
      catalog: [{
        purpose: "cv-builder-profile-storage",
        noticeVersion: "structured-cv-profile-storage-2026-11-12-draft-1",
        noticeState: "DRAFT", noticeApproved: false, acceptedForNewGrant: false,
      }],
    });

    let res = makeRes();
    await consentsHandler({
      method: "GET",
      headers: { authorization: `Bearer ${token()}` },
      query: { purpose: "cv-builder-profile-storage" },
    }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.noticeState).toBe("DRAFT");
    expect(res.body.grantAllowed).toBe(false);

    const before = risCalls().length;
    res = makeRes();
    await consentsHandler({
      method: "POST",
      headers: { authorization: `Bearer ${token()}` },
      query: { purpose: "cv-builder-profile-storage" },
      body: { purpose: "cv-builder-profile-storage" },
    }, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("consent_grant_not_available");
    expect(risCalls()).toHaveLength(before);
  });
});
