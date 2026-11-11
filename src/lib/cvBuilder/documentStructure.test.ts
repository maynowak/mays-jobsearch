import { describe, expect, it } from "vitest";
import { buildPdfDocument, detectDocumentSections, detectTimelineItems, matchDocumentHeading, normalizePdfDocument, type PdfSourcePage } from "./documentStructure";

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


describe("detectDocumentSections", () => {
  it("keeps composite headings, section boundaries and continued timelines separate", () => {
    const normalized = normalizePdfDocument(buildPdfDocument(fourPageDocument()));
    const sections = detectDocumentSections(normalized);

    expect(sections.map((section) => section.category)).toEqual([
      "profile",
      "target-roles",
      "skills",
      "projects",
      "training",
      "certificates",
      "experience",
      "mixed",
      "document-notes",
    ]);
    const skills = sections.find((section) => section.category === "skills");
    const projects = sections.find((section) => section.category === "projects");
    const experience = sections.find((section) => section.category === "experience");
    const mixed = sections.find((section) => section.category === "mixed");
    expect(skills?.blocks.map((block) => block.text)).toEqual(["AWS, Terraform, TypeScript"]);
    expect(projects?.blocks.map((block) => block.text)).toContain("2026 – Projekt A");
    expect(projects?.blocks.map((block) => block.text)).not.toContain("AWS, Terraform, TypeScript");
    expect(experience?.continued).toBe(true);
    expect(experience?.headingBlocks).toHaveLength(2);
    expect(experience?.pageStart).toBe(3);
    expect(experience?.pageEnd).toBe(3);
    expect(mixed?.categories).toEqual(["education", "languages"]);
  });

  it("does not attach an unknown heading or its content to the previous section", () => {
    const normalized = normalizePdfDocument(
      buildPdfDocument([
        {
          page: 1,
          text: "PROFIL\nKurzprofil\nFACHLICHE SCHWERPUNKTE\nCloud Architektur",
          lines: [
            { text: "PROFIL", order: 0 },
            { text: "Kurzprofil", order: 1 },
            { text: "FACHLICHE SCHWERPUNKTE", order: 2 },
            { text: "Cloud Architektur", order: 3 },
          ],
        },
      ])
    );
    const sections = detectDocumentSections(normalized);

    expect(sections.map((section) => section.category)).toEqual(["profile", "unknown"]);
    expect(sections[0].blocks.map((block) => block.text)).toEqual(["Kurzprofil"]);
    expect(sections[1].blocks.map((block) => block.text)).toEqual(["Cloud Architektur"]);
    expect(sections[1].uncertain).toBe(true);
  });

  it("does not treat dated project lines as headings", () => {
    const normalized = normalizePdfDocument(
      buildPdfDocument([
        {
          page: 1,
          text: "PROJEKTE\n2026 – Projekt A\nBeschreibung",
          lines: [
            { text: "PROJEKTE", order: 0 },
            { text: "2026 – Projekt A", order: 1 },
            { text: "Beschreibung", order: 2 },
          ],
        },
      ])
    );
    const sections = detectDocumentSections(normalized);
    expect(sections).toHaveLength(1);
    expect(sections[0].blocks.map((block) => block.text)).toEqual(["2026 – Projekt A", "Beschreibung"]);
  });
});


describe("continued headings and timeline structure", () => {
  it("recognizes English continued headings without treating them as a position", () => {
    expect(matchDocumentHeading("PROFESSIONAL EXPERIENCE (CONTINUED)")).toMatchObject({
      category: "experience",
      continued: true,
    });
  });

  it("separates freelance projects, training, qualifications and overlapping employment", () => {
    const items = detectTimelineItems([
      { page: 1, order: 0, text: "2012–10/2019 | Freelance Software Developer | Enterprise Projects", lines: [] },
      { page: 2, order: 1, text: "• Projekt A", lines: [] },
      { page: 2, order: 2, text: "03/2026–10/2026 | Project Lead | Cloud Project", lines: [] },
      { page: 2, order: 3, text: "2022 | Zertifizierungsziel AWS", lines: [] },
      { page: 3, order: 4, text: "2020–2022 | Senior Architect | Example GmbH", lines: [] },
      { page: 3, order: 5, text: "2020–2023 | Parallel Role | Example AG", lines: [] },
    ]);

    expect(items.map((item) => item.kind)).toEqual([
      "freelance",
      "project",
      "training",
      "employment",
      "employment",
    ]);
    expect(items[1].parentId).toBe(items[0].id);
    expect(items[0].dateText).toBe("2012–10/2019");
    expect(items[0].uncertainDate).toBe(true);
    expect(items[2].dateText).toBe("2022");
    expect(items[2].uncertainDate).toBe(true);
    expect(items[3].dateText).toBe("2020–2022");
    expect(items[4].dateText).toBe("2020–2023");
    expect(items[3].lines[0]).toContain("2020–2022");
    expect(items[4].lines[0]).toContain("2020–2023");
  });
});


describe("normalizePdfDocument repeated unknown headings", () => {
  it("keeps a repeated top heading when it is not a running page header", () => {
    const normalized = normalizePdfDocument(
      buildPdfDocument([
        {
          page: 1,
          text: "FACHLICHE SCHWERPUNKTE\nCloud",
          lines: [
            { text: "FACHLICHE SCHWERPUNKTE", order: 0 },
            { text: "Cloud", order: 1 },
          ],
        },
        {
          page: 2,
          text: "FACHLICHE SCHWERPUNKTE\nSecurity",
          lines: [
            { text: "FACHLICHE SCHWERPUNKTE", order: 0 },
            { text: "Security", order: 1 },
          ],
        },
      ])
    );
    expect(normalized.lines.filter((line) => line.block.text === "FACHLICHE SCHWERPUNKTE")).toHaveLength(2);
  });
});

describe("CV-BUILDER-REAL-WORLD-QA-02E skill headings", () => {
  it("recognises architecture, cloud and technologies headings as skills", () => {
    for (const heading of ["ARCHITECTURE & CLOUD", "SOFTWARE ARCHITECTURE", "TECHNICAL SKILLS", "TECHNOLOGIES"]) {
      expect(matchDocumentHeading(heading)).toMatchObject({ category: "skills", categories: ["skills"] });
    }
    expect(matchDocumentHeading("Architecture & Cloud")).toMatchObject({ category: "skills" });
  });

  it("keeps architecture-and-projects headings as projects", () => {
    expect(matchDocumentHeading("AKTUELLE ARCHITEKTUR- UND SOFTWAREPROJEKTE")).toMatchObject({
      category: "projects",
      categories: ["projects"],
    });
  });
});

describe("CV-BUILDER-REAL-WORLD-QA-02E training separation", () => {
  it("starts an undated training/lab block instead of appending it to employment", () => {
    const items = detectTimelineItems([
      { page: 1, order: 0, text: "2020–2024 | Solution Architect | Acme GmbH", lines: [] },
      { page: 1, order: 1, text: "Entwicklung von Cloud-Plattformen.", lines: [] },
      { page: 1, order: 2, text: "AWS QA LAB – in progress", lines: [] },
      { page: 1, order: 3, text: "Praktische Cloud-Übungen.", lines: [] },
    ]);
    expect(items.map((item) => item.kind)).toEqual(["employment", "training"]);
    expect(items[1].lines).toEqual(["AWS QA LAB – in progress", "Praktische Cloud-Übungen."]);
  });
});
