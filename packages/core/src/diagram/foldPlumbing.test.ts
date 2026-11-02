import { describe, expect, it } from 'vitest';

import { parseTemplate } from '../lib/parser.ts';
import type { Template } from '../types';
import { buildDiagram } from './buildDiagram.ts';

// `Name: Type` plus property lines, indented for the Resources section. An empty Properties reads as none.
const res = (name: string, type: string, ...properties: string[]) =>
  [`  ${name}:`, `    Type: ${type}`, '    Properties:', ...properties.map((line) => `      ${line}`)].join('\n');
const fn = (name: string, ...properties: string[]) => res(name, 'AWS::Lambda::Function', ...properties);
const role = (name: string, ...properties: string[]) => res(name, 'AWS::IAM::Role', ...properties);

const build = (foldPlumbing: boolean, ...resources: string[]) =>
  buildDiagram(parseTemplate(`Resources:\n${resources.join('\n')}`).template as Template, { foldPlumbing });
const folded = (...resources: string[]) => build(true, ...resources);
const nodeIds = (...resources: string[]) => folded(...resources).nodes.map(({ id }) => id);
const foldedInto = (id: string, ...resources: string[]) =>
  folded(...resources)
    .nodes.find((node) => node.id === id)
    ?.folded.map((resource) => resource.id);
const edges = (...resources: string[]) => folded(...resources).edges.map(({ source, target }) => `${source} → ${target}`);

