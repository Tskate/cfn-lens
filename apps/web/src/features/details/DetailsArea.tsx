import type { DiagramEdge, DiagramNode, FoldedResource, PropertySummary, ReferenceKind, SourceRange, ValueSummary } from '@cfn-lens/core';
import { ArrowUpRight, Code, MousePointerClick, X } from 'lucide-react';
import { cn } from 'cn';
import { useId, type ReactNode } from 'react';
import { ServiceIcon } from '@/components/ServiceIcon';
import { formatLineSpan, lineSpan } from '@/features/source/lineSpan';

interface DetailsAreaProps {
  node: DiagramNode | undefined;
  edges: readonly DiagramEdge[];
  properties: readonly PropertySummary[];
  // Resources drawn as nodes; anything else (a subnet, a folded role) can't be selected
  selectableIds: ReadonlySet<string>;
  onSelect: (id: string | undefined) => void;
  onShowRange: (range: SourceRange) => void;
}

const sectionTitleClass = 'text-xs font-semibold tracking-[0.04em] text-neutral-600 uppercase';
const chipClass = 'inline-flex h-7.5 items-center gap-1.5 rounded-md border px-2.5 text-[13px] hover:bg-neutral-50 [&_svg]:size-3.5';
const linkClass = 'font-medium text-blue-700 underline-offset-2 hover:underline';

const enterClass = 'animate-in fade-in slide-in-from-right-1 duration-200 ease-out motion-reduce:animate-none';

const referenceLabels: Record<ReferenceKind, string> = { Ref: 'Ref', 'Fn::GetAtt': 'GetAtt', 'Fn::Sub': 'Sub', DependsOn: 'DependsOn' };

export function DetailsArea({ node, ...props }: DetailsAreaProps) {
  if (!node) {
    return <NoSelection />;
  }

  // Another resource is a new panel: the key replays the entrance and starts it scrolled to the top.
  return <ResourceDetails key={node.id} node={node} {...props} />;
}

function NoSelection() {
  return (
    <aside
      aria-label="Resource details"
      className={cn('flex h-full flex-col items-center justify-center gap-3 overflow-auto bg-background p-8 text-center', enterClass)}
    >
      <span className="flex size-10 items-center justify-center rounded-[10px] bg-neutral-100 text-neutral-600">
        <MousePointerClick className="size-5" aria-hidden="true" />
      </span>
      <h2 className="font-semibold">No resource selected</h2>
      <p className="max-w-60 text-[13px] text-neutral-500">
        Click a box in the diagram to see what it does and where it lives in the template.
      </p>
    </aside>
  );
}

