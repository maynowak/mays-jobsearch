// @vitest-environment node
import { createHash } from "node:crypto";
import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetJwksCache } from "../../api/_lib/ris/auth.mjs";
import handler from "../../api/_lib/ris/consentsHandler.mjs";
import { evaluateNoticeGrant } from "../../api/_lib/ris/consentNotice.mjs";
import {
  CONSENT_SPECIAL_CATEGORIES,
  CONSENT_TEXT_SHA256,
  CONSENT_TEXT_VERSION,
} from "../../api/_lib/ris/consentText.mjs";
import {
  APPLICATION_STORAGE_CONSENT_TEXT,
  APPLICATION_STORAGE_CONSENT_TEXT_SHA256,
  APPLICATION_STORAGE_CONSENT_TEXT_VERSION,
  APPLICATION_STORAGE_SPECIAL_CATEGORIES,
} from "../../src/lib/applicationStorageConsent";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test-key", alg: "RS256", use: "sig" };

const ISSUER = "https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_TEST";
const CLIENT = "test-client";
const CREDENTIAL = "ris_test_credential";

const DRAFT_NOTICE = {
  purpose: "application-storage",
  noticeVersion: "1.0",
  noticeState: "DRAFT",
  noticeApproved: false,
  acceptedForNewGrant: false,
  legalApprovalRef: "internal-legal-ref-must-not-leak",
};

const ACTIVE_NOTICE = {
  purpose: "application-storage",
  noticeVersion: "1.0",
  noticeState: "ACTIVE",
  noticeApproved: true,
  acceptedForNewGrant: true,
  legalApprovalRef: "internal-legal-ref-must-not-leak",
};

const APPROVED_NOTICE = { ...ACTIVE_NOTICE, noticeState: "APPROVED" };
const SUPERSEDED_NOTICE = { ...ACTIVE_NOTICE, noticeState: "SUPERSEDED" };

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

let getResponse;
let postResponse;
let networkDown;
let fetchMock;

function risCalls() {
  return fetchMock.mock.calls.filter(([url]) => !String(url).includes("/.well-known/jwks.json"));
}

function callsByMethod(method) {
  return risCalls().filter(([, init]) => String(init?.method ?? "GET").toUpperCase() === method);
}

function request(method, { query = {}, body } = {}) {
  return { method, headers: { authorization: `Bearer ${token()}` }, query, body };
}

function consentItems() {
  return [{ purpose: "application-storage", status: "NOT_GRANTED", noticeVersion: null, version: 0 }];
}

