import { BaseEdge, EdgeLabelRenderer, useStore, type EdgeProps, type XYPosition } from '@xyflow/react';
import { useState } from 'react';
import type { RoutedFlowEdge } from './layoutDiagram';

const edgeStyles = {
  regular: { stroke: 'var(--color-group-vpc)', strokeWidth: 2 },
  highlighted: { stroke: 'var(--color-blue-600)', strokeWidth: 2 },
};

/** Draws the route ELK computed, so edges keep their right angles and avoid nodes. */
export function RoutedEdge({ data, markerEnd }: EdgeProps<RoutedFlowEdge>) {
  const [hovered, setHovered] = useState(false);
  const [start, ...rest] = data?.points ?? [];

  if (!start) {
    return null;
  }

  const style = data?.highlighted ? edgeStyles.highlighted : edgeStyles.regular;
  const via = data?.via ?? [];
  const orderOnly = via.length === 1 && via[0] === 'DependsOn';
  const points = [start, ...rest];
  const segment = rest
    .map((end, index) => ({ start: points[index] ?? start, end }))
    .sort((a, b) => Math.hypot(b.end.x - b.start.x, b.end.y - b.start.y) - Math.hypot(a.end.x - a.start.x, a.end.y - a.start.y))[0];
  const midpoint = segment ? { x: (segment.start.x + segment.end.x) / 2, y: (segment.start.y + segment.end.y) / 2 } : start;
  const conditionLabel = data?.conditionPaths
    ?.map((path) => path.map(({ name, value }) => (value ? name : `not ${name}`)).join(' and '))
    .join(' or ');
  const label =
    via.map((kind) => (kind === 'DependsOn' ? 'deployment order' : kind)).join(' + ') + (conditionLabel ? ` if ${conditionLabel}` : '');
  return (
    <g
      tabIndex={0}
      role="img"
      aria-label={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <title>{`References target: ${label}. Arrows do not represent traffic flow.`}</title>
      <BaseEdge
        path={toPath(start, rest)}
        markerEnd={markerEnd}
        className="transition-[stroke] duration-150 ease-out motion-reduce:transition-none"
        style={{ ...style, strokeDasharray: orderOnly ? '6 4' : undefined }}
      />
      <path
        d={toPath(start, rest)}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        vectorEffect="non-scaling-stroke"
        style={{ pointerEvents: 'stroke' }}
      />
      {midpoint && hovered && <EdgeTooltip midpoint={midpoint} label={label} />}
    </g>
  );
}

// Its own component so only a shown tooltip follows the zoom, not every edge.
function EdgeTooltip({ midpoint, label }: { midpoint: XYPosition; label: string }) {
  const zoom = useStore((state) => state.transform[2]);

  return (
    <EdgeLabelRenderer>
      <div
        className="pointer-events-none absolute rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-950 shadow-md"
        style={{
          transform: `translate(-50%, -100%) translate(${midpoint.x}px, ${midpoint.y - 12 / zoom}px) scale(${1 / zoom})`,
          transformOrigin: 'bottom center',
          maxWidth: 280,
        }}
      >
        {label}
      </div>
    </EdgeLabelRenderer>
  );
}

function toPath(start: XYPosition, rest: XYPosition[]): string {
  const lines = rest.map(({ x, y }) => `L ${x} ${y}`);
  return [`M ${start.x} ${start.y}`, ...lines].join(' ');
}
