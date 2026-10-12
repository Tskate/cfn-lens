import { describe, expect, it } from 'vitest';
import type { ParsedNode, YAMLMap } from 'yaml';

import { parseYaml } from './parseYaml.ts';
import { ParserContext } from './ParserContext.ts';

const setup = (source: string) => {
  const { doc, lineCounter } = parseYaml(source);
  const value = (doc.contents as YAMLMap.Parsed).get('Key', true) as ParsedNode;
  return { ctx: new ParserContext(lineCounter, source), value };
};

describe('ParserContext', () => {
  describe('rangeOf', () => {
    it('converts [start, end] offsets to 1-based positions', () => {
      const { ctx } = setup('Key: a\nOther: b');

      expect(ctx.rangeOf([7, 12])).toEqual({ start: { offset: 7, line: 2, column: 1 }, end: { offset: 12, line: 2, column: 6 } });
    });

    it('uses the range of a plain node', () => {
      const { ctx, value } = setup('Key: hello');

      expect(ctx.rangeOf(value)).toMatchObject({ start: { offset: 5, column: 6 }, end: { offset: 10, column: 11 } });
    });

    // The yaml library starts a node's range after its tag; diagnostics should underline the tag too
    it.each([
      ['a tagged scalar', 'Key: !Ref Bucket', 16],
      ['a tagged flow list', 'Key: !Equals [a, b]', 19],
      ['a tagged block list', 'Key: !And\n  - a\n  - b', 21],
    ])('starts %s at its tag', (_label, source, end) => {
      const { ctx, value } = setup(source);

      expect(ctx.rangeOf(value)).toMatchObject({ start: { offset: 5, line: 1, column: 6 }, end: { offset: end } });
    });

    // Standard YAML tags like !!str resolve to tag:yaml.org,2002:str and have no CloudFormation meaning
    it('ignores tags that are not CloudFormation short forms', () => {
      const { ctx, value } = setup('Key: !!str 42');

      expect(ctx.rangeOf(value).start.offset).toBe(11);
    });
  });

  describe('diagnostics', () => {
    it('reports errors and warnings with a range, and tracks hasErrors', () => {
      const { ctx, value } = setup('Key: !Ref Bucket');

      ctx.warning('string-not-quoted', 'a warning', value);
      expect(ctx.hasErrors).toBe(false);

      ctx.error('intrinsic-not-allowed', 'an error', value);
      expect(ctx.hasErrors).toBe(true);
      expect(ctx.diagnostics).toEqual([
        expect.objectContaining({ severity: 'warning', code: 'string-not-quoted' }),
        expect.objectContaining({
          severity: 'error',
          code: 'intrinsic-not-allowed',
          range: expect.objectContaining({ start: expect.objectContaining({ column: 6 }) }),
        }),
      ]);
    });

    it('omits the range when no location is given', () => {
      const { ctx } = setup('Key: x');

      ctx.warning('empty-template', 'empty');
      expect(ctx.diagnostics[0]).not.toHaveProperty('range');
    });

    it('adds diagnostics produced elsewhere', () => {
      const { ctx } = setup('Key: x');

      ctx.add([{ severity: 'error', code: 'too-many-entries', message: 'too many' }]);
      expect(ctx.diagnostics.map((d) => d.code)).toEqual(['too-many-entries']);
    });
  });
});
