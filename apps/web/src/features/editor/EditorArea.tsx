import { useId } from 'react';

interface EditorAreaProps {
  template: string | undefined;
}

export function EditorArea({ template }: EditorAreaProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex h-full flex-col bg-background">
      <div className="flex h-10 flex-none items-center justify-between gap-2 border-b pr-3 pl-4 text-[13px] text-neutral-600">
        <h2 id={headingId} className="font-medium">
          Template
        </h2>
      </div>
      {template ? (
        <TemplateSource template={template} />
      ) : (
        <p className="p-4 text-[13px] text-neutral-500">No template loaded. Start from the home page by pasting one or picking a sample.</p>
      )}
    </section>
  );
}

/** Read-only view with line numbers. CodeMirror replaces it in M1 (D16). */
function TemplateSource({ template }: { template: string }) {
  const lines = template.split('\n');

  return (
    <pre
      tabIndex={0}
      aria-label="Template source"
      className="min-h-0 flex-1 overflow-auto py-2 font-mono text-[12.5px]/5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
    >
      {lines.map((line, index) => (
        // Lines have no identity besides their position, so the index is the right key here.
        <span key={index} className="flex">
          <span aria-hidden="true" className="w-11 flex-none pr-3.5 text-right text-neutral-400 select-none">
            {index + 1}
          </span>
          <code>{line || ' '}</code>
        </span>
      ))}
    </pre>
  );
}
