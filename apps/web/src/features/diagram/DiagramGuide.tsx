import { CircleHelp, X } from 'lucide-react';
import { cn } from 'cn';
import type { ReactNode } from 'react';
import { Popover, PopoverClose, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/primitives/popover';

const sectionTitleClass = 'text-xs font-semibold tracking-[0.04em] text-neutral-600 uppercase';
const codeClass = 'font-mono text-xs';
/** Miniature of a diagram box or area. */
const box = 'h-6 w-11 rounded-md';

function FoldBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('flex h-5 items-center rounded-full bg-fold-badge px-1.75 text-[11px] font-semibold text-white', className)}>
      {children}
    </span>
  );
}

function Arrow({ className }: { className: string }) {
  return (
    <svg
      width="44"
      height="12"
      viewBox="0 0 44 12"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M2 6h38M34 2l6 4-6 4" />
    </svg>
  );
}

interface GuideRowProps {
  swatch: ReactNode;
  children: ReactNode;
}

function GuideRow({ swatch, children }: GuideRowProps) {
  return (
    <li className="flex items-center gap-3">
      <span aria-hidden="true" className="flex w-14 flex-none justify-center">
        {swatch}
      </span>
      <span>{children}</span>
    </li>
  );
}

function GuideSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 border-b border-neutral-100 px-4.5 py-3.5 last:border-b-0">
      <h3 className={sectionTitleClass}>{title}</h3>
      <ul className="flex flex-col gap-2.5">{children}</ul>
    </section>
  );
}

/** Legend button in the canvas corner that opens a full explanation of the diagram's notation. */
export function DiagramGuide() {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="How to read this diagram"
        className="absolute right-4 bottom-16 flex @lg:bottom-4 min-h-9.5 cursor-pointer flex-wrap items-center gap-3.5 rounded-lg border bg-background py-1.5 pr-2 pl-3 text-xs text-neutral-600 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:border-blue-600"
      >
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4.5 bg-group-vpc" />
          references
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-[3px] border-[1.5px] border-dashed border-neutral-500" />
          conditional
        </span>
        <span className="flex items-center gap-1.5">
          <FoldBadge className="h-4 px-1.25 text-[10px]">+n</FoldBadge>
          folded in
        </span>
        <span className="flex size-6 items-center justify-center rounded-md bg-neutral-100 text-foreground">
          <CircleHelp className="size-3.5" />
        </span>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="end"
        sideOffset={14}
        className="max-h-[calc(100dvh-10rem)] w-90 max-w-[calc(100vw-2rem)] gap-0 overflow-auto rounded-xl p-0 text-sm/[1.45] shadow-[0_12px_32px_rgb(0_0_0/0.12)]"
      >
        <div className="flex items-center justify-between gap-2 border-b py-3 pr-3 pl-4.5">
          <PopoverTitle className="text-[15px] font-semibold">How to read this diagram</PopoverTitle>
          <PopoverClose
            aria-label="Close guide"
            className="flex size-8 flex-none items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
          >
            <X className="size-4" />
          </PopoverClose>
        </div>

        <GuideSection title="Boxes are resources">
          <GuideRow swatch={<span className={cn(box, 'border border-neutral-300 bg-background')} />}>
            One resource from the template. Click it for details.
          </GuideRow>
          <GuideRow swatch={<span className={cn(box, 'border-[1.5px] border-dashed border-neutral-500')} />}>
            Only created when a condition is true, e.g. <code className={codeClass}>if CreateDatabase</code>.
          </GuideRow>
          <GuideRow swatch={<FoldBadge>+3</FoldBadge>}>Small helper resources (permissions, routes) folded into this one.</GuideRow>
          <GuideRow
            swatch={
              <span className="flex size-6 items-center justify-center rounded-md bg-neutral-100 text-neutral-600">
                <CircleHelp className="size-4" />
              </span>
            }
          >
            A type cfn-lens doesn’t know yet. Still shown, never hidden.
          </GuideRow>
        </GuideSection>

        <GuideSection title="Areas are networks">
          <GuideRow swatch={<span className={cn(box, 'border-[1.5px] border-group-vpc')} />}>
            <b className="font-semibold">VPC</b> — your private network.
          </GuideRow>
          <GuideRow swatch={<span className={cn(box, 'border-[1.5px] border-dashed border-group-az')} />}>
            <b className="font-semibold">Availability Zone</b> — a separate data center.
          </GuideRow>
          <GuideRow swatch={<span className={cn(box, 'border border-subnet-public-border bg-subnet-public')} />}>
            <b className="font-semibold">Public subnet</b> — reachable from the internet.
          </GuideRow>
          <GuideRow swatch={<span className={cn(box, 'border border-subnet-private-border bg-subnet-private')} />}>
            <b className="font-semibold">Private subnet</b> — only reachable from inside.
          </GuideRow>
        </GuideSection>

        <GuideSection title="Arrows are references">
          <GuideRow swatch={<Arrow className="stroke-group-vpc" />}>
            One resource points to another with <code className={codeClass}>!Ref</code>, <code className={codeClass}>!GetAtt</code> or
            similar. Hover to see which.
          </GuideRow>
          <GuideRow swatch={<Arrow className="stroke-blue-600" />}>Connections of the resource you selected.</GuideRow>
        </GuideSection>
      </PopoverContent>
    </Popover>
  );
}
