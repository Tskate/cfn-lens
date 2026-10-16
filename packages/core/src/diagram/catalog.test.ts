import { describe, expect, it } from 'vitest';

import { describeResourceType } from './catalog.ts';

describe('describeResourceType', () => {
  it.each([
    ['AWS::EC2::Instance', 'EC2 instance', 'server'],
    ['AWS::ElasticLoadBalancingV2::LoadBalancer', 'Load balancer', 'loadBalancer'],
    ['AWS::EC2::NatGateway', 'NAT gateway', 'natGateway'],
    ['AWS::S3::Bucket', 'S3 bucket', 'bucket'],
    ['AWS::RDS::DBInstance', 'RDS database', 'database'],
  ])('names %s and gives it an icon', (type, name, icon) => {
    expect(describeResourceType(type)).toEqual({ name, icon });
  });

  it.each(['Custom::DbSeeder', 'AWS::CloudFormation::CustomResource'])('calls %s a custom resource', (type) => {
    expect(describeResourceType(type)).toEqual({ name: 'Custom resource', icon: 'unknown' });
  });

  // Never dropped (D11): an unknown type still gets a readable name and the generic icon
  it.each([
    ['AWS::EC2::VPCEndpoint', 'EC2 VPCEndpoint'],
    ['MyOrg::Network::Vpc::MODULE', 'MyOrg Network Vpc MODULE'],
  ])('derives a name for %s', (type, name) => {
    expect(describeResourceType(type)).toEqual({ name, icon: 'unknown' });
  });
});