function ResourceDetails({ node, edges, properties, selectableIds, onSelect, onShowRange }: DetailsAreaProps & { node: DiagramNode }) {
  const headingId = useId();
  const uses = edges.filter(({ source }) => source === node.id).map(({ target, via }) => ({ id: target, via }));
  const usedBy = edges.filter(({ target }) => target === node.id).map(({ source, via }) => ({ id: source, via }));
  const link = (id: string, label: ReactNode = id) => (
    <ResourceLink id={id} label={label} selectableIds={selectableIds} onSelect={onSelect} />
  );

  return (
    <aside aria-labelledby={headingId} className={cn('flex h-full flex-col overflow-auto bg-background', enterClass)}>
      <div className="flex flex-col gap-3 border-b px-5 pt-5 pb-4">
        <div className="flex items-start gap-3">
          <ServiceIcon name={node.icon} className="size-10 rounded-[10px]" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 id={headingId} className="truncate text-lg font-semibold tracking-[-0.01em]">
              {node.id}
            </h2>
            <span className="truncate font-mono text-xs text-neutral-600">{node.type}</span>
          </div>
          <button
            type="button"
            aria-label="Close details"
            onClick={() => onSelect(undefined)}
            className="flex size-8 flex-none items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        {node.description && <p className="text-neutral-800">{node.description}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onShowRange(node.range)} className={chipClass}>
            <Code aria-hidden="true" />
            {formatLineSpan(lineSpan(node.range))}
          </button>
          {node.docsUrl && (
            <a href={node.docsUrl} target="_blank" rel="noreferrer" className={chipClass}>
              AWS docs
              <ArrowUpRight aria-hidden="true" />
            </a>
          )}
        </div>
      </div>

      {properties.length > 0 && (
        <Section title="Key properties">
          <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-2 text-[13px]">
            {properties.map(({ name, value }) => (
              <PropertyRow key={name} name={name}>
                <ValueView value={value} link={link} />
              </PropertyRow>
            ))}
          </dl>
        </Section>
      )}

      {uses.length + usedBy.length > 0 && (
        <Section title="Connections">
          <ul className="flex flex-col gap-2 text-[13px]">
            {uses.map(({ id, via }) => (
              <ConnectionRow key={`uses ${id}`} relation="uses" via={via}>
                {link(id)}
              </ConnectionRow>
            ))}
            {usedBy.map(({ id, via }) => (
              <ConnectionRow key={`used by ${id}`} relation="used by" via={via}>
                {link(id)}
              </ConnectionRow>
            ))}
          </ul>
        </Section>
      )}

      {node.folded.length > 0 && <FoldedSection folded={node.folded} onShowRange={onShowRange} />}
    </aside>
  );
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 border-b px-5 py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className={sectionTitleClass}>{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function PropertyRow({ name, children }: { name: string; children: ReactNode }) {
  return (
    <>
      <dt className="truncate text-neutral-600" title={name}>
        {name}
      </dt>
      <dd className="min-w-0 font-mono text-[12.5px] break-words">{children}</dd>
    </>
  );
}

function ConnectionRow({ relation, via, children }: { relation: string; via: readonly ReferenceKind[]; children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-2">
      <span className="w-18 flex-none text-neutral-600">{relation}</span>
      {children}
      {via.map((kind) => (
        <span key={kind} className="rounded bg-neutral-100 px-1.25 py-px font-mono text-[11px] text-neutral-600">
          {referenceLabels[kind]}
        </span>
      ))}
    </li>
  );
}

function FoldedSection({ folded, onShowRange }: { folded: readonly FoldedResource[]; onShowRange: (range: SourceRange) => void }) {
  const count = (
    <span className="flex h-5 items-center rounded-full bg-fold-badge px-1.75 text-[11px] font-semibold text-white">{folded.length}</span>
  );

  return (
    <Section title="Folded into this node" aside={count}>
      <p className="text-[13px] text-neutral-600">
        Supporting resources only this one uses. Turn on “Show all resources” to draw them separately.
      </p>
      <ul className="flex flex-col divide-y overflow-hidden rounded-lg border">
        {folded.map((resource) => (
          <li key={resource.id} className="flex items-center gap-2.5 px-3 py-2.5">
            <ServiceIcon name={resource.icon} className="size-6 rounded-md" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-medium">{resource.id}</span>
              <span className="truncate font-mono text-[11.5px] text-neutral-600">{resource.type}</span>
            </span>
            <button
              type="button"
              aria-label={`Show ${resource.id} in the template`}
              onClick={() => onShowRange(resource.range)}
              className="text-xs text-neutral-600 underline-offset-2 hover:underline"
            >
              L{lineSpan(resource.range).first}
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function ValueView({ value, link }: { value: ValueSummary; link: (id: string, label?: ReactNode) => ReactNode }) {
  if (value.kind === 'resource') {
    return link(value.id, [value.id, value.attribute].filter(Boolean).join('.'));
  }

  if (value.kind === 'parameter') {
    return <Labelled text={value.name} label="param" />;
  }

  if (value.kind === 'pseudoParameter') {
    return <Labelled text={value.name} label="pseudo" />;
  }

  if (value.kind === 'function') {
    return <span className="text-neutral-600">{value.fn.replace(/^Fn::/, '!')}</span>;
  }

  if (value.kind === 'count') {
    return <span className="text-neutral-600">{countLabel(value.count, value.of)}</span>;
  }

  if (value.kind === 'list') {
    return (
      <span className="flex flex-col gap-0.5">
        {value.items.map((item, index) => (
          // A summary has no identity besides its place in the list
          <ValueView key={index} value={item} link={link} />
        ))}
      </span>
    );
  }

  return <>{value.text}</>;
}

function Labelled({ text, label }: { text: string; label: string }) {
  return (
    <>
      {text} <span className="text-neutral-500">{label}</span>
    </>
  );
}

// Selecting only makes sense for resources drawn as nodes; others show as plain text.
function ResourceLink({
  id,
  label,
  selectableIds,
  onSelect,
}: {
  id: string;
  label: ReactNode;
  selectableIds: ReadonlySet<string>;
  onSelect: (id: string) => void;
}) {
  if (!selectableIds.has(id)) {
    return <span>{label}</span>;
  }

  return (
    <button type="button" onClick={() => onSelect(id)} className={linkClass}>
      {label}
    </button>
  );
}

// "1 item", "3 keys"
function countLabel(count: number, of: 'items' | 'keys'): string {
  if (count === 1) {
    return `1 ${of.slice(0, -1)}`;
  }

  return `${count} ${of}`;
}
