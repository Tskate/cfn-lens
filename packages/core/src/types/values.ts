import type { SourceRange } from '.';

export type TemplateValue =
  | { kind: 'scalar'; value: string | number | boolean | null; range: SourceRange }
  | { kind: 'list'; items: readonly TemplateValue[]; range: SourceRange }
  | { kind: 'object'; entries: ReadonlyMap<string, TemplateValue>; range: SourceRange }
  | { kind: 'intrinsic'; fn: string; arg: TemplateValue; range: SourceRange };
