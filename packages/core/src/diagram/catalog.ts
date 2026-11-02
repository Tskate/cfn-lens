import type { ResourceIcon } from '../types';

// Plumbing supports another resource instead of being part of the architecture (D3, D28):
// - owned: folds into the one resource it belongs to, e.g. a role used by a single function
// - network: routing and subnet groups, already drawn by the VPC and subnet boxes
export type Plumbing = 'owned' | 'network';

// attachedBy: the property naming what owned plumbing is attached to (a policy's Roles). Without it,
// the plumbing belongs to whoever references it (a role belongs to the function using it).
// description: what the resource does, in plain English, written for this project (PLAN §3: not copied from AWS).
export type ResourceDescription = { name: string; icon: ResourceIcon; plumbing?: Plumbing; attachedBy?: string; description?: string };

const DOCS_BASE = 'https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference';
const AWS_RESOURCE_TYPE = /^AWS::(\w+)::(\w+)$/;

// M1 catalog (~15 types, PLAN §3). Names are sentence case, as people say them.
const catalog: Readonly<Record<string, ResourceDescription>> = {
  'AWS::EC2::VPC': { name: 'VPC', icon: 'network' },
  'AWS::EC2::Subnet': { name: 'Subnet', icon: 'network' },
  'AWS::EC2::InternetGateway': { name: 'Internet gateway', icon: 'network' },
  'AWS::EC2::NatGateway': { name: 'NAT gateway', icon: 'natGateway' },
  'AWS::EC2::Instance': { name: 'EC2 instance', icon: 'server' },
  'AWS::AutoScaling::AutoScalingGroup': { name: 'Auto Scaling group', icon: 'server' },
  'AWS::ElasticLoadBalancingV2::LoadBalancer': { name: 'Load balancer', icon: 'loadBalancer' },
  'AWS::Lambda::Function': { name: 'Lambda function', icon: 'function' },
  'AWS::ApiGateway::RestApi': { name: 'REST API', icon: 'api' },
  'AWS::ApiGatewayV2::Api': { name: 'API Gateway API', icon: 'api' },
  'AWS::S3::Bucket': { name: 'S3 bucket', icon: 'bucket' },
  'AWS::DynamoDB::Table': { name: 'DynamoDB table', icon: 'table' },
  'AWS::RDS::DBInstance': { name: 'RDS database', icon: 'database' },
  'AWS::SQS::Queue': { name: 'SQS queue', icon: 'queue' },
  'AWS::SNS::Topic': { name: 'SNS topic', icon: 'topic' },
  'AWS::CloudFront::Distribution': { name: 'CloudFront distribution', icon: 'cdn' },

  'AWS::IAM::Role': { name: 'IAM role', icon: 'shield', plumbing: 'owned' },
  'AWS::IAM::Policy': { name: 'IAM policy', icon: 'shield', plumbing: 'owned', attachedBy: 'Roles' },
  'AWS::IAM::ManagedPolicy': { name: 'Managed policy', icon: 'shield', plumbing: 'owned', attachedBy: 'Roles' },
  'AWS::IAM::InstanceProfile': { name: 'Instance profile', icon: 'shield', plumbing: 'owned' },
  'AWS::EC2::LaunchTemplate': { name: 'Launch template', icon: 'server', plumbing: 'owned' },
  'AWS::Lambda::Permission': { name: 'Lambda permission', icon: 'shield', plumbing: 'owned', attachedBy: 'FunctionName' },
  'AWS::EC2::SecurityGroup': { name: 'Security group', icon: 'shield', plumbing: 'owned' },
  'AWS::EC2::SecurityGroupIngress': { name: 'Inbound rule', icon: 'shield', plumbing: 'owned', attachedBy: 'GroupId' },
  'AWS::EC2::SecurityGroupEgress': { name: 'Outbound rule', icon: 'shield', plumbing: 'owned', attachedBy: 'GroupId' },
  'AWS::S3::BucketPolicy': { name: 'Bucket policy', icon: 'shield', plumbing: 'owned', attachedBy: 'Bucket' },
  'AWS::SQS::QueuePolicy': { name: 'Queue policy', icon: 'shield', plumbing: 'owned', attachedBy: 'Queues' },
  'AWS::SNS::TopicPolicy': { name: 'Topic policy', icon: 'shield', plumbing: 'owned', attachedBy: 'Topics' },
  'AWS::Logs::LogGroup': { name: 'Log group', icon: 'unknown', plumbing: 'owned', attachedBy: 'LogGroupName' },
  'AWS::ElasticLoadBalancingV2::TargetGroup': { name: 'Target group', icon: 'loadBalancer', plumbing: 'owned' },
  'AWS::ElasticLoadBalancingV2::Listener': { name: 'Listener', icon: 'loadBalancer', plumbing: 'owned', attachedBy: 'LoadBalancerArn' },
  'AWS::ElasticLoadBalancingV2::ListenerRule': {
    name: 'Listener rule',
    icon: 'loadBalancer',
    plumbing: 'owned',
    attachedBy: 'ListenerArn',
  },
  'AWS::ApiGatewayV2::Integration': { name: 'API integration', icon: 'api', plumbing: 'owned', attachedBy: 'ApiId' },
  'AWS::ApiGatewayV2::Route': { name: 'API route', icon: 'api', plumbing: 'owned', attachedBy: 'ApiId' },
  'AWS::ApiGatewayV2::Stage': { name: 'API stage', icon: 'api', plumbing: 'owned', attachedBy: 'ApiId' },
  'AWS::EC2::EIP': { name: 'Elastic IP', icon: 'network', plumbing: 'owned', attachedBy: 'InstanceId' },

  'AWS::EC2::RouteTable': { name: 'Route table', icon: 'network', plumbing: 'network' },
  'AWS::EC2::Route': { name: 'Route', icon: 'network', plumbing: 'network' },
  'AWS::EC2::SubnetRouteTableAssociation': { name: 'Route table association', icon: 'network', plumbing: 'network' },
  'AWS::EC2::VPCGatewayAttachment': { name: 'Gateway attachment', icon: 'network', plumbing: 'network' },
  'AWS::EC2::NetworkAcl': { name: 'Network ACL', icon: 'shield', plumbing: 'network' },
  'AWS::EC2::NetworkAclEntry': { name: 'Network ACL rule', icon: 'shield', plumbing: 'network' },
  'AWS::EC2::SubnetNetworkAclAssociation': { name: 'Network ACL association', icon: 'shield', plumbing: 'network' },
  'AWS::RDS::DBSubnetGroup': { name: 'DB subnet group', icon: 'network', plumbing: 'network' },
  'AWS::ElastiCache::SubnetGroup': { name: 'Cache subnet group', icon: 'network', plumbing: 'network' },
};

const CUSTOM_RESOURCE: ResourceDescription = { name: 'Custom resource', icon: 'unknown' };

export function describeResourceType(type: string): ResourceDescription {
  const entry = catalog[type];

  if (entry) {
    return entry;
  }

  const isCustomResource = type.startsWith('Custom::') || type === 'AWS::CloudFormation::CustomResource';

  if (isCustomResource) {
    return CUSTOM_RESOURCE;
  }

  return { name: type.replace(/^AWS::/, '').replaceAll('::', ' '), icon: 'unknown' };
}

// AWS::EC2::Instance → …/aws-resource-ec2-instance.html. The site answers 200 with a generic page for
// unknown names, so this pattern (checked against several types) is all there is to go on.
export function docsUrlFor(type: string): string | undefined {
  const match = AWS_RESOURCE_TYPE.exec(type);

  if (!match) {
    return;
  }

  const [, service = '', resource = ''] = match;
  return `${DOCS_BASE}/aws-resource-${service.toLowerCase()}-${resource.toLowerCase()}.html`;
}
