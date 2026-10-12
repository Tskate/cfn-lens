import { isScalar, type ParsedNode, type YAMLMap } from 'yaml';

import type { Parameter, ParameterProperty, SourceRange } from '../types';
import type { ParserContext } from '../utils/yaml/ParserContext';
import { readBoolean, readNumber, readStringList } from '../utils/yaml/readScalars';
import { mappingEntry, readSection, type SectionEntry } from '../utils/yaml/readSection';
import { readString } from '../utils/yaml/readString';

// https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/parameters-section-structure.html
const PROPERTIES: ReadonlySet<string> = new Set<ParameterProperty>([
  'Type',
  'Default',
  'AllowedValues',
  'AllowedPattern',
  'ConstraintDescription',
  'Description',
  'MinLength',
  'MaxLength',
  'MinValue',
  'MaxValue',
  'NoEcho',
]);

export function readParameters(root: YAMLMap.Parsed, ctx: ParserContext): ReadonlyMap<string, Parameter> {
  return readSection(root, 'Parameters', ctx, mappingEntry(readParameter));
}

function readParameter(
  { name, nameNode, node, nameRange, range }: SectionEntry<YAMLMap.Parsed>,
  ctx: ParserContext,
): Parameter | undefined {
  const propertyRanges: Partial<Record<ParameterProperty, SourceRange>> = {};

  for (const { key, value } of node.items) {
    const property = isScalar(key) ? String(key.value) : undefined;
    if (property === undefined) {
      continue;
    }
    if (PROPERTIES.has(property)) {
      propertyRanges[property as ParameterProperty] = ctx.rangeOf(value ?? key);
    } else {
      ctx.error('unknown-property', `Unknown parameter property '${property}' in ${name}.`, key);
    }
  }

  // Reads an optional property with the given node reader; label is e.g. "Env.Default".
  const read = <T>(key: string, reader: (node: ParsedNode, label: string, ctx: ParserContext) => T | undefined) => {
    const property = node.get(key, true) as ParsedNode | undefined;
    return property && reader(property, `${name}.${key}`, ctx);
  };

  const typeNode = node.get('Type', true) as ParsedNode | undefined;
  const type = typeNode && readString(typeNode, `${name}.Type`, ctx)?.value;

  if (type === undefined) {
    // A wrongly shaped Type was already reported by readString: only report a truly missing one.
    if (!typeNode || (isScalar(typeNode) && typeNode.value === null)) {
      ctx.error('missing-required-property', `Parameter ${name} has no Type.`, nameNode);
    }
    return undefined;
  }

  return {
    name,
    type,
    default: read('Default', (n, label, c) => readString(n, label, c, { allowScalars: true }))?.value,
    allowedValues: read('AllowedValues', (n, label, c) => readStringList(n, label, c, { allowScalars: true })) ?? [],
    allowedPattern: read('AllowedPattern', readString)?.value,
    constraintDescription: read('ConstraintDescription', readString)?.value,
    description: read('Description', readString)?.value,
    minLength: read('MinLength', readNumber),
    maxLength: read('MaxLength', readNumber),
    minValue: read('MinValue', readNumber),
    maxValue: read('MaxValue', readNumber),
    noEcho: read('NoEcho', readBoolean) ?? false,
    nameRange,
    range,
    propertyRanges,
  };
}
