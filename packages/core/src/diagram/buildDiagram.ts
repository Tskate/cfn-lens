import type { DiagramEdge, DiagramModel, DiagramNode, ReferenceKind, Resource, Template } from '../types';
import { findReferences } from '../utils/findReferences';

type OutgoingReference = { target: string; via: ReferenceKind };
type MutableEdge = { source: string; target: string; via: ReferenceKind[] };

export function buildDiagram(template: Template): DiagramModel {
  const resources = [...template.resources.values()];
  const edges = new Map<string, MutableEdge>();

  for (const resource of resources) {
    for (const { target, via } of outgoingReferences(resource)) {
      const isResource = template.resources.has(target);
      const isSelf = target === resource.name;

      if (!isResource || isSelf) {
        continue;
      }

      addEdge(edges, resource.name, target, via);
    }
  }

  return { nodes: resources.map(toNode), edges: [...edges.values()] satisfies DiagramEdge[] };
}

function toNode(resource: Resource): DiagramNode {
  return { id: resource.name, type: resource.type, condition: resource.condition, range: resource.range };
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
