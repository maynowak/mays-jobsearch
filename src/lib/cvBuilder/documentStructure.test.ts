import { describe, expect, it } from "vitest";
import { buildPdfDocument, type PdfSourcePage } from "./documentStructure";

const pages: PdfSourcePage[] = [
  {
    page: 1,
    text: "MAX MUSTERMANN\nPROFIL\nArchitekt",
    lines: [
      { text: "MAX MUSTERMANN", order: 0, fontSize: 18 },
      { text: "PROFIL", order: 1, fontSize: 13 },
      { text: "Architekt", order: 2, fontSize: 10 },
    ],
  },
  {
    page: 2,
    text: "PROJEKTE\nProjekt A",
    lines: [
      { text: "PROJEKTE", order: 0, fontSize: 13 },
      { text: "Projekt A", order: 1, fontSize: 10 },
    ],
  },
];

describe("buildPdfDocument", () => {
  it("assigns every text block to its PDF page and preserves order", () => {
    const document = buildPdfDocument(pages);

    expect(document.pageCount).toBe(2);
    expect(document.text).toBe("MAX MUSTERMANN\nPROFIL\nArchitekt\n\nPROJEKTE\nProjekt A");
    expect(document.blocks).toHaveLength(5);
    expect(document.blocks.map((block) => block.page)).toEqual([1, 1, 1, 2, 2]);
    expect(document.blocks.map((block) => block.order)).toEqual([0, 1, 2, 3, 4]);
    expect(document.blocks.map((block) => block.text)).toEqual([
      "MAX MUSTERMANN",
      "PROFIL",
      "Architekt",
      "PROJEKTE",
      "Projekt A",
    ]);
    expect(document.pages[0].blocks).toHaveLength(3);
    expect(document.pages[1].blocks).toHaveLength(2);
  });

  it("derives blocks from text when a page has no explicit lines", () => {
    const document = buildPdfDocument([{ page: 1, text: "Erste Zeile\n\nZweite Zeile", lines: [] }]);

    expect(document.blocks.map((block) => block.text)).toEqual(["Erste Zeile", "Zweite Zeile"]);
    expect(document.pages[0].blocks.every((block) => block.page === 1)).toBe(true);
  });

  it("keeps an empty document valid and page-numbered", () => {
    const document = buildPdfDocument([{ page: 1, text: "", lines: [] }]);

    expect(document.pageCount).toBe(1);
    expect(document.blocks).toEqual([]);
    expect(document.text).toBe("");
  });
});
