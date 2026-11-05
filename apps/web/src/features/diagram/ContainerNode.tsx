import type { DiagramGroup, SubnetAccess } from '@cfn-lens/core';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from 'cn';
import type { ContainerFlowNode } from './layoutDiagram';

// Full class names (not built from strings) so Tailwind can find them when scanning the source.
const subnetClasses: Record<SubnetAccess, { box: string; label: string; title: string }> = {
  unknown: { box: 'border-dashed border-neutral-400 bg-neutral-100/50', label: 'text-neutral-600', title: 'Routing unknown' },
  public: { box: 'border-subnet-public-border bg-subnet-public', label: 'text-subnet-public-text', title: 'Public' },
  private: { box: 'border-subnet-private-border bg-subnet-private', label: 'text-subnet-private-text', title: 'Private' },
};

/** A VPC, Availability Zone or subnet box, labelled in its top-left corner. */
export function ContainerNode({ data }: NodeProps<ContainerFlowNode>) {
  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} className="!border-0 !bg-transparent" />
      <ContainerBox group={data.group} />
      <Handle type="source" position={Position.Bottom} isConnectable={false} className="!border-0 !bg-transparent" />
    </>
  );
}

function ContainerBox({ group }: { group: DiagramGroup }) {
  if (group.kind === 'vpc') {
    return (
      <div className="size-full rounded-[14px] border-[1.5px] border-group-vpc bg-white/55 px-4 py-2.5">
        <p className="text-[13px]/4 font-semibold text-neutral-800">
          VPC <span className="font-normal text-neutral-600">{[group.id, group.cidr].filter(Boolean).join(' · ')}</span>
        </p>
      </div>
    );
  }

  if (group.kind === 'availabilityZone') {
    return (
      <div className="size-full rounded-xl border-[1.5px] border-dashed border-group-az px-4 py-2.5">
        <p className="text-xs/4 font-semibold text-neutral-600">{group.name}</p>
      </div>
    );
  }

  const classes = subnetClasses[group.access];

  return (
    <div
      title={
        group.access === 'unknown'
          ? 'Routing cannot be resolved from this template: association, route table, or gateway is missing, external, or conditional.'
          : group.access === 'public'
            ? 'An explicit route table association and route to an internet gateway were found. This does not guarantee resource reachability.'
            : 'The explicit route table has no discovered internet gateway route. External changes are not evaluated.'
      }
      className={cn('size-full rounded-[10px] border px-3 py-2.5', classes.box)}
    >
      <p className={cn('text-xs/4', classes.label)}>
        <b className="font-semibold">{classes.title}</b> · {group.id}
      </p>
    </div>
  );
}
