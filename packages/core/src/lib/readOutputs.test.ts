import { describe, expect, it } from 'vitest';

import { runReader } from '../fixtures/runReader.ts';
import { readOutputs } from './readOutputs.ts';

const at = (line: number, column: number) => expect.objectContaining({ start: expect.objectContaining({ line, column }) });
const codes = (source: string) => runReader(readOutputs, source).diagnostics.map((d) => d.code);

// Section shape (missing, empty, logical IDs, non-mapping entries) is covered in readSection.test.ts.
describe('readOutputs', () => {
  it.each([
    [
      'YAML',
      `Outputs:
  VpcId:
    Description: The VPC
    Value: !Ref Vpc
    Export:
      Name: !Sub '\${AWS::StackName}-VpcId'
    Condition: IsProd`,
    ],
    [
      'JSON',
      `{ "Outputs": { "VpcId": { "Description": "The VPC", "Value": { "Ref": "Vpc" }, "Export": { "Name": { "Fn::Sub": "\${AWS::StackName}-VpcId" } }, "Condition": "IsProd" } } }`,
    ],
  ])('reads every property from %s', (_label, source) => {
    const { value, diagnostics } = runReader(readOutputs, source);

    expect(value.get('VpcId')).toMatchObject({
      name: 'VpcId',
      description: 'The VPC',
      value: { kind: 'intrinsic', fn: 'Ref', arg: { kind: 'scalar', value: 'Vpc' } },
      exportName: { kind: 'intrinsic', fn: 'Fn::Sub', arg: { kind: 'scalar', value: '${AWS::StackName}-VpcId' } },
      condition: 'IsProd',
    });
    expect(diagnostics).toEqual([]);
  });

  it('records where each property is', () => {
    const { value } = runReader(readOutputs, `Outputs:\n  Id:\n    Value: x\n    Condition: IsProd`);

    expect(value.get('Id')).toMatchObject({
      nameRange: at(2, 3),
      propertyRanges: { Value: at(3, 12), Condition: at(4, 16) },
    });
  });

  it('leaves optional properties undefined', () => {
    const { value, diagnostics } = runReader(readOutputs, `Outputs:\n  Id:\n    Value: x\n    Description:\n    Export:`);

    expect(value.get('Id')).toMatchObject({ description: undefined, exportName: undefined, condition: undefined });
    expect(diagnostics).toEqual([]);
  });

  it('reports an unknown property', () => {
    expect(codes(`Outputs:\n  Id:\n    Value: x\n    Exports: { Name: y }`)).toEqual(['unknown-property']);
  });

  describe('Value', () => {
    // The output stays known, so the diagram and references to it don't vanish while typing
    it.each([
      ['missing', `Outputs:\n  Id:\n    Description: x`],
      ['empty', `Outputs:\n  Id:\n    Value:`],
    ])('reports a %s Value and keeps the output', (_label, source) => {
      const { value, diagnostics } = runReader(readOutputs, source);

      expect(value.get('Id')).toMatchObject({ name: 'Id', value: undefined });
      expect(diagnostics).toEqual([expect.objectContaining({ severity: 'error', code: 'missing-required-property', range: at(2, 3) })]);
    });

    it('accepts a literal value', () => {
      const { value } = runReader(readOutputs, `Outputs:\n  Port:\n    Value: 443`);

      expect(value.get('Port')?.value).toMatchObject({ kind: 'scalar', value: 443 });
    });
  });

  describe('Description', () => {
    it('rejects an intrinsic function', () => {
      const { value, diagnostics } = runReader(readOutputs, `Outputs:\n  Id:\n    Value: x\n    Description: !Ref Env`);

      expect(value.get('Id')?.description).toBeUndefined();
      expect(diagnostics).toEqual([expect.objectContaining({ severity: 'error', code: 'intrinsic-not-allowed', range: at(4, 18) })]);
    });

    it('reports a description over 1024 bytes and keeps it', () => {
      const long = 'é'.repeat(513); // 1026 bytes
      const { value, diagnostics } = runReader(readOutputs, `Outputs:\n  Id:\n    Value: x\n    Description: ${long}`);

      expect(value.get('Id')?.description).toBe(long);
      expect(diagnostics.map((d) => d.code)).toEqual(['description-too-long']);
    });

    it('accepts exactly 1024 bytes', () => {
      expect(codes(`Outputs:\n  Id:\n    Value: x\n    Description: ${'a'.repeat(1024)}`)).toEqual([]);
    });

    it('warns about an unquoted number', () => {
      expect(codes(`Outputs:\n  Id:\n    Value: x\n    Description: 42`)).toEqual(['string-not-quoted']);
    });
  });

  describe('Export', () => {
    it('accepts a literal name', () => {
      const { value } = runReader(readOutputs, `Outputs:\n  Id:\n    Value: x\n    Export: { Name: shared-vpc }`);

      expect(value.get('Id')?.exportName).toMatchObject({ kind: 'scalar', value: 'shared-vpc' });
    });

    it('reports an Export that is not a mapping', () => {
      expect(codes(`Outputs:\n  Id:\n    Value: x\n    Export: shared-vpc`)).toEqual(['expected-mapping']);
    });

    it.each([
      ['missing', `Export: {}`],
      ['empty', `Export:\n      Name:`],
    ])('reports a %s Name', (_label, exportYaml) => {
      const { value, diagnostics } = runReader(readOutputs, `Outputs:\n  Id:\n    Value: x\n    ${exportYaml}`);

      expect(value.get('Id')?.exportName).toBeUndefined();
      expect(diagnostics).toEqual([expect.objectContaining({ code: 'missing-required-property', range: at(4, 5) })]);
    });

    it('reports an unknown property inside Export', () => {
      expect(codes(`Outputs:\n  Id:\n    Value: x\n    Export: { Name: a, Value: b }`)).toEqual(['unknown-property']);
    });
  });

  describe('Condition', () => {
    it('rejects an intrinsic function', () => {
      expect(codes(`Outputs:\n  Id:\n    Value: x\n    Condition: !Ref IsProd`)).toEqual(['intrinsic-not-allowed']);
    });

    it('rejects a list', () => {
      expect(codes(`Outputs:\n  Id:\n    Value: x\n    Condition: [IsProd]`)).toEqual(['expected-string']);
    });
  });
});
