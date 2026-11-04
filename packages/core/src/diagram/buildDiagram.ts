import type { DiagramEdge, DiagramModel, DiagramNode, FoldedResource, ReferenceKind, Resource, Template, TemplateValue } from '../types';
import { findReferences, type ValueReference } from '../utils/findReferences';
import { describeResourceType, docsUrlFor } from './catalog';
import { findContainment, placementValues } from './findContainment';
import { foldPlumbing, type Folding } from './foldPlumbing';

// foldPlumbing: false is "Show all resources"
export type BuildDiagramOptions = { foldPlumbing?: boolean };

type OutgoingReference = { target: string; via: ReferenceKind; conditions?: ValueReference['conditions']; range?: ValueReference['range'] };
type MutableEdge = {
  source: string;
  target: string;
  via: ReferenceKind[];
  conditionPaths?: (readonly { name: string; value: boolean }[])[];
};

const NO_FOLDING: Folding = { ownerOf: new Map(), absorbed: new Set() };
const SECURITY_GROUP_RULE_TYPES = new Set(['AWS::EC2::SecurityGroup', 'AWS::EC2::SecurityGroupIngress', 'AWS::EC2::SecurityGroupEgress']);

export function buildDiagram(template: Template, options: BuildDiagramOptions = {}): DiagramModel {
  const { groups, parentOf, placementAlternatives } = findContainment(template);
  const groupIds = new Set(groups.map(({ id }) => id));
  const resources = [...template.resources.values()].filter((resource) => !groupIds.has(resource.name));

  // Suppress only the exact unconditional placement reference represented by a container.
  const references = new Map(
    [...template.resources.values()].map((resource) => {
      const placement = placementValues(resource).flatMap(findReferences);
      const hasPlacement =
        parentOf.has(resource.name) ||
        groups.some((group) => group.id === resource.name && group.kind === 'subnet' && group.parentId !== undefined);
      const outgoing = outgoingReferences(resource).filter((reference) => {
        if (!template.resources.has(reference.target) || reference.target === resource.name) return false;
        const represented =
          hasPlacement &&
          groupIds.has(reference.target) &&
          !reference.conditions?.length &&
          reference.via !== 'DependsOn' &&
          placement.some((item) => item.target === reference.target && item.range.start.offset === reference.range?.start.offset);
        return !represented;
      });
      return [resource.name, outgoing];
    }),
  );

  const folding = foldOrKeep(options, resources, references, groupIds);
  const shownAs = (id: string): string | undefined => {
    if (folding.absorbed.has(id)) {
      return;
    }

    return folding.ownerOf.get(id) ?? id;
  };

  const edges = new Map<string, MutableEdge>();

  for (const [name, outgoing] of references) {
    for (const { target, via, conditions } of outgoing) {
      const source = shownAs(name);
      const shownTarget = shownAs(target);
      const isHidden = source === undefined || shownTarget === undefined;

      if (isHidden || source === shownTarget) {
        continue;
      }

      addEdge(edges, source, shownTarget, via, conditions);
    }
  }

  const foldedInto = new Map<string, FoldedResource[]>();

  for (const resource of resources) {
    const owner = folding.ownerOf.get(resource.name);

    if (owner !== undefined) {
      foldedInto.set(owner, [...(foldedInto.get(owner) ?? []), toFolded(resource)]);
    }
  }

  const nodes = resources
    .filter((resource) => shownAs(resource.name) === resource.name)
    .map((resource) => ({
      ...toNode(resource, parentOf.get(resource.name), foldedInto.get(resource.name) ?? []),
      placementAlternatives: placementAlternatives.get(resource.name),
    }));
  const absorbed = resources.filter((resource) => folding.absorbed.has(resource.name)).map(toFolded);

  return { groups, nodes, edges: [...edges.values()] satisfies DiagramEdge[], absorbed };
}

