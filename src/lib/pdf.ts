import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  buildPdfDocument,
  type PdfDocumentStructure,
  type PdfSourceLine,
  type PdfSourcePage,
} from "./cvBuilder/documentStructure";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function extractPdfDocument(file: File): Promise<PdfDocumentStructure> {
  const buffer = await file.arrayBuffer();
  const task = getDocument({ data: buffer });
  const pdf = await task.promise;
  try {
    const pages: PdfSourcePage[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      let pageText = "";
      let currentLine = "";
      let lastHeight: number | undefined;
      let order = 0;
      const lines: PdfSourceLine[] = [];
      for (const item of content.items) {
        if (!("str" in item)) continue;
        pageText += item.str;
        pageText += item.hasEOL ? "\n" : " ";
        currentLine += item.str;
        lastHeight = Number.isFinite(item.height) ? item.height : undefined;
        if (item.hasEOL) {
          if (currentLine.trim()) {
            lines.push({
              text: currentLine.trim(),
              order: order++,
              ...(lastHeight ? { fontSize: lastHeight } : {}),
            });
          }
          currentLine = "";
        } else {
          currentLine += " ";
        }
      }
      if (currentLine.trim()) {
        lines.push({
          text: currentLine.trim(),
          order: order++,
          ...(lastHeight ? { fontSize: lastHeight } : {}),
        });
      }
      pages.push({ page: pageNumber, text: pageText.trim(), lines });
    }
    return buildPdfDocument(pages);
  } finally {
    void task.destroy();
  }
}

export async function extractPdfText(file: File): Promise<string> {
  const document = await extractPdfDocument(file);
  return document.text;
}
