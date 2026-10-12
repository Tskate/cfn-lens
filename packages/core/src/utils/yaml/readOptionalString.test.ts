import { describe, expect, it } from 'vitest';
import type { YAMLMap } from 'yaml';

import { runReader } from '../../fixtures/runReader.ts';
import type { ParserContext } from './ParserContext.ts';
import { readOptionalString } from './readOptionalString.ts';

// Shared rules for every optional string field; field readers test only their own extra rules.
const read = (source: string) => runReader((root: YAMLMap.Parsed, ctx: ParserContext) => readOptionalString(root, 'Key', ctx), source);

describe('readOptionalString', () => {
  it('returns a string value with its node', () => {
    const { value, diagnostics } = read(`Key: hello`);

    expect(value).toMatchObject({ value: 'hello', reported: false, node: { range: [5, 10, 10] } });
    expect(diagnostics).toEqual([]);
  });

  // Unquoted 2010-09-09 is a date in YAML 1.1; the shared YAML setup must keep it a string
  it('keeps an unquoted date-like value as a string', () => {
    const { value, diagnostics } = read(`Key: 2010-09-09`);

    // `reported: false` matters: the source-text fallback would also yield '2010-09-09' for a Date
    expect(value).toMatchObject({ value: '2010-09-09', reported: false });
    expect(diagnostics).toEqual([]);
  });

  // Block scalars: the parsed value, not the raw source
  it.each([
    ['literal |', 'Key: |\n  Line one\n  Line two\n', 'Line one\nLine two\n'],
    ['folded >', 'Key: >\n  One long\n  sentence\n', 'One long sentence\n'],
  ])('reads a %s block', (_label, source, expected) => {
    expect(read(source).value?.value).toBe(expected);
  });

  // Optional in CloudFormation: never a diagnostic
  it.each([
    ['missing', `Other: x`],
    ['empty', `Key:`],
    ['explicit null', `Key: ~`],
  ])('returns undefined without a diagnostic when %s', (_label, source) => {
    const { value, diagnostics } = read(source);

    expect(value).toBeUndefined();
    expect(diagnostics).toEqual([]);
  });

  // Source text, not String(value): `2010.10` parses to the number 2010.1
  it.each(['42', '2010.10', 'true'])('converts the unquoted %s from its source text and warns', (text) => {
    const { value, diagnostics } = read(`Key: ${text}`);

    expect(value).toMatchObject({ value: text, reported: true });
    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: 'warning',
        code: 'string-not-quoted',
        range: expect.objectContaining({ start: { offset: 5, line: 1, column: 6 } }),
      }),
    ]);
  });

  it.each([
    ['a list', `Key: [a, b]`],
    ['a mapping', `Key: { a: b }`],
  ])('returns undefined and reports %s', (_label, source) => {
    const { value, diagnostics } = read(source);

    expect(value).toBeUndefined();
    expect(diagnostics).toEqual([expect.objectContaining({ severity: 'error', code: 'expected-string' })]);
  });
});
