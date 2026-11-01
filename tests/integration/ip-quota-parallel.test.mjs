// @vitest-environment node
import { createServer } from "node:http";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { connect } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const exec = promisify(execFile);
let dockerAvailable = false;
try {
  execFileSync("docker", ["info"], { stdio: "ignore" });
  dockerAvailable = true;
} catch {
  dockerAvailable = false;
}
const describeDocker = dockerAvailable ? describe : describe.skip;
const container = `mj-rest-redis-${Date.now()}`;
let server;
let restUrl;
let redisPort;
let realFetch;
let providerCalls = 0;
let source;

function respEncode(args) {
  return `*${args.length}\r\n${args
    .map((arg) => {
      const value = String(arg);
      return `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
    })
    .join("")}`;
}

function parseReply(buffer) {
  if (buffer.length === 0) return null;
  const type = String.fromCharCode(buffer[0]);
  const lineEnd = buffer.indexOf("\r\n");
  if (lineEnd === -1) return null;
  const line = buffer.slice(1, lineEnd).toString();
  if (type === "+") return { value: line, rest: buffer.slice(lineEnd + 2) };
  if (type === "-") return { error: line, rest: buffer.slice(lineEnd + 2) };
  if (type === ":") return { value: Number(line), rest: buffer.slice(lineEnd + 2) };
  if (type === "$") {
    const length = Number(line);
    if (length === -1) return { value: null, rest: buffer.slice(lineEnd + 2) };
    const start = lineEnd + 2;
    const end = start + length;
    return { value: buffer.slice(start, end).toString(), rest: buffer.slice(end + 2) };
  }
  if (type === "*") {
    const count = Number(line);
    if (count === -1) return { value: null, rest: buffer.slice(lineEnd + 2) };
    let rest = buffer.slice(lineEnd + 2);
    const values = [];
    for (let i = 0; i < count; i += 1) {
      const parsed = parseReply(rest);
      if (!parsed) return null;
      if (parsed.error) return parsed;
      values.push(parsed.value);
      rest = parsed.rest;
    }
    return { value: values, rest };
  }
  return null;
}

function redisCommand(args) {
  return new Promise((resolve, reject) => {
    const socket = connect(redisPort, "127.0.0.1");
    let buffer = Buffer.alloc(0);
    socket.on("connect", () => socket.write(respEncode(args)));
    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      const parsed = parseReply(buffer);
      if (!parsed) return;
      socket.end();
      if (parsed.error) reject(new Error(parsed.error));
      else resolve(parsed.value);
    });
    socket.on("error", reject);
  });
}

function startRestServer() {
  return new Promise((resolve) => {
    const srv = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const command = JSON.parse(body);
          if (!Array.isArray(command) || command.length === 0) throw new Error("invalid command");
          const result = await redisCommand(command.map(String));
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ result }));
        } catch (error) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: String(error?.message ?? error) }));
        }
      });
    });
    srv.listen(0, "127.0.0.1", () => {
      restUrl = `http://127.0.0.1:${srv.address().port}`;
      resolve(srv);
    });
  });
}

beforeAll(async () => {
  await exec("docker", [
    "run", "--rm", "-d", "--name", container, "-p", "127.0.0.1::6379", "redis:7-alpine",
  ]);
  const { stdout } = await exec("docker", ["port", container, "6379"]);
  const match = /:(\d+)\s*$/.exec(stdout.trim());
  redisPort = Number(match?.[1]);
  for (let i = 0; i < 50; i += 1) {
    try {
      if ((await redisCommand(["PING"])) === "PONG") break;
    } catch {
      /* retry */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  server = await startRestServer();
  process.env.UPSTASH_REDIS_REST_URL = restUrl;
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  process.env.IP_QUOTA_ENABLED = "true";
  process.env.MJ_IP_QUOTA_SECRET = "synthetic-test-secret";
  process.env.MJ_IP_QUOTA_VERSION = "v1";
  process.env.IP_QUOTA_WINDOW_SEC = "600";
  process.env.IP_QUOTA_MAX_PER_WINDOW = "30";
  process.env.IP_QUOTA_DAILY_MAX = "300";
  process.env.JOB_SOURCE_THEIRSTACK_ENABLED = "true";
  process.env.THEIRSTACK_API_KEY = "synthetic-key";
  process.env.THEIRSTACK_MONTHLY_MAX_CREDITS = "200";

  realFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith(restUrl)) return realFetch(url, options);
    providerCalls += 1;
    return new Response(
      JSON.stringify({
        data: [
          {
            id: 1,
            job_title: "Cloud Engineer",
            company: "Synthetic",
            location: "Berlin",
            description: "AWS Terraform",
            date_posted: "2026-10-01",
            remote: false,
            technology_slugs: ["aws"],
            url: "https://example.invalid/job",
          },
        ],
      }),
      { status: 200 }
    );
  };

  source = await import("../../api/_lib/sources/theirstack.mjs");
}, 60000);

