import { Separator } from 'react-resizable-panels';

/**
 * A 1px divider with a wider invisible hit area. Turns blue while hovered, focused or dragged.
 * Arrow keys resize it and double-click resets the neighbouring panel (built into react-resizable-panels).
 */
export function WorkspaceSplitter({ label }: { label: string }) {
  return (
    <Separator
      aria-label={label}
      className="group/split relative z-10 flex w-px items-center justify-center bg-border outline-none before:absolute before:inset-y-0 before:left-1/2 before:w-0.5 before:-translate-x-1/2 before:bg-blue-600 before:opacity-0 before:transition-opacity after:absolute after:inset-y-0 after:-inset-x-1 data-[separator=active]:before:opacity-100 data-[separator=focus]:before:opacity-100 data-[separator=hover]:before:opacity-100"
    >
      <span className="relative h-8 w-1.5 rounded-full border border-neutral-300 bg-background transition-colors group-data-[separator=active]/split:border-blue-600 group-data-[separator=focus]/split:border-blue-600" />
    </Separator>
  );
}
