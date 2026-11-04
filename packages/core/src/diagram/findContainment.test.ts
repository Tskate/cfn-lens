import { describe, expect, it } from 'vitest';

import { parseTemplate } from '../lib/parser.ts';
import type { Template } from '../types';
import { findContainment } from './findContainment.ts';

const contain = (resources: string) => findContainment(parseTemplate(`Resources:\n${resources}`).template as Template);

// `Name: Type` plus property lines, indented for the Resources section. An empty Properties reads as none.
const res = (name: string, type: string, ...properties: string[]) =>
  [`  ${name}:`, `    Type: ${type}`, '    Properties:', ...properties.map((line) => `      ${line}`)].join('\n');
const vpc = res('AppVpc', 'AWS::EC2::VPC', 'CidrBlock: 10.0.0.0/16');
const subnet = (name: string, ...properties: string[]) => res(name, 'AWS::EC2::Subnet', 'VpcId: !Ref AppVpc', ...properties);
const inZone = (index: number) => `AvailabilityZone: !Select [${index}, !GetAZs '']`;

// Two AZs with a public and a private subnet each, as on the design render
const webApp = [
  vpc,
  subnet('PublicSubnetA', inZone(0), 'CidrBlock: 10.0.1.0/24'),
  subnet('PublicSubnetB', inZone(1)),
  subnet('PrivateSubnetA', inZone(0)),
  subnet('PrivateSubnetB', inZone(1)),
  res('AppIgw', 'AWS::EC2::InternetGateway'),
  res('PublicRoutes', 'AWS::EC2::RouteTable', 'VpcId: !Ref AppVpc'),
  res('InternetRoute', 'AWS::EC2::Route', 'RouteTableId: !Ref PublicRoutes', 'GatewayId: !Ref AppIgw', 'DestinationCidrBlock: 0.0.0.0/0'),
  res('PublicAssocA', 'AWS::EC2::SubnetRouteTableAssociation', 'SubnetId: !Ref PublicSubnetA', 'RouteTableId: !Ref PublicRoutes'),
  res('PublicAssocB', 'AWS::EC2::SubnetRouteTableAssociation', 'SubnetId: !Ref PublicSubnetB', 'RouteTableId: !Ref PublicRoutes'),
].join('\n');

