import { isMap, isScalar, type ParsedNode, type YAMLMap } from 'yaml';

import type { Output, OutputProperty, SourceRange, TemplateValue } from '../types';
import { utf8ByteLength } from '../utils/utf8ByteLength';
import { isIntrinsic } from './intrinsics';
import type { ParserContext } from './ParserContext';
import { mappingEntry, readSection, type SectionEntry } from './readSection';
import { readString } from './readString';
import { readValue } from './readValue';

// https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/outputs-section-structure.html
const PROPERTIES: ReadonlySet<string> = new Set<OutputProperty>(['Value', 'Description', 'Export', 'Condition']);
const MAX_DESCRIPTION_BYTES = 1024;

export function readOutputs(root: YAMLMap.Parsed, ctx: ParserContext): ReadonlyMap<string, Output> {
  return readSection(root, 'Outputs', ctx, mappingEntry(readOutput));
}

function readOutput({ name, nameNode, node, nameRange, range }: SectionEntry<YAMLMap.Parsed>, ctx: ParserContext): Output {
  const propertyRanges: Partial<Record<OutputProperty, SourceRange>> = {};

  for (const { key, value } of node.items) {
    const property = isScalar(key) ? String(key.value) : undefined;
    if (property === undefined) {
      continue;
    }
    if (PROPERTIES.has(property)) {
      propertyRanges[property as OutputProperty] = ctx.rangeOf(value ?? key);
    } else {
      ctx.error('unknown-property', `Unknown output property '${property}' in ${name}.`, key);
    }
  }

  const valueNode = present(node.get('Value', true));
  if (!valueNode) {
    ctx.error('missing-required-property', `Output ${name} has no Value.`, nameNode);
  }

  return {
    name,
    value: valueNode && readValue(valueNode, ctx),
    description: readDescription(present(node.get('Description', true)), `${name}.Description`, ctx),
    exportName: readExportName(node, name, ctx),
    condition: readLiteralString(present(node.get('Condition', true)), `${name}.Condition`, ctx, { allowScalars: true }),
    nameRange,
    range,
    propertyRanges,
  };
}

// The node, or undefined when the key is missing or has no value (`Key:`).
function present(node: unknown): ParsedNode | undefined {
  const parsed = node as ParsedNode | undefined;
  return parsed && !(isScalar(parsed) && parsed.value === null) ? parsed : undefined;
}

// Description and Condition must be literals: "You can't use a parameter or function".
function readLiteralString(
  node: ParsedNode | undefined,
  label: string,
  ctx: ParserContext,
  options: { allowScalars?: boolean } = {},
): string | undefined {
  if (!node) {
    return undefined;
  }
  if (isIntrinsic(node)) {
    ctx.error('intrinsic-not-allowed', `${label} must be a literal string, not an intrinsic function.`, node);
    return undefined;
  }
  return readString(node, label, ctx, options)?.value;
}

function readDescription(node: ParsedNode | undefined, label: string, ctx: ParserContext): string | undefined {
  const description = readLiteralString(node, label, ctx);
  const bytes = description === undefined ? 0 : utf8ByteLength(description);

  if (node && bytes > MAX_DESCRIPTION_BYTES) {
    ctx.error('description-too-long', `${label} is ${bytes} bytes; CloudFormation allows at most ${MAX_DESCRIPTION_BYTES}.`, node);
  }

  return description;
}

function readExportName(output: YAMLMap.Parsed, name: string, ctx: ParserContext): TemplateValue | undefined {
  const exportNode = present(output.get('Export', true));

  if (!exportNode) {
    return undefined;
  }

  if (!isMap(exportNode)) {
    ctx.error('expected-mapping', `${name}.Export must be a mapping with a Name.`, exportNode);
    return undefined;
  }

  for (const { key } of exportNode.items) {
    if (isScalar(key) && key.value !== 'Name') {
      ctx.error('unknown-property', `Unknown Export property '${String(key.value)}' in ${name}.`, key);
    }
  }

  const nameNode = present(exportNode.get('Name', true));

  if (!nameNode) {
    // Point at the Export key, the closest thing to the missing Name.
    const exportKey = output.items.find(({ key }) => isScalar(key) && key.value === 'Export')?.key as ParsedNode;
    ctx.error('missing-required-property', `${name}.Export has no Name.`, exportKey);
    return undefined;
  }

  return readValue(nameNode, ctx);
}
