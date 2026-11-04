import type { DiagramGroup, Resource, SubnetAccess, Template, TemplateValue } from '../types';
import { findReferences } from '../utils/findReferences';

export type Containment = {
  // Parents come before their children
  groups: DiagramGroup[];
  // Resource logical ID → the group it sits in; resources outside every VPC are absent
  parentOf: ReadonlyMap<string, string>;
  placementAlternatives: ReadonlyMap<string, readonly string[]>;
};

type Zone = { id: string; name: string; parentId?: string };

const VPC = 'AWS::EC2::VPC';
const SUBNET = 'AWS::EC2::Subnet';
const INTERNET_GATEWAY = 'AWS::EC2::InternetGateway';
const ROUTE = 'AWS::EC2::Route';
const ROUTE_TABLE_ASSOCIATION = 'AWS::EC2::SubnetRouteTableAssociation';

/**
 * VPC › AZ › Subnet groups (D29), and which group each other resource sits in: the smallest one
 * holding every subnet it references (directly or through a *SubnetGroup), else the VPC it references.
 */
export function findContainment(template: Template): Containment {
  const resources = [...template.resources.values()];
  const typeOf = (id: string) => template.resources.get(id)?.type;
  const references = new Map(resources.map((resource) => [resource.name, placementReferences(resource)]));
  const referencesOfType = (id: string, type: string) => (references.get(id) ?? []).filter((target) => typeOf(target) === type);

  const publicSubnets = findPublicSubnets(resources, typeOf);
  const zones = new Map<string, Zone>();

  const subnets = resources.filter(isType(SUBNET)).map((subnet): DiagramGroup & { kind: 'subnet' } => {
    const [vpcId] = referencesOfType(subnet.name, VPC);
    const zone = readZone(subnet.properties, vpcId);

    if (zone) {
      zones.set(zone.id, zone);
    }

    const access: SubnetAccess = publicSubnets.has(subnet.name) ? 'public' : 'private';
    return { kind: 'subnet', id: subnet.name, access, cidr: readCidr(subnet), parentId: zone?.id ?? vpcId, range: subnet.range };
  });

  const vpcs = resources
    .filter(isType(VPC))
    .map((vpc): DiagramGroup => ({ kind: 'vpc', id: vpc.name, cidr: readCidr(vpc), range: vpc.range }));
  const availabilityZones = [...zones.values()].map((zone): DiagramGroup => ({ kind: 'availabilityZone', ...zone }));
  const groups = [...vpcs, ...availabilityZones, ...subnets];

  const groupParents = new Map(groups.map((group) => [group.id, parentIdOf(group)]));
  const ancestorsOf = (id: string): string[] => {
    const parentId = groupParents.get(id);

    if (parentId === undefined) {
      return [id];
    }

    return [id, ...ancestorsOf(parentId)];
  };

  const subnetsReachedFrom = (id: string): string[] => {
    const type = typeOf(id);

    if (type === SUBNET) {
      return [id];
    }

    const isSubnetGroup = type?.endsWith('SubnetGroup') ?? false;

    if (!isSubnetGroup) {
      return [];
    }

    return referencesOfType(id, SUBNET);
  };

  const parentOf = new Map<string, string>();
  const placementAlternatives = new Map<string, readonly string[]>();

  for (const resource of resources) {
    if (groupParents.has(resource.name)) {
      continue;
    }

    const conditional = placementValues(resource)
      .flatMap(findReferences)
      .filter((ref) => ref.conditions?.length);
    if (conditional.length > 0) {
      placementAlternatives.set(
        resource.name,
        conditional.map(
          (ref) => `${ref.target} if ${ref.conditions!.map((condition) => `${condition.name}=${condition.value}`).join(' and ')}`,
        ),
      );
      continue;
    }
    const targets = references.get(resource.name) ?? [];
    const subnetIds = targets.flatMap(subnetsReachedFrom);
    const parentId = lowestCommonGroup(subnetIds.map(ancestorsOf)) ?? referencesOfType(resource.name, VPC)[0];

    if (parentId !== undefined) {
      parentOf.set(resource.name, parentId);
    }
  }

  return { groups, parentOf, placementAlternatives };
}

// Public = associated with a route table that has a route to an internet gateway in this template.
// Subnets without an association use the VPC's main route table, which a template can't add routes to.
function findPublicSubnets(resources: readonly Resource[], typeOf: (id: string) => string | undefined): Set<string> {
  const internetRouteTables = new Set<string>();

  for (const route of resources.filter(isType(ROUTE))) {
    const gateway = propertyTarget(route, 'GatewayId');
    const routeTable = propertyTarget(route, 'RouteTableId');
    const isInternetRoute = gateway !== undefined && typeOf(gateway) === INTERNET_GATEWAY;

    if (isInternetRoute && routeTable !== undefined) {
      internetRouteTables.add(routeTable);
    }
  }

  const publicSubnets = new Set<string>();

  for (const association of resources.filter(isType(ROUTE_TABLE_ASSOCIATION))) {
    const routeTable = propertyTarget(association, 'RouteTableId');
    const subnet = propertyTarget(association, 'SubnetId');
    const isPublic = routeTable !== undefined && internetRouteTables.has(routeTable);

    if (isPublic && subnet !== undefined) {
      publicSubnets.add(subnet);
    }
  }

  return publicSubnets;
}

