import { describe, expect, it } from "vitest";
import { fileSizeLocale, formatFileSize } from "./fileSize";

// CV-FILESIZE-DISPLAY-01: Anzeige der Dateigroesse.
describe("formatFileSize", () => {
  it("shows 0 bytes as 0 B instead of 0.0 MB", () => {
    expect(formatFileSize(0, "de-DE")).toBe("0 B");
    expect(formatFileSize(0, "en-US")).toBe("0 B");
  });

  it("shows small byte values in bytes", () => {
    expect(formatFileSize(850, "de-DE")).toBe("850 B");
    expect(formatFileSize(1, "de-DE")).toBe("1 B");
    expect(formatFileSize(1023, "de-DE")).toBe("1.023 B");
  });

  it("shows kilobyte values with one decimal in the active locale", () => {
    expect(formatFileSize(25_600, "de-DE")).toBe("25,0 KB");
    expect(formatFileSize(25_600, "en-US")).toBe("25.0 KB");
  });

  it("shows 512 KB and 1.5 MB correctly", () => {
    expect(formatFileSize(524_288, "de-DE")).toBe("512,0 KB");
    expect(formatFileSize(1_572_864, "de-DE")).toBe("1,5 MB");
    expect(formatFileSize(1_572_864, "en-US")).toBe("1.5 MB");
  });

  it("promotes a value that would round to 1024 of the previous unit", () => {
    expect(formatFileSize(1_048_575, "de-DE")).toBe("1,0 MB");
  });

  it("never reports small valid PDFs as 0.0 MB", () => {
    for (const bytes of [850, 10_000, 25_600]) {
      expect(formatFileSize(bytes, "de-DE")).not.toContain("0,0 MB");
      expect(formatFileSize(bytes, "de-DE")).not.toContain("0.0 MB");
    }
  });

  it("falls back to 0 B for invalid input", () => {
    expect(formatFileSize(-5, "de-DE")).toBe("0 B");
    expect(formatFileSize(Number.NaN, "de-DE")).toBe("0 B");
    expect(formatFileSize(Number.POSITIVE_INFINITY, "de-DE")).toBe("0 B");
  });
});

describe("fileSizeLocale", () => {
  it("maps the app language to a number locale", () => {
    expect(fileSizeLocale("de")).toBe("de-DE");
    expect(fileSizeLocale("en")).toBe("en-US");
  });
});
