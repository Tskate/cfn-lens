import type { DiagramGroup, DiagramModel, DiagramNode, FoldedResource, ResourceIcon } from '@cfn-lens/core';
import { MarkerType, type Edge, type Node, type XYPosition } from '@xyflow/react';
import type { ElkExtendedEdge, ElkNode, LayoutOptions } from 'elkjs/lib/elk.bundled.js';

export type ResourceNodeData = {
  resourceType: string;
  typeName: string;
  icon: ResourceIcon;
  condition?: string;
  folded: readonly FoldedResource[];
};
export type ResourceFlowNode = Node<ResourceNodeData, 'resource'>;
export type ContainerFlowNode = Node<{ group: DiagramGroup }, 'container'>;
export type DiagramFlowNode = ResourceFlowNode | ContainerFlowNode;
export type RoutedEdgeData = { points: XYPosition[] };
export type RoutedFlowEdge = Edge<RoutedEdgeData, 'routed'>;
export type DiagramLayout = { nodes: DiagramFlowNode[]; edges: RoutedFlowEdge[] };

export const NODE_WIDTH = 156;
export const NODE_HEIGHT = 56;
// The "if Condition" tag under a conditional node; ELK must keep edges and neighbours clear of it.
export const CONDITION_TAG_HEIGHT = 28;

// ELK is ~1.5 MB, so it gets its own chunk and loads while the rest of the workspace renders.
const elkReady = import('elkjs/lib/elk.bundled.js').then(({ default: ELK }) => new ELK());

// https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html
const layoutOptions: LayoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.edgeRouting': 'ORTHOGONAL',
  // One layout over the whole hierarchy, so edges can cross container borders
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  // Edge points in root coordinates: React Flow draws edges in one layer over everything
  'org.eclipse.elk.json.edgeCoords': 'ROOT',
  'elk.spacing.nodeNode': '56',
  'elk.layered.spacing.nodeNodeBetweenLayers': '64',
  'elk.layered.spacing.edgeNodeBetweenLayers': '24',
};

// The top padding leaves room for the label in the corner.
const containerOptions: Record<DiagramGroup['kind'], LayoutOptions> = {
  vpc: { 'elk.padding': '[top=48,left=24,bottom=24,right=24]' },
  availabilityZone: { 'elk.padding': '[top=40,left=16,bottom=16,right=16]' },
  subnet: {
    'elk.padding': '[top=44,left=16,bottom=20,right=16]',
    'elk.nodeSize.constraints': 'MINIMUM_SIZE',
    'elk.nodeSize.minimum': '(200, 72)',
  },
};

// Above every container, whose backgrounds would otherwise hide edges inside them.
const EDGE_Z_INDEX = 1000;

// use() needs the same promise on every render, and a promise made during render is new each time.
const layouts = new WeakMap<DiagramModel, Promise<DiagramLayout>>();

export function loadLayout(model: DiagramModel): Promise<DiagramLayout> {
  const cached = layouts.get(model);

  if (cached) {
    return cached;
  }

  const layout = layoutDiagram(model);
  layouts.set(model, layout);
  return layout;
}

async function layoutDiagram(model: DiagramModel): Promise<DiagramLayout> {
  const elk = await elkReady;
  const graph = await elk.layout(toElkGraph(model));

  const groups = new Map(model.groups.map((group) => [group.id, group]));
  const resources = new Map(model.nodes.map((node) => [node.id, node]));
  const nodes: DiagramFlowNode[] = [];

  // Pre-order: React Flow needs every parent before its children.
  const visit = (elkNode: ElkNode, parentId: string | undefined) => {
    const group = groups.get(elkNode.id);
    const resource = resources.get(elkNode.id);

    if (group) {
      nodes.push(toContainerNode(group, elkNode, parentId));
    }

    if (resource) {
      nodes.push(toResourceNode(resource, elkNode, parentId));
    }

    (elkNode.children ?? []).forEach((child) => visit(child, elkNode.id));
  };

  (graph.children ?? []).forEach((child) => visit(child, undefined));

  const routes = new Map((graph.edges ?? []).map((edge) => [edge.id, pointsOf(edge)]));
  const edges = model.edges.map(({ source, target }): RoutedFlowEdge => {
    const id = edgeId(source, target);

    return {
      id,
      type: 'routed',
      source,
      target,
      zIndex: EDGE_Z_INDEX,
      data: { points: routes.get(id) ?? [] },
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: 'var(--color-group-vpc)' },
    };
  });

  return { nodes, edges };
}

function toElkGraph(model: DiagramModel): ElkNode {
  const elkNodes = new Map<string, ElkNode>();
  const childrenOf = new Map<string | undefined, ElkNode[]>();

  const add = (elkNode: ElkNode, parentId: string | undefined) => {
    elkNodes.set(elkNode.id, elkNode);
    childrenOf.set(parentId, [...(childrenOf.get(parentId) ?? []), elkNode]);
  };

  model.groups.forEach((group) => add({ id: group.id, layoutOptions: containerOptions[group.kind] }, parentIdOf(group)));
  model.nodes.forEach((node) => add({ id: node.id, width: NODE_WIDTH, height: heightOf(node) }, node.parentId));

  elkNodes.forEach((elkNode, id) => {
    elkNode.children = childrenOf.get(id) ?? [];
  });

  return {
    id: 'root',
    layoutOptions,
    children: childrenOf.get(undefined) ?? [],
    edges: model.edges.map(({ source, target }) => ({ id: edgeId(source, target), sources: [source], targets: [target] })),
  };
}

function toContainerNode(group: DiagramGroup, { x = 0, y = 0, width, height }: ElkNode, parentId: string | undefined): ContainerFlowNode {
  return { id: group.id, type: 'container', position: { x, y }, width, height, parentId, data: { group }, selectable: false };
}

function toResourceNode(node: DiagramNode, { x = 0, y = 0 }: ElkNode, parentId: string | undefined): ResourceFlowNode {
  const data = { resourceType: node.type, typeName: node.typeName, icon: node.icon, condition: node.condition, folded: node.folded };
  return { id: node.id, type: 'resource', position: { x, y }, parentId, data };
}

function heightOf(node: DiagramNode): number {
  if (node.condition === undefined) {
    return NODE_HEIGHT;
  }

  return NODE_HEIGHT + CONDITION_TAG_HEIGHT;
}

function parentIdOf(group: DiagramGroup): string | undefined {
  if (group.kind === 'vpc') {
    return;
  }

  return group.parentId;
}

function pointsOf(edge: ElkExtendedEdge): XYPosition[] {
  return (edge.sections ?? []).flatMap(({ startPoint, bendPoints = [], endPoint }) => [startPoint, ...bendPoints, endPoint]);
}

function edgeId(source: string, target: string): string {
  return JSON.stringify([source, target]);
}
