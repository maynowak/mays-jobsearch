// @vitest-environment node
import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetJwksCache } from "../../api/_lib/ris/auth.mjs";
import handler from "../../api/_lib/ris/cvsHandler.mjs";
import consentsHandler from "../../api/_lib/ris/consentsHandler.mjs";
import { CV_CONSENT_TEXT_SHA256, CV_CONSENT_TEXT_VERSION } from "../../api/_lib/ris/cvConsentText.mjs";

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

function cv(overrides = {}) {
  return {
    schemaVersion: 1,
    cvId: "cv-1",
    filename: "resume.pdf",
    contentType: "application/pdf",
    processingStatus: "ready",
    sizeBytes: 2048,
    documentId: "doc-1",
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
    version: 3,
    ...overrides,
  };
}

beforeEach(() => {
  __resetJwksCache();
  process.env.RIS_CV_STORAGE_ENABLED = "true";
  process.env.RIS_CONSENT_SERVICE_ENABLED = "false";
  process.env.RIS_API_BASE_URL = "https://ris.example.invalid";
  process.env.RIS_PARTNER_CREDENTIAL = CREDENTIAL;
  process.env.RIS_COGNITO_ISSUER = ISSUER;
  process.env.RIS_COGNITO_CLIENT_ID = CLIENT;
  process.env.RIS_TEST_USER_ALLOWLIST = `${ISSUER}|user-1`;
  risResponse = response(200, { items: [cv()], nextCursor: null });
  fetchMock = vi.fn(async (url) => {
    if (String(url).includes("/.well-known/jwks.json")) return response(200, { keys: [jwk] });
    return risResponse;
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of [
    "RIS_CV_STORAGE_ENABLED", "RIS_CONSENT_SERVICE_ENABLED", "RIS_API_BASE_URL",
    "RIS_PARTNER_CREDENTIAL", "RIS_COGNITO_ISSUER", "RIS_COGNITO_CLIENT_ID",
    "RIS_TEST_USER_ALLOWLIST", "RIS_CV_CONSENT_NOTICE_VERSION",
    "RIS_CV_CONSENT_TEXT_VERSION", "RIS_CV_CONSENT_TEXT_SHA256",
    "RIS_CV_CONSENT_TEXT_STATE",
  ]) delete process.env[key];
});

describe("/api/ris/cv-consents", () => {
  it("verwendet den separaten cv-storage-Purpose und Text-Mapping", async () => {
    process.env.RIS_CONSENT_SERVICE_ENABLED = "true";
    process.env.RIS_CV_CONSENT_NOTICE_VERSION = "1.0";
    process.env.RIS_CV_CONSENT_TEXT_VERSION = CV_CONSENT_TEXT_VERSION;
    process.env.RIS_CV_CONSENT_TEXT_SHA256 = CV_CONSENT_TEXT_SHA256;
    process.env.RIS_CV_CONSENT_TEXT_STATE = "APPROVED";
    risResponse = response(200, {
      items: [{
        purpose: "cv-storage", status: "NOT_GRANTED", noticeVersion: null, version: 0,
      }],
      catalog: [{
        purpose: "cv-storage", noticeVersion: "1.0", noticeState: "DRAFT",
        noticeApproved: false, acceptedForNewGrant: true,
      }],
    });
    const res = makeRes();
    await consentsHandler({
      method: "GET",
      headers: { authorization: `Bearer ${token()}` },
      query: { purpose: "cv-storage" },
    }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.consent.purpose).toBe("cv-storage");
    expect(res.body.textVersion).toBe(CV_CONSENT_TEXT_VERSION);
    expect(res.body.textState).toBe("APPROVED");
    expect(risCalls()[0][0]).toContain("purpose=cv-storage");
  });

  it("weist einen unbekannten Purpose fail-closed ab", async () => {
    const res = makeRes();
    await consentsHandler({
      method: "GET",
      headers: { authorization: `Bearer ${token()}` },
      query: { purpose: "marketing" },
    }, res);
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe("unknown_purpose");
    expect(risCalls()).toHaveLength(0);
  });
});

describe("/api/ris/cvs", () => {
  it("lehnt ohne Token ab", async () => {
    const res = makeRes();
    await handler({ method: "GET", headers: {}, query: {} }, res);
    expect(res.statusCode).toBe(401);
  });

  it("bleibt deaktiviert ohne CV-Storage-Flag", async () => {
    process.env.RIS_CV_STORAGE_ENABLED = "false";
    const res = makeRes();
    await handler(request("GET"), res);
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe("cv_storage_disabled");
    expect(risCalls()).toHaveLength(0);
  });

  it("lehnt nicht allowlistete Nutzer ab", async () => {
    process.env.RIS_TEST_USER_ALLOWLIST = `${ISSUER}|other`;
    const res = makeRes();
    await handler(request("GET"), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("test_user_not_allowed");
  });

  it("listet CVs mit Server-Credential", async () => {
    const res = makeRes();
    await handler(request("GET", { query: { limit: "20" } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.items[0].cvId).toBe("cv-1");
    const call = risCalls()[0];
    expect(call[1].headers["X-Api-Credential"]).toBe(CREDENTIAL);
    expect(call[1].headers.Authorization).toBe(`Bearer ${token()}`);
    expect(call[1].body).toBeUndefined();
  });

  it("erstellt CV-Metadaten ohne Browser-Identität", async () => {
    risResponse = response(201, cv({ processingStatus: "pending", sizeBytes: undefined, documentId: undefined }));
    const res = makeRes();
    await handler(request("POST", {
      body: { filename: "resume.pdf", contentType: "application/pdf", metadata: { language: "de" } },
    }), res);
    expect(res.statusCode).toBe(201);
    const [, init] = risCalls()[0];
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      filename: "resume.pdf",
      contentType: "application/pdf",
      metadata: { language: "de" },
    });
    expect(body.userId).toBeUndefined();
    expect(body.tenantId).toBeUndefined();
  });

  it("vermittelt Upload-Ticket, Complete und Download-Ticket", async () => {
    risResponse = response(200, {
      cvId: "cv-1", documentId: "doc-1", uploadUrl: "https://s3.example/put",
      expiresAt: "2026-11-01T00:15:00Z", requiredHeaders: { "Content-Type": "application/pdf" },
    });
    let res = makeRes();
    await handler(request("POST", { query: { id: "cv-1", action: "upload" }, body: { contentType: "application/pdf" } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.uploadUrl).toBe("https://s3.example/put");
    expect(risCalls()[0][0]).toContain("/v1/partner/me/cvs/cv-1/document/upload");

    risResponse = response(200, cv());
    res = makeRes();
    await handler(request("POST", { query: { id: "cv-1", action: "complete" }, body: { documentId: "doc-1" } }), res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(risCalls().at(-1)[1].body)).toEqual({ documentId: "doc-1" });

    risResponse = response(200, { downloadUrl: "https://s3.example/get", expiresAt: "2026-11-01T00:15:00Z" });
    res = makeRes();
    await handler(request("GET", { query: { id: "cv-1", action: "document" } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.downloadUrl).toBe("https://s3.example/get");
  });

  it("löscht nur den angefragten CV-Pfad", async () => {
    risResponse = response(200, { cvId: "cv-1", deleted: true, physicalPurge: false });
    const res = makeRes();
    await handler(request("DELETE", { query: { id: "cv-1" } }), res);
    expect(res.statusCode).toBe(200);
    expect(risCalls()[0][0]).toContain("/v1/partner/me/cvs/cv-1");
    expect(risCalls()[0][1].method).toBe("DELETE");
  });

  it("blockt Path-Traversal und fremde Aktionen", async () => {
    const res = makeRes();
    await handler(request("GET", { query: { id: "../../other", action: "document" } }), res);
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe("invalid_cv_id");
  });

  it("mappt RIS-Fehler fail-closed", async () => {
    risResponse = response(403, { error: "denied", code: "CV_STORAGE_CONSENT_REQUIRED" });
    const res = makeRes();
    await handler(request("POST", { body: { filename: "resume.pdf" } }), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("CV_STORAGE_CONSENT_REQUIRED");
  });
});
