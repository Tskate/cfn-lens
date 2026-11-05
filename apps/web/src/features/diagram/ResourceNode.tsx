import type { FoldedResource } from '@cfn-lens/core';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from 'cn';
import { ServiceIcon } from '@/components/ServiceIcon';
import { CONDITION_TAG_HEIGHT, type ResourceFlowNode } from './layoutDiagram';

// Edges need a handle on each side to attach to; nobody draws new edges, so they stay invisible.
const handleClass = '!border-0 !bg-transparent';

// Conditional nodes are laid out taller, so the tag under them has its own space.
const variants = {
  regular: { box: 'border border-[#e0e0e0] bg-background shadow-xs', tagSpace: 0 },
  conditional: { box: 'border-[1.5px] border-dashed border-neutral-500 bg-white/70', tagSpace: CONDITION_TAG_HEIGHT },
};
// 1px less padding keeps the content still when the border grows to 2px
const selectedBox = 'border-2 border-blue-600 bg-background px-[11px] shadow-[0_0_0_4px_rgb(37_99_235/0.16),0_4px_12px_rgb(0_0_0/0.08)]';

export function ResourceNode({ id, data, selected }: NodeProps<ResourceFlowNode>) {
  const { resourceType, typeName, icon, condition, folded } = data;
  const variant = condition === undefined && !data.placementAlternatives?.length ? variants.regular : variants.conditional;
  const box = selected ? selectedBox : variant.box;

  return (
    <div className="relative" style={{ paddingBottom: variant.tagSpace }}>
      <Handle type="target" position={Position.Top} isConnectable={false} className={handleClass} />
      <div title={resourceType} className={cn('flex h-14 w-39 items-center gap-2.5 rounded-[10px] px-3 text-[13px]/4', box)}>
        <ServiceIcon name={icon} className="rounded-lg" />
        <span className="min-w-0">
          <b className="block truncate font-semibold">{id}</b>
          <span className="block truncate text-xs text-neutral-600">{typeName}</span>
        </span>
      </div>
      {data.placementAlternatives?.length && (
        <span title={data.placementAlternatives.join('; ')} className="absolute bottom-0 left-0 text-[10px] text-neutral-600">
          Placement varies by condition
        </span>
      )}
      {folded.length > 0 && <FoldBadge folded={folded} />}
      {condition !== undefined && (
        <span className="absolute top-16.5 left-0 rounded-md border border-[#e0e0e0] bg-background px-1.5 py-px font-mono text-[11px]/4 whitespace-nowrap text-neutral-600">
          if {condition}
        </span>
      )}
      <Handle type="source" position={Position.Bottom} isConnectable={false} className={handleClass} />
    </div>
  );
}

/** "+n": plumbing folded into this node, named in full for screen readers and on hover. */
function FoldBadge({ folded }: { folded: readonly FoldedResource[] }) {
  const names = folded.map(({ id, typeName }) => `${id} (${typeName})`).join(', ');

  return (
    <span
      role="img"
      aria-label={`Folded in: ${names}`}
      title={`Folded in: ${names}`}
      className="absolute -top-2.5 -right-2.5 flex h-5 items-center rounded-full bg-fold-badge px-1.75 text-[11px] font-semibold text-white"
    >
      +{folded.length}
    </span>
  );
}
