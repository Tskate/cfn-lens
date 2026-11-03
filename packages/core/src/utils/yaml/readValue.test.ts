import { describe, expect, it } from 'vitest';
import type { ParsedNode, YAMLMap } from 'yaml';

import { runReader } from '../../fixtures/runReader.ts';
import type { ParserContext } from './ParserContext.ts';
import { readValue } from './readValue.ts';

// Reads the value under the `V` key of the snippet.
const read = (source: string) =>
  runReader((root: YAMLMap.Parsed, ctx: ParserContext) => readValue(root.get('V', true) as ParsedNode, ctx), source);

const at = (line: number, column: number) => expect.objectContaining({ start: expect.objectContaining({ line, column }) });

describe('readValue', () => {
  describe('literals', () => {
    // Resource properties are typed (Integer, Boolean…), so scalars keep their parsed type
    it.each([
      ['a string', 'V: hello', 'hello'],
      ['a number', 'V: 42', 42],
      ['a boolean', 'V: true', true],
      ['null', 'V: ~', null],
    ])('reads %s as a scalar', (_label, source, expected) => {
      const { value, diagnostics } = read(source);

      expect(value).toEqual({ kind: 'scalar', value: expected, range: expect.anything() });
      expect(diagnostics).toEqual([]);
    });

    it('reads lists and objects recursively, keeping key order', () => {
      const { value, diagnostics } = read(`V:\n  Tags: [a, 1]\n  80: open`);

      expect(value).toMatchObject({
        kind: 'object',
        entries: new Map<string, unknown>([
          [
            'Tags',
            {
              kind: 'list',
              items: [
                { kind: 'scalar', value: 'a' },
                { kind: 'scalar', value: 1 },
              ],
            },
          ],
          ['80', { kind: 'scalar', value: 'open' }],
        ]),
      });
      expect(value.kind === 'object' && [...value.entries.keys()]).toEqual(['Tags', '80']);
      expect(diagnostics).toEqual([]);
    });

    it('reports a key that is not a scalar and skips its entry', () => {
      const { value, diagnostics } = read(`V:\n  ? [a, b]\n  : x\n  Ok: y`);

      expect(value).toMatchObject({ kind: 'object', entries: new Map([['Ok', { kind: 'scalar', value: 'y' }]]) });
      expect(diagnostics).toEqual([expect.objectContaining({ code: 'expected-string', range: at(2, 5) })]);
    });
  });

  describe('intrinsic functions', () => {
    it.each([
      ['long form', 'V: { Ref: Bucket }'],
      ['short form', 'V: !Ref Bucket'],
    ])('reads Ref in %s', (_label, source) => {
      const { value, diagnostics } = read(source);

      expect(value).toMatchObject({ kind: 'intrinsic', fn: 'Ref', arg: { kind: 'scalar', value: 'Bucket' } });
      expect(diagnostics).toEqual([]);
    });

    it('expands short-form names to Fn::*', () => {
      expect(read('V: !GetAtt Bucket.Arn').value).toMatchObject({
        kind: 'intrinsic',
        fn: 'Fn::GetAtt',
        arg: { kind: 'scalar', value: 'Bucket.Arn' },
      });
    });

    it('reads nested functions in both forms', () => {
      const { value } = read(`V: !Join [':', [!Ref 'AWS::StackName', { 'Fn::GetAtt': [Vpc, CidrBlock] }]]`);

      expect(value).toMatchObject({
        kind: 'intrinsic',
        fn: 'Fn::Join',
        arg: {
          kind: 'list',
          items: [
            { kind: 'scalar', value: ':' },
            {
              kind: 'list',
              items: [
                { kind: 'intrinsic', fn: 'Ref', arg: { kind: 'scalar', value: 'AWS::StackName' } },
                { kind: 'intrinsic', fn: 'Fn::GetAtt', arg: { kind: 'list', items: [{ value: 'Vpc' }, { value: 'CidrBlock' }] } },
              ],
            },
          ],
        },
      });
    });

    // The function spans its tag; its argument is the tagged value alone
    it('gives a short-form call the range from its tag and the argument the range after it', () => {
      const { value } = read('V: !Ref Bucket');

      expect(value).toMatchObject({ range: at(1, 4), arg: { range: at(1, 9) } });
    });

    it('reads an empty argument as a null scalar', () => {
      expect(read('V: { Ref: }').value).toMatchObject({ kind: 'intrinsic', fn: 'Ref', arg: { kind: 'scalar', value: null } });
    });

    it.each([
      ['two keys', 'V: { Ref: A, Other: B }'],
      ['a non-function key', 'V: { Name: A }'],
      // Condition is a function only inside condition expressions (e.g. it is a key in IAM policies)
      ['Condition', 'V: { Condition: IsProd }'],
    ])('reads a mapping with %s as an object', (_label, source) => {
      expect(read(source).value).toMatchObject({ kind: 'object' });
    });
  });
});
