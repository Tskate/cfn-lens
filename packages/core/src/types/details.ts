// A property value, summarized for the details panel.
export type ValueSummary =
  | { kind: 'text'; text: string }
  | { kind: 'parameter'; name: string }
  | { kind: 'pseudoParameter'; name: string }
  | { kind: 'resource'; id: string; attribute?: string }
  | { kind: 'function'; fn: string }
  // A short list of simple values; longer or nested lists are counted instead
  | { kind: 'list'; items: readonly ValueSummary[] }
  | { kind: 'count'; of: 'items' | 'keys'; count: number };

export type PropertySummary = { name: string; value: ValueSummary };
