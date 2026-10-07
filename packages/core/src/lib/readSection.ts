import { isMap, isScalar, type ParsedNode, type YAMLMap } from 'yaml';

import type { SourceRange } from '../types';
import type { ParserContext } from './ParserContext';
import { readString } from './readString';

export type SectionEntry = {
  name: string;
  nameNode: ParsedNode;
  node: YAMLMap.Parsed;
  nameRange: SourceRange;
  range: SourceRange;
};

// https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/resources-section-structure.html#resources-section-logical-id
const LOGICAL_ID = /^[A-Za-z0-9]+$/;

// Reads a section that maps logical IDs to mappings (Parameters, Mappings, Resources, Outputs).
// Missing or empty → empty map. Entries that are not mappings are reported and skipped.
export function readSection<T>(
  root: YAMLMap.Parsed,
  key: string,
  ctx: ParserContext,
  readEntry: (entry: SectionEntry, ctx: ParserContext) => T | undefined,
): ReadonlyMap<string, T> {
  const entries = new Map<string, T>();
  const section = root.get(key, true) as ParsedNode | undefined;

  if (!section || (isScalar(section) && section.value === null)) {
    return entries;
  }

  if (!isMap(section)) {
    ctx.error('expected-mapping', `${key} must be a mapping of logical IDs.`, section);
    return entries;
  }

  for (const { key: nameNode, value } of section.items) {
    const name = readString(nameNode, `${key} logical ID`, ctx, { allowScalars: true })?.value;

    if (name === undefined) {
      continue;
    }

    if (!LOGICAL_ID.test(name)) {
      ctx.error('invalid-logical-id', `Logical ID '${name}' must contain only letters and digits.`, nameNode);
    }

    if (!isMap(value)) {
      ctx.error('expected-mapping', `${name} must be a mapping.`, value ?? nameNode);
      continue;
    }

    const entry = readEntry(
      { name, nameNode, node: value, nameRange: ctx.rangeOf(nameNode), range: ctx.rangeOf([nameNode.range[0], value.range[1]]) },
      ctx,
    );

    if (entry !== undefined) {
      entries.set(name, entry);
    }
  }

  return entries;
}
