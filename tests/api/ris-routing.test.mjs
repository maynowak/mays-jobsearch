// @vitest-environment node
import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetJwksCache } from "../../api/_lib/ris/auth.mjs";
import router from "../../api/ris/router.mjs";
import { CONSENT_TEXT_SHA256, CONSENT_TEXT_VERSION } from "../../api/_lib/ris/consentText.mjs";

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
  return { ok: status < 400, status, json: async () => body };
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

function makeReq(path, { method = "GET", headers = {}, body, query = {} } = {}) {
  const url = new URL(path, "http://localhost");
  const routeMap = {
    "/api/ris/applications": ["applications", "__ris_applications"],
    "/api/ris/consents": ["consents", "__ris_consents"],
    "/api/ris/cvs": ["cvs", "__ris_cvs"],
    "/api/ris/cv-consents": ["cv-consents", "__ris_cv_consents"],
    "/api/ris/search-profile-consents": ["search-profile-consents", "__ris_search_profile_consents"],
    "/api/ris/search-profiles": ["search-profiles", "__ris_search_profiles"],
    "/api/ris/cv-builder-profiles": ["cv-builder-profiles", "__ris_cv_builder_profiles"],
    "/api/ris/erasure": ["erasure", "__ris_erasure"],
  };
  const [exactRoute, flagKey] = routeMap[url.pathname] ?? ["", ""];
  return {
    method,
    url: path,
    headers,
    query: {
      ...Object.fromEntries(url.searchParams),
      ...(flagKey ? { [flagKey]: "1" } : {}),
      ...query,
    },
    body,
  };
}

