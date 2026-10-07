import { isMap, isScalar, type ParsedNode } from 'yaml';

// Short form: a YAML tag such as !Ref. Long form: a mapping with exactly one key, Ref or Fn::*.
export function isIntrinsic(node: ParsedNode): boolean {
  if (node.tag?.startsWith('!')) {
    return true;
  }

  if (!isMap(node) || node.items.length !== 1) {
    return false;
  }

  const key = node.items[0]?.key;
  return isScalar(key) && typeof key.value === 'string' && (key.value === 'Ref' || key.value.startsWith('Fn::'));
}
