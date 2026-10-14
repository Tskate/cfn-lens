import { describe, expect, it } from 'vitest';

import { parseTemplate } from '../lib/parser.ts';
import type { Template } from '../types';
import { buildDiagram } from './buildDiagram.ts';

const at = (line: number, column: number) => expect.objectContaining({ start: expect.objectContaining({ line, column }) });

const diagram = (resources: string) => {
  const { template } = parseTemplate(`Parameters:\n  Env:\n    Type: String\nResources:\n${resources}`);
  return buildDiagram(template as Template);
};
const edges = (resources: string) => diagram(resources).edges.map(({ source, target }) => `${source} → ${target}`);
const resource = (name: string, ...properties: string[]) =>
  [`  ${name}:`, `    Type: AWS::SNS::Topic`, `    Properties:`, ...properties.map((line) => `      ${line}`)].join('\n');

describe('buildDiagram', () => {
  it('has no nodes or edges without resources', () => {
    expect(buildDiagram(parseTemplate('Description: x').template as Template)).toEqual({ nodes: [], edges: [] });
  });

  it('makes one node per resource, in template order', () => {
    const { nodes } = diagram(`  Vpc:\n    Type: AWS::EC2::VPC\n  Bucket:\n    Type: AWS::S3::Bucket\n    Condition: IsProd`);

    expect(nodes).toEqual([
      { id: 'Vpc', type: 'AWS::EC2::VPC', condition: undefined, range: at(5, 3) },
      { id: 'Bucket', type: 'AWS::S3::Bucket', condition: 'IsProd', range: at(7, 3) },
    ]);
  });

  describe('edges', () => {
    it.each([
      ['Ref', 'VpcId: !Ref Vpc'],
      ['Fn::GetAtt', 'Cidr: !GetAtt Vpc.CidrBlock'],
      ['Fn::Sub', `Name: !Sub '\${Vpc}-subnet'`],
    ])('point from the resource holding a %s to the resource it names', (via, property) => {
      expect(diagram([resource('Vpc'), resource('Subnet', property)].join('\n')).edges).toEqual([
        { source: 'Subnet', target: 'Vpc', via: [via] },
      ]);
    });

    it('come from DependsOn', () => {
      expect(diagram(`${resource('Vpc')}\n  Subnet:\n    Type: AWS::EC2::Subnet\n    DependsOn: Vpc`).edges).toEqual([
        { source: 'Subnet', target: 'Vpc', via: ['DependsOn'] },
      ]);
    });

    it('come from nested values and every Fn::If branch', () => {
      const source = [resource('Prod'), resource('Dev'), resource('Alarm', 'Actions:', '  - !If [IsProd, !Ref Prod, !Ref Dev]')].join('\n');

      expect(edges(source)).toEqual(['Alarm → Prod', 'Alarm → Dev']);
    });

    // One line per pair keeps the diagram readable; via says how they're linked
    it('merge every reference between the same pair, listing each kind once', () => {
      const source = [
        resource('Vpc'),
        `${resource('Subnet', 'VpcId: !Ref Vpc', 'Cidr: !GetAtt Vpc.CidrBlock', 'Other: !Ref Vpc')}\n    DependsOn: Vpc`,
      ].join('\n');

      expect(diagram(source).edges).toEqual([{ source: 'Subnet', target: 'Vpc', via: ['Ref', 'Fn::GetAtt', 'DependsOn'] }]);
    });

    it('keep both directions as separate edges', () => {
      expect(edges([resource('A', 'X: !Ref B'), resource('B', 'X: !GetAtt A.Arn')].join('\n'))).toEqual(['A → B', 'B → A']);
    });

    it('skip parameters, pseudo parameters and unknown names', () => {
      expect(edges(resource('Topic', 'A: !Ref Env', 'B: !Ref AWS::Region', 'C: !Ref Missing', `D: !Sub '\${Gone.Arn}'`))).toEqual([]);
    });

    it('skip a resource referencing itself', () => {
      expect(edges(resource('Topic', 'Name: !GetAtt Topic.TopicName'))).toEqual([]);
    });

    // Metadata and policies describe how a resource is managed, not how the architecture connects
    it('ignore references outside Properties and DependsOn', () => {
      expect(edges(`${resource('Queue')}\n  Topic:\n    Type: AWS::SNS::Topic\n    Metadata:\n      Uses: !Ref Queue`)).toEqual([]);
    });
  });
});
