import { isScalar, isSeq, type ParsedNode } from 'yaml';

import type { ParserContext } from './ParserContext';
import { readString, type ReadStringOptions } from './readString';

const isEmpty = (node: ParsedNode) => isScalar(node) && node.value === null;

// Accepts numeric strings too: JSON templates often write "MaxLength": "64".
export function readNumber(node: ParsedNode, label: string, ctx: ParserContext): number | undefined {
  if (isEmpty(node)) {
    return undefined;
  }

  if (isScalar(node)) {
    const value = typeof node.value === 'string' && node.value.trim() !== '' ? Number(node.value) : node.value;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  ctx.error('expected-number', `${label} must be a number.`, node);
  return undefined;
}

// Accepts 'true' / 'false' strings too: JSON templates often write "NoEcho": "true".
export function readBoolean(node: ParsedNode, label: string, ctx: ParserContext): boolean | undefined {
  if (isEmpty(node)) {
    return undefined;
  }

  if (isScalar(node)) {
    const value = typeof node.value === 'string' ? node.value.toLowerCase() : node.value;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
  }

  ctx.error('expected-boolean', `${label} must be true or false.`, node);
  return undefined;
}

// Invalid items are reported and skipped; the valid ones are kept in order.
export function readStringList(node: ParsedNode, label: string, ctx: ParserContext, options: ReadStringOptions = {}): string[] | undefined {
  if (isEmpty(node)) {
    return undefined;
  }

  if (!isSeq(node)) {
    ctx.error('expected-list', `${label} must be a list.`, node);
    return undefined;
  }

  return node.items.flatMap((item) => readString(item, label, ctx, options)?.value ?? []);
}
