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

/** The lines of a range that may be absent (nothing selected). */
export function optionalLineSpan(range: SourceRange | undefined): LineSpan | undefined {
  if (!range) {
    return;
  }

  return lineSpan(range);
}

/** Rebuilds a span from its two numbers, which effects depend on instead of a fresh object. */
export function spanFrom(first: number | undefined, last: number | undefined): LineSpan | undefined {
  if (first === undefined || last === undefined) {
    return;
  }

  return { first, last };
}

/** "Lines 85–99", or "Line 7" for a single line. */
export function formatLineSpan({ first, last }: LineSpan): string {
  if (first === last) {
    return `Line ${first}`;
  }

  return `Lines ${first}–${last}`;
}
