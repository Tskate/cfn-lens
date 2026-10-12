import { isMap, isScalar, type ParsedNode } from 'yaml';

// fn is the long-form name ('Ref', 'Condition' or 'Fn::*'). arg is the function's argument:
// for the short form it is the tagged node itself (`!Equals [a, b]` → the list), null when empty.
export type IntrinsicCall = { fn: string; arg: ParsedNode | null; node: ParsedNode };

// condition: also treat `{ Condition: Name }` as a call. Only inside condition expressions,
// because elsewhere (e.g. an IAM policy statement) `Condition` is an ordinary key.
export type ReadIntrinsicOptions = { condition?: boolean };

export function readIntrinsicCall(node: ParsedNode, options: ReadIntrinsicOptions = {}): IntrinsicCall | undefined {
  if (node.tag?.startsWith('!')) {
    const name = node.tag.slice(1);
    return { fn: name === 'Ref' || name === 'Condition' ? name : `Fn::${name}`, arg: node, node };
  }

  const pair = isMap(node) && node.items.length === 1 ? node.items[0] : undefined;
  if (!pair) {
    return undefined;
  }

  const { key, value } = pair;
  const fn = isScalar(key) && typeof key.value === 'string' ? key.value : undefined;

  if (fn === undefined || !(fn === 'Ref' || fn.startsWith('Fn::') || (options.condition && fn === 'Condition'))) {
    return undefined;
  }

  return { fn, arg: value && !(isScalar(value) && value.value === null) ? value : null, node };
}

// Short form: a YAML tag such as !Ref. Long form: a mapping with exactly one key, Ref or Fn::*.
export function isIntrinsic(node: ParsedNode): boolean {
  return readIntrinsicCall(node) !== undefined;
}
