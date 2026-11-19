// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseCvBuilderImportText as parseFrontend } from "../../src/lib/cvBuilder/pdfImport";
import { parseCvBuilderImportText as parseApi } from "../../api/_lib/analysis/cvParser.mjs";
import { buildPdfDocument as buildFrontendDocument } from "../../src/lib/cvBuilder/documentStructure";
import { buildPdfDocument as buildApiDocument } from "../../api/_lib/analysis/cvParser.mjs";

function normalizeGeneratedIds(value) {
  if (Array.isArray(value)) return value.map(normalizeGeneratedIds);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    key === "id" || key === "itemId" ? "<generated>" : normalizeGeneratedIds(item),
  ]));
}

const sample = [
  "Max Mustermann",
  "E-Mail-Adresse: max@example.com",
  "Telefonnummer: +49 6151 123456",
  "Wohnort: Darmstadt",
  "",
  "PROFIL",
  "Profil: Cloud Engineer",
  "",
  "BERUFSERFAHRUNG",
  "01/2020 - heute | Example GmbH | Senior Cloud Engineer",
  "AWS, Terraform und Kubernetes betrieben.",
  "",
  "AUSBILDUNG",
  "2015 - 2019 | Hochschule Darmstadt | Bachelor of Science Informatik",
  "",
  "KENNTNISSE",
  "Node.js, NodeJS, AWS, AWS, TypeScript",
  "",
  "SPRACHEN",
  "Deutsch: Muttersprache | Englisch: Fließend",
].join("\n");

describe("JM-CV-JOB-PARSER-QUALITY-01 frontend/API parser parity", () => {
  it("uses the same CV parser core in the frontend and the generated API artifact", () => {
    const frontend = normalizeGeneratedIds(parseFrontend(sample));
    const api = normalizeGeneratedIds(parseApi(sample));
    expect(api).toEqual(frontend);
  });

  it("uses the same PDF document builder in both parser paths", () => {
    const pages = [{
      page: 1,
      text: sample,
      lines: sample.split("\n").map((text, order) => ({ text, order })),
    }];
    expect(buildApiDocument(pages)).toEqual(buildFrontendDocument(pages));
  });
});
