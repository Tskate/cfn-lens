import { describe, expect, it } from 'vitest';

import { describeResourceType, docsUrlFor } from './catalog.ts';

describe('describeResourceType', () => {
  it.each([
    ['AWS::EC2::Instance', 'EC2 instance', 'server'],
    ['AWS::AutoScaling::AutoScalingGroup', 'Auto Scaling group', 'server'],
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

describe('docsUrlFor', () => {
  it.each([
    ['AWS::EC2::Instance', 'aws-resource-ec2-instance'],
    ['AWS::ElasticLoadBalancingV2::LoadBalancer', 'aws-resource-elasticloadbalancingv2-loadbalancer'],
    // Not in the catalog: the reference follows the same pattern for every AWS type
    ['AWS::EC2::VPCEndpoint', 'aws-resource-ec2-vpcendpoint'],
  ])('links %s to its reference page', (type, page) => {
    expect(docsUrlFor(type)).toBe(`https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/${page}.html`);
  });

  // Custom resources, registry extensions and modules have no page in the AWS reference
  it.each(['Custom::DbSeeder', 'MyOrg::Service::Thing', 'MyOrg::Network::Vpc::MODULE', 'AWS::Serverless::Function::Extra'])(
    'has no link for %s',
    (type) => {
      expect(docsUrlFor(type)).toBeUndefined();
    },
  );
});
