import type { LineCounter, ParsedNode } from 'yaml';

import type { Diagnostic, DiagnosticCode, DiagnosticSeverity, Position, SourceRange } from '../types';

type Location = ParsedNode | readonly [start: number, end: number];

export class ParserContext {
  readonly diagnostics: Diagnostic[] = [];
  readonly #lineCounter: LineCounter;

  constructor(lineCounter: LineCounter) {
    this.#lineCounter = lineCounter;
  }

  get hasErrors(): boolean {
    return this.diagnostics.some((diagnostic) => diagnostic.severity === 'error');
  }

  error(code: DiagnosticCode, message: string, at?: Location): void {
    this.#report('error', code, message, at);
  }

  warning(code: DiagnosticCode, message: string, at?: Location): void {
    this.#report('warning', code, message, at);
  }

  rangeOf(at: Location): SourceRange {
    const [start, end] = 'range' in at ? at.range : at;
    return { start: this.#position(start), end: this.#position(end) };
  }

  #report(severity: DiagnosticSeverity, code: DiagnosticCode, message: string, at?: Location): void {
    this.diagnostics.push({ severity, code, message, ...(at && { range: this.rangeOf(at) }) });
  }

  #position(offset: number): Position {
    const { line, col } = this.#lineCounter.linePos(offset);
    return { offset, line, column: col };
  }
}
