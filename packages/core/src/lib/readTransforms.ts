import { isMap, isSeq, type ParsedNode, type YAMLMap } from 'yaml';

import type { ParserContext } from './ParserContext';
import { readString } from './readString';

// https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/transform-section-structure.html
// Shapes: a name, a list of names (applied in order), or { Name, Parameters } (e.g. AWS::Include).
export function readTransforms(root: YAMLMap.Parsed, ctx: ParserContext): string[] {
  const node = root.get('Transform', true) as ParsedNode | undefined;

  if (!node) {
    return [];
  }

  const entries = isSeq(node) ? node.items : [node];

  return entries.flatMap((entry) => readTransformName(entry, ctx) ?? []);
}

function readTransformName(node: ParsedNode, ctx: ParserContext): string | undefined {
  if (!isMap(node)) {
    return readString(node, 'Transform', ctx)?.value;
  }

  // Parameters are ignored until the parser has a generic value tree.
  const name = node.get('Name', true) as ParsedNode | undefined;

  if (!name) {
    ctx.error('transform-missing-name', 'A Transform mapping needs a Name.', node);
    return undefined;
  }

  return readString(name, 'Transform Name', ctx)?.value;
}
