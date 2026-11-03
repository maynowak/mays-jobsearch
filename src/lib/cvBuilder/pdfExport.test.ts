import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  createCvBuilderPdf,
  cvBuilderFileName,
} from "./pdfExport";
import { createEmptyCvBuilderDraft, type CvBuilderDraftV1 } from "./contractTypes";

async function fontBytes() {
  const [regular, bold, serifRegular, serifBold] = await Promise.all([
    readFile(resolve("src/assets/fonts/DejaVuSans.ttf")),
    readFile(resolve("src/assets/fonts/DejaVuSans-Bold.ttf")),
    readFile(resolve("src/assets/fonts/DejaVuSerif.ttf")),
    readFile(resolve("src/assets/fonts/DejaVuSerif-Bold.ttf")),
  ]);
  return {
    regular: new Uint8Array(regular),
    bold: new Uint8Array(bold),
    serifRegular: new Uint8Array(serifRegular),
    serifBold: new Uint8Array(serifBold),
  };
}

function richDraft(): CvBuilderDraftV1 {
  const draft = createEmptyCvBuilderDraft();
  draft.personal = {
    fullName: "Zoë Beispiel-Ćurić",
    email: "zoe@example.invalid",
    phone: "+49 30 123456",
    location: "Berlin",
  };
  draft.profile = {
    headline: "Senior Frontend Entwicklerin",
    summary: "Barrierefreie React-Anwendungen, Designsysteme und Cloud-Architektur.",
  };
  draft.experience = [{
    id: "exp-1",
    employer: "Beispiel GmbH",
    position: "Senior Frontend Entwicklerin",
    startMonth: "2019-03",
    current: true,
    description: "React, TypeScript und Designsysteme. ".repeat(130),
  }];
  draft.education = [{
    id: "edu-1",
    institution: "Beispiel-Universität",
    degree: "B.Sc. Informatik",
    startMonth: "2013-10",
    endMonth: "2017-09",
    current: false,
  }];
  draft.skills = ["React", "TypeScript", "Cloud Architecture"];
  draft.projects = [{
    id: "project-1",
    name: "Job Matcher",
    technologies: ["React", "Node.js"],
    description: "Strukturierte Jobsuche mit ATS-Unterstützung.",
  }];
  draft.certificates = [{
    id: "cert-1",
    name: "AWS Cloud Practitioner",
    issuer: "Amazon",
    date: "2023-05",
  }];
  draft.languages = [{ id: "lang-1", language: "Deutsch", level: "native" }];
  draft.links = [{
    id: "link-1",
    kind: "portfolio",
    label: "Portfolio",
    url: "https://example.invalid/portfolio",
  }];
  return draft;
}

describe("CV-BUILDER-01C PDF export", () => {
  it("creates a real multi-page PDF for a long CV", async () => {
    const bytes = await createCvBuilderPdf(richDraft(), "classic", {
      fontBytes: await fontBytes(),
      language: "de",
    });
    expect(Buffer.from(bytes).subarray(0, 4).toString()).toBe("%PDF");
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBeGreaterThan(1);
    expect(document.getTitle()).toContain("Zoë Beispiel-Ćurić");
  });

  it("creates one PDF per template without changing the draft", async () => {
    const draft = richDraft();
    const snapshot = JSON.stringify(draft);
    const fonts = await fontBytes();
    for (const template of ["classic", "modern", "compact"] as const) {
      const bytes = await createCvBuilderPdf(draft, template, { fontBytes: fonts, language: "en" });
      const document = await PDFDocument.load(bytes);
      expect(document.getPageCount()).toBeGreaterThan(0);
    }
    expect(JSON.stringify(draft)).toBe(snapshot);
  });

  it("keeps one-, two- and three-page CVs inside A4 pages", async () => {
    const fonts = await fontBytes();
    const shortDraft = richDraft();
    shortDraft.experience = [{
      id: "exp-short",
      employer: "Beispiel GmbH",
      position: "Frontend Entwicklerin",
      startMonth: "2019-03",
      current: true,
      description: "React und TypeScript.",
    }];
    shortDraft.projects = [];
    shortDraft.certificates = [];
    shortDraft.languages = [];
    shortDraft.links = [];
    shortDraft.profile.summary = "Barrierefreie React-Anwendungen und Designsysteme.";

    const onePage = await createCvBuilderPdf(shortDraft, "classic", { fontBytes: fonts, language: "de" });
    expect((await PDFDocument.load(onePage)).getPageCount()).toBe(1);

    const twoPageDraft = {
      ...shortDraft,
      experience: shortDraft.experience.map((entry) => ({
        ...entry,
        description: "React, TypeScript und Designsysteme. ".repeat(100),
      })),
    };
    const twoPages = await createCvBuilderPdf(twoPageDraft, "classic", { fontBytes: fonts, language: "de" });
    expect((await PDFDocument.load(twoPages)).getPageCount()).toBe(2);

    const threePageDraft = {
      ...twoPageDraft,
      experience: Array.from({ length: 2 }, (_, index) => ({
        ...twoPageDraft.experience[0],
        id: `exp-${index}`,
        employer: `Beispiel GmbH ${index}`,
        position: `Frontend Entwicklerin ${index}`,
      })),
    };
    const threePages = await createCvBuilderPdf(threePageDraft, "classic", { fontBytes: fonts, language: "de" });
    expect((await PDFDocument.load(threePages)).getPageCount()).toBe(3);
  });

  it("rejects invalid and empty drafts", async () => {
    await expect(createCvBuilderPdf(createEmptyCvBuilderDraft(), "classic", {
      fontBytes: await fontBytes(),
    })).rejects.toMatchObject({ code: "empty" });

    const invalid = richDraft();
    invalid.personal.email = "invalid";
    await expect(createCvBuilderPdf(invalid, "modern", {
      fontBytes: await fontBytes(),
    })).rejects.toMatchObject({ code: "validation" });
  });

  it("builds a safe file name from the name and avoids unsafe characters", () => {
    expect(cvBuilderFileName(createEmptyCvBuilderDraft())).toBe("Lebenslauf.pdf");
    const draft = createEmptyCvBuilderDraft();
    draft.personal.fullName = '../Zoë: Beispiel?';
    expect(cvBuilderFileName(draft)).toBe("Lebenslauf-Zoe-Beispiel.pdf");
  });
});
