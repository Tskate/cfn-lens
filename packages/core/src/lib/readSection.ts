import { isMap, isScalar, type ParsedNode, type YAMLMap } from 'yaml';

import type { SourceRange } from '../types';
import type { ParserContext } from './ParserContext';
import { readString } from './readString';

// `node` is null when the entry has no value (`Name:` or `Name: ~`).
export type SectionEntry<TNode extends ParsedNode | null = ParsedNode | null> = {
  name: string;
  nameNode: ParsedNode;
  node: TNode;
  nameRange: SourceRange;
  range: SourceRange;
};

type EntryReader<T, TNode extends ParsedNode | null> = (entry: SectionEntry<TNode>, ctx: ParserContext) => T | undefined;

// https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/resources-section-structure.html#resources-section-logical-id
const LOGICAL_ID = /^[A-Za-z0-9]+$/;
// https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cloudformation-limits.html
export const MAX_NAME_LENGTH = 255;

// Reads a section that maps logical IDs to definitions (Parameters, Mappings, Conditions, Resources, Outputs).
// Missing or empty → empty map. Entries whose reader returns undefined are left out.
export function readSection<T>(
  root: YAMLMap.Parsed,
  key: string,
  ctx: ParserContext,
  readEntry: EntryReader<T, ParsedNode | null>,
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

    if (name.length > MAX_NAME_LENGTH) {
      ctx.error('name-too-long', `Logical IDs can be at most ${MAX_NAME_LENGTH} characters.`, nameNode);
    }

    const node = value && !(isScalar(value) && value.value === null) ? value : null;
    const end = (node ?? nameNode).range[1];
    const entry = readEntry({ name, nameNode, node, nameRange: ctx.rangeOf(nameNode), range: ctx.rangeOf([nameNode.range[0], end]) }, ctx);

    if (entry !== undefined) {
      entries.set(name, entry);
    }
  }

  return entries;
}

// For sections whose entries must be mappings (Parameters, Mappings, Resources, Outputs).
export function mappingEntry<T>(readEntry: EntryReader<T, YAMLMap.Parsed>): EntryReader<T, ParsedNode | null> {
  return (entry, ctx) => {
    if (!isMap(entry.node)) {
      ctx.error('expected-mapping', `${entry.name} must be a mapping.`, entry.node ?? entry.nameNode);
      return undefined;
    }
    return readEntry({ ...entry, node: entry.node }, ctx);
  };
}
