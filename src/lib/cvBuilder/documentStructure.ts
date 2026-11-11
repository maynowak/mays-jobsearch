export interface PdfSourceLine {
  text: string;
  order: number;
  fontSize?: number;
}

export interface PdfSourcePage {
  page: number;
  text: string;
  lines: PdfSourceLine[];
}

export interface PdfTextBlock {
  page: number;
  order: number;
  text: string;
  lines: string[];
  fontSize?: number;
}

export interface PdfDocumentPage {
  page: number;
  text: string;
  blocks: PdfTextBlock[];
}

export interface PdfDocumentStructure {
  pageCount: number;
  text: string;
  pages: PdfDocumentPage[];
  blocks: PdfTextBlock[];
}

export function buildPdfDocument(pages: PdfSourcePage[]): PdfDocumentStructure {
  let order = 0;
  const documentPages: PdfDocumentPage[] = pages.map((page) => {
    const sourceLines: PdfSourceLine[] = page.lines.length
      ? page.lines
      : page.text
          .split("\n")
          .map((text, index) => ({ text, order: index }))
          .filter((line) => line.text.trim());
    const blocks: PdfTextBlock[] = sourceLines
      .filter((line) => line.text.trim())
      .map((line) => {
        const text = line.text.trim();
        return {
          page: page.page,
          order: order++,
          text,
          lines: [text],
          ...(Number.isFinite(line.fontSize) ? { fontSize: line.fontSize } : {}),
        };
      });
    return {
      page: page.page,
      text: page.text.trim(),
      blocks,
    };
  });
  return {
    pageCount: documentPages.length,
    text: documentPages.map((page) => page.text).join("\n\n").trim(),
    pages: documentPages,
    blocks: documentPages.flatMap((page) => page.blocks),
  };
}
