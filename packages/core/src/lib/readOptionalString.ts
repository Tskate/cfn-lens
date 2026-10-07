import type { ParsedNode, YAMLMap } from 'yaml';

import type { ParserContext } from './ParserContext';
import { readString, type StringField } from './readString';

export function readOptionalString(root: YAMLMap.Parsed, key: string, ctx: ParserContext): StringField | undefined {
  const node = root.get(key, true) as ParsedNode | undefined;

  return node && readString(node, key, ctx);
}
