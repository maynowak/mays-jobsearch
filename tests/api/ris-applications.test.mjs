// @vitest-environment node
import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetJwksCache } from "../../api/_lib/ris/auth.mjs";
import handler from "../../api/ris/applications.mjs";

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
  const payload = b64u(
    JSON.stringify({
      iss: ISSUER,
      client_id: CLIENT,
      token_use: "access",
      sub: "user-1",
      exp: Math.floor(Date.now() / 1000) + 300,
      ...overrides,
    })
  );
  const signature = cryptoSign("RSA-SHA256", Buffer.from(`${header}.${payload}`), privateKey).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

function response(status, body) {
  return {
    ok: status < 400,
    status,
    json: async () => body,
  };
}

function makeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    },
  };
}

let risResponse;
let fetchMock;

function risCalls() {
  return fetchMock.mock.calls.filter(([url]) => !String(url).includes("/.well-known/jwks.json"));
}

function risApplication(overrides = {}) {
  return {
    applicationId: "app-1",
    job: {
      jobId: "job-1",
      title: "Test Software Engineer",
      company: "Synthetic Test Company",
      location: "Darmstadt",
      source: "synthetic",
    },
    documents: { coverLetterDraft: "", coverLetterVersions: [], documentStatus: "missing" },
    status: "DRAFT",
    stage: "draft",
    version: 1,
    createdAt: "2026-11-05T10:00:00Z",
    updatedAt: "2026-11-05T10:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  __resetJwksCache();
  process.env.RIS_APPLICATION_STORAGE_ENABLED = "true";
  process.env.RIS_API_BASE_URL = "https://ris.example.invalid";
  process.env.RIS_PARTNER_CREDENTIAL = CREDENTIAL;
  process.env.RIS_COGNITO_ISSUER = ISSUER;
  process.env.RIS_COGNITO_CLIENT_ID = CLIENT;
  risResponse = response(200, { application: risApplication() });
  fetchMock = vi.fn(async (url) => {
    if (String(url).includes("/.well-known/jwks.json")) return response(200, { keys: [jwk] });
    return risResponse;
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.RIS_APPLICATION_STORAGE_ENABLED;
  delete process.env.RIS_API_BASE_URL;
  delete process.env.RIS_PARTNER_CREDENTIAL;
  delete process.env.RIS_API_KEY;
  delete process.env.RIS_API_CREDENTIAL;
  delete process.env.RIS_COGNITO_ISSUER;
  delete process.env.RIS_COGNITO_CLIENT_ID;
});

describe("/api/ris/applications", () => {
  it("lehnt ohne Token ab", async () => {
    const res = makeRes();
    await handler({ method: "GET", headers: {}, query: {} }, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe("unauthenticated");
  });

  it("lehnt bei deaktiviertem Feature ab", async () => {
    process.env.RIS_APPLICATION_STORAGE_ENABLED = "false";
    const res = makeRes();
    await handler({ method: "GET", headers: { authorization: `Bearer ${token()}` }, query: {} }, res);
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe("ris_disabled");
  });

  it("lehnt fremden Issuer ab", async () => {
    const res = makeRes();
    await handler(
      { method: "GET", headers: { authorization: `Bearer ${token({ iss: "https://evil.invalid" })}` }, query: {} },
      res
    );
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe("invalid_issuer");
  });

  it("lehnt fremden Client ab", async () => {
    const res = makeRes();
    await handler(
      { method: "GET", headers: { authorization: `Bearer ${token({ client_id: "other-client" })}` }, query: {} },
      res
    );
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe("invalid_client");
  });

  it("erstellt eine Bewerbung mit serverseitigem Credential und Mapping", async () => {
    risResponse = response(201, { application: risApplication() });
    const res = makeRes();
    await handler(
      {
        method: "POST",
        headers: { authorization: `Bearer ${token()}`, "idempotency-key": "idem-1" },
        query: {},
        body: {
          job: {
            jobId: "job-1",
            title: "Test Software Engineer",
            companyName: "Synthetic Test Company",
            location: ["Darmstadt"],
            source: ["synthetic"],
            jobOrigin: "source",
          },
        },
      },
      res
    );

    expect(res.statusCode).toBe(201);
    expect(res.body.application.applicationId).toBe("app-1");
    const [url, options] = risCalls()[0];
    expect(String(url)).toBe("https://ris.example.invalid/v1/partner/me/applications");
    expect(options.headers["X-Api-Credential"]).toBe(CREDENTIAL);
    expect(options.headers.Authorization).toMatch(/^Bearer /);
    const payload = JSON.parse(options.body);
    expect(payload.job).toMatchObject({
      jobId: "job-1",
      company: "Synthetic Test Company",
      location: "Darmstadt",
      source: "synthetic",
    });
    expect(payload.idempotencyKey).toBe("idem-1");
  });

  it("lehnt mehrere Orte ab, statt still zu verlieren", async () => {
    const res = makeRes();
    await handler(
      {
        method: "POST",
        headers: { authorization: `Bearer ${token()}` },
        query: {},
        body: {
          job: {
            jobId: "job-1",
            title: "Test",
            companyName: "Synthetic Test Company",
            location: ["Darmstadt", "Frankfurt"],
            source: ["synthetic"],
          },
        },
      },
      res
    );
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe("unsupported_location_multiple");
    expect(risCalls()).toHaveLength(0);
  });

  it("lehnt Builder-CV-Referenzen ab", async () => {
    const res = makeRes();
    await handler(
      {
        method: "POST",
        headers: { authorization: `Bearer ${token()}` },
        query: {},
        body: {
          job: {
            jobId: "job-1",
            title: "Test",
            companyName: "Synthetic Test Company",
            location: ["Darmstadt"],
            source: ["synthetic"],
          },
          documents: { cvReference: { cvId: "cvb-1", cvSource: "builder" } },
        },
      },
      res
    );
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe("builder_cv_unsupported");
  });

  it("liest eine Bewerbung", async () => {
    const res = makeRes();
    await handler(
      { method: "GET", headers: { authorization: `Bearer ${token()}` }, query: { id: "app-1" } },
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.application.applicationId).toBe("app-1");
    expect(res.body.application.job.companyName).toBe("Synthetic Test Company");
    expect(res.body.application.job.location).toEqual(["Darmstadt"]);
  });

  it("sendet expectedVersion beim Patch", async () => {
    const res = makeRes();
    await handler(
      {
        method: "PATCH",
        headers: { authorization: `Bearer ${token()}` },
        query: { id: "app-1" },
        body: { expectedVersion: 3, notes: "updated" },
      },
      res
    );
    expect(res.statusCode).toBe(200);
    const [, options] = risCalls()[0];
    expect(JSON.parse(options.body).expectedVersion).toBe(3);
  });

  it("meldet Delete erst nach RIS-Erfolg", async () => {
    risResponse = response(204, null);
    const res = makeRes();
    await handler(
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${token()}` },
        query: { id: "app-1" },
        body: { expectedVersion: 2 },
      },
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ deleted: true, idempotent: false });
  });

  it("mappt RIS-409 auf version_conflict", async () => {
    risResponse = response(409, { error: "conflict", code: "VERSION_CONFLICT" });
    const res = makeRes();
    await handler(
      {
        method: "PATCH",
        headers: { authorization: `Bearer ${token()}` },
        query: { id: "app-1" },
        body: { expectedVersion: 1, notes: "x" },
      },
      res
    );
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("version_conflict");
  });

  it("mappt RIS-503 auf unavailable", async () => {
    risResponse = response(503, { error: "down" });
    const res = makeRes();
    await handler(
      { method: "GET", headers: { authorization: `Bearer ${token()}` }, query: { id: "app-1" } },
      res
    );
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe("unavailable");
  });

  it("liefert Metrics über den BFF", async () => {
    risResponse = response(200, { metrics: { total: 2 } });
    const res = makeRes();
    await handler(
      {
        method: "GET",
        headers: { authorization: `Bearer ${token()}` },
        query: { action: "metrics" },
      },
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ metrics: { total: 2 } });
    expect(String(risCalls()[0][0])).toContain("/metrics");
  });


  it("lehnt abgelaufene Tokens ab", async () => {
    const res = makeRes();
    await handler(
      {
        method: "GET",
        headers: { authorization: `Bearer ${token({ exp: Math.floor(Date.now() / 1000) - 10 })}` },
        query: {},
      },
      res
    );
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe("token_expired");
  });

  it("lehnt eine ungültige Signatur ab", async () => {
    const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const [header, payload] = token().split(".");
    const signature = cryptoSign(
      "RSA-SHA256",
      Buffer.from(`${header}.${payload}`),
      other.privateKey
    ).toString("base64url");
    const res = makeRes();
    await handler(
      {
        method: "GET",
        headers: { authorization: `Bearer ${header}.${payload}.${signature}` },
        query: {},
      },
      res
    );
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe("invalid_signature");
  });

  it("lehnt ID-Tokens ab", async () => {
    const res = makeRes();
    await handler(
      {
        method: "GET",
        headers: { authorization: `Bearer ${token({ token_use: "id" })}` },
        query: {},
      },
      res
    );
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe("invalid_token_use");
  });

  it("lehnt Tokens ohne sub ab", async () => {
    const res = makeRes();
    await handler(
      {
        method: "GET",
        headers: { authorization: `Bearer ${token({ sub: "" })}` },
        query: {},
      },
      res
    );
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe("invalid_subject");
  });

  it("meldet JWKS-Ausfall als 503, nicht als 401", async () => {
    fetchMock.mockImplementation(async (url) => {
      if (String(url).includes("/.well-known/jwks.json")) return response(503, {});
      return risResponse;
    });
    const res = makeRes();
    await handler(
      { method: "GET", headers: { authorization: `Bearer ${token()}` }, query: {} },
      res
    );
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe("unavailable");
  });

  it("lehnt unbekannte Aktionen ab", async () => {
    const res = makeRes();
    await handler(
      {
        method: "GET",
        headers: { authorization: `Bearer ${token()}` },
        query: { action: "unknown" },
      },
      res
    );
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe("invalid_action");
  });

  it("lehnt Pfadmanipulation in applicationId ab", async () => {
    const res = makeRes();
    await handler(
      {
        method: "GET",
        headers: { authorization: `Bearer ${token()}` },
        query: { id: "../../etc/passwd" },
      },
      res
    );
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe("invalid_application_id");
  });

  it("lehnt nicht erlaubte Methoden ab", async () => {
    const res = makeRes();
    await handler(
      { method: "PUT", headers: { authorization: `Bearer ${token()}` }, query: {} },
      res
    );
    expect(res.statusCode).toBe(405);
  });

  it("lehnt zu große Bodies ab", async () => {
    const res = makeRes();
    await handler(
      {
        method: "POST",
        headers: { authorization: `Bearer ${token()}` },
        query: {},
        body: {
          job: {
            jobId: "job-1",
            title: "Test",
            companyName: "Synthetic",
            location: ["Darmstadt"],
            source: ["synthetic"],
          },
          notes: "x".repeat(210000),
        },
      },
      res
    );
    expect(res.statusCode).toBe(413);
    expect(res.body.code).toBe("payload_too_large");
  });


  it("bindet ownerId an sub, nicht an E-Mail oder Browserwerte", async () => {
    risResponse = response(200, { application: risApplication() });
    const first = makeRes();
    await handler(
      { method: "GET", headers: { authorization: `Bearer ${token({ sub: "user-A", email: "same@example.invalid" })}` }, query: { id: "app-1" } },
      first
    );
    const second = makeRes();
    await handler(
      { method: "GET", headers: { authorization: `Bearer ${token({ sub: "user-B", email: "same@example.invalid" })}` }, query: { id: "app-1" } },
      second
    );
    expect(first.body.application.ownerId).toBe("user-A");
    expect(second.body.application.ownerId).toBe("user-B");
  });

  it("ignoriert ownerId aus dem Browser-Body", async () => {
    risResponse = response(201, { application: risApplication() });
    const res = makeRes();
    await handler(
      {
        method: "POST",
        headers: { authorization: `Bearer ${token({ sub: "user-real" })}` },
        query: {},
        body: {
          ownerId: "victim",
          job: {
            jobId: "job-1",
            title: "Test",
            companyName: "Synthetic",
            location: ["Darmstadt"],
            source: ["synthetic"],
          },
        },
      },
      res
    );
    expect(res.body.application.ownerId).toBe("user-real");
    const payload = JSON.parse(risCalls()[0][1].body);
    expect(payload).not.toHaveProperty("ownerId");
  });


  it("akzeptiert RIS_API_KEY als Server-Credential-Alias", async () => {
    delete process.env.RIS_PARTNER_CREDENTIAL;
    process.env.RIS_API_KEY = "ris_alias_credential";
    risResponse = response(201, { application: risApplication() });
    const res = makeRes();
    await handler(
      {
        method: "POST",
        headers: { authorization: `Bearer ${token()}` },
        query: {},
        body: {
          job: {
            jobId: "job-1",
            title: "Test",
            companyName: "Synthetic",
            location: ["Darmstadt"],
            source: ["synthetic"],
          },
        },
      },
      res
    );
    expect(res.statusCode).toBe(201);
    expect(risCalls()[0][1].headers["X-Api-Credential"]).toBe("ris_alias_credential");
  });

  it("gibt weder Token noch Credential in der Antwort aus", async () => {
    const res = makeRes();
    const bearer = token();
    await handler(
      { method: "GET", headers: { authorization: `Bearer ${bearer}` }, query: { id: "app-1" } },
      res
    );
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain(bearer);
    expect(serialized).not.toContain(CREDENTIAL);
  });
});
