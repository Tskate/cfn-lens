import { isMap, isScalar, isSeq, type ParsedNode, type YAMLMap } from 'yaml';

import type { Mapping, MappingValue } from '../types/template';
import { isIntrinsic } from './intrinsics';
import type { ParserContext } from './ParserContext';
import { MAX_NAME_LENGTH, readSection, type SectionEntry } from './readSection';
import { readString } from './readString';

// https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/mappings-section-structure.html
// MappingName → top-level key → attribute → String | List. Only literals: no intrinsic functions.
export function readMappings(root: YAMLMap.Parsed, ctx: ParserContext): ReadonlyMap<string, Mapping> {
  return readSection(root, 'Mappings', ctx, readMapping);
}

function readMapping({ name, node, nameRange, range }: SectionEntry, ctx: ParserContext): Mapping {
  const entries = new Map<string, ReadonlyMap<string, MappingValue>>();

  for (const { key, value } of node.items) {
    const topKey = readString(key, `${name} key`, ctx, { allowScalars: true })?.value;

    if (topKey === undefined) {
      continue;
    }

    if (!isMap(value)) {
      ctx.error('expected-mapping', `${name}.${topKey} must be a mapping of attribute names to values.`, value ?? key);
      continue;
    }

    entries.set(topKey, readAttributes(value, `${name}.${topKey}`, ctx));
  }

  return { name, entries, nameRange, range };
}

function readAttributes(node: YAMLMap.Parsed, label: string, ctx: ParserContext): ReadonlyMap<string, MappingValue> {
  const attributes = new Map<string, MappingValue>();

  for (const { key, value } of node.items) {
    const attribute = readString(key, `${label} attribute`, ctx, { allowScalars: true })?.value;

    if (attribute === undefined) {
      continue;
    }

    if (attribute.length > MAX_NAME_LENGTH) {
      ctx.error('name-too-long', `Mapping attribute names can be at most ${MAX_NAME_LENGTH} characters.`, key);
    }

    const mappingValue = readMappingValue(value ?? key, `${label}.${attribute}`, ctx);

    if (mappingValue !== undefined) {
      attributes.set(attribute, mappingValue);
    }
  }

  return attributes;
}

function readMappingValue(node: ParsedNode, label: string, ctx: ParserContext): MappingValue | undefined {
  if (isScalar(node) && node.value === null) {
    ctx.error('expected-string', `${label} must be a string or a list of strings.`, node);
    return undefined;
  }

  if (!isSeq(node) || isIntrinsic(node)) {
    return readLiteral(node, label, ctx);
  }

  // A partially read list would make Fn::FindInMap return the wrong value, so any bad item drops the whole list.
  const items = node.items.map((item) => readLiteral(item, label, ctx));
  return items.every((item) => item !== undefined) ? items : undefined;
}

function readLiteral(node: ParsedNode, label: string, ctx: ParserContext): string | undefined {
  if (isIntrinsic(node)) {
    ctx.error('intrinsic-not-allowed', `${label}: intrinsic functions can't be used in Mappings.`, node);
    return undefined;
  }

  return readString(node, label, ctx, { allowScalars: true })?.value;
}
