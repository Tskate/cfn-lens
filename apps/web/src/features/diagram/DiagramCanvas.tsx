import type { DiagramModel } from '@cfn-lens/core';
import { applyNodeChanges, MarkerType, ReactFlow, type NodeChange } from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import { use, useState } from 'react';
import { CanvasViewport } from './CanvasViewport';
import { ContainerNode } from './ContainerNode';
import { loadLayout, type DiagramFlowNode, type DiagramLayout, type RoutedFlowEdge } from './layoutDiagram';
import { ResourceNode } from './ResourceNode';
import { RoutedEdge } from './RoutedEdge';
import { FIT_VIEW_OPTIONS, MAX_ZOOM, MIN_ZOOM } from './viewport';

// Outside the component: React Flow re-creates every node when these objects change.
const nodeTypes = { resource: ResourceNode, container: ContainerNode };
const edgeTypes = { routed: RoutedEdge };

const highlightedMarker = { type: MarkerType.ArrowClosed, width: 16, height: 16, color: 'var(--color-blue-600)' };

interface DiagramCanvasProps {
  model: DiagramModel;
  selectedId: string | undefined;
  onSelect: (id: string | undefined) => void;
}

// A new layout starts a fresh canvas, so its node state never mixes with the previous diagram's.
const layoutKeys = new WeakMap<DiagramLayout, number>();
let nextLayoutKey = 0;

export function DiagramCanvas({ model, ...props }: DiagramCanvasProps) {
  const layout = use(loadLayout(model));
  return <FlowCanvas key={keyOf(layout)} layout={layout} {...props} />;
}

function FlowCanvas({ layout, selectedId, onSelect }: Omit<DiagramCanvasProps, 'model'> & { layout: DiagramLayout }) {
  // Controlled nodes: React Flow measures them and reports the sizes as changes, which must be
  // applied, or it can't find the handles edges attach to. Selection is the exception: the page owns it.
  const [flowNodes, setFlowNodes] = useState(layout.nodes);
  const [followsSize, setFollowsSize] = useState(true);
  const nodes = flowNodes.map((node) => markSelected(node, selectedId));
  const edges = layout.edges.map((edge) => markHighlighted(edge, selectedId));

  const handleNodesChange = (changes: NodeChange<DiagramFlowNode>[]) => {
    const selectChanges = changes.filter((change) => change.type === 'select');
    const otherChanges = changes.filter((change) => change.type !== 'select');

    if (otherChanges.length > 0) {
      setFlowNodes((current) => applyNodeChanges(otherChanges, current));
    }

    if (selectChanges.length > 0) {
      onSelect(selectChanges.find((change) => change.selected)?.id);
    }
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={handleNodesChange}
      onPaneClick={() => onSelect(undefined)}
      // An event means the person dragged or scrolled; moves made in code (fit, zoom buttons) pass null
      onMoveStart={(event) => setFollowsSize((follows) => follows && event === null)}
      nodesDraggable={false}
      nodesConnectable={false}
      edgesFocusable={false}
      fitView
      fitViewOptions={FIT_VIEW_OPTIONS}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      attributionPosition="top-right"
    >
      <CanvasViewport followsSize={followsSize} onFollowsSizeChange={setFollowsSize} />
    </ReactFlow>
  );
}

function keyOf(layout: DiagramLayout): number {
  const existing = layoutKeys.get(layout);

  if (existing !== undefined) {
    return existing;
  }

  nextLayoutKey += 1;
  layoutKeys.set(layout, nextLayoutKey);
  return nextLayoutKey;
}

function markSelected(node: DiagramFlowNode, selectedId: string | undefined): DiagramFlowNode {
  const isSelected = node.id === selectedId;

  if (!isSelected) {
    return node;
  }

  return { ...node, selected: true };
}

// The selected node's edges turn blue and come to the front.
function markHighlighted(edge: RoutedFlowEdge, selectedId: string | undefined): RoutedFlowEdge {
  const isConnected = selectedId !== undefined && (edge.source === selectedId || edge.target === selectedId);

  if (!isConnected || !edge.data) {
    return edge;
  }

  return { ...edge, zIndex: (edge.zIndex ?? 0) + 1, markerEnd: highlightedMarker, data: { ...edge.data, highlighted: true } };
}
