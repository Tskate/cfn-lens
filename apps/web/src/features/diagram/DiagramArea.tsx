import type { Diagnostic, DiagramModel, ParseResult } from '@cfn-lens/core';
import { FileX, Network, TriangleAlert } from 'lucide-react';
import { Suspense, useDeferredValue, type ReactNode } from 'react';
import { findBlockingProblem, formatLocation } from '@/features/diagnostics/diagnostics';
import { DiagramCanvas } from './DiagramCanvas';
import { DiagramErrorBoundary } from './DiagramErrorBoundary';
import { DiagramGuide } from './DiagramGuide';
import { ZoomControls } from './ZoomControls';

interface DiagramAreaProps {
  /** Undefined until a template is loaded. */
  parseResult: ParseResult | undefined;
  diagram: DiagramModel | undefined;
  selectedId: string | undefined;
  onSelect: (id: string | undefined) => void;
}

export function DiagramArea({ parseResult, diagram, selectedId, onSelect }: DiagramAreaProps) {
  // While a new diagram lays out (e.g. after "Show all resources"), keep showing the previous one
  const deferredDiagram = useDeferredValue(diagram);

  return (
    <section
      aria-label="Architecture diagram"
      className="@container relative h-full overflow-hidden bg-[#f7f7f7] bg-[radial-gradient(var(--color-neutral-300)_1px,transparent_1px)] bg-size-[16px_16px]"
    >
      <DiagramContent parseResult={parseResult} diagram={deferredDiagram} selectedId={selectedId} onSelect={onSelect} />
      <DiagramGuide />
    </section>
  );
}

function DiagramContent({ parseResult, diagram, selectedId, onSelect }: DiagramAreaProps) {
  const blockingProblem = findBlockingProblem(parseResult);

  if (blockingProblem) {
    return (
      <MessageCard>
        <UnreadableTemplate problem={blockingProblem} />
      </MessageCard>
    );
  }

  const hasContent = diagram !== undefined && diagram.nodes.length + diagram.groups.length > 0;

  if (!hasContent) {
    return (
      <MessageCard>
        <DiagramPlaceholder />
      </MessageCard>
    );
  }

  // The canvas renders its own live zoom controls
  return (
    <div className="absolute inset-0">
      <DiagramErrorBoundary resetKey={diagram} fallback={(error) => <CanvasFailed error={error} />}>
        <Suspense fallback={<LayingOut />}>
          <DiagramCanvas model={diagram} selectedId={selectedId} onSelect={onSelect} />
        </Suspense>
      </DiagramErrorBoundary>
    </div>
  );
}

// Without a diagram the zoom controls stay visible but disabled.
function MessageCard({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="flex h-full items-center justify-center p-6">
        <div className="flex w-full max-w-110 flex-col gap-4 rounded-[14px] border bg-background p-7 shadow-[0_8px_24px_rgb(0_0_0/0.06)]">
          {children}
        </div>
      </div>
      <ZoomControls />
    </>
  );
}

function CanvasFailed({ error }: { error: Error }) {
  return (
    <MessageCard>
      <span className="flex size-10 items-center justify-center rounded-[10px] bg-amber-50 text-amber-700">
        <TriangleAlert className="size-6" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-semibold tracking-[-0.01em]">The diagram couldn’t be drawn</h2>
        <p className="text-neutral-600">The template itself is fine, but something went wrong while laying it out.</p>
      </div>
      <p className="border-t border-neutral-100 pt-3 font-mono text-xs break-words text-neutral-600">{error.message}</p>
    </MessageCard>
  );
}

function LayingOut() {
  return (
    <>
      <p role="status" className="flex h-full items-center justify-center text-[13px] text-neutral-500">
        Laying out the diagram…
      </p>
      <ZoomControls />
    </>
  );
}

function DiagramPlaceholder() {
  return (
    <>
      <span className="flex size-10 items-center justify-center rounded-[10px] bg-neutral-100 text-neutral-600">
        <Network className="size-6" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-semibold tracking-[-0.01em]">Your diagram will appear here</h2>
        <p className="text-neutral-600">Every resource in the template, grouped by network and connected by references.</p>
      </div>
    </>
  );
}

function UnreadableTemplate({ problem }: { problem: Diagnostic }) {
  const location = formatLocation(problem);

  return (
    <>
      <span className="flex size-10 items-center justify-center rounded-[10px] bg-red-50 text-red-700">
        <FileX className="size-6" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-semibold tracking-[-0.01em]">This template can’t be read yet</h2>
        <p className="text-neutral-600">
          {location && <span className="font-medium text-neutral-950">{location}: </span>}
          {problem.message}
        </p>
      </div>
      <p className="border-t border-neutral-100 pt-3 text-[13px] text-neutral-600">The diagram appears once the template parses.</p>
    </>
  );
}
