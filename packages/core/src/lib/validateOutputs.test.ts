import { describe, expect, it } from 'vitest';
import type { YAMLMap } from 'yaml';

import { runReader } from '../fixtures/runReader.ts';
import type { ParserContext } from './ParserContext.ts';
import { readConditions } from './readConditions.ts';
import { readOutputs } from './readOutputs.ts';
import { validateOutputs } from './validateOutputs.ts';

const at = (line: number, column: number) => expect.objectContaining({ start: expect.objectContaining({ line, column }) });

// The readers build the input; validateOutputs itself is a pure function over it.
const validate = (outputs: string) => {
  const { value } = runReader(
    (root: YAMLMap.Parsed, ctx: ParserContext) => ({ conditions: readConditions(root, ctx), outputs: readOutputs(root, ctx) }),
    `Conditions:\n  IsProd: !Equals [a, b]\nOutputs:\n${outputs}`,
  );
  return validateOutputs(value.outputs, value);
};

describe('validateOutputs', () => {
  it('accepts valid outputs', () => {
    expect(
      validate(`  A:\n    Value: x\n    Condition: IsProd\n    Export: { Name: a }\n  B:\n    Value: y\n    Export: { Name: b }`),
    ).toEqual([]);
  });

  it('reports an unknown condition at the Condition value', () => {
    expect(validate(`  A:\n    Value: x\n    Condition: IsDev`)).toEqual([
      expect.objectContaining({ severity: 'error', code: 'unknown-condition', range: at(6, 16) }),
    ]);
  });

  // Export names are unique per account and Region, so one template can't export a name twice
  it('reports every repeat of a literal export name', () => {
    const diagnostics = validate(
      `  A:\n    Value: x\n    Export: { Name: shared }\n  B:\n    Value: y\n    Export: { Name: shared }\n  C:\n    Value: z\n    Export: { Name: shared }`,
    );

    expect(diagnostics).toEqual([
      expect.objectContaining({ severity: 'error', code: 'duplicate-export-name', range: at(9, 21) }),
      expect.objectContaining({ severity: 'error', code: 'duplicate-export-name', range: at(12, 21) }),
    ]);
  });

  // Their resolved values are only known at deploy time
  it('does not compare export names built with functions', () => {
    expect(
      validate(
        `  A:\n    Value: x\n    Export: { Name: !Sub '\${AWS::StackName}-id' }\n  B:\n    Value: y\n    Export: { Name: !Sub '\${AWS::StackName}-id' }`,
      ),
    ).toEqual([]);
  });
});
