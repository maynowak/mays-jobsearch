import { describe, expect, it } from "vitest";
import { diffText } from "./textDiff";

describe("LETTER-REVISION-01C textDiff", () => {
  it("marks unchanged, removed and added words", () => {
    const result = diffText("Hello old world.", "Hello new world.");
    expect(result.kept).toBe(2);
    expect(result.removed).toBe(1);
    expect(result.added).toBe(1);
    expect(result.changeGroups).toBe(1);
    expect(result.segments.map((segment) => segment.type)).toContain("removed");
    expect(result.segments.map((segment) => segment.type)).toContain("added");
    expect(
      result.segments
        .filter((segment) => segment.type !== "removed")
        .map((segment) => segment.text)
        .join("")
    ).toBe("Hello new world.");
  });

  it("handles identical text without change groups", () => {
    const result = diffText("Same text", "Same text");
    expect(result.segments.every((segment) => segment.type === "equal")).toBe(true);
    expect(result.segments.map((segment) => segment.text).join("")).toBe("Same text");
    expect(result).toMatchObject({ kept: 2, added: 0, removed: 0, changeGroups: 0 });
  });

  it("handles empty and completely replaced text", () => {
    expect(diffText("", "").segments).toEqual([]);
    const result = diffText("Old letter", "Completely new letter");
    expect(result.segments.some((segment) => segment.type === "removed")).toBe(true);
    expect(result.segments.some((segment) => segment.type === "added")).toBe(true);
  });

  it("preserves line breaks and special characters", () => {
    const result = diffText("Hello\n\nold & <tag>", "Hello\n\nnew & <tag>");
    expect(
      result.segments
        .filter((segment) => segment.type !== "removed")
        .map((segment) => segment.text)
        .join("")
    ).toBe("Hello\n\nnew & <tag>");
    expect(result.kept).toBeGreaterThan(0);
  });
});