describe('findContainment', () => {
  it('finds no groups without a VPC or subnet', () => {
    const { groups, parentOf } = contain(res('Bucket', 'AWS::S3::Bucket'));

    expect(groups).toEqual([]);
    expect(parentOf.size).toBe(0);
  });

  describe('groups', () => {
    it('nest VPC › AZ › subnet, parents first', () => {
      expect(contain(webApp).groups).toEqual([
        { kind: 'vpc', id: 'AppVpc', cidr: '10.0.0.0/16', range: expect.anything() },
        { kind: 'availabilityZone', id: 'AppVpc:AZ 1', name: 'AZ 1', parentId: 'AppVpc' },
        { kind: 'availabilityZone', id: 'AppVpc:AZ 2', name: 'AZ 2', parentId: 'AppVpc' },
        { kind: 'subnet', id: 'PublicSubnetA', access: 'public', cidr: '10.0.1.0/24', parentId: 'AppVpc:AZ 1', range: expect.anything() },
        expect.objectContaining({ id: 'PublicSubnetB', access: 'public', parentId: 'AppVpc:AZ 2' }),
        expect.objectContaining({ id: 'PrivateSubnetA', access: 'private', parentId: 'AppVpc:AZ 1' }),
        expect.objectContaining({ id: 'PrivateSubnetB', access: 'private', parentId: 'AppVpc:AZ 2' }),
      ]);
    });

    it('name an AZ written as a literal', () => {
      expect(contain([vpc, subnet('Subnet', 'AvailabilityZone: us-east-1a')].join('\n')).groups).toContainEqual({
        kind: 'availabilityZone',
        id: 'AppVpc:us-east-1a',
        name: 'us-east-1a',
        parentId: 'AppVpc',
      });
    });

    // D29: anything else can't be resolved, so there's no AZ box
    it.each([
      ['a parameter', 'AvailabilityZone: !Ref Zone'],
      ['a Select from a list', `AvailabilityZone: !Select [0, [a, b]]`],
      ['no AvailabilityZone', 'CidrBlock: 10.0.1.0/24'],
    ])('put a subnet with %s directly in its VPC', (_label, property) => {
      const { groups } = contain([vpc, subnet('Subnet', property)].join('\n'));

      expect(groups.map((group) => group.kind)).toEqual(['vpc', 'subnet']);
      expect(groups[1]).toMatchObject({ parentId: 'AppVpc' });
    });

    it('leave a subnet outside any VPC when its VPC is not in the template', () => {
      expect(contain(res('Subnet', 'AWS::EC2::Subnet', 'VpcId: !ImportValue SharedVpc')).groups).toEqual([
        expect.objectContaining({ kind: 'subnet', id: 'Subnet', parentId: undefined }),
      ]);
    });

    // Only a direct route to an internet gateway makes a subnet public
    it.each([
      ['no route table', []],
      [
        'a route through a NAT gateway',
        [
          res('Routes', 'AWS::EC2::RouteTable', 'VpcId: !Ref AppVpc'),
          res('Nat', 'AWS::EC2::NatGateway'),
          res('NatRoute', 'AWS::EC2::Route', 'RouteTableId: !Ref Routes', 'NatGatewayId: !Ref Nat'),
          res('Assoc', 'AWS::EC2::SubnetRouteTableAssociation', 'SubnetId: !Ref Subnet', 'RouteTableId: !Ref Routes'),
        ],
      ],
      // A VPN-only subnet: GatewayId, but a virtual private gateway, not an internet gateway
      [
        'a route through a VPN gateway',
        [
          res('Routes', 'AWS::EC2::RouteTable', 'VpcId: !Ref AppVpc'),
          res('Vgw', 'AWS::EC2::VPNGateway', 'Type: ipsec.1'),
          res('VpnRoute', 'AWS::EC2::Route', 'RouteTableId: !Ref Routes', 'GatewayId: !Ref Vgw'),
          res('Assoc', 'AWS::EC2::SubnetRouteTableAssociation', 'SubnetId: !Ref Subnet', 'RouteTableId: !Ref Routes'),
        ],
      ],
    ])('call a subnet with %s private', (_label, extra) => {
      expect(contain([vpc, subnet('Subnet'), ...extra].join('\n')).groups[1]).toMatchObject({ id: 'Subnet', access: 'private' });
    });
  });

  describe('placement', () => {
    const place = (...resources: string[]) => contain([webApp, ...resources].join('\n')).parentOf;

    it('puts a resource in the one subnet it references', () => {
      expect(place(res('WebServer', 'AWS::EC2::Instance', 'SubnetId: !Ref PrivateSubnetA')).get('WebServer')).toBe('PrivateSubnetA');
    });

    it('puts a resource across subnets of one AZ in that AZ', () => {
      const parentOf = place(res('Alb', 'AWS::ElasticLoadBalancingV2::LoadBalancer', 'Subnets: [!Ref PublicSubnetA, !Ref PrivateSubnetA]'));

      expect(parentOf.get('Alb')).toBe('AppVpc:AZ 1');
    });

    it('puts a resource across AZs in the VPC', () => {
      const parentOf = place(res('Alb', 'AWS::ElasticLoadBalancingV2::LoadBalancer', 'Subnets: [!Ref PublicSubnetA, !Ref PublicSubnetB]'));

      expect(parentOf.get('Alb')).toBe('AppVpc');
    });

    it('follows a subnet group to its subnets', () => {
      const parentOf = place(
        res('DbSubnets', 'AWS::RDS::DBSubnetGroup', 'SubnetIds: [!Ref PrivateSubnetA]'),
        res('Database', 'AWS::RDS::DBInstance', 'DBSubnetGroupName: !Ref DbSubnets'),
      );

      expect(parentOf.get('Database')).toBe('PrivateSubnetA');
    });

    it('puts a resource that references only the VPC in the VPC', () => {
      expect(place(res('WebSg', 'AWS::EC2::SecurityGroup', 'VpcId: !Ref AppVpc')).get('WebSg')).toBe('AppVpc');
      expect(place().get('PublicRoutes')).toBe('AppVpc');
    });

    it('leaves resources without network references outside', () => {
      const parentOf = place(res('Logs', 'AWS::S3::Bucket'));

      expect(parentOf.has('Logs')).toBe(false);
      expect(parentOf.has('AppIgw')).toBe(false);
    });

    // DependsOn orders creation; it doesn't put a resource into a network
    it('keeps alternative subnet choices out of simultaneous containment', () => {
      const result = contain(
        [webApp, res('Server', 'AWS::EC2::Instance', 'SubnetId: !If [Prod, !Ref PrivateSubnetA, !Ref PrivateSubnetB]')].join('\n'),
      );
      expect(result.parentOf.has('Server')).toBe(false);
      expect(result.placementAlternatives.get('Server')).toEqual(['PrivateSubnetA if Prod=true', 'PrivateSubnetB if Prod=false']);
    });

    it('ignores incidental subnet and VPC references', () => {
      const parentOf = place(
        res('Function', 'AWS::Lambda::Function', 'Environment: {Variables: {Subnet: !Ref PrivateSubnetA}}'),
        res('Role', 'AWS::IAM::Role', 'Policies: [{PolicyDocument: {Resource: !Ref PrivateSubnetA}}]'),
        res('Bucket', 'AWS::S3::Bucket', 'Tags: [{Key: Network, Value: !Ref AppVpc}]'),
      );
      expect(parentOf.has('Function')).toBe(false);
      expect(parentOf.has('Role')).toBe(false);
      expect(parentOf.has('Bucket')).toBe(false);
    });

    it('uses nested Lambda and ECS network configuration', () => {
      const parentOf = place(
        res('Function', 'AWS::Lambda::Function', 'VpcConfig: {SubnetIds: [!Ref PrivateSubnetA]}'),
        res(
          'Service',
          'AWS::ECS::Service',
          'NetworkConfiguration: {AwsvpcConfiguration: {Subnets: [!Ref PrivateSubnetA, !Ref PrivateSubnetB]}}',
        ),
      );
      expect(parentOf.get('Function')).toBe('PrivateSubnetA');
      expect(parentOf.get('Service')).toBe('AppVpc');
    });

    it('ignores DependsOn', () => {
      expect(place(`${res('Logs', 'AWS::S3::Bucket')}\n    DependsOn: PrivateSubnetA`).has('Logs')).toBe(false);
    });

    it('never places the VPC or subnets themselves', () => {
      const parentOf = place();

      expect(parentOf.has('AppVpc')).toBe(false);
      expect(parentOf.has('PublicSubnetA')).toBe(false);
    });
  });
});
