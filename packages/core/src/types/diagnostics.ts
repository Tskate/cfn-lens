export type Position = { offset: number; line: number; column: number };
export type SourceRange = { start: Position; end: Position };

export type DiagnosticSeverity = 'error' | 'warning';
// Stable identifiers for tests and UI logic; messages may change freely.
export type DiagnosticCode =
  | 'yaml-syntax'
  | 'empty-template'
  | 'root-not-object'
  | 'expected-string'
  | 'expected-number'
  | 'expected-boolean'
  | 'expected-list'
  | 'expected-mapping'
  | 'invalid-logical-id'
  | 'missing-required-property'
  | 'unknown-property'
  | 'string-not-quoted'
  | 'unsupported-format-version'
  | 'description-too-long'
  | 'transform-missing-name'
  | 'unsupported-parameter-type'
  | 'constraint-not-applicable'
  | 'invalid-constraint-range'
  | 'invalid-allowed-pattern'
  | 'default-violates-constraint'
  | 'too-many-entries'
  | 'name-too-long'
  | 'intrinsic-not-allowed'
  | 'expected-condition-function'
  | 'function-not-allowed'
  | 'invalid-arguments'
  | 'invalid-ref'
  | 'unknown-condition'
  | 'unknown-mapping'
  | 'unknown-mapping-key'
  | 'circular-condition'
  | 'constant-condition'
  | 'duplicate-export-name'
  | 'invalid-resource-type'
  | 'invalid-policy'
  | 'unknown-resource'
  | 'unknown-resource-reference'
  | 'circular-dependency';

export type Diagnostic = {
  severity: DiagnosticSeverity;
  code: DiagnosticCode;
  message: string;
  range?: SourceRange;
};
