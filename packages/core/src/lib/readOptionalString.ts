import { isScalar, type ParsedNode, type Scalar, type YAMLMap } from 'yaml';

import type { ParserContext } from './ParserContext';

type StringField = { value: string; node: Scalar.Parsed; reported: boolean };

export function readOptionalString(root: YAMLMap.Parsed, key: string, ctx: ParserContext): StringField | undefined {
  const node = root.get(key, true) as ParsedNode | undefined;

  if (!node) {
    return undefined;
  }

  if (!isScalar(node)) {
    ctx.warning('expected-string', `${key} must be a string.`, node);
    return undefined;
  }

  if (node.value === null) {
    return undefined;
  }

  if (typeof node.value !== 'string') {
    const text = node.source ?? String(node.value);
    ctx.warning('string-not-quoted', `${key} should be a quoted string: '${text}'.`, node);
    return { value: text, node, reported: true };
  }

  return { value: node.value, node, reported: false };
}
