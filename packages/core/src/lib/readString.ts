import { isScalar, type ParsedNode, type Scalar } from 'yaml';

import type { ParserContext } from './ParserContext';

// `reported`: a warning was already added for this value, so callers skip their own checks.
export type StringField = { value: string; node: Scalar.Parsed; reported: boolean };

export function readString(node: ParsedNode, label: string, ctx: ParserContext): StringField | undefined {
  if (!isScalar(node)) {
    ctx.warning('expected-string', `${label} must be a string.`, node);
    return undefined;
  }

  // `Key:` with no value parses as null: treat it like a missing value.
  if (node.value === null) {
    return undefined;
  }

  if (typeof node.value !== 'string') {
    // Source text, not String(value): `2010.10` parses to the number 2010.1.
    const text = node.source ?? String(node.value);
    ctx.warning('string-not-quoted', `${label} should be a quoted string: '${text}'.`, node);
    return { value: text, node, reported: true };
  }

  return { value: node.value, node, reported: false };
}
