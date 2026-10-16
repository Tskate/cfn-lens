import type { SourceRange } from './diagnostics';

// What the diagram shows, without positions: layout belongs to the app.

export type ReferenceFunction = 'Ref' | 'Fn::GetAtt' | 'Fn::Sub';
export type ReferenceKind = ReferenceFunction | 'DependsOn';

// Icon ids shared with the app, which draws them.
export type ResourceIcon =
  | 'server'
  | 'function'
  | 'loadBalancer'
  | 'network'
  | 'natGateway'
  | 'cdn'
  | 'api'
  | 'bucket'
  | 'database'
  | 'table'
  | 'queue'
  | 'topic'
  | 'shield'
  | 'unknown';

// A plumbing resource that isn't drawn as its own node (D28).
export type FoldedResource = {
  id: string;
  type: string;
  typeName: string;
  range: SourceRange;
};

export type DiagramNode = {
  // The resource's logical ID
  id: string;
  type: string;
  // Friendly type name, e.g. "EC2 instance"
  typeName: string;
  icon: ResourceIcon;
  condition?: string;
  range: SourceRange;
  // The group the resource sits in; none for resources outside every VPC
  parentId?: string;
  // Plumbing folded into this node, in template order
  folded: readonly FoldedResource[];
};

// A subnet is public when its route table has a route to an internet gateway.
// https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html#subnet-types
export type SubnetAccess = 'public' | 'private';

// Containers drawn around resources: VPC › Availability Zone › Subnet (D29).
// A VPC or subnet uses its logical ID; an AZ, which isn't a resource, gets a synthetic id with ':'.
export type DiagramGroup =
  | { kind: 'vpc'; id: string; cidr?: string; range: SourceRange }
  | { kind: 'availabilityZone'; id: string; name: string; parentId?: string }
  | { kind: 'subnet'; id: string; access: SubnetAccess; cidr?: string; parentId?: string; range: SourceRange };

// source holds the reference, target is the resource it names (Subnet → Vpc).
export type DiagramEdge = {
  source: string;
  target: string;
  via: readonly ReferenceKind[];
};

export type DiagramModel = {
  // Parents come before their children
  groups: readonly DiagramGroup[];
  nodes: readonly DiagramNode[];
  edges: readonly DiagramEdge[];
  // Routing plumbing the VPC and subnet boxes already show
  absorbed: readonly FoldedResource[];
};
