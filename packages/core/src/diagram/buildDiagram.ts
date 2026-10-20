import type { DiagramEdge, DiagramModel, DiagramNode, FoldedResource, ReferenceKind, Resource, Template, TemplateValue } from '../types';
import { findReferences } from '../utils/findReferences';
import { describeResourceType, docsUrlFor } from './catalog';
import { findContainment } from './findContainment';
import { foldPlumbing, type Folding } from './foldPlumbing';

// foldPlumbing: false is "Show all resources"
export type BuildDiagramOptions = { foldPlumbing?: boolean };

type OutgoingReference = { target: string; via: ReferenceKind };
type MutableEdge = { source: string; target: string; via: ReferenceKind[] };

const NO_FOLDING: Folding = { ownerOf: new Map(), absorbed: new Set() };

export function buildDiagram(template: Template, options: BuildDiagramOptions = {}): DiagramModel {
  const { groups, parentOf } = findContainment(template);
  const groupIds = new Set(groups.map(({ id }) => id));
  const resources = [...template.resources.values()].filter((resource) => !groupIds.has(resource.name));

  // Placement already shows a reference to a VPC or subnet, so groups get no edges
  const isLinkable = (source: string, target: string) => template.resources.has(target) && target !== source && !groupIds.has(target);
  const references = new Map(
    resources.map((resource) => [resource.name, outgoingReferences(resource).filter(({ target }) => isLinkable(resource.name, target))]),
  );

  const folding = foldOrKeep(options, resources, references);
  const shownAs = (id: string): string | undefined => {
    if (folding.absorbed.has(id)) {
      return;
    }

    return folding.ownerOf.get(id) ?? id;
  };

  const edges = new Map<string, MutableEdge>();

  for (const [name, outgoing] of references) {
    for (const { target, via } of outgoing) {
      const source = shownAs(name);
      const shownTarget = shownAs(target);
      const isHidden = source === undefined || shownTarget === undefined;

      if (isHidden || source === shownTarget) {
        continue;
      }

      addEdge(edges, source, shownTarget, via);
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
    .map((resource) => toNode(resource, parentOf.get(resource.name), foldedInto.get(resource.name) ?? []));
  const absorbed = resources.filter((resource) => folding.absorbed.has(resource.name)).map(toFolded);

  return { groups, nodes, edges: [...edges.values()] satisfies DiagramEdge[], absorbed };
}

function foldOrKeep(
  { foldPlumbing: shouldFold = true }: BuildDiagramOptions,
  resources: readonly Resource[],
  references: ReadonlyMap<string, readonly OutgoingReference[]>,
): Folding {
  if (!shouldFold) {
    return NO_FOLDING;
  }

  const referrers = new Map<string, string[]>();

  for (const [name, outgoing] of references) {
    for (const { target } of outgoing) {
      referrers.set(target, [...(referrers.get(target) ?? []), name]);
    }
  }

  const byName = new Map(resources.map((resource) => [resource.name, resource]));
  const plumbingOf = (id: string) => describeResourceType(byName.get(id)?.type ?? '').plumbing;

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

function addEdge(edges: Map<string, MutableEdge>, source: string, target: string, via: ReferenceKind): void {
  const key = JSON.stringify([source, target]);
  const edge = edges.get(key);

  if (!edge) {
    edges.set(key, { source, target, via: [via] });
    return;
  }

  if (!edge.via.includes(via)) {
    edge.via.push(via);
  }
}
