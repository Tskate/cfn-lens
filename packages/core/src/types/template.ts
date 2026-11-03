import type { SourceRange } from './diagnostics';
import type { Condition, Mapping, Output, Parameter, Resource } from './sections';

export type Format = 'yaml' | 'json' | 'unknown';

// Any value that may contain intrinsic functions (Output values, resource properties).
export type TemplateValue =
  | { kind: 'scalar'; value: string | number | boolean | null; range: SourceRange }
  | { kind: 'list'; items: readonly TemplateValue[]; range: SourceRange }
  | { kind: 'object'; entries: ReadonlyMap<string, TemplateValue>; range: SourceRange }
  | { kind: 'intrinsic'; fn: string; arg: TemplateValue; range: SourceRange };

export type Template = {
  // '2010-09-09' is only valid for now https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/format-version-structure.html
  formatVersion?: string;
  description?: string;
  // Macro names in execution order; [] when the section is missing.
  transforms: string[];
  resources: ReadonlyMap<string, Resource>;
  parameters: ReadonlyMap<string, Parameter>;
  mappings: ReadonlyMap<string, Mapping>;
  conditions: ReadonlyMap<string, Condition>;
  outputs: ReadonlyMap<string, Output>;
};
