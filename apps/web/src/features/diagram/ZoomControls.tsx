import { Maximize, Minus, Plus } from 'lucide-react';

const buttonClass =
  'flex size-9 items-center justify-center outline-none hover:bg-neutral-100 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-40';

// Without handlers (no diagram yet) every button is disabled.
interface ZoomControlsProps {
  zoom?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFit?: () => void;
}

export function ZoomControls({ zoom = 1, onZoomIn, onZoomOut, onFit }: ZoomControlsProps) {
  return (
    <div
      role="group"
      aria-label="Zoom"
      className="absolute bottom-4 left-4 z-10 flex divide-x overflow-hidden rounded-lg border bg-background shadow-xs [&_svg]:size-4"
    >
      <button type="button" aria-label="Zoom out" disabled={!onZoomOut} onClick={onZoomOut} className={buttonClass}>
        <Minus aria-hidden="true" />
      </button>
      <output aria-label="Zoom level" className="flex w-13 items-center justify-center text-xs text-neutral-600 tabular-nums">
        {Math.round(zoom * 100)}%
      </output>
      <button type="button" aria-label="Zoom in" disabled={!onZoomIn} onClick={onZoomIn} className={buttonClass}>
        <Plus aria-hidden="true" />
      </button>
      <button type="button" aria-label="Fit to view" disabled={!onFit} onClick={onFit} className={buttonClass}>
        <Maximize aria-hidden="true" />
      </button>
    </div>
  );
}