function foldOrKeep(
  { foldPlumbing: shouldFold = true }: BuildDiagramOptions,
  resources: readonly Resource[],
  references: ReadonlyMap<string, readonly OutgoingReference[]>,
  groupIds: ReadonlySet<string>,
): Folding {
  if (!shouldFold) return NO_FOLDING;
  const conditionalIds = new Set<string>();
  for (const [source, refs] of references) {
    for (const ref of refs) {
      if (ref.conditions?.length || groupIds.has(source) || groupIds.has(ref.target)) {
        conditionalIds.add(source);
        conditionalIds.add(ref.target);
      }
    }
  }

  const byName = new Map(resources.map((resource) => [resource.name, resource]));
  const referrers = new Map<string, string[]>();

  for (const [name, outgoing] of references) {
    // A security group rule names other groups as traffic peers, which doesn't make it their owner
    const isSecurityGroupRule = SECURITY_GROUP_RULE_TYPES.has(byName.get(name)?.type ?? '');

    if (isSecurityGroupRule) {
      continue;
    }

    for (const { target } of outgoing) {
      referrers.set(target, [...(referrers.get(target) ?? []), name]);
    }
  }

  const plumbingOf = (id: string) =>
    conditionalIds.has(id) || byName.get(id)?.condition ? undefined : describeResourceType(byName.get(id)?.type ?? '').plumbing;

  // What the plumbing is attached to, else whoever uses it. A role's own references are what it
  // grants access to, so they become the owner's edges rather than owner candidates.
  const ownerCandidatesOf = (id: string): readonly string[] => {
    const attachedTo = attachmentTargets(byName.get(id), references.get(id) ?? []);

    if (attachedTo.length > 0) {
      return attachedTo;
    }

    return referrers.get(id) ?? [];
  };

  return foldPlumbing(
    resources.map(({ name }) => name),
    plumbingOf,
    ownerCandidatesOf,
  );
}

function attachmentTargets(resource: Resource | undefined, linkable: readonly OutgoingReference[]): string[] {
  const attachment = attachmentValue(resource);

  if (!attachment) {
    return [];
  }

  const linkableTargets = new Set(linkable.map(({ target }) => target));
  return findReferences(attachment)
    .map(({ target }) => target)
    .filter((target) => linkableTargets.has(target));
}

function attachmentValue(resource: Resource | undefined): TemplateValue | undefined {
  if (!resource) {
    return;
  }

  const { attachedBy } = describeResourceType(resource.type);

  if (attachedBy === undefined || resource.properties?.kind !== 'object') {
    return;
  }

  return resource.properties.entries.get(attachedBy);
}

function toNode(resource: Resource, parentId: string | undefined, folded: readonly FoldedResource[]): DiagramNode {
  const { name, icon, description } = describeResourceType(resource.type);
  return {
    id: resource.name,
    type: resource.type,
    typeName: name,
    icon,
    description,
    docsUrl: docsUrlFor(resource.type),
    condition: resource.condition,
    range: resource.range,
    parentId,
    folded,
  };
}

function toFolded(resource: Resource): FoldedResource {
  const { name, icon } = describeResourceType(resource.type);
  return { id: resource.name, type: resource.type, typeName: name, icon, range: resource.range };
}

function outgoingReferences(resource: Resource): OutgoingReference[] {
  const dependsOn = resource.dependsOn.map((target): OutgoingReference => ({ target, via: 'DependsOn' }));

  if (!resource.properties) {
    return dependsOn;
  }

  return [...findReferences(resource.properties), ...dependsOn];
}

function addEdge(
  edges: Map<string, MutableEdge>,
  source: string,
  target: string,
  via: ReferenceKind,
  conditions?: ValueReference['conditions'],
): void {
  const key = JSON.stringify([source, target]);
  const edge = edges.get(key);

  if (!edge) {
    edges.set(key, { source, target, via: [via], ...(conditions ? { conditionPaths: [conditions] } : {}) });
    return;
  }

  if (!conditions) delete edge.conditionPaths;
  else if (edge.conditionPaths) edge.conditionPaths.push(conditions);
  if (!edge.via.includes(via)) {
    edge.via.push(via);
  }
}
