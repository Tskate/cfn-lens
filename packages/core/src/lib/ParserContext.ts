import type { LineCounter, ParsedNode } from 'yaml';

import type { Diagnostic, DiagnosticCode, DiagnosticSeverity, Position, SourceRange } from '../types';

type Location = ParsedNode | readonly [start: number, end: number];

export class ParserContext {
  readonly diagnostics: Diagnostic[] = [];
  readonly #lineCounter: LineCounter;
  readonly #sourceText: string;

  constructor(lineCounter: LineCounter, sourceText: string) {
    this.#lineCounter = lineCounter;
    this.#sourceText = sourceText;
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

  add(diagnostics: readonly Diagnostic[]): void {
    this.diagnostics.push(...diagnostics);
  }

  rangeOf(at: Location): SourceRange {
    const [start, end] = 'range' in at ? at.range : at;
    // A node's range starts after its tag; include the tag so `!Equals [a, b]` is underlined whole.
    const tagStart = 'range' in at && at.tag?.startsWith('!') ? this.#sourceText.lastIndexOf(at.tag, start) : -1;
    return { start: this.#position(tagStart >= 0 ? tagStart : start), end: this.#position(end) };
  }

  #report(severity: DiagnosticSeverity, code: DiagnosticCode, message: string, at?: Location): void {
    this.diagnostics.push({ severity, code, message, ...(at && { range: this.rangeOf(at) }) });
  }

  #position(offset: number): Position {
    const { line, col } = this.#lineCounter.linePos(offset);
    return { offset, line, column: col };
  }
}
