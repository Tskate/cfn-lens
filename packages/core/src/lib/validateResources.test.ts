import { describe, expect, it } from 'vitest';
import type { YAMLMap } from 'yaml';

import { runReader } from '../fixtures/runReader.ts';
import type { ParserContext } from '../utils/yaml/ParserContext.ts';
import { readConditions } from './readConditions.ts';
import { readResources } from './readResources.ts';
import { validateResources } from './validateResources.ts';

const at = (line: number, column: number) => expect.objectContaining({ start: expect.objectContaining({ line, column }) });

// The readers build the input; validateResources itself is a pure function over it.
// Resources start on line 4.
const validate = (resources: string) => {
  const { value } = runReader(
    (root: YAMLMap.Parsed, ctx: ParserContext) => ({ conditions: readConditions(root, ctx), resources: readResources(root, ctx) }),
    `Conditions:\n  IsProd: !Equals [a, b]\nResources:\n${resources}`,
  );
  return validateResources(value.resources, value);
};
const codes = (resources: string) => validate(resources).map((d) => d.code);
// A resource with the given extra lines; Type is on the line after the name.
const res = (name: string, ...lines: string[]) =>
  [`  ${name}:`, `    Type: AWS::SNS::Topic`, ...lines.map((line) => `    ${line}`)].join('\n');

describe('validateResources', () => {
  it('accepts valid resources', () => {
    expect(
      validate(
        [
          res('Queue', 'DeletionPolicy: Retain', 'UpdateReplacePolicy: Snapshot'),
          res('Topic', 'Condition: IsProd', 'DependsOn: Queue'),
          res('Bucket', 'DependsOn: [Queue, Topic]'),
        ].join('\n'),
      ),
    ).toEqual([]);
  });

  it('reports an unknown condition at the Condition value', () => {
    expect(validate(res('Topic', 'Condition: IsDev'))).toEqual([
      expect.objectContaining({ severity: 'error', code: 'unknown-condition', range: at(6, 16) }),
    ]);
  });

  describe('DeletionPolicy', () => {
    it.each(['Delete', 'Retain', 'RetainExceptOnCreate', 'Snapshot'])('accepts %s', (policy) => {
      expect(codes(res('Topic', `DeletionPolicy: ${policy}`))).toEqual([]);
    });

    it('reports an unknown value', () => {
      expect(validate(res('Topic', 'DeletionPolicy: Keep'))).toEqual([
        expect.objectContaining({ severity: 'error', code: 'invalid-policy', range: at(6, 21) }),
      ]);
    });
  });

  describe('UpdateReplacePolicy', () => {
    it.each(['Delete', 'Retain', 'Snapshot'])('accepts %s', (policy) => {
      expect(codes(res('Topic', `UpdateReplacePolicy: ${policy}`))).toEqual([]);
    });

    // RetainExceptOnCreate exists only for DeletionPolicy
    it('reports RetainExceptOnCreate', () => {
      expect(validate(res('Topic', 'UpdateReplacePolicy: RetainExceptOnCreate'))).toEqual([
        expect.objectContaining({ severity: 'error', code: 'invalid-policy', range: at(6, 26) }),
      ]);
    });
  });

  describe('DependsOn', () => {
    it('reports each target that is not a resource, at DependsOn', () => {
      const diagnostics = validate([res('Queue'), res('Topic', 'DependsOn: [Queue, Missing, Gone]')].join('\n'));

      expect(diagnostics).toEqual([
        expect.objectContaining({
          severity: 'error',
          code: 'unknown-resource',
          message: expect.stringContaining("'Missing'"),
          range: at(8, 16),
        }),
        expect.objectContaining({
          severity: 'error',
          code: 'unknown-resource',
          message: expect.stringContaining("'Gone'"),
          range: at(8, 16),
        }),
      ]);
    });

    // DependsOn only orders resources: a parameter or condition with that name doesn't count
    it('reports a target that is a condition, not a resource', () => {
      expect(codes(res('Topic', 'DependsOn: IsProd'))).toEqual(['unknown-resource']);
    });

    it('reports a resource that depends on itself', () => {
      expect(validate(res('A', 'DependsOn: A'))).toEqual([
        expect.objectContaining({
          severity: 'error',
          code: 'circular-dependency',
          message: expect.stringContaining('A → A'),
          range: at(6, 16),
        }),
      ]);
    });

    it('reports a longer cycle once, naming its path', () => {
      expect(validate([res('A', 'DependsOn: B'), res('B', 'DependsOn: C'), res('C', 'DependsOn: A')].join('\n'))).toEqual([
        expect.objectContaining({ code: 'circular-dependency', message: expect.stringContaining('A → B → C → A') }),
      ]);
    });

    // Two paths to the same resource are not a cycle
    it('accepts a diamond', () => {
      expect(codes([res('A', 'DependsOn: [B, C]'), res('B', 'DependsOn: D'), res('C', 'DependsOn: D'), res('D')].join('\n'))).toEqual([]);
    });
  });
});
