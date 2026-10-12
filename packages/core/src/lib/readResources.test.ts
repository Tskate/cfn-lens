import { describe, expect, it } from 'vitest';

import { runReader } from '../fixtures/runReader.ts';
import { readResources } from './readResources.ts';

const at = (line: number, column: number) => expect.objectContaining({ start: expect.objectContaining({ line, column }) });
const read = (source: string) => runReader(readResources, source);
const codes = (source: string) => read(source).diagnostics.map((d) => d.code);
// A resource named Res with the given extra lines under it.
const resource = (...lines: string[]) => `Resources:\n  Res:\n    Type: AWS::S3::Bucket\n${lines.map((line) => `    ${line}`).join('\n')}`;

// Section shape (missing, empty, logical IDs, non-mapping entries) is covered in readSection.test.ts.
describe('readResources', () => {
  it.each([
    [
      'YAML',
      `Resources:
  Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Ref Name
    DependsOn: [Queue, Topic]
    Condition: IsProd
    DeletionPolicy: Retain
    UpdateReplacePolicy: Snapshot
    Metadata: { Owner: team }
    CreationPolicy: { ResourceSignal: { Count: 1 } }
    UpdatePolicy: { AutoScalingReplacingUpdate: { WillReplace: true } }`,
    ],
    [
      'JSON',
      `{ "Resources": { "Bucket": { "Type": "AWS::S3::Bucket", "Properties": { "BucketName": { "Ref": "Name" } }, "DependsOn": ["Queue", "Topic"], "Condition": "IsProd", "DeletionPolicy": "Retain", "UpdateReplacePolicy": "Snapshot", "Metadata": { "Owner": "team" }, "CreationPolicy": { "ResourceSignal": { "Count": 1 } }, "UpdatePolicy": { "AutoScalingReplacingUpdate": { "WillReplace": true } } } } }`,
    ],
  ])('reads every attribute from %s', (_label, source) => {
    const { value, diagnostics } = read(source);

    expect(value.get('Bucket')).toMatchObject({
      name: 'Bucket',
      type: 'AWS::S3::Bucket',
      properties: {
        kind: 'object',
        entries: new Map([['BucketName', { kind: 'intrinsic', fn: 'Ref', arg: { kind: 'scalar', value: 'Name' } }]]),
      },
      dependsOn: ['Queue', 'Topic'],
      condition: 'IsProd',
      deletionPolicy: 'Retain',
      updateReplacePolicy: 'Snapshot',
      metadata: { kind: 'object' },
      creationPolicy: { kind: 'object' },
      updatePolicy: { kind: 'object' },
    });
    expect(diagnostics).toEqual([]);
  });

  it('accepts a resource with only a Type', () => {
    const { value, diagnostics } = read(`Resources:\n  Bucket:\n    Type: AWS::S3::Bucket`);

    expect(value.get('Bucket')).toMatchObject({
      type: 'AWS::S3::Bucket',
      properties: undefined,
      dependsOn: [],
      condition: undefined,
      deletionPolicy: undefined,
      updateReplacePolicy: undefined,
    });
    expect(diagnostics).toEqual([]);
  });

  it('records where each attribute is', () => {
    const { value } = read(`Resources:\n  Bucket:\n    Type: AWS::S3::Bucket\n    DependsOn: Queue`);

    expect(value.get('Bucket')).toMatchObject({
      nameRange: at(2, 3),
      propertyRanges: { Type: at(3, 11), DependsOn: at(4, 16) },
    });
  });

  it('reports an unknown attribute at its key', () => {
    expect(read(resource('Propertes: {}')).diagnostics).toEqual([
      expect.objectContaining({ severity: 'error', code: 'unknown-property', range: at(4, 5) }),
    ]);
  });

  describe('Type', () => {
    // Without a Type the resource can't be drawn or checked, so it is left out (like a Parameter without Type)
    it.each([
      ['missing', `Resources:\n  Bucket:\n    Properties: {}`],
      ['empty', `Resources:\n  Bucket:\n    Type:`],
    ])('reports a %s Type at the logical ID and skips the resource', (_label, source) => {
      const { value, diagnostics } = read(source);

      expect(value.has('Bucket')).toBe(false);

      expect(diagnostics).toEqual([expect.objectContaining({ severity: 'error', code: 'missing-required-property', range: at(2, 3) })]);
    });

    // One diagnostic per problem: readString already explains what's wrong
    it('reports a Type that is not a string only once', () => {
      const { value, diagnostics } = read(`Resources:\n  Bucket:\n    Type: [AWS::S3::Bucket]`);

      expect(value.has('Bucket')).toBe(false);
      expect(diagnostics.map((d) => d.code)).toEqual(['expected-string']);
    });

    // Not every valid type is AWS::Service::Type: custom resources, registry extensions, modules and SAM
    it.each([
      'Custom::Notifier',
      'AWS::CloudFormation::CustomResource',
      'MyOrg::Service::Thing',
      'MyOrg::Network::Vpc::MODULE',
      'AWS::Serverless::Function',
    ])('keeps the valid type %s', (type) => {
      const { value, diagnostics } = read(`Resources:\n  Res:\n    Type: ${type}`);

      expect(value.get('Res')?.type).toBe(type);
      expect(diagnostics).toEqual([]);
    });

    // CloudFormation rejects it, but the resource stays so the diagram and references to it don't vanish
    it.each(['S3Bucket', 'AWS:S3:Bucket'])('reports the malformed type %s and keeps the resource', (type) => {
      const { value, diagnostics } = read(`Resources:\n  Res:\n    Type: ${type}`);

      expect(value.get('Res')?.type).toBe(type);
      expect(diagnostics).toEqual([expect.objectContaining({ severity: 'error', code: 'invalid-resource-type', range: at(3, 11) })]);
    });

    // Unknown attributes are still reported, as for a Parameter without Type
    it('reports unknown attributes even when Type is missing', () => {
      expect(codes(`Resources:\n  Bucket:\n    Propertes: {}`)).toEqual(['unknown-property', 'missing-required-property']);
    });
  });

  describe.each(['Properties', 'Metadata', 'CreationPolicy', 'UpdatePolicy'])('%s', (key) => {
    it('keeps the mapping as a value tree', () => {
      const { value, diagnostics } = read(resource(`${key}:`, `  Count: !Ref Size`));

      expect(value.get('Res')).toMatchObject({
        [key.charAt(0).toLowerCase() + key.slice(1)]: {
          kind: 'object',
          entries: new Map([['Count', { kind: 'intrinsic', fn: 'Ref' }]]),
        },
      });
      expect(diagnostics).toEqual([]);
    });

    it('leaves an empty value undefined without a diagnostic', () => {
      expect(codes(resource(`${key}:`))).toEqual([]);
    });

    it.each([
      ['a string', 'x'],
      ['a list', '[a]'],
    ])('reports %s and keeps the resource', (_label, yaml) => {
      const { value, diagnostics } = read(resource(`${key}: ${yaml}`));

      expect(value.has('Res')).toBe(true);
      expect(diagnostics.map((d) => d.code)).toEqual(['expected-mapping']);
    });
  });

  describe('DependsOn', () => {
    it.each([
      ['a single name', 'DependsOn: Queue', ['Queue']],
      ['a list', 'DependsOn: [Queue, Topic]', ['Queue', 'Topic']],
      // Logical IDs may be all digits
      ['an unquoted number', 'DependsOn: 123', ['123']],
      ['a list with unquoted numbers', 'DependsOn: [123, Queue]', ['123', 'Queue']],
      ['an empty value', 'DependsOn:', []],
      ['an empty list', 'DependsOn: []', []],
    ])('reads %s as a list', (_label, yaml, expected) => {
      const { value, diagnostics } = read(resource(yaml));

      expect(value.get('Res')?.dependsOn).toEqual(expected);
      expect(diagnostics).toEqual([]);
    });

    // One bad item shouldn't hide the other dependency edges
    it('keeps the valid items of a list and reports the bad one', () => {
      const { value, diagnostics } = read(resource('DependsOn: [Queue, { a: 1 }, Topic]'));

      expect(value.get('Res')?.dependsOn).toEqual(['Queue', 'Topic']);
      expect(diagnostics.map((d) => d.code)).toEqual(['expected-string']);
    });

    it('reports a mapping', () => {
      const { value, diagnostics } = read(resource('DependsOn: { Queue: true }'));

      expect(value.get('Res')?.dependsOn).toEqual([]);
      expect(diagnostics.map((d) => d.code)).toEqual(['expected-string']);
    });

    // Unverified: CloudFormation likely rejects intrinsics here without AWS::LanguageExtensions
    it.todo('rejects an intrinsic function');
  });

  describe.each([
    ['Condition', 'condition', 'IsProd'],
    ['DeletionPolicy', 'deletionPolicy', 'Retain'],
    ['UpdateReplacePolicy', 'updateReplacePolicy', 'Retain'],
  ])('%s', (key, field, example) => {
    it('reads a string', () => {
      const { value, diagnostics } = read(resource(`${key}: ${example}`));

      expect(value.get('Res')).toMatchObject({ [field]: example });
      expect(diagnostics).toEqual([]);
    });

    it('leaves an empty value undefined without a diagnostic', () => {
      const { value, diagnostics } = read(resource(`${key}:`));

      expect(value.get('Res')).toMatchObject({ [field]: undefined });
      expect(diagnostics).toEqual([]);
    });

    it('reports a list and keeps the resource', () => {
      const { value, diagnostics } = read(resource(`${key}: [${example}]`));

      expect(value.get('Res')).toMatchObject({ [field]: undefined });
      expect(diagnostics.map((d) => d.code)).toEqual(['expected-string']);
    });
  });
});
