import { Maximize, Minus, Plus } from 'lucide-react';

const buttonClass =
  'flex size-9 items-center justify-center outline-none hover:bg-neutral-100 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-40';

// TODO: wire to the diagram viewport once the renderer exists.
export function ZoomControls() {
  const disabled = true;

  return (
    <div
      role="group"
      aria-label="Zoom"
      className="absolute bottom-4 left-4 flex divide-x overflow-hidden rounded-lg border bg-background shadow-xs [&_svg]:size-4"
    >
      <button type="button" aria-label="Zoom out" disabled={disabled} className={buttonClass}>
        <Minus aria-hidden="true" />
      </button>
      <span className="flex w-13 items-center justify-center text-xs text-neutral-600 tabular-nums">100%</span>
      <button type="button" aria-label="Zoom in" disabled={disabled} className={buttonClass}>
        <Plus aria-hidden="true" />
      </button>
      <button type="button" aria-label="Fit to view" disabled={disabled} className={buttonClass}>
        <Maximize aria-hidden="true" />
      </button>
    </div>
  );
}
