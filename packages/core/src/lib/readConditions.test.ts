import { describe, expect, it } from 'vitest';

import { runReader } from '../fixtures/runReader.ts';
import { readConditions } from './readConditions.ts';

const read = (conditions: string) => runReader(readConditions, `Conditions:\n${conditions}`);
const expressionOf = (conditions: string, name = 'C') => read(conditions).value.get(name)?.expression;

// Section shape (missing, empty, logical IDs) is covered in readSection.test.ts.
describe('readConditions', () => {
  describe('expressions', () => {
    // Short and long forms produce the same tree
    it.each([
      ['short form', `  C: !Equals [!Ref Env, prod]`],
      ['long form', `  C:\n    Fn::Equals: [{ Ref: Env }, prod]`],
    ])('reads Fn::Equals in %s', (_label, source) => {
      const { value, diagnostics } = read(source);

      expect(value.get('C')?.expression).toMatchObject({
        kind: 'equals',
        left: { kind: 'ref', target: 'Env' },
        right: { kind: 'literal', value: 'prod' },
      });
      expect(diagnostics).toEqual([]);
    });

    it('reads nested And / Or / Not and condition references in both forms', () => {
      expect(expressionOf(`  C: !And\n    - !Condition IsProd\n    - !Or [{ Condition: A }, !Not [!Condition B]]`)).toMatchObject({
        kind: 'and',
        operands: [
          { kind: 'condition', name: 'IsProd' },
          {
            kind: 'or',
            operands: [
              { kind: 'condition', name: 'A' },
              { kind: 'not', operand: { kind: 'condition', name: 'B' } },
            ],
          },
        ],
      });
    });

    it('reads Fn::FindInMap operands, including nested Ref', () => {
      expect(expressionOf(`  C: !Equals [!FindInMap [RegionMap, !Ref 'AWS::Region', Enabled], 'true']`)).toMatchObject({
        kind: 'equals',
        left: {
          kind: 'findInMap',
          mapName: { kind: 'literal', value: 'RegionMap' },
          topLevelKey: { kind: 'ref', target: 'AWS::Region' },
          secondLevelKey: { kind: 'literal', value: 'Enabled' },
        },
      });
    });

    it('reads unquoted numbers and empty strings as literals without warnings', () => {
      const { value, diagnostics } = read(`  A: !Equals [!Ref Count, 3]\n  B: !Equals [!Ref Name, '']`);

      expect(value.get('A')?.expression).toMatchObject({ right: { kind: 'literal', value: '3' } });
      expect(value.get('B')?.expression).toMatchObject({ right: { kind: 'literal', value: '' } });
      expect(diagnostics).toEqual([]);
    });

    it('accepts a condition function as an Fn::Equals operand', () => {
      expect(expressionOf(`  C: !Equals [!Condition IsProd, 'true']`)).toMatchObject({ left: { kind: 'condition', name: 'IsProd' } });
    });

    it('records the name range, the whole-entry range and each expression range', () => {
      const condition = read(`  IsProd: !Equals [!Ref Env, prod]`).value.get('IsProd');

      expect(condition?.nameRange).toMatchObject({ start: { line: 2, column: 3 }, end: { line: 2, column: 9 } });
      expect(condition?.expression?.range).toMatchObject({ start: { line: 2, column: 11 } });
      expect(condition?.expression).toMatchObject({ left: { range: { start: { line: 2, column: 20 } } } });
    });
  });

  describe('invalid expressions', () => {
    // The condition stays in the map with expression undefined, so references to it still resolve
    it.each([
      ['a plain value', `  C: true`],
      ['empty', `  C:`],
      ['a plain list', `  C: [a, b]`],
    ])('reports a condition that is %s and keeps its name', (_label, source) => {
      const { value, diagnostics } = read(source);

      expect(value.get('C')).toMatchObject({ name: 'C', expression: undefined });
      expect(diagnostics).toEqual([expect.objectContaining({ severity: 'error', code: 'expected-condition-function' })]);
    });

    it.each([
      ['Fn::If (Resources and Outputs only)', `  C: !If [IsProd, a, b]`, 'Resources'],
      ['Fn::GetAtt inside Fn::Equals', `  C: !Equals [!GetAtt Bucket.Arn, x]`, 'Fn::GetAtt'],
      ['Fn::Sub inside Fn::Equals', `  C: !Equals [!Sub '\${AWS::Region}', x]`, 'Fn::Sub'],
      ['Fn::ForEach', `  C:\n    Fn::ForEach: [x]`, 'AWS::LanguageExtensions'],
    ])('reports %s as not allowed', (_label, source, hint) => {
      const { value, diagnostics } = read(source);

      expect(value.get('C')?.expression).toBeUndefined();
      expect(diagnostics).toEqual([
        expect.objectContaining({ severity: 'error', code: 'function-not-allowed', message: expect.stringContaining(hint) }),
      ]);
    });

    it.each([
      ['Fn::And with 1 condition', `  C: !And [!Condition A]`],
      ['Fn::Or with 11 conditions', `  C: !Or [${Array.from({ length: 11 }, () => '!Condition A').join(', ')}]`],
      ['Fn::Not with 2 conditions', `  C: !Not [!Condition A, !Condition B]`],
      ['Fn::Equals with 3 values', `  C: !Equals [a, b, c]`],
      ['Fn::Equals without a list', `  C: !Equals a`],
      ['Fn::FindInMap with 2 values', `  C: !Equals [!FindInMap [Map, key], x]`],
    ])('reports %s', (_label, source) => {
      const { value, diagnostics } = read(source);

      expect(value.get('C')?.expression).toBeUndefined();
      expect(diagnostics).toEqual([expect.objectContaining({ severity: 'error', code: 'invalid-arguments' })]);
    });

    it('accepts Fn::And and Fn::Or with 2 and 10 conditions', () => {
      const ten = Array.from({ length: 10 }, () => '!Condition A').join(', ');
      const { diagnostics } = read(`  A: !And [!Condition X, !Condition Y]\n  B: !Or [${ten}]`);

      expect(diagnostics).toEqual([]);
    });

    // One diagnostic per problem: an invalid inner part invalidates the condition without extra errors
    it('reports a nested problem once and drops the whole expression', () => {
      const { value, diagnostics } = read(`  C: !Not [!Equals [a]]`);

      expect(value.get('C')?.expression).toBeUndefined();
      expect(diagnostics.map((d) => d.code)).toEqual(['invalid-arguments']);
    });

    it.each([
      ['a Condition name that is not a string', `  C: !Not [!Condition [A]]`],
      ['an empty Fn::Equals value', `  C: !Equals [!Ref Env, ~]`],
      ['a Ref target that is not a string', `  C: !Equals [{ Ref: [Env] }, x]`],
    ])('reports %s', (_label, source) => {
      expect(read(source).diagnostics).toEqual([expect.objectContaining({ severity: 'error', code: 'expected-string' })]);
    });
  });
});
