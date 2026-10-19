import type { SourceRange } from '@cfn-lens/core';

export type LineSpan = { first: number; last: number };

/** The 1-based lines a range covers. A YAML block ends at column 1 of the next line, which isn't part of it. */
export function lineSpan({ start, end }: SourceRange): LineSpan {
  const endsAtLineStart = end.column === 1 && end.line > start.line;

  if (endsAtLineStart) {
    return { first: start.line, last: end.line - 1 };
  }

  return { first: start.line, last: end.line };
}

/** "Lines 85–99", or "Line 7" for a single line. */
export function formatLineSpan({ first, last }: LineSpan): string {
  if (first === last) {
    return `Line ${first}`;
  }

  return `Lines ${first}–${last}`;
}