beforeEach(() => {
  __resetJwksCache();
  process.env.RIS_APPLICATION_STORAGE_ENABLED = "false";
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

  getResponse = response(200, { items: consentItems() });
  postResponse = response(200, { consent: { purpose: "application-storage", status: "GRANTED", noticeVersion: "1.0", version: 1 } });
  networkDown = false;

  fetchMock = vi.fn(async (url, init = {}) => {
    if (String(url).includes("/.well-known/jwks.json")) return response(200, { keys: [jwk] });
    if (networkDown) throw new TypeError("fetch failed");
    if (String(init?.method ?? "GET").toUpperCase() === "GET") return getResponse;
    return postResponse;
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of [
    "RIS_APPLICATION_STORAGE_ENABLED", "RIS_CONSENT_SERVICE_ENABLED", "RIS_API_BASE_URL",
    "RIS_PARTNER_CREDENTIAL", "RIS_COGNITO_ISSUER", "RIS_COGNITO_CLIENT_ID",
    "RIS_TEST_USER_ALLOWLIST", "RIS_CONSENT_NOTICE_VERSION",
    "RIS_CONSENT_TEXT_VERSION", "RIS_CONSENT_TEXT_SHA256", "RIS_CONSENT_TEXT_STATE",
  ]) delete process.env[key];
});

describe("/api/ris/consents", () => {
  it("lehnt ohne Token ab", async () => {
    const res = makeRes();
    await handler({ method: "GET", headers: {}, query: {} }, res);
    expect(res.statusCode).toBe(401);
  });

  it("bleibt deaktiviert, wenn nur Application-Storage aktiviert ist", async () => {
    process.env.RIS_CONSENT_SERVICE_ENABLED = "false";
    process.env.RIS_APPLICATION_STORAGE_ENABLED = "true";
    const res = makeRes();
    await handler({ method: "GET", headers: { authorization: `Bearer ${token()}` }, query: {} }, res);
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe("consent_disabled");
    expect(risCalls()).toHaveLength(0);
  });

  it("meldet missing_config, wenn Consent aktiviert aber Verbindungsdaten fehlen", async () => {
    delete process.env.RIS_API_BASE_URL;
    const res = makeRes();
    await handler({ method: "GET", headers: { authorization: `Bearer ${token()}` }, query: {} }, res);
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe("missing_config");
    expect(risCalls()).toHaveLength(0);
  });

  it("lehnt fremden Issuer ab", async () => {
    const res = makeRes();
    await handler({ method: "GET", headers: { authorization: `Bearer ${token({ iss: "https://evil.invalid" })}` }, query: {} }, res);
    expect(res.statusCode).toBe(401);
  });

  it("liefert Status und sperrt ohne konfigurierte Notice-Version", async () => {
    const res = makeRes();
    await handler(request("GET"), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.consent.status).toBe("NOT_GRANTED");
    expect(res.body.noticeVersion).toBeNull();
    expect(res.body.grantAllowed).toBe(false);
    expect(res.body.noticeReason).toBe("notice_version_not_mapped");
  });

  it("sperrt eine DRAFT-Notice trotz gesetzter Version", async () => {
    process.env.RIS_CONSENT_NOTICE_VERSION = "1.0";
    getResponse = response(200, { items: consentItems(), catalog: [DRAFT_NOTICE] });
    const res = makeRes();
    await handler(request("GET"), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.noticeVersion).toBe("1.0");
    expect(res.body.noticeState).toBe("DRAFT");
    expect(res.body.noticeApproved).toBe(false);
    expect(res.body.acceptedForNewGrant).toBe(false);
    expect(res.body.grantAllowed).toBe(false);
    expect(res.body.noticeReason).toBe("notice_not_active");
    expect(JSON.stringify(res.body)).not.toContain("legalApprovalRef");
    expect(JSON.stringify(res.body)).not.toContain("internal-legal-ref-must-not-leak");
  });

  it("gibt eine ACTIVE, freigegebene und für neue Grants akzeptierte Notice frei", async () => {
    process.env.RIS_CONSENT_NOTICE_VERSION = "1.0";
    getResponse = response(200, {
      items: consentItems(),
      catalog: [{ ...DRAFT_NOTICE, noticeVersion: "0.9" }, ACTIVE_NOTICE],
    });
    const res = makeRes();
    await handler(request("GET"), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.noticeState).toBe("ACTIVE");
    expect(res.body.noticeApproved).toBe(true);
    expect(res.body.acceptedForNewGrant).toBe(true);
    expect(res.body.textVersion).toBe(CONSENT_TEXT_VERSION);
    expect(res.body.textHash).toBe(CONSENT_TEXT_SHA256);
    expect(res.body.textState).toBe("APPROVED");
    expect(res.body.textMapped).toBe(true);
    expect(res.body.textApproved).toBe(true);
    expect(res.body.textReason).toBeNull();
    expect(res.body.grantAllowed).toBe(true);
    expect(res.body.noticeReason).toBeNull();
  });

  it("gibt eine APPROVED-Notice frei (RIS GRANTABLE_NOTICE_STATES)", async () => {
    process.env.RIS_CONSENT_NOTICE_VERSION = "1.0";
    getResponse = response(200, { items: consentItems(), catalog: [APPROVED_NOTICE] });
    const res = makeRes();
    await handler(request("GET"), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.noticeState).toBe("APPROVED");
    expect(res.body.noticeApproved).toBe(true);
    expect(res.body.acceptedForNewGrant).toBe(true);
    expect(res.body.grantAllowed).toBe(true);
    expect(res.body.noticeReason).toBeNull();
  });

  it("sperrt SUPERSEDED trotz gesetzter Freigabe-Flags", async () => {
    process.env.RIS_CONSENT_NOTICE_VERSION = "1.0";
    getResponse = response(200, { items: consentItems(), catalog: [SUPERSEDED_NOTICE] });
    const res = makeRes();
    await handler(request("GET"), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.noticeState).toBe("SUPERSEDED");
    // RIS reports both flags true while CONSENT_NOTICE_STATE_ENFORCED=false;
    // only the state check blocks this entry.
    expect(res.body.noticeApproved).toBe(true);
    expect(res.body.acceptedForNewGrant).toBe(true);
    expect(res.body.grantAllowed).toBe(false);
    expect(res.body.noticeReason).toBe("notice_not_active");
  });

  it("sperrt ein DRAFT mit gesetzten Freigabe-Flags", async () => {
    process.env.RIS_CONSENT_NOTICE_VERSION = "1.0";
    getResponse = response(200, {
      items: consentItems(),
      catalog: [{ ...DRAFT_NOTICE, noticeApproved: true, acceptedForNewGrant: true }],
    });
    const res = makeRes();
    await handler(request("GET"), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.noticeState).toBe("DRAFT");
    expect(res.body.grantAllowed).toBe(false);
    expect(res.body.noticeReason).toBe("notice_not_active");
  });

  it("sperrt ACTIVE ohne rechtliche Freigabe", async () => {
    process.env.RIS_CONSENT_NOTICE_VERSION = "1.0";
    getResponse = response(200, {
      items: consentItems(),
      catalog: [{ ...ACTIVE_NOTICE, noticeApproved: false }],
    });
    const res = makeRes();
    await handler(request("GET"), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.grantAllowed).toBe(false);
    expect(res.body.noticeReason).toBe("notice_not_approved");
  });

  it("sperrt ACTIVE, das nicht für neue Grants akzeptiert ist", async () => {
    process.env.RIS_CONSENT_NOTICE_VERSION = "1.0";
    getResponse = response(200, {
      items: consentItems(),
      catalog: [{ ...ACTIVE_NOTICE, acceptedForNewGrant: false }],
    });
    const res = makeRes();
    await handler(request("GET"), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.grantAllowed).toBe(false);
    expect(res.body.noticeReason).toBe("notice_not_accepted");
  });

  it("fällt ohne Katalog geschlossen zu", async () => {
    process.env.RIS_CONSENT_NOTICE_VERSION = "1.0";
    getResponse = response(200, { items: consentItems() });
    const res = makeRes();
    await handler(request("GET"), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.grantAllowed).toBe(false);
    expect(res.body.noticeState).toBe("UNKNOWN");
    expect(res.body.noticeReason).toBe("notice_catalog_invalid");
  });

  it("fällt bei malformed Katalog geschlossen zu", async () => {
    process.env.RIS_CONSENT_NOTICE_VERSION = "1.0";
    getResponse = response(200, { items: consentItems(), catalog: "not-a-list" });
    const res = makeRes();
    await handler(request("GET"), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.grantAllowed).toBe(false);
    expect(res.body.noticeReason).toBe("notice_catalog_invalid");
  });

  it("sperrt eine bei RIS unbekannte Version", async () => {
    process.env.RIS_CONSENT_NOTICE_VERSION = "1.0";
    getResponse = response(200, {
      items: consentItems(),
      catalog: [{ ...ACTIVE_NOTICE, noticeVersion: "2.0" }],
    });
    const res = makeRes();
    await handler(request("GET"), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.grantAllowed).toBe(false);
    expect(res.body.noticeReason).toBe("notice_version_unknown");
  });

  it("blockiert Grant ohne freigegebene Erklärungsversion", async () => {
    const res = makeRes();
    await handler(request("POST", { body: { purpose: "application-storage" } }), res);
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe("notice_version_not_mapped");
    expect(risCalls().length).toBe(0);
  });

  it("weist einen Grant bei DRAFT-Notice ab, ohne RIS-Grant aufzurufen", async () => {
    process.env.RIS_CONSENT_NOTICE_VERSION = "1.0";
    getResponse = response(200, { items: consentItems(), catalog: [DRAFT_NOTICE] });
    const res = makeRes();
    await handler(request("POST", { body: { purpose: "application-storage" } }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("notice_not_active");
    expect(callsByMethod("POST")).toHaveLength(0);
  });

  it("weist einen Grant bei SUPERSEDED-Notice ab, ohne RIS-Grant aufzurufen", async () => {
    process.env.RIS_CONSENT_NOTICE_VERSION = "1.0";
    getResponse = response(200, { items: consentItems(), catalog: [SUPERSEDED_NOTICE] });
    const res = makeRes();
    await handler(request("POST", { body: { purpose: "application-storage" } }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("notice_not_active");
    expect(callsByMethod("POST")).toHaveLength(0);
  });

  it("weist einen Grant bei unbekannter Version ab, ohne RIS-Grant aufzurufen", async () => {
    process.env.RIS_CONSENT_NOTICE_VERSION = "1.0";
    getResponse = response(200, {
      items: consentItems(),
      catalog: [{ ...ACTIVE_NOTICE, noticeVersion: "2.0" }],
    });
    const res = makeRes();
    await handler(request("POST", { body: { purpose: "application-storage" } }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("notice_version_unknown");
    expect(callsByMethod("POST")).toHaveLength(0);
  });

  it("weist einen Grant bei fehlendem Katalog ab, ohne RIS-Grant aufzurufen", async () => {
    process.env.RIS_CONSENT_NOTICE_VERSION = "1.0";
    getResponse = response(200, { items: consentItems() });
    const res = makeRes();
    await handler(request("POST", { body: { purpose: "application-storage" } }), res);
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe("notice_catalog_invalid");
    expect(callsByMethod("POST")).toHaveLength(0);
  });

  it("sendet bei freigegebener Notice Version, Kategorien und Textnachweis an RIS", async () => {
    process.env.RIS_CONSENT_NOTICE_VERSION = "1.0";
    getResponse = response(200, { items: consentItems(), catalog: [ACTIVE_NOTICE] });
    const res = makeRes();
    await handler(request("POST", { body: { purpose: "application-storage", noticeVersion: "9.9", specialCategoriesConsent: true } }), res);
    expect(res.statusCode).toBe(200);

    const calls = risCalls();
    expect(String(calls[0][0])).toContain("/consents?purpose=application-storage");
    const grantCall = callsByMethod("POST")[0];
    expect(String(grantCall[0])).toContain("/consents");
    const sent = JSON.parse(grantCall[1].body);
    expect(sent.purpose).toBe("application-storage");
    expect(sent.noticeVersion).toBe("1.0");
    expect(sent.noticeVersion).not.toBe("9.9");
    expect(sent.specialCategoriesConsent).toBe(true);
    expect(sent.specialCategories).toEqual([...CONSENT_SPECIAL_CATEGORIES]);
    expect(sent.externalTextVersion).toBe(CONSENT_TEXT_VERSION);
    expect(sent.externalTextSha256).toBe(CONSENT_TEXT_SHA256);
  });

  it("sendet bei einer APPROVED-Notice die serverseitige Version an RIS", async () => {
    process.env.RIS_CONSENT_NOTICE_VERSION = "1.0";
    getResponse = response(200, { items: consentItems(), catalog: [APPROVED_NOTICE] });
    const res = makeRes();
    await handler(request("POST", { body: { purpose: "application-storage", specialCategoriesConsent: true } }), res);
    expect(res.statusCode).toBe(200);
    const grantCall = callsByMethod("POST")[0];
    expect(JSON.parse(grantCall[1].body).noticeVersion).toBe("1.0");
  });

  it("weist einen Grant ohne ausdrückliche Art.-9-Einwilligung vor dem RIS-Aufruf ab", async () => {
    process.env.RIS_CONSENT_NOTICE_VERSION = "1.0";
    getResponse = response(200, { items: consentItems(), catalog: [ACTIVE_NOTICE] });

    for (const body of [
      { purpose: "application-storage" },
      { purpose: "application-storage", specialCategoriesConsent: false },
      { purpose: "application-storage", specialCategoriesConsent: "true" },
    ]) {
      const res = makeRes();
      await handler(request("POST", { body }), res);
      expect(res.statusCode).toBe(422);
      expect(res.body.code).toBe("special_categories_consent_required");
      expect(callsByMethod("POST")).toHaveLength(0);
    }
  });

  it("liefert den Backend-Nachweis fail-closed und mit gespeicherten Feldern", async () => {
    process.env.RIS_CONSENT_NOTICE_VERSION = "1.0";
    getResponse = response(200, { items: consentItems(), catalog: [ACTIVE_NOTICE] });

    const bare = makeRes();
    await handler(request("GET"), bare);
    expect(bare.statusCode).toBe(200);
    expect(bare.body.specialCategoriesConsent).toBe(false);
    expect(bare.body.specialCategories).toEqual([]);
    expect(bare.body.externalTextVersion).toBeNull();
    expect(bare.body.externalTextSha256).toBeNull();
    expect(bare.body.consent.specialCategoriesConsent).toBe(false);

    getResponse = response(200, {
      items: [{
        purpose: "application-storage",
        status: "GRANTED",
        noticeVersion: "1.0",
        version: 1,
        specialCategoriesConsent: true,
        specialCategories: ["health", "genetic_data"],
        externalTextVersion: CONSENT_TEXT_VERSION,
        externalTextSha256: CONSENT_TEXT_SHA256,
      }],
      catalog: [ACTIVE_NOTICE],
    });
    const stored = makeRes();
    await handler(request("GET"), stored);
    expect(stored.body.specialCategoriesConsent).toBe(true);
    expect(stored.body.specialCategories).toEqual(["health", "genetic_data"]);
    expect(stored.body.externalTextVersion).toBe(CONSENT_TEXT_VERSION);
    expect(stored.body.externalTextSha256).toBe(CONSENT_TEXT_SHA256);
    expect(stored.body.consent.specialCategoriesConsent).toBe(true);
    expect(stored.body.consent.externalTextVersion).toBe(CONSENT_TEXT_VERSION);
  });

  it("fällt bei RIS-Statusfehler geschlossen zu und schreibt keinen Grant", async () => {
    process.env.RIS_CONSENT_NOTICE_VERSION = "1.0";
    getResponse = response(500, { error: "boom" });
    const res = makeRes();
    await handler(request("POST", { body: { purpose: "application-storage" } }), res);
    expect(res.statusCode).toBeGreaterThanOrEqual(500);
    expect(res.body.code).toBe("notice_catalog_unavailable");
    expect(callsByMethod("POST")).toHaveLength(0);
  });

  it("fällt bei nicht erreichbarem RIS geschlossen zu", async () => {
    process.env.RIS_CONSENT_NOTICE_VERSION = "1.0";
    networkDown = true;
    const res = makeRes();
    await handler(request("POST", { body: { purpose: "application-storage" } }), res);
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe("notice_catalog_unavailable");
    expect(callsByMethod("POST")).toHaveLength(0);
  });

  it("erlaubt den Widerruf auch bei gesperrtem Grant", async () => {
    process.env.RIS_CONSENT_NOTICE_VERSION = "1.0";
    getResponse = response(200, { items: consentItems(), catalog: [DRAFT_NOTICE] });
    postResponse = response(200, { consent: { purpose: "application-storage", status: "WITHDRAWN", version: 2 } });
    const res = makeRes();
    await handler(request("POST", { query: { action: "withdraw" }, body: { purpose: "application-storage" } }), res);
    expect(res.statusCode).toBe(200);
    const posts = callsByMethod("POST");
    expect(posts).toHaveLength(1);
    expect(String(posts[0][0])).toContain("/consents/withdraw");
    expect(callsByMethod("GET")).toHaveLength(0);
  });

  it("weist unbekannte Zwecke ab", async () => {
    const res = makeRes();
    await handler(request("POST", { body: { purpose: "marketing" } }), res);
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe("unknown_purpose");
  });
});

describe("consent text mapping gate", () => {
  function approveText() {
    process.env.RIS_CONSENT_TEXT_VERSION = CONSENT_TEXT_VERSION;
    process.env.RIS_CONSENT_TEXT_SHA256 = CONSENT_TEXT_SHA256;
    process.env.RIS_CONSENT_TEXT_STATE = "APPROVED";
  }

  function activeNotice() {
    getResponse = response(200, { items: consentItems(), catalog: [ACTIVE_NOTICE] });
  }

  it("hält Server- und Client-Textidentität sowie den SHA-256 konsistent", () => {
    expect(CONSENT_TEXT_VERSION).toBe(APPLICATION_STORAGE_CONSENT_TEXT_VERSION);
    expect(CONSENT_TEXT_SHA256).toBe(APPLICATION_STORAGE_CONSENT_TEXT_SHA256);
    expect([...CONSENT_SPECIAL_CATEGORIES]).toEqual([...APPLICATION_STORAGE_SPECIAL_CATEGORIES]);
    const digest = createHash("sha256")
      .update(APPLICATION_STORAGE_CONSENT_TEXT, "utf8")
      .digest("hex");
    expect(digest).toBe(CONSENT_TEXT_SHA256);
  });

  it("sperrt ohne konfiguriertes Text-Mapping und schreibt keinen Grant", async () => {
    delete process.env.RIS_CONSENT_TEXT_VERSION;
    delete process.env.RIS_CONSENT_TEXT_SHA256;
    delete process.env.RIS_CONSENT_TEXT_STATE;
    process.env.RIS_CONSENT_NOTICE_VERSION = "1.0";
    activeNotice();

    const get = makeRes();
    await handler(request("GET"), get);
    expect(get.statusCode).toBe(200);
    expect(get.body.grantAllowed).toBe(false);
    expect(get.body.textVersion).toBeNull();
    expect(get.body.textHash).toBeNull();
    expect(get.body.textState).toBeNull();
    expect(get.body.textMapped).toBe(false);
    expect(get.body.textApproved).toBe(false);
    expect(get.body.textReason).toBe("consent_text_not_configured");

    const post = makeRes();
    await handler(request("POST", { body: { purpose: "application-storage" } }), post);
    expect(post.statusCode).toBe(503);
    expect(post.body.code).toBe("consent_text_not_configured");
    expect(callsByMethod("POST")).toHaveLength(0);
  });

  it("sperrt einen DRAFT-Textstatus und schreibt keinen Grant", async () => {
    process.env.RIS_CONSENT_NOTICE_VERSION = "1.0";
    approveText();
    process.env.RIS_CONSENT_TEXT_STATE = "DRAFT";
    activeNotice();

    const get = makeRes();
    await handler(request("GET"), get);
    expect(get.statusCode).toBe(200);
    expect(get.body.grantAllowed).toBe(false);
    expect(get.body.textState).toBe("DRAFT");
    expect(get.body.textMapped).toBe(true);
    expect(get.body.textApproved).toBe(false);
    expect(get.body.textReason).toBe("consent_text_not_approved");

    const post = makeRes();
    await handler(request("POST", { body: { purpose: "application-storage" } }), post);
    expect(post.statusCode).toBe(409);
    expect(post.body.code).toBe("consent_text_not_approved");
    expect(callsByMethod("POST")).toHaveLength(0);
  });

  it("sperrt abweichende Textversion oder abweichenden Hash", async () => {
    process.env.RIS_CONSENT_NOTICE_VERSION = "1.0";
    for (const override of [
      { version: "application-storage-consent-other" },
      { hash: "0".repeat(64) },
    ]) {
      approveText();
      if (override.version) process.env.RIS_CONSENT_TEXT_VERSION = override.version;
      if (override.hash) process.env.RIS_CONSENT_TEXT_SHA256 = override.hash;
      activeNotice();

      const get = makeRes();
      await handler(request("GET"), get);
      expect(get.statusCode).toBe(200);
      expect(get.body.grantAllowed).toBe(false);
      expect(get.body.textMapped).toBe(false);
      expect(get.body.textApproved).toBe(false);
      expect(get.body.textReason).toBe("consent_text_mismatch");

      const post = makeRes();
      await handler(request("POST", { body: { purpose: "application-storage" } }), post);
      expect(post.statusCode).toBe(503);
      expect(post.body.code).toBe("consent_text_mismatch");
      expect(callsByMethod("POST")).toHaveLength(0);
    }
  });

  it("gibt ein APPROVED-Mapping nur mit freigegebener Notice frei", async () => {
    process.env.RIS_CONSENT_NOTICE_VERSION = "1.0";
    approveText();
    activeNotice();

    const get = makeRes();
    await handler(request("GET"), get);
    expect(get.statusCode).toBe(200);
    expect(get.body.grantAllowed).toBe(true);
    expect(get.body.textMapped).toBe(true);
    expect(get.body.textApproved).toBe(true);
  });
});

describe("evaluateNoticeGrant", () => {
  it("blockiert DRAFT auch bei widersprüchlichen Freigabe-Flags", () => {
    const notice = evaluateNoticeGrant(
      { catalog: [{ ...ACTIVE_NOTICE, noticeState: "DRAFT" }] },
      { noticeVersion: "1.0", purpose: "application-storage" },
    );
    expect(notice.grantAllowed).toBe(false);
    expect(notice.noticeReason).toBe("notice_not_active");
  });

  it("blockiert SUPERSEDED trotz noticeApproved und acceptedForNewGrant", () => {
    const notice = evaluateNoticeGrant(
      { catalog: [SUPERSEDED_NOTICE] },
      { noticeVersion: "1.0", purpose: "application-storage" },
    );
    expect(notice.noticeApproved).toBe(true);
    expect(notice.acceptedForNewGrant).toBe(true);
    expect(notice.grantAllowed).toBe(false);
    expect(notice.noticeReason).toBe("notice_not_active");
  });

  it("akzeptiert APPROVED und ACTIVE, aber keinen anderen Zustand", () => {
    for (const state of ["APPROVED", "ACTIVE"]) {
      const notice = evaluateNoticeGrant(
        { catalog: [{ ...ACTIVE_NOTICE, noticeState: state }] },
        { noticeVersion: "1.0", purpose: "application-storage" },
      );
      expect(notice.grantAllowed).toBe(true);
    }
    for (const state of ["DRAFT", "SUPERSEDED", "PUBLISHED", "UNKNOWN"]) {
      const notice = evaluateNoticeGrant(
        { catalog: [{ ...ACTIVE_NOTICE, noticeState: state }] },
        { noticeVersion: "1.0", purpose: "application-storage" },
      );
      expect(notice.grantAllowed).toBe(false);
      expect(notice.noticeReason).toBe("notice_not_active");
    }
  });

  it("ignoriert Katalogeinträge für andere Zwecke", () => {
    const notice = evaluateNoticeGrant(
      { catalog: [{ ...ACTIVE_NOTICE, purpose: "marketing" }] },
      { noticeVersion: "1.0", purpose: "application-storage" },
    );
    expect(notice.grantAllowed).toBe(false);
    expect(notice.noticeReason).toBe("notice_version_unknown");
  });

  it("verlangt echtes Boolean true für Freigabe und Annahme", () => {
    const notice = evaluateNoticeGrant(
      { catalog: [{ ...ACTIVE_NOTICE, noticeApproved: "true", acceptedForNewGrant: 1 }] },
      { noticeVersion: "1.0", purpose: "application-storage" },
    );
    expect(notice.grantAllowed).toBe(false);
    expect(notice.noticeReason).toBe("notice_not_approved");
  });

  it("fällt bei widersprüchlichen Duplikaten derselben Version geschlossen zu", () => {
    const notice = evaluateNoticeGrant(
      { catalog: [ACTIVE_NOTICE, { ...ACTIVE_NOTICE, noticeState: "DRAFT" }] },
      { noticeVersion: "1.0", purpose: "application-storage" },
    );
    expect(notice.grantAllowed).toBe(false);
    expect(notice.noticeReason).toBe("notice_catalog_invalid");
  });

  it("gibt eine vollständig freigegebene ACTIVE-Notice frei", () => {
    const notice = evaluateNoticeGrant(
      { catalog: [ACTIVE_NOTICE] },
      { noticeVersion: "1.0", purpose: "application-storage" },
    );
    expect(notice).toMatchObject({
      noticeVersion: "1.0",
      noticeState: "ACTIVE",
      noticeApproved: true,
      acceptedForNewGrant: true,
      grantAllowed: true,
      noticeReason: null,
    });
  });
});
