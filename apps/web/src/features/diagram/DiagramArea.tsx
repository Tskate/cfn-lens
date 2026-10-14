import type { Diagnostic, ParseResult } from '@cfn-lens/core';
import { FileX, Network } from 'lucide-react';
import { findBlockingProblem, formatLocation } from '@/features/diagnostics/diagnostics';
import { DiagramGuide } from './DiagramGuide';
import { ZoomControls } from './ZoomControls';

interface DiagramAreaProps {
  /** Undefined until a template is loaded. */
  parseResult: ParseResult | undefined;
}

export function DiagramArea({ parseResult }: DiagramAreaProps) {
  const blockingProblem = findBlockingProblem(parseResult);

  return (
    <section
      aria-label="Architecture diagram"
      className="relative flex h-full items-center justify-center overflow-hidden bg-[#f7f7f7] bg-[radial-gradient(var(--color-neutral-300)_1px,transparent_1px)] bg-size-[16px_16px] p-6"
    >
      <div className="flex w-full max-w-110 flex-col gap-4 rounded-[14px] border bg-background p-7 shadow-[0_8px_24px_rgb(0_0_0/0.06)]">
        {blockingProblem ? <UnreadableTemplate problem={blockingProblem} /> : <DiagramPlaceholder />}
      </div>

      <ZoomControls />
      <DiagramGuide />
    </section>
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
