import { BaseEdge, type EdgeProps, type XYPosition } from '@xyflow/react';
import type { RoutedFlowEdge } from './layoutDiagram';

const edgeStyle = { stroke: 'var(--color-group-vpc)', strokeWidth: 2 };

/** Draws the route ELK computed, so edges keep their right angles and avoid nodes. */
export function RoutedEdge({ data, markerEnd }: EdgeProps<RoutedFlowEdge>) {
  const [start, ...rest] = data?.points ?? [];

  if (!start) {
    return null;
  }

  return <BaseEdge path={toPath(start, rest)} markerEnd={markerEnd} style={edgeStyle} />;
}

function toPath(start: XYPosition, rest: XYPosition[]): string {
  const lines = rest.map(({ x, y }) => `L ${x} ${y}`);
  return [`M ${start.x} ${start.y}`, ...lines].join(' ');
}
