import { Network } from 'lucide-react';
import { DiagramGuide } from './DiagramGuide';
import { ZoomControls } from './ZoomControls';

export function DiagramArea() {
  return (
    <section
      aria-label="Architecture diagram"
      className="relative flex h-full items-center justify-center overflow-hidden bg-[#f7f7f7] bg-[radial-gradient(var(--color-neutral-300)_1px,transparent_1px)] bg-size-[16px_16px] p-6"
    >
      <div className="flex w-full max-w-110 flex-col gap-4 rounded-[14px] border bg-background p-7 shadow-[0_8px_24px_rgb(0_0_0/0.06)]">
        <span className="flex size-10 items-center justify-center rounded-[10px] bg-neutral-100 text-neutral-600">
          <Network className="size-6" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-semibold tracking-[-0.01em]">Your diagram will appear here</h2>
          <p className="text-neutral-600">Every resource in the template, grouped by network and connected by references.</p>
        </div>
      </div>

      <ZoomControls />
      <DiagramGuide />
    </section>
  );
}
