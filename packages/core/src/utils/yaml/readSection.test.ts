import { describe, expect, it } from 'vitest';
import type { YAMLMap } from 'yaml';

import { runReader } from '../../fixtures/runReader.ts';
import type { ParserContext } from './ParserContext.ts';
import { mappingEntry, readSection, type SectionEntry } from './readSection.ts';

// A trivial entry reader for mapping entries: keeps the name and the number of keys.
const readEntry = mappingEntry((entry: SectionEntry<YAMLMap.Parsed>) => ({ name: entry.name, keys: entry.node.items.length }));
const read = (source: string) =>
  runReader((root: YAMLMap.Parsed, ctx: ParserContext) => readSection(root, 'Section', ctx, readEntry), source);

describe('readSection', () => {
  it('reads every entry in source order', () => {
    const { value, diagnostics } = read(`Section:\n  Zeta: { a: 1 }\n  Alpha: { a: 1, b: 2 }`);

    expect([...value.entries()]).toEqual([
      ['Zeta', { name: 'Zeta', keys: 1 }],
      ['Alpha', { name: 'Alpha', keys: 2 }],
    ]);
    expect(diagnostics).toEqual([]);
  });

  it('gives each entry its name range and whole-entry range', () => {
    let captured: SectionEntry | undefined;
    runReader(
      (root: YAMLMap.Parsed, ctx: ParserContext) => readSection(root, 'Section', ctx, (entry) => (captured = entry)),
      `Section:\n  Env:\n    Type: String`,
    );

    expect(captured?.nameRange).toMatchObject({ start: { line: 2, column: 3 }, end: { line: 2, column: 6 } });
    expect(captured?.range).toMatchObject({ start: { line: 2, column: 3 }, end: { line: 3, column: 17 } });
  });

  it('skips entries whose reader returns undefined', () => {
    const { value } = runReader(
      (root: YAMLMap.Parsed, ctx: ParserContext) =>
        readSection(root, 'Section', ctx, (entry) => (entry.name === 'Skip' ? undefined : entry.name)),
      `Section:\n  Keep: {}\n  Skip: {}`,
    );

    expect([...value.keys()]).toEqual(['Keep']);
  });

  it.each([
    ['missing', `Other: x`],
    ['empty', `Section:`],
    ['an empty mapping', `Section: {}`],
  ])('returns an empty map without a diagnostic when %s', (_label, source) => {
    const { value, diagnostics } = read(source);

    expect(value.size).toBe(0);
    expect(diagnostics).toEqual([]);
  });

  it('reports an error when the section is not a mapping', () => {
    const { value, diagnostics } = read(`Section: [a, b]`);

    expect(value.size).toBe(0);
    expect(diagnostics).toEqual([expect.objectContaining({ severity: 'error', code: 'expected-mapping' })]);
  });

  it('reports a non-alphanumeric logical ID but keeps the entry', () => {
    const { value, diagnostics } = read(`Section:\n  my-param: { a: 1 }`);

    expect(value.has('my-param')).toBe(true);
    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: 'error',
        code: 'invalid-logical-id',
        range: expect.objectContaining({ start: expect.objectContaining({ line: 2, column: 3 }) }),
      }),
    ]);
  });

  it('reports a logical ID longer than 255 characters but keeps the entry', () => {
    const name = 'A'.repeat(256);
    const { value, diagnostics } = read(`Section:\n  ${'A'.repeat(255)}: { a: 1 }\n  ${name}: { a: 1 }`);

    expect(value.size).toBe(2);
    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: 'error',
        code: 'name-too-long',
        range: expect.objectContaining({ start: expect.objectContaining({ line: 3 }) }),
      }),
    ]);
  });

  // Conditions are tagged lists (`!Equals [a, b]`), so readSection passes any node through
  it.each([
    ['a tagged list', `Section:\n  Env: !Equals [a, b]`, 'YAMLSeq'],
    ['a scalar', `Section:\n  Env: hello`, 'Scalar'],
    ['empty', `Section:\n  Env:`, 'null'],
    ['explicit null', `Section:\n  Env: ~`, 'null'],
  ])('passes an entry that is %s to the reader', (_label, source, expected) => {
    const { value, diagnostics } = runReader(
      (root: YAMLMap.Parsed, ctx: ParserContext) => readSection(root, 'Section', ctx, (entry) => entry.node?.constructor.name ?? 'null'),
      source,
    );

    expect(value.get('Env')).toBe(expected);
    expect(diagnostics).toEqual([]);
  });

  describe('mappingEntry', () => {
    it.each([
      ['empty', `Section:\n  Env:`],
      ['a string', `Section:\n  Env: hello`],
    ])('skips and reports an entry that is %s instead of a mapping', (_label, source) => {
      const { value, diagnostics } = read(source);

      expect(value.size).toBe(0);
      expect(diagnostics).toEqual([expect.objectContaining({ severity: 'error', code: 'expected-mapping' })]);
    });
  });
});
