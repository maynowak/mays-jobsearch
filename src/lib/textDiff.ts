export type DiffSegmentType = "equal" | "removed" | "added";

export interface DiffSegment {
  type: DiffSegmentType;
  text: string;
}

export interface TextDiffResult {
  segments: DiffSegment[];
  kept: number;
  added: number;
  removed: number;
  changeGroups: number;
  truncated: boolean;
}

const MAX_DIFF_CELLS = 2_000_000;

function tokenize(text: string): string[] {
  return text.match(/\S+\s*/g) ?? (text ? [text] : []);
}

function countWords(tokens: string[]): number {
  return tokens.filter((token) => token.trim().length > 0).length;
}

/**
 * Small dependency-free word-level diff for letter previews. It keeps the
 * original and proposed texts complete, while marking removed/added tokens.
 */
export function diffText(original: string, proposed: string): TextDiffResult {
  const left = tokenize(original);
  const right = tokenize(proposed);

  if (left.length * right.length > MAX_DIFF_CELLS) {
    const removed = countWords(left);
    const added = countWords(right);
    return {
      segments: [
        ...(removed ? [{ type: "removed" as const, text: original }] : []),
        ...(added ? [{ type: "added" as const, text: proposed }] : []),
      ],
      kept: 0,
      added,
      removed,
      changeGroups: removed || added ? 1 : 0,
      truncated: true,
    };
  }

  const rows = left.length + 1;
  const columns = right.length + 1;
  const table = Array.from({ length: rows }, () => new Uint32Array(columns));
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < columns; j += 1) {
      table[i][j] =
        left[i - 1] === right[j - 1]
          ? table[i - 1][j - 1] + 1
          : Math.max(table[i - 1][j], table[i][j - 1]);
    }
  }

  const reversed: DiffSegment[] = [];
  let i = left.length;
  let j = right.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && left[i - 1] === right[j - 1]) {
      reversed.push({ type: "equal", text: left[i - 1] });
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
      reversed.push({ type: "added", text: right[j - 1] });
      j -= 1;
    } else {
      reversed.push({ type: "removed", text: left[i - 1] });
      i -= 1;
    }
  }

  const segments = reversed.reverse();
  let kept = 0;
  let added = 0;
  let removed = 0;
  let changeGroups = 0;
  let inChange = false;
  for (const segment of segments) {
    if (segment.type === "equal") {
      kept += countWords([segment.text]);
      inChange = false;
    } else {
      if (segment.type === "added") added += countWords([segment.text]);
      else removed += countWords([segment.text]);
      if (!inChange) changeGroups += 1;
      inChange = true;
    }
  }

  return { segments, kept, added, removed, changeGroups, truncated: false };
}
