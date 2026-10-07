export type Position = { offset: number; line: number; column: number };
export type SourceRange = { start: Position; end: Position };
export type Format = 'yaml' | 'json' | 'unknown';
export type DiagnosticSeverity = 'error' | 'warning';
// Stable identifiers for tests and UI logic; messages may change freely.
export type DiagnosticCode =
  | 'yaml-syntax'
  | 'empty-template'
  | 'root-not-object'
  | 'expected-string'
  | 'string-not-quoted'
  | 'unsupported-format-version'
  | 'description-too-long';
export type Diagnostic = {
  severity: DiagnosticSeverity;
  code: DiagnosticCode;
  message: string;
  range?: SourceRange;
};
