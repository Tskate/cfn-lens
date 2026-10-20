import { describe, expect, it } from 'vitest';

import { parseTemplate } from '../lib/parser.ts';
import type { Template } from '../types';
import { summarizeProperties } from './summarizeProperties.ts';

// The properties of Server, next to a parameter and two resources it can point at.
const summarize = (...properties: string[]) => {
  const source = [
    'Parameters:\n  InstanceType:\n    Type: String',
    'Resources:',
    '  Subnet:\n    Type: AWS::EC2::Subnet',
    '  Sg:\n    Type: AWS::EC2::SecurityGroup',
    '  Server:\n    Type: AWS::EC2::Instance\n    Properties:',
    ...properties.map((line) => `      ${line}`),
  ].join('\n');
  return summarizeProperties(parseTemplate(source).template as Template, 'Server');
};
const value = (property: string) => summarize(`P: ${property}`)[0]?.value;

describe('summarizeProperties', () => {
  it('lists top-level properties in template order', () => {
    expect(summarize('InstanceType: t3.micro', 'Monitoring: true', 'Count: 2').map(({ name }) => name)).toEqual([
      'InstanceType',
      'Monitoring',
      'Count',
    ]);
  });

  it('is empty for a resource without properties or a missing resource', () => {
    expect(summarize()).toEqual([]);
    expect(summarizeProperties(parseTemplate('Resources:\n  A:\n    Type: AWS::SNS::Topic').template as Template, 'Gone')).toEqual([]);
  });

  it.each([
    ['a string', 't3.micro', 't3.micro'],
    ['a number', '2', '2'],
    ['a boolean', 'true', 'true'],
  ])('shows %s as text', (_label, property, text) => {
    expect(value(property)).toEqual({ kind: 'text', text });
  });

  describe('Ref', () => {
    it('names a parameter', () => {
      expect(value('!Ref InstanceType')).toEqual({ kind: 'parameter', name: 'InstanceType' });
    });

    it('names a pseudo parameter', () => {
      expect(value('!Ref AWS::Region')).toEqual({ kind: 'pseudoParameter', name: 'AWS::Region' });
    });

    it('points at a resource', () => {
      expect(value('!Ref Subnet')).toEqual({ kind: 'resource', id: 'Subnet' });
    });

    // Already reported by the validators; the panel just shows what's written
    it('shows an unknown name as text', () => {
      expect(value('!Ref Missing')).toEqual({ kind: 'text', text: 'Missing' });
    });
  });

  it('points at the resource of a GetAtt, with its attribute', () => {
    expect(value('!GetAtt Sg.GroupId')).toEqual({ kind: 'resource', id: 'Sg', attribute: 'GroupId' });
  });

  it('names any other function', () => {
    expect(value(`!Sub '\${AWS::StackName}-web'`)).toEqual({ kind: 'function', fn: 'Fn::Sub' });
  });

  describe('lists', () => {
    it('show a short list of simple values item by item', () => {
      expect(value('[!Ref Sg, !Ref Subnet]')).toEqual({
        kind: 'list',
        items: [
          { kind: 'resource', id: 'Sg' },
          { kind: 'resource', id: 'Subnet' },
        ],
      });
    });

    it.each([
      ['longer than three', '[a, b, c, d]', 4],
      ['holding mappings', '[{ Key: a }]', 1],
    ])('count a list %s', (_label, property, count) => {
      expect(value(property)).toEqual({ kind: 'count', of: 'items', count });
    });
  });

  it('counts the keys of a mapping', () => {
    expect(value('{ A: 1, B: 2 }')).toEqual({ kind: 'count', of: 'keys', count: 2 });
  });
});
