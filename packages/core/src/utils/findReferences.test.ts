import { describe, expect, it } from 'vitest';
import type { ParsedNode, YAMLMap } from 'yaml';

import { runReader } from '../fixtures/runReader.ts';
import type { ParserContext } from './yaml/ParserContext.ts';
import { readValue } from './yaml/readValue.ts';
import { findReferences } from './findReferences.ts';

// Finds the references in the value under the `V` key of the snippet.
const find = (source: string) =>
  findReferences(runReader((root: YAMLMap.Parsed, ctx: ParserContext) => readValue(root.get('V', true) as ParsedNode, ctx), source).value);
const targets = (source: string) => find(source).map(({ target, attribute }) => (attribute ? `${target}.${attribute}` : target));

const at = (line: number, column: number) => expect.objectContaining({ start: expect.objectContaining({ line, column }) });

describe('findReferences', () => {
  it('finds nothing in literals', () => {
    expect(find(`V:\n  Name: bucket\n  Ports: [80, 443]`)).toEqual([]);
  });

  describe('Ref', () => {
    it.each([
      ['short form', 'V: !Ref Bucket'],
      ['long form', 'V: { Ref: Bucket }'],
    ])('reads the %s, at the whole function', (_label, source) => {
      expect(find(source)).toEqual([{ target: 'Bucket', via: 'Ref', range: at(1, 4) }]);
    });

    it('keeps parameters and pseudo parameters, for the caller to filter', () => {
      expect(targets(`V: [!Ref Env, !Ref AWS::Region]`)).toEqual(['Env', 'AWS::Region']);
    });

    // Logical IDs may be all digits
    it.each([
      ['short form', 'V: !Ref 123'],
      ['long form', 'V: { Ref: 123 }'],
    ])('reads an unquoted number in the %s as a name', (_label, source) => {
      expect(targets(source)).toEqual(['123']);
    });

    // A function inside Ref needs AWS::LanguageExtensions; its target is only known at deploy time
    it('skips a computed target but keeps references inside it', () => {
      expect(find(`V: !Ref { 'Fn::Join': ['', [!Ref Stage, Topic]] }`)).toEqual([expect.objectContaining({ target: 'Stage', via: 'Ref' })]);
    });
  });

  describe('Fn::GetAtt', () => {
    it.each([
      ['short form', 'V: !GetAtt Bucket.Arn'],
      ['short form with a list', 'V: !GetAtt [Bucket, Arn]'],
      ['long form', `V: { 'Fn::GetAtt': [Bucket, Arn] }`],
    ])('reads the %s', (_label, source) => {
      expect(find(source)).toEqual([{ target: 'Bucket', attribute: 'Arn', via: 'Fn::GetAtt', range: at(1, 4) }]);
    });

    // Attribute names may contain dots: the logical ID ends at the first one
    it.each([
      ['short form', 'V: !GetAtt Elb.SourceSecurityGroup.OwnerAlias'],
      ['list form', 'V: !GetAtt [Elb, SourceSecurityGroup.OwnerAlias]'],
    ])('reads a dotted attribute in the %s', (_label, source) => {
      expect(find(source)).toEqual([expect.objectContaining({ target: 'Elb', attribute: 'SourceSecurityGroup.OwnerAlias' })]);
    });

    // The attribute name may be a Ref; the resource is still known
    it('keeps the resource when the attribute is computed, and the Ref inside it', () => {
      expect(find('V: !GetAtt [Bucket, !Ref AttrName]')).toEqual([
        expect.objectContaining({ target: 'Bucket', attribute: undefined, via: 'Fn::GetAtt' }),
        expect.objectContaining({ target: 'AttrName', via: 'Ref' }),
      ]);
    });

    it('skips a computed resource name', () => {
      expect(targets(`V: !GetAtt [!Sub 'Queue\${Stage}', Arn]`)).toEqual(['Stage']);
    });
  });

  describe('Fn::Sub', () => {
    it('reads ${Name} as a Ref and ${Name.Attr} as a GetAtt, at the string', () => {
      expect(find(`V: !Sub 'arn:\${AWS::Partition}:s3:::\${Bucket}/\${Role.Arn}'`)).toEqual([
        { target: 'AWS::Partition', via: 'Fn::Sub', range: at(1, 9) },
        { target: 'Bucket', via: 'Fn::Sub', range: at(1, 9) },
        { target: 'Role', attribute: 'Arn', via: 'Fn::Sub', range: at(1, 9) },
      ]);
    });

    it('reads the long form', () => {
      expect(targets(`V: { 'Fn::Sub': '\${Bucket}' }`)).toEqual(['Bucket']);
    });

    it('skips ${!Literal}', () => {
      expect(targets(`V: !Sub '\${!Literal}-\${Bucket}'`)).toEqual(['Bucket']);
    });

    // Variables from the map are local to the Sub, not template names; their values are walked
    it('skips map variables and reads references in their values', () => {
      expect(targets(`V: !Sub ['www.\${Domain}.\${Zone}', { Domain: !Ref RootDomain }]`)).toEqual(['Zone', 'RootDomain']);
    });
  });

  it('walks lists, objects and other functions', () => {
    const source = `V:
  Tags:
    - Value: !If [IsProd, !Ref ProdTopic, !GetAtt DevTopic.Name]
  Code: { 'Fn::Join': ['', [!Ref Bucket]] }`;

    expect(targets(source)).toEqual(['ProdTopic', 'DevTopic.Name', 'Bucket']);
  });
});

it('preserves nested branch conditions', () => {
  const refs = find('V: !If [Prod, !If [Blue, !Ref A, !Ref B], !Ref C]');
  expect(refs.map(({ target, conditions }) => ({ target, conditions }))).toEqual([
    {
      target: 'A',
      conditions: [
        { name: 'Prod', value: true },
        { name: 'Blue', value: true },
      ],
    },
    {
      target: 'B',
      conditions: [
        { name: 'Prod', value: true },
        { name: 'Blue', value: false },
      ],
    },
    { target: 'C', conditions: [{ name: 'Prod', value: false }] },
  ]);
});
