import { describe, expect, it } from "vitest";
import { rootComponentFor } from "./rootRoute";

describe("rootRoute (LANDINGPAGE-SWAP)", () => {
  it("root path renders LandingPage2", () => {
    expect(rootComponentFor("/")).toBe("landing2");
  });

  it("landingspage2, top and impressum render App", () => {
    expect(rootComponentFor("/landingspage2")).toBe("app");
    expect(rootComponentFor("/top")).toBe("app");
    expect(rootComponentFor("/impressum")).toBe("app");
    expect(rootComponentFor("/anything-else")).toBe("app");
  });
});
