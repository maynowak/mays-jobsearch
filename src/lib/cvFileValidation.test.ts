import { describe, expect, it } from "vitest";
import {
  MAX_CV_FILE_SIZE_BYTES,
  isPdfFile,
  partitionCvFiles,
  validateCvFile,
} from "./cvFileValidation";

function pdf(name: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type: "application/pdf" });
}

describe("validateCvFile", () => {
  it("rejects 0-byte PDF files as empty", () => {
    expect(validateCvFile(pdf("empty.pdf", 0))).toBe("empty");
  });

  it("accepts small but valid PDF files", () => {
    expect(validateCvFile(pdf("small.pdf", 850))).toBeNull();
    expect(validateCvFile(pdf("tiny.pdf", 1))).toBeNull();
    expect(validateCvFile(pdf("under-50kb.pdf", 25 * 1024))).toBeNull();
  });

  it("keeps the existing size limit", () => {
    expect(validateCvFile(pdf("ok.pdf", MAX_CV_FILE_SIZE_BYTES))).toBeNull();
    expect(validateCvFile(pdf("big.pdf", MAX_CV_FILE_SIZE_BYTES + 1))).toBe("too-large");
  });

  it("keeps the existing PDF type check", () => {
    expect(validateCvFile(new File(["x"], "notes.txt", { type: "text/plain" }))).toBe("not-pdf");
    expect(validateCvFile(new File(["x"], "cv.pdf", { type: "" }))).toBeNull();
  });
});

describe("isPdfFile", () => {
  it("accepts .pdf extension or the pdf mime type", () => {
    expect(isPdfFile(new File(["x"], "cv.PDF", { type: "" }))).toBe(true);
    expect(isPdfFile(new File(["x"], "cv.pdf", { type: "application/pdf" }))).toBe(true);
    expect(isPdfFile(new File(["x"], "cv.pdf", { type: "image/png" }))).toBe(false);
  });
});

describe("partitionCvFiles", () => {
  it("separates accepted and rejected files in a multi upload", () => {
    const good = pdf("good.pdf", 2048);
    const empty = pdf("empty.pdf", 0);
    const tooBig = pdf("big.pdf", MAX_CV_FILE_SIZE_BYTES + 10);
    const notPdf = new File(["x"], "notes.txt", { type: "text/plain" });

    const result = partitionCvFiles([good, empty, tooBig, notPdf]);

    expect(result.accepted).toEqual([good]);
    expect(result.rejected.map((entry) => entry.reason)).toEqual(["empty", "too-large", "not-pdf"]);
    expect(result.rejected.map((entry) => entry.file.name)).toEqual([
      "empty.pdf",
      "big.pdf",
      "notes.txt",
    ]);
  });

  it("accepts an empty multi upload without errors", () => {
    expect(partitionCvFiles([])).toEqual({ accepted: [], rejected: [] });
  });
});
