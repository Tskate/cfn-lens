import { MousePointerClick } from 'lucide-react';

export function DetailsArea() {
  return (
    <aside
      aria-label="Resource details"
      className="flex h-full flex-col items-center justify-center gap-3 overflow-auto bg-background p-8 text-center"
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
