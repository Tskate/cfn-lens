import { describe, expect, it } from 'vitest';
import type { ParsedNode, YAMLMap } from 'yaml';

import { runReader } from '../../fixtures/runReader.ts';
import type { ParserContext } from './ParserContext.ts';
import { readBoolean, readNumber, readStringList } from './readScalars.ts';
import { readString } from './readString.ts';

// Runs a node-level reader on the value of `Key` in a snippet.
const readKey = <T>(read: (node: ParsedNode, label: string, ctx: ParserContext) => T, source: string) =>
  runReader((root: YAMLMap.Parsed, ctx: ParserContext) => read(root.get('Key', true) as ParsedNode, 'Key', ctx), source);

describe('readString with allowScalars', () => {
  it.each(['8080', '2010.10', 'true'])('returns the unquoted %s as text without a warning', (text) => {
    const { value, diagnostics } = readKey((node, label, ctx) => readString(node, label, ctx, { allowScalars: true }), `Key: ${text}`);

    expect(value).toMatchObject({ value: text, reported: false });
    expect(diagnostics).toEqual([]);
  });
});

describe('readNumber', () => {
  it.each([
    ['a number', `Key: 64`, 64],
    ['a numeric string (common in JSON)', `Key: '64'`, 64],
    ['a decimal', `Key: 0.5`, 0.5],
  ])('reads %s', (_label, source, expected) => {
    const { value, diagnostics } = readKey(readNumber, source);

    expect(value).toBe(expected);
    expect(diagnostics).toEqual([]);
  });

  it('returns undefined for an empty value', () => {
    expect(readKey(readNumber, `Key:`)).toEqual({ value: undefined, diagnostics: [] });
  });

  it.each([`Key: abc`, `Key: ''`, `Key: [1]`, `Key: true`])('reports an error for %s', (source) => {
    const { value, diagnostics } = readKey(readNumber, source);

    expect(value).toBeUndefined();
    expect(diagnostics).toEqual([expect.objectContaining({ severity: 'error', code: 'expected-number' })]);
  });
});

describe('readBoolean', () => {
  it.each([
    [`Key: true`, true],
    [`Key: false`, false],
    [`Key: 'true'`, true],
    [`Key: 'FALSE'`, false],
  ])('reads %s', (source, expected) => {
    const { value, diagnostics } = readKey(readBoolean, source);

    expect(value).toBe(expected);
    expect(diagnostics).toEqual([]);
  });

  it('returns undefined for an empty value', () => {
    expect(readKey(readBoolean, `Key:`)).toEqual({ value: undefined, diagnostics: [] });
  });

  it.each([`Key: yes`, `Key: 1`, `Key: [true]`])('reports an error for %s', (source) => {
    const { value, diagnostics } = readKey(readBoolean, source);

    expect(value).toBeUndefined();
    expect(diagnostics).toEqual([expect.objectContaining({ severity: 'error', code: 'expected-boolean' })]);
  });
});

describe('readStringList', () => {
  it('reads a list, keeping order', () => {
    const { value, diagnostics } = readKey(readStringList, `Key: [b, a]`);

    expect(value).toEqual(['b', 'a']);
    expect(diagnostics).toEqual([]);
  });

  it('passes options to each item', () => {
    const { value, diagnostics } = readKey((node, label, ctx) => readStringList(node, label, ctx, { allowScalars: true }), `Key: [1, 2]`);

    expect(value).toEqual(['1', '2']);
    expect(diagnostics).toEqual([]);
  });

  it('keeps valid items and reports each invalid one', () => {
    const { value, diagnostics } = readKey(readStringList, `Key: [a, [b], c]`);

    expect(value).toEqual(['a', 'c']);
    expect(diagnostics.map((d) => d.code)).toEqual(['expected-string']);
  });

  it('returns undefined for an empty value', () => {
    expect(readKey(readStringList, `Key:`)).toEqual({ value: undefined, diagnostics: [] });
  });

  it('reports an error when the value is not a list', () => {
    const { value, diagnostics } = readKey(readStringList, `Key: a`);

    expect(value).toBeUndefined();
    expect(diagnostics).toEqual([expect.objectContaining({ severity: 'error', code: 'expected-list' })]);
  });
});
