import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const handler = (await import(
  pathToFileURL(path.resolve('api/ris/[...path].mjs')).href
)).default;

function request({ method = 'GET', url = '/api/ris/applications', segments = ['applications'], headers = {}, body } = {}) {
  const listeners = new Map();
  return {
    method,
    url,
    query: { path: segments },
    headers,
    body,
    on(event, fn) {
      listeners.set(event, fn);
    },
    off(event) {
      listeners.delete(event);
    },
  };
}

function response() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(chunk) {
      this.body = chunk === undefined ? '' : String(chunk);
    },
  };
}

function configure() {
  process.env.RIS_API_BASE_URL = 'https://ris.example.invalid';
  process.env.RIS_API_KEY = 'ris_test_secret';
}

function clearConfig() {
  delete process.env.RIS_API_BASE_URL;
  delete process.env.RIS_API_KEY;
  delete process.env.RIS_PARTNER_TIMEOUT_MS;
}

test.afterEach(() => {
  clearConfig();
  delete globalThis.fetch;
});

test('rejects missing access token before contacting RIS', async () => {
  configure();
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response('{}', { status: 200 });
  };
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 401);
  assert.equal(called, false);
});

test('fails closed when RIS is not configured', async () => {
  clearConfig();
  const res = response();
  await handler(request({ headers: { authorization: 'Bearer token' } }), res);
  assert.equal(res.statusCode, 503);
  assert.equal(JSON.parse(res.body).code, 'unavailable');
});

test('forwards list with server-side partner key and no key leakage', async () => {
  configure();
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return new Response(JSON.stringify({ items: [], nextCursor: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const res = response();
  await handler(request({
    headers: { authorization: 'Bearer user-token' },
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(captured.url, 'https://ris.example.invalid/v1/partner/me/applications');
  assert.equal(captured.init.headers.Authorization, 'Bearer user-token');
  assert.equal(captured.init.headers['X-Api-Credential'], 'ris_test_secret');
  assert.equal(res.body.includes('ris_test_secret'), false);
  assert.equal(res.headers['cache-control'], 'no-store, private');
});

test('forwards create body and preserves the RIS status', async () => {
  configure();
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return new Response(JSON.stringify({ applicationId: 'app-1', version: 1 }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const res = response();
  await handler(request({
    method: 'POST',
    headers: { authorization: 'Bearer user-token' },
    body: { job: { jobId: 'job-1' } },
  }), res);

  assert.equal(res.statusCode, 201);
  assert.equal(captured.init.method, 'POST');
  assert.deepEqual(JSON.parse(captured.init.body), { job: { jobId: 'job-1' } });
});

test('maps an upstream version conflict to version_conflict', async () => {
  configure();
  globalThis.fetch = async () => new Response(
    JSON.stringify({ error: 'conflict', code: 'VERSION_CONFLICT' }),
    { status: 409, headers: { 'Content-Type': 'application/json' } }
  );
  const res = response();
  await handler(request({
    method: 'PATCH',
    segments: ['applications', 'app-1'],
    url: '/api/ris/applications/app-1',
    headers: { authorization: 'Bearer user-token' },
    body: { expectedVersion: 1, notes: 'x' },
  }), res);

  assert.equal(res.statusCode, 409);
  assert.equal(JSON.parse(res.body).code, 'version_conflict');
});

test('refuses not-yet-supported status/history/cover-letter routes', async () => {
  configure();
  for (const suffix of ['status', 'history', 'cover-letter-versions']) {
    const res = response();
    await handler(request({
      method: 'POST',
      segments: ['applications', 'app-1', suffix],
      url: `/api/ris/applications/app-1/${suffix}`,
      headers: { authorization: 'Bearer user-token' },
      body: {},
    }), res);
    assert.equal(res.statusCode, 501);
    assert.equal(JSON.parse(res.body).code, 'unsupported');
  }
});

test('rejects unsupported methods', async () => {
  configure();
  const res = response();
  await handler(request({
    method: 'PUT',
    headers: { authorization: 'Bearer user-token' },
  }), res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.allow, 'GET, POST, PATCH, DELETE');
});