describe('folding plumbing', () => {
  it('folds plumbing into its only owner', () => {
    const resources = [role('Role'), fn('Handler', 'Role: !GetAtt Role.Arn')];

    expect(nodeIds(...resources)).toEqual(['Handler']);
    expect(folded(...resources).nodes[0]?.folded).toEqual([
      { id: 'Role', type: 'AWS::IAM::Role', typeName: 'IAM role', icon: 'shield', range: expect.anything() },
    ]);
  });

  // D28: shared plumbing is part of the architecture
  it('keeps plumbing with several owners visible', () => {
    expect(nodeIds(role('Role'), fn('A', 'Role: !GetAtt Role.Arn'), fn('B', 'Role: !GetAtt Role.Arn'))).toEqual(['Role', 'A', 'B']);
  });

  it('keeps plumbing without an owner visible', () => {
    expect(nodeIds(res('Sg', 'AWS::EC2::SecurityGroup', 'GroupDescription: lonely'))).toEqual(['Sg']);
  });

  it('follows chains: a policy on a role folds with the role, in template order', () => {
    const resources = [res('Policy', 'AWS::IAM::Policy', 'Roles: [!Ref Role]'), role('Role'), fn('Handler', 'Role: !GetAtt Role.Arn')];

    expect(nodeIds(...resources)).toEqual(['Handler']);
    expect(foldedInto('Handler', ...resources)).toEqual(['Policy', 'Role']);
  });

  it('folds a launch template and everything it uses into its Auto Scaling group', () => {
    const resources = [
      role('Role'),
      res('Profile', 'AWS::IAM::InstanceProfile', 'Roles: [!Ref Role]'),
      res('Sg', 'AWS::EC2::SecurityGroup', 'GroupDescription: web'),
      res(
        'Template',
        'AWS::EC2::LaunchTemplate',
        'LaunchTemplateData:',
        '  IamInstanceProfile:',
        '    Arn: !GetAtt Profile.Arn',
        '  SecurityGroupIds: [!Ref Sg]',
      ),
      res('Servers', 'AWS::AutoScaling::AutoScalingGroup', 'LaunchTemplate:', '  LaunchTemplateId: !Ref Template'),
    ];

    expect(nodeIds(...resources)).toEqual(['Servers']);
    expect(foldedInto('Servers', ...resources)).toEqual(['Role', 'Profile', 'Sg', 'Template']);
  });

  // A rule naming a group as its traffic source is about the traffic, not a use of that group
  it.each([
    ['inline in another group', [res('DbSg', 'AWS::EC2::SecurityGroup', 'SecurityGroupIngress:', '  - SourceSecurityGroupId: !Ref WebSg')]],
    [
      'in a separate rule',
      [
        res('DbSg', 'AWS::EC2::SecurityGroup', 'GroupDescription: db'),
        res('DbRule', 'AWS::EC2::SecurityGroupIngress', 'GroupId: !Ref DbSg', 'SourceSecurityGroupId: !Ref WebSg'),
      ],
    ],
  ])('folds a security group into its user when it is named %s', (_, dbSecurityGroup) => {
    // The database side first: once DbSg folds into Db, Db would look like a second owner of WebSg
    const resources = [
      ...dbSecurityGroup,
      res('Db', 'AWS::RDS::DBInstance', 'VPCSecurityGroups: [!Ref DbSg]'),
      res('WebSg', 'AWS::EC2::SecurityGroup', 'GroupDescription: web'),
      res('Web', 'AWS::EC2::Instance', 'SecurityGroupIds: [!Ref WebSg]'),
    ];

    expect(nodeIds(...resources)).toEqual(['Db', 'Web']);
    expect(edges(...resources)).toEqual(['Db → Web']);
  });

  it('stops a chain at a shared link', () => {
    const resources = [
      res('Policy', 'AWS::IAM::Policy', 'Roles: [!Ref Role]'),
      role('Role'),
      fn('A', 'Role: !GetAtt Role.Arn'),
      fn('B', 'Role: !GetAtt Role.Arn'),
    ];

    expect(nodeIds(...resources)).toEqual(['Policy', 'Role', 'A', 'B']);
  });

  // A policy's Roles, a permission's FunctionName: what it's attached to, not what it mentions
  describe('owner', () => {
    it('is what attached plumbing names in its attachment property', () => {
      const resources = [
        res('Uploads', 'AWS::S3::Bucket'),
        fn('Handler'),
        res('Invoke', 'AWS::Lambda::Permission', 'FunctionName: !Ref Handler', 'SourceArn: !GetAtt Uploads.Arn'),
      ];

      expect(nodeIds(...resources)).toEqual(['Uploads', 'Handler']);
      expect(foldedInto('Handler', ...resources)).toEqual(['Invoke']);
    });

    // The role's own references are what it grants access to
    it('is whoever uses plumbing without an attachment property', () => {
      const resources = [
        res('Bucket', 'AWS::S3::Bucket'),
        role('Role', 'Policies: [{ PolicyDocument: { Resource: !GetAtt Bucket.Arn } }]'),
        fn('Handler', 'Role: !GetAtt Role.Arn'),
      ];

      expect(foldedInto('Handler', ...resources)).toEqual(['Role']);
    });

    it('falls back to whoever uses it when the attachment property names nothing in the template', () => {
      const resources = [
        res('Ip', 'AWS::EC2::EIP', 'Domain: vpc'),
        res('Nat', 'AWS::EC2::NatGateway', 'AllocationId: !GetAtt Ip.AllocationId'),
      ];

      expect(foldedInto('Nat', ...resources)).toEqual(['Ip']);
    });
  });

  describe('edges', () => {
    // The role's policy reads the bucket, so the function does
    it('move from the folded resource to its owner', () => {
      const resources = [
        res('Bucket', 'AWS::S3::Bucket'),
        role('Role', 'Policies: [{ PolicyDocument: { Resource: !GetAtt Bucket.Arn } }]'),
        fn('Handler', 'Role: !GetAtt Role.Arn'),
      ];

      expect(folded(...resources).edges).toEqual([{ source: 'Handler', target: 'Bucket', via: ['Fn::GetAtt'] }]);
    });

    it('merge with an edge the owner already has', () => {
      const resources = [
        res('Bucket', 'AWS::S3::Bucket'),
        role('Role', 'Policies: [{ PolicyDocument: { Resource: !GetAtt Bucket.Arn } }]'),
        fn('Handler', 'Role: !GetAtt Role.Arn', 'Environment: { Variables: { BUCKET: !Ref Bucket } }'),
      ];

      expect(folded(...resources).edges).toEqual([{ source: 'Handler', target: 'Bucket', via: ['Fn::GetAtt', 'Ref'] }]);
    });

    it('drop the link between a resource and what folded into it', () => {
      expect(edges(role('Role'), fn('Handler', 'Role: !GetAtt Role.Arn'))).toEqual([]);
    });
  });

  describe('routing plumbing', () => {
    const routing = [
      res('Vpc', 'AWS::EC2::VPC'),
      res('Igw', 'AWS::EC2::InternetGateway'),
      res('Attach', 'AWS::EC2::VPCGatewayAttachment', 'VpcId: !Ref Vpc', 'InternetGatewayId: !Ref Igw'),
      res('Routes', 'AWS::EC2::RouteTable', 'VpcId: !Ref Vpc'),
      res('Route', 'AWS::EC2::Route', 'RouteTableId: !Ref Routes', 'GatewayId: !Ref Igw'),
    ];

    it('is absorbed by the boxes: not drawn, listed on the model', () => {
      const model = folded(...routing);

      expect(model.nodes.map(({ id }) => id)).toEqual(['Igw']);
      expect(model.edges).toEqual([]);
      expect(model.absorbed.map(({ id }) => id)).toEqual(['Attach', 'Routes', 'Route']);
    });

    // A subnet group's subnets already place the database (findContainment)
    it('includes subnet groups', () => {
      const model = folded(
        res('DbSubnets', 'AWS::RDS::DBSubnetGroup'),
        res('Database', 'AWS::RDS::DBInstance', 'DBSubnetGroupName: !Ref DbSubnets'),
      );

      expect(model.nodes.map(({ id }) => id)).toEqual(['Database']);
      expect(model.absorbed.map(({ id }) => id)).toEqual(['DbSubnets']);
    });
  });

  // "Show all resources"
  it('draws everything when folding is off', () => {
    const model = build(
      false,
      res('Policy', 'AWS::IAM::Policy', 'Roles: [!Ref Role]'),
      role('Role'),
      fn('Handler', 'Role: !GetAtt Role.Arn'),
      res('Routes', 'AWS::EC2::RouteTable'),
    );

    expect(model.nodes.map(({ id, folded }) => [id, folded.length])).toEqual([
      ['Policy', 0],
      ['Role', 0],
      ['Handler', 0],
      ['Routes', 0],
    ]);
    expect(model.absorbed).toEqual([]);
    expect(model.edges.map(({ source, target }) => `${source} → ${target}`)).toEqual(['Policy → Role', 'Handler → Role']);
  });
});
