import type { Diagnostic, DiagnosticSeverity, ParseResult } from '@cfn-lens/core';

export function sortDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return diagnostics.toSorted((a, b) => startOffset(a) - startOffset(b));
}

export function worstSeverity(diagnostics: readonly Diagnostic[]): DiagnosticSeverity | undefined {
  const hasErrors = diagnostics.some(isError);

  if (hasErrors) {
    return 'error';
  }

  if (diagnostics.length > 0) {
    return 'warning';
  }

  return;
}

export function summarizeDiagnostics(diagnostics: readonly Diagnostic[]): string {
  const errorCount = diagnostics.filter(isError).length;
  const warningCount = diagnostics.length - errorCount;
  const parts = [plural(errorCount, 'error'), plural(warningCount, 'warning')];
  return parts.filter(Boolean).join(', ');
}

export function formatLocation({ range }: Diagnostic): string | undefined {
  if (!range) {
    return;
  }

  return `Line ${range.start.line}, column ${range.start.column}`;
}

export function findBlockingProblem(parseResult: ParseResult | undefined): Diagnostic | undefined {
  if (!parseResult) {
    return;
  }

  if (parseResult.template === null) {
    return parseResult.diagnostics[0];
  }
  return sortDiagnostics(parseResult.diagnostics).find(isYamlSyntaxError);
}

const isError = (diagnostic: Diagnostic) => diagnostic.severity === 'error';
const isYamlSyntaxError = (diagnostic: Diagnostic) => diagnostic.code === 'yaml-syntax';

function startOffset({ range }: Diagnostic): number {
  return range?.start.offset ?? -1;
}

function plural(count: number, word: string): string {
  if (count === 0) {
    return '';
  }
  if (count === 1) {
    return `1 ${word}`;
  }
  return `${count} ${word}s`;
}