function applicationFixture(overrides = {}) {
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

let risResponse;
let fetchMock;

function risCalls() {
  return fetchMock.mock.calls.filter(([url]) => !String(url).includes("/.well-known/jwks.json"));
}

beforeEach(() => {
  __resetJwksCache();
  process.env.RIS_APPLICATION_STORAGE_ENABLED = "true";
  process.env.RIS_CV_STORAGE_ENABLED = "true";
  process.env.RIS_SEARCH_PROFILE_STORAGE_ENABLED = "true";
  process.env.RIS_CV_BUILDER_PROFILE_STORAGE_ENABLED = "true";
  process.env.RIS_CONSENT_SERVICE_ENABLED = "true";
  process.env.RIS_API_BASE_URL = "https://ris.example.invalid";
  process.env.RIS_PARTNER_CREDENTIAL = CREDENTIAL;
  process.env.RIS_COGNITO_ISSUER = ISSUER;
  process.env.RIS_COGNITO_CLIENT_ID = CLIENT;
  process.env.RIS_TEST_USER_ALLOWLIST = `${ISSUER}|user-1`;
  delete process.env.RIS_CONSENT_NOTICE_VERSION;
  process.env.RIS_CONSENT_TEXT_VERSION = CONSENT_TEXT_VERSION;
  process.env.RIS_CONSENT_TEXT_SHA256 = CONSENT_TEXT_SHA256;
  process.env.RIS_CONSENT_TEXT_STATE = "APPROVED";

  risResponse = response(200, { items: [applicationFixture()], nextCursor: null });
  fetchMock = vi.fn(async (url) => {
    if (String(url).includes("/.well-known/jwks.json")) return response(200, { keys: [jwk] });
    return risResponse;
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of [
    "RIS_APPLICATION_STORAGE_ENABLED",
    "RIS_CV_STORAGE_ENABLED",
    "RIS_SEARCH_PROFILE_STORAGE_ENABLED",
    "RIS_CV_BUILDER_PROFILE_STORAGE_ENABLED",
    "RIS_CONSENT_SERVICE_ENABLED",
    "RIS_API_BASE_URL",
    "RIS_PARTNER_CREDENTIAL",
    "RIS_COGNITO_ISSUER",
    "RIS_COGNITO_CLIENT_ID",
    "RIS_TEST_USER_ALLOWLIST",
    "RIS_CONSENT_NOTICE_VERSION",
    "RIS_CONSENT_TEXT_VERSION",
    "RIS_CONSENT_TEXT_SHA256",
    "RIS_CONSENT_TEXT_STATE",
  ]) delete process.env[key];
});

describe("RIS single-entry routing", () => {
  it("konfiguriert ausschließlich die acht RIS-Rewrites und blockt den Router direkt", () => {
    const config = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));
    const risRewrites = config.rewrites.filter((rewrite) => rewrite.source.startsWith("/api/ris/"));
    expect(risRewrites).toEqual([
      { source: "/api/ris/applications", destination: "/api/ris/router?__ris_applications=1" },
      { source: "/api/ris/consents", destination: "/api/ris/router?__ris_consents=1" },
      { source: "/api/ris/cvs", destination: "/api/ris/router?__ris_cvs=1" },
      { source: "/api/ris/cv-consents", destination: "/api/ris/router?__ris_cv_consents=1" },
      { source: "/api/ris/search-profile-consents", destination: "/api/ris/router?__ris_search_profile_consents=1" },
      { source: "/api/ris/search-profiles", destination: "/api/ris/router?__ris_search_profiles=1" },
      { source: "/api/ris/cv-builder-profiles", destination: "/api/ris/router?__ris_cv_builder_profiles=1" },
      { source: "/api/ris/erasure", destination: "/api/ris/router?__ris_erasure=1" },
    ]);
    expect(config.redirects).toContainEqual({
      source: "/api/ris/router",
      destination: "/404",
      permanent: false,
    });
  });

  it("leitet /api/ris/applications an den Applications-Handler und erhält Query-Parameter", async () => {
    const res = makeRes();
    await router(
      makeReq("/api/ris/applications?limit=10", {
        headers: { authorization: `Bearer ${token()}` },
      }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.items[0].applicationId).toBe("app-1");
    const [url] = risCalls()[0];
    expect(String(url)).toContain("/v1/partner/me/applications?limit=10");
  });

  it("leitet /api/ris/consents an den Consent-Handler und erhält Query-Parameter", async () => {
    risResponse = response(200, {
      items: [{ purpose: "application-storage", status: "NOT_GRANTED", noticeVersion: null, version: 0 }],
    });
    const res = makeRes();
    await router(
      makeReq("/api/ris/consents?purpose=application-storage", {
        headers: { authorization: `Bearer ${token()}` },
      }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.consent.status).toBe("NOT_GRANTED");
    const [url] = risCalls()[0];
    expect(String(url)).toContain("/v1/partner/me/consents?purpose=application-storage");
  });

  it("erhält Methode, Body und Authorization-Header für Applications-POST", async () => {
    risResponse = response(201, { application: applicationFixture() });
    const res = makeRes();
    await router(
      makeReq("/api/ris/applications", {
        method: "POST",
        headers: { authorization: `Bearer ${token()}`, "idempotency-key": "idem-1" },
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
      }),
      res
    );

    expect(res.statusCode).toBe(201);
    const [, options] = risCalls()[0];
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toMatch(/^Bearer /);
    const payload = JSON.parse(options.body);
    expect(payload.job.jobId).toBe("job-1");
    expect(payload.idempotencyKey).toBe("idem-1");
  });

  it("erhält Methode und Body für Consent-Grant", async () => {
    process.env.RIS_CONSENT_NOTICE_VERSION = "1.0";
    const catalogResponse = response(200, {
      items: [{ purpose: "application-storage", status: "NOT_GRANTED", noticeVersion: null, version: 0 }],
      catalog: [{
        purpose: "application-storage",
        noticeVersion: "1.0",
        noticeState: "ACTIVE",
        noticeApproved: true,
        acceptedForNewGrant: true,
      }],
    });
    const grantResponse = response(200, {
      consent: { purpose: "application-storage", status: "GRANTED", noticeVersion: "1.0", version: 1 },
    });
    fetchMock.mockImplementation(async (url, init = {}) => {
      if (String(url).includes("/.well-known/jwks.json")) return response(200, { keys: [jwk] });
      return String(init?.method ?? "GET").toUpperCase() === "GET" ? catalogResponse : grantResponse;
    });
    const res = makeRes();
    await router(
      makeReq("/api/ris/consents", {
        method: "POST",
        headers: { authorization: `Bearer ${token()}` },
        body: { purpose: "application-storage", specialCategoriesConsent: true },
      }),
      res
    );

    expect(res.statusCode).toBe(200);
    const grantCall = risCalls().find(([, options]) => options.method === "POST");
    expect(grantCall).toBeDefined();
    const payload = JSON.parse(grantCall[1].body);
    expect(payload.purpose).toBe("application-storage");
    expect(payload.noticeVersion).toBe("1.0");
  });

  it("leitet /api/ris/cv-builder-profiles an den Structured-CV-Handler", async () => {
    risResponse = response(200, {
      items: [{ profileId: "cvp-12345678", name: "Synthetic", template: "classic", version: 1,
        createdAt: "2026-11-13T00:00:00Z", updatedAt: "2026-11-13T00:00:00Z" }],
      nextCursor: null,
    });
    const res = makeRes();
    await router(
      makeReq("/api/ris/cv-builder-profiles?limit=2", {
        headers: { authorization: `Bearer ${token()}` },
      }), res,
    );
    expect(res.statusCode).toBe(200);
    expect(String(risCalls()[0][0])).toContain("/v1/partner/me/cv-builder-profiles?limit=2");
  });

  it("kann per Query-Parameter nicht auf den anderen Handler umschalten", async () => {
    const res = makeRes();
    await router(
      makeReq("/api/ris/applications?limit=1", {
        headers: { authorization: `Bearer ${token()}` },
        query: { __ris_cv_builder_profiles: "1" },
      }),
      res
    );

    expect(res.statusCode).toBe(404);
    expect(res.body.code).toBe("not_found");
    expect(risCalls()).toHaveLength(0);
  });

  it("akzeptiert das Applications-Rewrite-Ziel ohne Pfadkontext", async () => {
    const res = makeRes();
    await router(
      makeReq("/api/ris/router?__ris_applications=1&limit=1", {
        headers: { authorization: `Bearer ${token()}` },
      }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.items[0].applicationId).toBe("app-1");
    const [url] = risCalls()[0];
    expect(String(url)).toContain("/v1/partner/me/applications");
  });

  it("weist widersprüchliche Rewrite-Flags ab", async () => {
    const res = makeRes();
    await router(makeReq("/api/ris/router?__ris_applications=1&__ris_consents=1"), res);

    expect(res.statusCode).toBe(404);
    expect(res.body.code).toBe("not_found");
    expect(risCalls()).toHaveLength(0);
  });

  it("weist unbekannte RIS-Routen ab", async () => {
    const res = makeRes();
    await router(makeReq("/api/ris/unknown"), res);

    expect(res.statusCode).toBe(404);
    expect(res.body.code).toBe("not_found");
    expect(risCalls()).toHaveLength(0);
  });

  it("weist verschachtelte RIS-Pfade ab", async () => {
    const res = makeRes();
    await router(makeReq("/api/ris/applications/extra"), res);

    expect(res.statusCode).toBe(404);
    expect(res.body.code).toBe("not_found");
    expect(risCalls()).toHaveLength(0);
  });

  it("behält das bestehende 401-Verhalten für beide öffentlichen Routen", async () => {
    const applications = makeRes();
    await router(makeReq("/api/ris/applications"), applications);
    expect(applications.statusCode).toBe(401);

    const consents = makeRes();
    await router(makeReq("/api/ris/consents"), consents);
    expect(consents.statusCode).toBe(401);
  });
});


describe("search-profile routes", () => {
  it("leitet /api/ris/search-profiles an den Search-Profile-Handler", async () => {
    const res = makeRes();
    await router(
      makeReq("/api/ris/search-profiles?type=manual&limit=5", {
        headers: { authorization: `Bearer ${token()}` },
      }),
      res
    );
    expect(res.statusCode).toBe(200);
    expect(risCalls()[0][0]).toContain("/v1/partner/me/manual-search-profiles?limit=5");
  });

  it("setzt bei /api/ris/search-profile-consents den Purpose serverseitig", async () => {
    process.env.RIS_CONSENT_SERVICE_ENABLED = "true";
    process.env.RIS_SEARCH_PROFILE_CONSENT_NOTICE_VERSION = "1.0";
    process.env.RIS_SEARCH_PROFILE_CONSENT_TEXT_VERSION =
      "search-profile-storage-consent-2026-11-08-v2";
    process.env.RIS_SEARCH_PROFILE_CONSENT_TEXT_SHA256 =
      "75919c8bc219c938bdd2452a8bf02955997d1336ba2ca716bc691dd54eaa7ef6";
    process.env.RIS_SEARCH_PROFILE_CONSENT_TEXT_STATE = "DRAFT";
    risResponse = response(200, { items: [], catalog: [] });
    const res = makeRes();
    await router(
      makeReq("/api/ris/search-profile-consents", {
        headers: { authorization: `Bearer ${token()}` },
      }),
      res
    );
    expect(risCalls()[0][0]).toContain("purpose=search-profile-storage");
  });
});
