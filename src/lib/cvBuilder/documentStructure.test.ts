import { describe, expect, it } from "vitest";
import { buildPdfDocument, normalizePdfDocument, type PdfSourcePage } from "./documentStructure";

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


function fourPageDocument(): PdfSourcePage[] {
  const header = (page: number) => `MAY MUSTERMANN | ATS-PROFIL | 13.10.2026 Seite ${page}`;
  const footer = "Vertraulich – nur für Bewerbungszwecke";
  const pages = [
    [
      header(1),
      "PROFIL",
      "Architekt und Entwickler",
      "ZIELPOSITIONEN",
      "Cloud Architect",
      "KERNKOMPETENZEN – ATS-SUCHBEGRIFFE",
      "AWS, Terraform, TypeScript",
      footer,
    ],
    [
      header(2),
      "AKTUELLE ARCHITEKTUR- UND SOFTWAREPROJEKTE",
      "2026 – Projekt A",
      "Projektbeschreibung",
      "AWS QA LABS – PRAXISORIENTIERTE CLOUD-QUALIFIZIERUNG (2026)",
      "Praktische Übungen",
      footer,
    ],
    [
      header(3),
      "WEITERBILDUNG & ZERTIFIKATSSTATUS",
      "Zertifizierungsziel AWS",
      "BERUFLICHER WERDEGANG – LANGE TIMELINE",
      "2020–2026 | Architekt | Beispiel GmbH",
      "BERUFLICHER WERDEGANG – FORTSETZUNG",
      "2012–2020 | Entwickler | Beispiel AG",
      footer,
    ],
    [
      header(4),
      "AUSBILDUNG, SPRACHEN & WEITERE QUALIFIKATIONEN",
      "M.Sc. Informatik",
      "Deutsch (Muttersprache)",
      "ATS- UND VERÖFFENTLICHUNGSHINWEISE",
      "Dieses Dokument ist ein Bewerbungsprofil.",
      footer,
    ],
  ];
  return pages.map((lines, index) => ({
    page: index + 1,
    text: lines.join("\n"),
    lines: lines.map((text, order) => ({ text, order, fontSize: text === lines[0] ? 18 : 10 })),
  }));
}

describe("normalizePdfDocument", () => {
  it("removes running headers, footers and page numbers but keeps continued sections", () => {
    const normalized = normalizePdfDocument(buildPdfDocument(fourPageDocument()));
    const texts = normalized.lines.map((line) => line.block.text);

    expect(texts).not.toContain("MAY MUSTERMANN | ATS-PROFIL | 13.10.2026 Seite 1");
    expect(texts).not.toContain("Vertraulich – nur für Bewerbungszwecke");
    expect(texts.filter((text) => /^Seite \d+$/.test(text))).toHaveLength(0);
    expect(texts).toContain("BERUFLICHER WERDEGANG – FORTSETZUNG");
    expect(texts).toContain("AUSBILDUNG, SPRACHEN & WEITERE QUALIFIKATIONEN");
    expect(normalized.lines.find((line) => line.block.text === "BERUFLICHER WERDEGANG – FORTSETZUNG")?.kind).toBe("heading");
    expect(normalized.ignored.some((entry) => entry.reason === "page-header")).toBe(true);
    expect(normalized.ignored.some((entry) => entry.reason === "page-footer")).toBe(true);
  });

  it("does not lose any non-header, non-footer block", () => {
    const source = buildPdfDocument(fourPageDocument());
    const normalized = normalizePdfDocument(source);
    const accounted = new Set([
      ...normalized.lines.map((line) => line.block.order),
      ...normalized.ignored.map((entry) => entry.block.order),
    ]);
    expect(accounted.size).toBe(source.blocks.length);
    expect(normalized.lines.length + normalized.ignored.length).toBe(source.blocks.length);
  });

  it("keeps page-number-like dates out of the ignored set when they are content", () => {
    const normalized = normalizePdfDocument(
      buildPdfDocument([
        {
          page: 1,
          text: "2026\nProjekt",
          lines: [
            { text: "2026", order: 0 },
            { text: "Projekt", order: 1 },
          ],
        },
      ])
    );
    expect(normalized.ignored).toEqual([]);
    expect(normalized.lines.map((line) => line.block.text)).toEqual(["2026", "Projekt"]);
  });
});