// A literal zone name, or !Select [N, !GetAZs …] → "AZ N+1". Anything else can't be resolved (D29).
function readZone(properties: TemplateValue | undefined, vpcId: string | undefined): Zone | undefined {
  const value = entryOf(properties, 'AvailabilityZone');
  const name = literalString(value) ?? selectedZoneName(value);

  if (name === undefined) {
    return;
  }

  return { id: `${vpcId ?? ''}:${name}`, name, parentId: vpcId };
}

function selectedZoneName(value: TemplateValue | undefined): string | undefined {
  const [index, list] = selectArguments(value);
  const isZoneList = list?.kind === 'intrinsic' && list.fn === 'Fn::GetAZs';
  const position = index?.kind === 'scalar' ? Number(index.value) : NaN;

  if (!isZoneList || !Number.isInteger(position)) {
    return;
  }

  return `AZ ${position + 1}`;
}

// The first group shared by every chain of ancestors (each chain starts with the subnet itself).
function lowestCommonGroup(chains: readonly string[][]): string | undefined {
  const [first = []] = chains;
  return first.find((group) => chains.every((chain) => chain.includes(group)));
}

// Only documented network configuration establishes placement. Arbitrary references
// in policies, environment variables, or user data do not locate a resource.
const PLACEMENT_PATHS: Readonly<Record<string, readonly string[]>> = {
  'AWS::EC2::Subnet': ['VpcId'],
  'AWS::EC2::Instance': ['SubnetId', 'NetworkInterfaces'],
  'AWS::EC2::NetworkInterface': ['SubnetId'],
  'AWS::EC2::NatGateway': ['SubnetId'],
  'AWS::EC2::SecurityGroup': ['VpcId'],
  'AWS::EC2::RouteTable': ['VpcId'],
  'AWS::EC2::VPCEndpoint': ['VpcId', 'SubnetIds'],
  'AWS::EC2::SubnetRouteTableAssociation': ['SubnetId'],
  'AWS::EC2::SubnetNetworkAclAssociation': ['SubnetId'],
  'AWS::EC2::NetworkAcl': ['VpcId'],
  'AWS::ElasticLoadBalancingV2::LoadBalancer': ['Subnets', 'SubnetMappings'],
  'AWS::ElasticLoadBalancing::LoadBalancer': ['Subnets'],
  'AWS::AutoScaling::AutoScalingGroup': ['VPCZoneIdentifier'],
  'AWS::Lambda::Function': ['VpcConfig.SubnetIds'],
  'AWS::ECS::Service': ['NetworkConfiguration.AwsvpcConfiguration.Subnets'],
  'AWS::RDS::DBSubnetGroup': ['SubnetIds'],
  'AWS::RDS::DBInstance': ['DBSubnetGroupName'],
  'AWS::RDS::DBCluster': ['DBSubnetGroupName'],
  'AWS::ElastiCache::SubnetGroup': ['SubnetIds'],
  'AWS::ElastiCache::CacheCluster': ['CacheSubnetGroupName'],
  'AWS::ElastiCache::ReplicationGroup': ['CacheSubnetGroupName'],
  'AWS::Redshift::ClusterSubnetGroup': ['SubnetIds'],
  'AWS::Redshift::Cluster': ['ClusterSubnetGroupName'],
  'AWS::EFS::MountTarget': ['SubnetId'],
};

function placementValues(resource: Resource): TemplateValue[] {
  return (PLACEMENT_PATHS[resource.type] ?? []).flatMap((path) => {
    let value = resource.properties;
    for (const key of path.split('.')) value = entryOf(value, key);
    return value ? [value] : [];
  });
}

function placementReferences(resource: Resource): string[] {
  return placementValues(resource)
    .flatMap(findReferences)
    .map(({ target }) => target);
}

function propertyTarget(resource: Resource, key: string): string | undefined {
  const value = entryOf(resource.properties, key);

  if (!value) {
    return;
  }

  return findReferences(value)[0]?.target;
}

function readCidr(resource: Resource): string | undefined {
  return literalString(entryOf(resource.properties, 'CidrBlock'));
}

function entryOf(value: TemplateValue | undefined, key: string): TemplateValue | undefined {
  if (value?.kind !== 'object') {
    return;
  }

  return value.entries.get(key);
}

function selectArguments(value: TemplateValue | undefined): readonly TemplateValue[] {
  const isSelect = value?.kind === 'intrinsic' && value.fn === 'Fn::Select';

  if (!isSelect || value.arg.kind !== 'list') {
    return [];
  }

  return value.arg.items;
}

function literalString(value: TemplateValue | undefined): string | undefined {
  if (value?.kind !== 'scalar') {
    return;
  }

  const text = value.value;

  if (typeof text !== 'string') {
    return;
  }

  return text;
}

function parentIdOf(group: DiagramGroup): string | undefined {
  if (group.kind === 'vpc') {
    return;
  }

  return group.parentId;
}

function isType(type: string) {
  return (resource: Resource) => resource.type === type;
}
