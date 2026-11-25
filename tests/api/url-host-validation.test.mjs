// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hostnameOf, isHostname } from "../helpers/url.mjs";

describe("test helper - hostname validation", () => {
  it("accepts the exact expected hostname", () => {
    expect(isHostname("https://www.arbeitnow.com/api/job-board-api", "www.arbeitnow.com")).toBe(true);
    expect(isHostname("https://nominatim.openstreetmap.org/search?q=berlin", "nominatim.openstreetmap.org")).toBe(true);
    expect(hostnameOf("https://BOARDS-API.GREENHOUSE.IO/v1/boards")).toBe("boards-api.greenhouse.io");
  });

  it("rejects suffixes appended to the trusted host", () => {
    expect(isHostname("https://www.arbeitnow.com.attacker.test/api", "www.arbeitnow.com")).toBe(false);
    expect(isHostname("https://evil.test/www.arbeitnow.com", "www.arbeitnow.com")).toBe(false);
  });

  it("rejects userinfo and host-confusion URLs", () => {
    expect(isHostname("https://www.arbeitnow.com@evil.test/api", "www.arbeitnow.com")).toBe(false);
    expect(isHostname("https://evil.test/?next=https://www.arbeitnow.com", "www.arbeitnow.com")).toBe(false);
  });

  it("rejects invalid URLs instead of guessing", () => {
    expect(isHostname("not a url", "www.arbeitnow.com")).toBe(false);
    expect(hostnameOf("")).toBe("");
  });
});
