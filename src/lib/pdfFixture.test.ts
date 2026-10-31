// @vitest-environment node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const fixture = resolve(process.cwd(), "tests/fixtures/cv/synthetic-cv.pdf");

async function extractFixtureText(): Promise<string> {
  const data = new Uint8Array(await readFile(fixture));
  const task = getDocument({
    data,
    standardFontDataUrl: `${resolve(process.cwd(), "node_modules/pdfjs-dist/standard_fonts")}/`,
  });
  const pdf = await task.promise;
  const chunks: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      chunks.push(
        content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .trim()
      );
    }
  } finally {
    void task.destroy();
  }
  return chunks.join("\n");
}

describe("JM-GUEST-CV-E2E-09: synthetic PDF fixture", () => {
  it("is a text-based PDF whose content is extractable", async () => {
    const text = await extractFixtureText();
    expect(text).toContain("Synthetic Test CV");
    expect(text).toContain("Cloud Engineer");
    expect(text).toContain("Java, AWS, Terraform, Docker");
    expect(text).toContain("Python, Linux, SQL, CI/CD");
    expect(text).toContain("Frankfurt");
  });

  it("contains only synthetic data", async () => {
    const text = await extractFixtureText();
    expect(text).not.toMatch(/@/);
    expect(text).not.toMatch(/\+?\d[\d\s/-]{7,}/);
  });
});
