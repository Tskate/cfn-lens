import { useId, type ReactNode } from 'react';

interface AreaProps {
  title: string;
  children: ReactNode;
}

/** A titled region of the workspace. The heading labels the region for screen readers. */
export function Area({ title, children }: AreaProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex h-full min-h-0 flex-col">
      <h2 id={headingId} className="border-b px-3 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </section>
  );
}
