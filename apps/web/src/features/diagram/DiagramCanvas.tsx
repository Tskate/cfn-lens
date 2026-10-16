import type { DiagramModel } from '@cfn-lens/core';
import { ReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import { use } from 'react';
import { ContainerNode } from './ContainerNode';
import { loadLayout } from './layoutDiagram';
import { ResourceNode } from './ResourceNode';
import { RoutedEdge } from './RoutedEdge';

// Outside the component: React Flow re-creates every node when these objects change.
const nodeTypes = { resource: ResourceNode, container: ContainerNode };
const edgeTypes = { routed: RoutedEdge };

export function DiagramCanvas({ model }: { model: DiagramModel }) {
  const { nodes, edges } = use(loadLayout(model));

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      fitView
      minZoom={0.2}
      fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
      attributionPosition="top-right"
    />
  );
}
