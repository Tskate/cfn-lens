import { isMap, isScalar, isSeq, type ParsedNode } from 'yaml';

import type { TemplateValue } from '../types';
import { readIntrinsicCall } from './intrinsics';
import type { ParserContext } from './ParserContext';
import { readString } from './readString';

// Reads any value that may contain intrinsic functions into a TemplateValue tree.
// Only the shape is read here: function names and arguments are checked separately.
export function readValue(node: ParsedNode, ctx: ParserContext): TemplateValue {
  const call = readIntrinsicCall(node);

  if (!call) {
    return readLiteral(node, ctx);
  }

  // Short form: the argument is the tagged node itself, without its tag, so read it as a literal.
  const isShortForm = call.arg === node;
  const arg = call.arg
    ? isShortForm
      ? readLiteral(node, ctx)
      : readValue(call.arg, ctx)
    : ({ kind: 'scalar', value: null, range: ctx.rangeOf(node) } as const);

  return { kind: 'intrinsic', fn: call.fn, arg, range: ctx.rangeOf(node) };
}

function readLiteral(node: ParsedNode, ctx: ParserContext): TemplateValue {
  // The tuple form skips the tag: a short-form argument starts after it.
  const range = ctx.rangeOf([node.range[0], node.range[1]]);

  if (isSeq(node)) {
    return { kind: 'list', items: node.items.map((item) => readValue(item, ctx)), range };
  }

  if (isMap(node)) {
    const entries = new Map<string, TemplateValue>();

    for (const { key, value } of node.items) {
      const name = readString(key, 'Key', ctx, { allowScalars: true })?.value;
      if (name !== undefined) {
        entries.set(name, value ? readValue(value, ctx) : { kind: 'scalar', value: null, range: ctx.rangeOf(key) });
      }
    }

    return { kind: 'object', entries, range };
  }

  // The only other node kind is a YAML alias (*name), not resolved yet: read as null.
  const value = isScalar(node) ? node.value : null;
  return { kind: 'scalar', value: value as string | number | boolean | null, range };
}
