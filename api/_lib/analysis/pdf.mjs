import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { buildPdfDocument } from "./cvParser.mjs";

/**
 * Server-side PDF text extraction. This is the extraction counterpart to the
 * browser `src/lib/pdf.ts`; the mapping itself remains the generated parser
 * from the existing CV builder source.
 */
export async function extractPdfDocument(buffer, { maxPages = 40 } = {}) {
  const task = getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  });
  const pdf = await task.promise;
  if (pdf.numPages > maxPages) {
    void task.destroy();
    const error = new Error("pdf_too_many_pages");
    error.code = "pdf_too_many_pages";
    throw error;
  }
  try {
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      let pageText = "";
      let currentLine = "";
      let lastHeight;
      let order = 0;
      const lines = [];
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
