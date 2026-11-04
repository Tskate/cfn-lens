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
  const via = data?.via ?? [];
  const orderOnly = via.length === 1 && via[0] === 'DependsOn';
  const midpoint = [start, ...rest][Math.floor((rest.length + 1) / 2)];
  const conditionLabel = data?.conditionPaths
    ?.map((path) => path.map(({ name, value }) => (value ? name : `not ${name}`)).join(' and '))
    .join(' or ');
  const label =
    via.map((kind) => (kind === 'DependsOn' ? 'deployment order' : kind)).join(' + ') + (conditionLabel ? ` if ${conditionLabel}` : '');
  return (
    <g>
      <title>{`References target: ${label}. Arrows do not represent traffic flow.`}</title>
      <BaseEdge path={toPath(start, rest)} markerEnd={markerEnd} style={{ ...style, strokeDasharray: orderOnly ? '6 4' : undefined }} />
      {midpoint && (
        <text
          x={midpoint.x}
          y={midpoint.y - 8}
          textAnchor="middle"
          fontSize={10}
          fill={style.stroke}
          stroke="var(--color-background)"
          strokeWidth={4}
          paintOrder="stroke"
          pointerEvents="none"
        >
          {label}
        </text>
      )}
    </g>
  );
}

function toPath(start: XYPosition, rest: XYPosition[]): string {
  const lines = rest.map(({ x, y }) => `L ${x} ${y}`);
  return [`M ${start.x} ${start.y}`, ...lines].join(' ');
}
