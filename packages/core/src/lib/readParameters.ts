import { isScalar, type ParsedNode, type YAMLMap } from 'yaml';

import type { Parameter } from '../types/template';
import type { ParserContext } from './ParserContext';
import { readBoolean, readNumber, readStringList } from './readScalars';
import { readSection, type SectionEntry } from './readSection';
import { readString } from './readString';

// https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/parameters-section-structure.html
const PROPERTIES = new Set([
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
  return readSection(root, 'Parameters', ctx, readParameter);
}

function readParameter({ name, nameNode, node, nameRange, range }: SectionEntry, ctx: ParserContext): Parameter | undefined {
  for (const { key } of node.items) {
    if (isScalar(key) && !PROPERTIES.has(String(key.value))) {
      ctx.error('unknown-property', `Unknown parameter property '${key.value}' in ${name}.`, key);
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
  };
}
