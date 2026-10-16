import type { Diagnostic, DiagnosticSeverity } from '@cfn-lens/core';
import { useId } from 'react';
import { cn } from 'cn';
import { DiagnosticIcon } from '@/features/diagnostics/DiagnosticIcon';
import { formatLocation, sortDiagnostics, summarizeDiagnostics, worstSeverity } from '@/features/diagnostics/diagnostics';

interface EditorAreaProps {
  template: string | undefined;
  diagnostics: readonly Diagnostic[];
}

// Full class names (not built from strings) so Tailwind can find them when scanning the source.
const severityClasses: Record<DiagnosticSeverity, { summary: string; line: string; lineNumber: string; problemList: string }> = {
  error: {
    summary: 'text-red-700',
    line: 'bg-red-50 shadow-[inset_2px_0_0_var(--color-red-600)]',
    lineNumber: 'font-medium text-red-700',
    problemList: 'border-red-200 bg-red-50 text-red-950',
  },
  warning: {
    summary: 'text-amber-700',
    line: 'bg-amber-50 shadow-[inset_2px_0_0_var(--color-amber-500)]',
    lineNumber: 'font-medium text-amber-700',
    problemList: 'border-amber-200 bg-amber-50 text-amber-950',
  },
};

export function EditorArea({ template, diagnostics }: EditorAreaProps) {
  const headingId = useId();
  const severity = worstSeverity(diagnostics);
  const classes = severity && severityClasses[severity];

  return (
    <section aria-labelledby={headingId} className="flex h-full flex-col bg-background">
      <div className="flex h-10 flex-none items-center justify-between gap-2 border-b pr-3 pl-4 text-[13px] text-neutral-600">
        <h2 id={headingId} className="font-medium">
          Template
        </h2>
        <span role="status" className={cn('flex items-center gap-1.5 font-medium', classes?.summary)}>
          {severity && <DiagnosticIcon severity={severity} />}
          {summarizeDiagnostics(diagnostics)}
        </span>
      </div>
      {template ? (
        <>
          <TemplateSource template={template} lineSeverities={severityByLine(diagnostics)} />
          <ProblemList diagnostics={diagnostics} />
        </>
      ) : (
        <p className="p-4 text-[13px] text-neutral-500">No template loaded. Start from the home page by pasting one or picking a sample.</p>
      )}
    </section>
  );
}

/** Read-only view with line numbers. CodeMirror replaces it in M1 (D16). */
function TemplateSource({ template, lineSeverities }: { template: string; lineSeverities: ReadonlyMap<number, DiagnosticSeverity> }) {
  const lines = template.split('\n');

  return (
    <pre
      tabIndex={0}
      aria-label="Template source"
      className="min-h-0 flex-1 overflow-auto py-2 font-mono text-[12.5px]/5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
    >
      {lines.map((line, index) => {
        const lineNumber = index + 1;
        const severity = lineSeverities.get(lineNumber);
        const classes = severity && severityClasses[severity];

        return (
          // Lines have no identity besides their position, so the index is the right key here.
          <span key={index} className={cn('flex', classes?.line)}>
            <span aria-hidden="true" className={cn('w-11 flex-none pr-3.5 text-right text-neutral-400 select-none', classes?.lineNumber)}>
              {lineNumber}
            </span>
            <code>{line || ' '}</code>
          </span>
        );
      })}
    </pre>
  );
}

function ProblemList({ diagnostics }: { diagnostics: readonly Diagnostic[] }) {
  const severity = worstSeverity(diagnostics);
  if (!severity) {
    return null;
  }

  return (
    <ul
      aria-label="Problems"
      className={cn('max-h-40 flex-none overflow-auto border-t py-1.5 text-[13px]', severityClasses[severity].problemList)}
    >
      {sortDiagnostics(diagnostics).map((diagnostic, index) => {
        const location = formatLocation(diagnostic);

        return (
          <li key={index} className="flex items-start gap-2.5 px-4 py-1.5">
            <DiagnosticIcon severity={diagnostic.severity} className="mt-0.5" />
            <span>
              {location && <b className="font-semibold">{location} — </b>}
              {diagnostic.message}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** 1-based line → the worst severity of the problems starting on it. */
function severityByLine(diagnostics: readonly Diagnostic[]): Map<number, DiagnosticSeverity> {
  const lines = new Map<number, DiagnosticSeverity>();

  for (const { range, severity } of diagnostics) {
    if (!range) {
      continue;
    }
    const line = range.start.line;
    const hasError = lines.get(line) === 'error';
    if (!hasError) {
      lines.set(line, severity);
    }
  }

  return lines;
}
