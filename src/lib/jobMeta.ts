export function toEpochMs(value: number | string | undefined | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < 1e11 ? n * 1000 : n;
}

export function formatJobDate(
  value: number | string | undefined | null,
  locale: string
): string | null {
  const ms = toEpochMs(value);
  if (ms == null) return null;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  } catch {
    return null;
  }
}

export const JOB_TYPE_LABEL_KEYS: Record<string, string> = {
  full_time: "jobtype.fullTime",
  part_time: "jobtype.partTime",
  remote: "jobtype.remote",
  freelance: "jobtype.freelance",
  internship: "jobtype.internship",
  contract: "jobtype.contract",
};

export const CONTRACT_TYPE_LABEL_KEYS: Record<string, string> = {
  UNBEFRISTET: "contract.permanent",
  BEFRISTET: "contract.fixedTerm",
};

export function prettifyCode(code: string): string {
  return code
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function jobTypeLabelKey(code: string): string | null {
  return JOB_TYPE_LABEL_KEYS[code] ?? null;
}

export function contractTypeLabelKey(value: string | undefined): string | null {
  if (!value) return null;
  return CONTRACT_TYPE_LABEL_KEYS[value.trim().toUpperCase()] ?? null;
}

export function descriptionPreview(
  description: string | undefined,
  previewLength: number,
  expanded: boolean
): string | null {
  if (!description) return null;
  const text = String(description).replace(/\s+/g, " ").trim();
  if (!text) return null;
  const long = text.length > previewLength;
  return !expanded && long ? text.slice(0, previewLength).trimEnd() + "…" : text;
}
