import { BaseEdge, type EdgeProps, type XYPosition } from '@xyflow/react';
import type { RoutedFlowEdge } from './layoutDiagram';

const edgeStyles = {
  regular: { stroke: 'var(--color-group-vpc)', strokeWidth: 2 },
  highlighted: { stroke: 'var(--color-blue-600)', strokeWidth: 2 },
};

/** Draws the route ELK computed, so edges keep their right angles and avoid nodes. */
export function RoutedEdge({ data, markerEnd }: EdgeProps<RoutedFlowEdge>) {
  const [start, ...rest] = data?.points ?? [];

  if (!start) {
    return null;
  }

  const style = data?.highlighted ? edgeStyles.highlighted : edgeStyles.regular;
  return <BaseEdge path={toPath(start, rest)} markerEnd={markerEnd} style={style} />;
}

function toPath(start: XYPosition, rest: XYPosition[]): string {
  const lines = rest.map(({ x, y }) => `L ${x} ${y}`);
  return [`M ${start.x} ${start.y}`, ...lines].join(' ');
}
