import type { Diagnostic, DiagnosticSeverity, Format, SourceRange } from '@cfn-lens/core';
import { lazy, Suspense, useEffect, useId, useRef } from 'react';
import { cn } from 'cn';
import { DiagnosticIcon } from '@/features/diagnostics/DiagnosticIcon';
import { formatLocation, sortDiagnostics, summarizeDiagnostics, worstSeverity } from '@/features/diagnostics/diagnostics';
import { optionalLineSpan, type LineSpan } from '@/features/source/lineSpan';

interface EditorAreaProps {
  source: string | undefined;
  format: Format | undefined;
  diagnostics: readonly Diagnostic[];
  // The selected resource's lines (or a line link's), drawn in blue
  highlight: SourceRange | undefined;
  onChange: (source: string) => void;
}

// CodeMirror is a separate chunk (D30); until it arrives the read-only view stands in.
const TemplateEditor = lazy(() => import('./TemplateEditor').then((module) => ({ default: module.TemplateEditor })));

type LineClasses = { line: string; lineNumber: string };

const highlightClasses: LineClasses = {
  line: 'bg-[#eff4ff] shadow-[inset_2px_0_0_var(--color-blue-600)]',
  lineNumber: 'text-blue-700',
};

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

export function EditorArea({ source, format, diagnostics, highlight, onChange }: EditorAreaProps) {
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
      {source !== undefined ? (
        <>
          <Suspense fallback={<TemplateSource template={source} lineSeverities={severityByLine(diagnostics)} highlight={highlight} />}>
            <TemplateEditor source={source} format={format} diagnostics={diagnostics} highlight={highlight} onChange={onChange} />
          </Suspense>
          <ProblemList diagnostics={diagnostics} />
        </>
      ) : (
        <p className="p-4 text-[13px] text-neutral-500">No template loaded. Start from the home page by pasting one or picking a sample.</p>
      )}
    </section>
  );
}

/** Read-only view with line numbers, shown while the CodeMirror chunk loads. */
function TemplateSource({
  template,
  lineSeverities,
  highlight,
}: {
  template: string;
  lineSeverities: ReadonlyMap<number, DiagnosticSeverity>;
  highlight: SourceRange | undefined;
}) {
  const lines = template.split('\n');
  const sourceRef = useRef<HTMLPreElement>(null);
  const highlighted = optionalLineSpan(highlight);
  const firstHighlightedLine = highlighted?.first;

  // Scrolling is outside React's rendering, so it's an effect: bring new highlighted lines into view.
  useEffect(() => {
    if (firstHighlightedLine === undefined) {
      return;
    }

    sourceRef.current?.querySelector(`[data-line="${firstHighlightedLine}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [firstHighlightedLine]);

  const classesFor = (lineNumber: number): LineClasses | undefined => {
    if (isWithin(lineNumber, highlighted)) {
      return highlightClasses;
    }

    const severity = lineSeverities.get(lineNumber);

    if (!severity) {
      return;
    }

    return severityClasses[severity];
  };

  return (
    <pre
      ref={sourceRef}
      tabIndex={0}
      aria-label="Template source"
      className="min-h-0 flex-1 overflow-auto py-2 font-mono text-[12.5px]/5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
    >
      {lines.map((line, index) => {
        const lineNumber = index + 1;
        const classes = classesFor(lineNumber);

        return (
          // Lines have no identity besides their position, so the index is the right key here.
          <span key={index} data-line={lineNumber} className={cn('flex', classes?.line)}>
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

function isWithin(lineNumber: number, span: LineSpan | undefined): boolean {
  if (!span) {
    return false;
  }

  return lineNumber >= span.first && lineNumber <= span.last;
}
