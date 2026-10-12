import { isMap, isScalar, isSeq, type ParsedNode, type YAMLMap } from 'yaml';
import type { ParserContext } from '../utils/yaml/ParserContext';
import type { Resource, ResourceProperty, SourceRange, TemplateValue } from '../types';
import { mappingEntry, readSection, type SectionEntry } from '../utils/yaml/readSection';
import { readString } from '../utils/yaml/readString';
import { readValue } from '../utils/yaml/readValue';
import { readStringList } from '../utils/yaml/readScalars';
import { readOptionalString } from '../utils/yaml/readOptionalString';

const RESOURCE_TYPE = /^[A-Za-z0-9]+::[A-Za-z0-9]+/;

export function readResources(root: YAMLMap.Parsed, ctx: ParserContext): ReadonlyMap<string, Resource> {
  return readSection(root, 'Resources', ctx, mappingEntry(readResource));
}

function readResource({ name, node, nameRange, range, nameNode }: SectionEntry<YAMLMap.Parsed>, ctx: ParserContext): Resource | undefined {
  const typeNode = node.get('Type', true) as ParsedNode | undefined;
  const propertyRanges = readPropertyRanges(node, name, ctx);

  const type = typeNode && readString(typeNode, `${name}.Type`, ctx)?.value;

  if (type === undefined) {
    if (!typeNode || (isScalar(typeNode) && typeNode.value === null)) {
      ctx.error('missing-required-property', `Resource ${name} has no Type.`, nameNode);
    }
    return undefined;
  }

  // Lenient on purpose: Custom::Name, registry types (Org::Service::Type) and modules (…::MODULE) are valid too.
  // The resource is kept, so the diagram and references to it don't vanish.
  if (!RESOURCE_TYPE.test(type)) {
    ctx.error('invalid-resource-type', `Resource type '${type}' must look like Service::Type, e.g. AWS::S3::Bucket.`, typeNode);
  }

  const properties = readObjectProperty(node, 'Properties', name, ctx);
  const creationPolicy = readObjectProperty(node, 'CreationPolicy', name, ctx);
  const updatePolicy = readObjectProperty(node, 'UpdatePolicy', name, ctx);
  const dependsOn = readDependsOn(node, name, ctx);
  const deletionPolicy = readOptionalString(node, 'DeletionPolicy', ctx)?.value;
  const condition = readOptionalString(node, 'Condition', ctx)?.value;
  const metadata = readObjectProperty(node, 'Metadata', name, ctx);
  const updateReplacePolicy = readOptionalString(node, 'UpdateReplacePolicy', ctx)?.value;

  return {
    name,
    nameRange,
    range,
    type,
    properties,
    dependsOn,
    creationPolicy,
    updatePolicy,
    updateReplacePolicy,
    deletionPolicy,
    condition,
    metadata,
    propertyRanges,
  };
}

function readDependsOn(resource: YAMLMap.Parsed, name: string, ctx: ParserContext): readonly string[] {
  const node = resource.get('DependsOn', true) as ParsedNode | undefined;

  if (!node || (isScalar(node) && node.value === null)) {
    return [];
  }

  if (isSeq(node)) {
    return readStringList(node, `${name}.DependsOn`, ctx, { allowScalars: true }) ?? [];
  }

  const target = readString(node, `${name}.DependsOn`, ctx, { allowScalars: true })?.value;
  return target === undefined ? [] : [target];
}

// An optional attribute whose value must be a mapping; its contents are kept as a value tree.
function readObjectProperty(resource: YAMLMap.Parsed, key: ResourceProperty, name: string, ctx: ParserContext): TemplateValue | undefined {
  const node = resource.get(key, true) as ParsedNode | undefined;

  if (!node || (isScalar(node) && node.value === null)) {
    return undefined;
  }

  if (!isMap(node)) {
    ctx.error('expected-mapping', `${name}.${key} must be a mapping.`, node);
    return undefined;
  }

  return readValue(node, ctx);
}

const PROPERTIES: ReadonlySet<string> = new Set<ResourceProperty>([
  'Type',
  'Properties',
  'Condition',
  'DeletionPolicy',
  'UpdateReplacePolicy',
  'CreationPolicy',
  'UpdatePolicy',
  'Metadata',
  'DependsOn',
]);

function readPropertyRanges(node: YAMLMap.Parsed, name: string, ctx: ParserContext): Partial<Record<ResourceProperty, SourceRange>> {
  const propertyRanges: Partial<Record<ResourceProperty, SourceRange>> = {};

  for (const { key, value } of node.items) {
    const property = isScalar(key) ? String(key.value) : undefined;

    if (property === undefined) {
      continue;
    }

    if (PROPERTIES.has(property)) {
      propertyRanges[property as ResourceProperty] = ctx.rangeOf(value ?? key);
    } else {
      ctx.error('unknown-property', `Unknown resource property '${property}' in ${name}.`, key);
    }
  }

  return propertyRanges;
}