afterAll(async () => {
  globalThis.fetch = realFetch;
  await new Promise((resolve) => server.close(resolve));
  try {
    await exec("docker", ["rm", "-f", container]);
  } catch {
    /* removed */
  }
  delete process.env.IP_QUOTA_ENABLED;
});

function identity(scope) {
  return { sessionId: "synthetic-session", ip: "203.0.113.7", ipScope: scope };
}

describeDocker("JM-COOKIELESS-QUOTA-02B-02B-VERIFICATION-02: REST + parallel", () => {
  it("ten identical requests cause one paid call and one IP/budget charge", async () => {
    const { deriveIpScope } = await import("../../api/_lib/ip.mjs");
    const scope = deriveIpScope("203.0.113.7", process.env);
    providerCalls = 0;
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        source.fetchJobs({ skills: "aws", targetRoles: [], city: "", identity: identity(scope) })
      )
    );
    expect(providerCalls).toBe(1);
    expect(results.every((result) => result.jobs.length === 1)).toBe(true);

    const month = new Date().toISOString().slice(0, 7);
    expect(Number(await redisCommand(["GET", `mj-usage:theirstack:credits:${month}`]))).toBe(1);
    const windowKeys = await redisCommand(["KEYS", "mj-quota:ip:v1:theirstack:w:*"]);
    expect(windowKeys).toHaveLength(1);
    expect(Number(await redisCommand(["GET", windowKeys[0]]))).toBe(1);
  }, 60000);

  it("different queries use separate locks and both call the provider", async () => {
    const { deriveIpScope } = await import("../../api/_lib/ip.mjs");
    const scope = deriveIpScope("203.0.113.8", process.env);
    providerCalls = 0;
    await Promise.all([
      source.fetchJobs({ skills: "python", targetRoles: [], city: "", identity: identity(scope) }),
      source.fetchJobs({ skills: "rust", targetRoles: [], city: "", identity: identity(scope) }),
    ]);
    expect(providerCalls).toBe(2);
  });

  it("blocks a paid call when the IP window limit is reached", async () => {
    const { deriveIpScope } = await import("../../api/_lib/ip.mjs");
    const scope = deriveIpScope("203.0.113.10", process.env);
    process.env.IP_QUOTA_MAX_PER_WINDOW = "1";
    providerCalls = 0;
    await source.fetchJobs({ skills: "scala", targetRoles: [], city: "", identity: identity(scope) });
    const result = await source.fetchJobs({
      skills: "kotlin",
      targetRoles: [],
      city: "",
      identity: identity(scope),
    });
    expect(result.meta.reason).toBe("limit_reached");
    expect(providerCalls).toBe(1);
    process.env.IP_QUOTA_MAX_PER_WINDOW = "30";
  });

  it("blocks a paid call when the global credit budget is reached", async () => {
    const { deriveIpScope } = await import("../../api/_lib/ip.mjs");
    const scope = deriveIpScope("203.0.113.11", process.env);
    const month = new Date().toISOString().slice(0, 7);
    process.env.THEIRSTACK_MONTHLY_MAX_CREDITS = "1";
    await redisCommand(["SET", `mj-usage:theirstack:credits:${month}`, "1"]);
    providerCalls = 0;
    const result = await source.fetchJobs({
      skills: "elixir",
      targetRoles: [],
      city: "",
      identity: identity(scope),
    });
    expect(result.meta.reason).toBe("limit_reached");
    expect(providerCalls).toBe(0);
    process.env.THEIRSTACK_MONTHLY_MAX_CREDITS = "200";
    await redisCommand(["DEL", `mj-usage:theirstack:credits:${month}`]);
  });

  it("a cache hit does not call the provider", async () => {
    const { deriveIpScope } = await import("../../api/_lib/ip.mjs");
    const scope = deriveIpScope("203.0.113.9", process.env);
    providerCalls = 0;
    await source.fetchJobs({ skills: "aws", targetRoles: [], city: "", identity: identity(scope) });
    const first = providerCalls;
    await source.fetchJobs({ skills: "aws", targetRoles: [], city: "", identity: identity(scope) });
    expect(providerCalls).toBe(first);
  });

  it("fails closed on Redis outage without a provider call", async () => {
    const { deriveIpScope } = await import("../../api/_lib/ip.mjs");
    const scope = deriveIpScope("203.0.113.12", process.env);
    await exec("docker", ["stop", container]);
    providerCalls = 0;
    const result = await source.fetchJobs({
      skills: "haskell",
      targetRoles: [],
      city: "",
      identity: identity(scope),
    });
    expect(result.meta.reason).toBe("quota_unavailable");
    expect(providerCalls).toBe(0);
  }, 15000);
});
