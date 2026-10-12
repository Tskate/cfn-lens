import { describe, expect, it } from 'vitest';
import type { YAMLMap } from 'yaml';

import { runReader } from '../fixtures/runReader.ts';
import type { ParserContext } from './ParserContext.ts';
import { readConditions } from './readConditions.ts';
import { readMappings } from './readMappings.ts';
import { readParameters } from './readParameters.ts';
import { validateConditions } from './validateConditions.ts';

const SECTIONS = `Parameters:
  Env: { Type: String }
Mappings:
  RegionMap:
    us-east-1: { Enabled: 'true' }
    eu-west-1: { Enabled: 'false', Legacy: 'true' }
`;

// The readers build the input; validateConditions itself is a pure function over it.
const validate = (conditions: string) => {
  const { value } = runReader(
    (root: YAMLMap.Parsed, ctx: ParserContext) => ({
      parameters: readParameters(root, ctx),
      mappings: readMappings(root, ctx),
      conditions: readConditions(root, ctx),
    }),
    `${SECTIONS}Conditions:\n${conditions}`,
  );
  return validateConditions(value.conditions, value);
};
const codes = (conditions: string) => validate(conditions).map((d) => d.code);

describe('validateConditions', () => {
  it('accepts a valid set of conditions', () => {
    expect(
      validate(`  IsProd: !Equals [!Ref Env, prod]
  IsUsEast: !Equals [!Ref 'AWS::Region', us-east-1]
  Enabled: !Equals [!FindInMap [RegionMap, !Ref 'AWS::Region', Enabled], 'true']
  Both: !And [!Condition IsProd, !Condition IsUsEast]`),
    ).toEqual([]);
  });

  describe('Ref', () => {
    it.each(['AWS::AccountId', 'AWS::Region', 'AWS::StackName', 'AWS::Partition', 'AWS::URLSuffix'])(
      'accepts the pseudo parameter %s',
      (pseudo) => {
        expect(validate(`  C: !Equals [!Ref '${pseudo}', x]`)).toEqual([]);
      },
    );

    // Conditions can't reference resources; anything that isn't a parameter is invalid
    it('reports a Ref to something that is not a parameter, at the Ref', () => {
      expect(validate(`  C: !Equals [!Ref MyBucket, x]`)).toEqual([
        expect.objectContaining({
          severity: 'error',
          code: 'invalid-ref',
          range: expect.objectContaining({ start: expect.objectContaining({ line: 8, column: 15 }) }),
        }),
      ]);
    });
  });

  describe('Condition references', () => {
    it('reports an unknown condition at the reference', () => {
      expect(validate(`  C: !Not [!Condition Missing]`)).toEqual([
        expect.objectContaining({
          severity: 'error',
          code: 'unknown-condition',
          range: expect.objectContaining({ start: expect.objectContaining({ line: 8, column: 12 }) }),
        }),
      ]);
    });

    // The invalid condition was already reported by the reader
    it('does not report a reference to a condition whose expression is invalid', () => {
      expect(codes(`  Broken: true\n  C: !Not [!Condition Broken]`)).toEqual([]);
    });
  });

  describe('cycles', () => {
    it('reports a condition that references itself', () => {
      expect(validate(`  A: !Not [!Condition A]`)).toEqual([
        expect.objectContaining({ severity: 'error', code: 'circular-condition', message: expect.stringContaining('A → A') }),
      ]);
    });

    it('reports a longer cycle once, naming its path', () => {
      expect(
        validate(`  A: !Not [!Condition B]\n  B: !And [!Condition X, !Condition C]\n  C: !Not [!Condition A]\n  X: !Equals [!Ref Env, x]`),
      ).toEqual([expect.objectContaining({ code: 'circular-condition', message: expect.stringContaining('A → B → C → A') })]);
    });

    // Two paths to the same condition are not a cycle
    it('accepts a diamond', () => {
      expect(
        codes(`  A: !And [!Condition B, !Condition C]\n  B: !Not [!Condition D]\n  C: !Not [!Condition D]\n  D: !Equals [!Ref Env, x]`),
      ).toEqual([]);
    });
  });

  describe('Fn::FindInMap', () => {
    it.each([
      ['an unknown mapping', `!FindInMap [Missing, us-east-1, Enabled]`, 'unknown-mapping', 27],
      ['an unknown top-level key', `!FindInMap [RegionMap, ap-south-1, Enabled]`, 'unknown-mapping-key', 38],
      ['an unknown second-level key', `!FindInMap [RegionMap, us-east-1, Legacy]`, 'unknown-mapping-key', 49],
      ['a second-level key no top-level key has', `!FindInMap [RegionMap, !Ref 'AWS::Region', Nope]`, 'unknown-mapping-key', 58],
    ])('reports %s at that argument', (_label, findInMap, code, column) => {
      expect(validate(`  C: !Equals [${findInMap}, x]`)).toEqual([
        expect.objectContaining({
          severity: 'error',
          code,
          range: expect.objectContaining({ start: expect.objectContaining({ line: 8, column }) }),
        }),
      ]);
    });

    // With a Ref top-level key, a second-level key that exists under some key may be valid
    it('accepts a second-level key that exists under at least one top-level key', () => {
      expect(validate(`  C: !Equals [!FindInMap [RegionMap, !Ref 'AWS::Region', Legacy], x]`)).toEqual([]);
    });

    it('validates Refs inside Fn::FindInMap', () => {
      expect(codes(`  C: !Equals [!FindInMap [RegionMap, !Ref Missing, Enabled], x]`)).toEqual(['invalid-ref']);
    });
  });

  // Always true or always false: almost certainly a mistake, but CloudFormation accepts it
  it('warns about Fn::Equals comparing two literals', () => {
    expect(validate(`  C: !Equals [prod, prod]`)).toEqual([expect.objectContaining({ severity: 'warning', code: 'constant-condition' })]);
  });

  it('checks deeply nested operands', () => {
    expect(codes(`  C: !Not [!Or [!Condition Missing, !Equals [!Ref Nope, x]]]`)).toEqual(['unknown-condition', 'invalid-ref']);
  });
});
