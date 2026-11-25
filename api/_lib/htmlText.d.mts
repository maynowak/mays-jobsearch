export interface HtmlToTextOptions {
  blockNewlines?: boolean;
  brNewlines?: boolean;
}

export function decodeHtmlEntities(value: string): string;
export function htmlToText(value: string | null | undefined, options?: HtmlToTextOptions): string;
