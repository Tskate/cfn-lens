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
  it('has no groups, nodes or edges without resources', () => {
    expect(buildDiagram(parseTemplate('Description: x').template as Template)).toEqual({ groups: [], nodes: [], edges: [], absorbed: [] });
  });

  it('makes one node per resource, in template order', () => {
    const { nodes } = diagram(`  Queue:\n    Type: AWS::SQS::Queue\n  Bucket:\n    Type: AWS::S3::Bucket\n    Condition: IsProd`);

    expect(nodes).toEqual([
      {
        id: 'Queue',
        type: 'AWS::SQS::Queue',
        typeName: 'SQS queue',
        icon: 'queue',
        description: undefined,
        docsUrl: expect.stringContaining('aws-resource-sqs-queue.html'),
        condition: undefined,
        range: at(5, 3),
        parentId: undefined,
        folded: [],
      },
      {
        id: 'Bucket',
        type: 'AWS::S3::Bucket',
        typeName: 'S3 bucket',
        icon: 'bucket',
        description: undefined,
        docsUrl: expect.stringContaining('aws-resource-s3-bucket.html'),
        condition: 'IsProd',
        range: at(7, 3),
        parentId: undefined,
        folded: [],
      },
    ]);
  });

  // Placement rules are covered in findContainment.test.ts
  describe('containers', () => {
    const network = [
      `  Vpc:\n    Type: AWS::EC2::VPC`,
      `  Subnet:\n    Type: AWS::EC2::Subnet\n    Properties:\n      VpcId: !Ref Vpc`,
      `  Server:\n    Type: AWS::EC2::Instance\n    Properties:\n      SubnetId: !Ref Subnet\n      Topic: !Ref Alerts`,
      resource('Alerts', 'Vpc: !Ref Vpc'),
    ].join('\n');

    it('turn VPCs and subnets into groups instead of nodes', () => {
      const { groups, nodes } = diagram(network);

      expect(groups.map(({ id }) => id)).toEqual(['Vpc', 'Subnet']);
      expect(nodes.map(({ id }) => id)).toEqual(['Server', 'Alerts']);
    });

    it('give each node the group it sits in', () => {
      expect(diagram(network).nodes.map(({ id, parentId }) => [id, parentId])).toEqual([
        ['Server', 'Subnet'],
        ['Alerts', undefined],
      ]);
    });

    it('drop edges to groups, which placement already shows', () => {
      expect(edges(network)).toEqual(['Server → Alerts']);
    });
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
      expect(diagram(`${resource('Vpc')}\n  Server:\n    Type: AWS::EC2::Instance\n    DependsOn: Vpc`).edges).toEqual([
        { source: 'Server', target: 'Vpc', via: ['DependsOn'] },
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

it('retains opposite branch guards on diagram connections', () => {
  const model = diagram(`  A:
    Type: AWS::SNS::Topic
    Properties:
      Value: !If [Prod, !Ref B, !Ref C]
  B:
    Type: AWS::SNS::Topic
  C:
    Type: AWS::SNS::Topic`);
  expect(model.edges).toEqual([
    { source: 'A', target: 'B', via: ['Ref'], conditionPaths: [[{ name: 'Prod', value: true }]] },
    { source: 'A', target: 'C', via: ['Ref'], conditionPaths: [[{ name: 'Prod', value: false }]] },
  ]);
});
