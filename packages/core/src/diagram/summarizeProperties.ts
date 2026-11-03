import type { PropertySummary, Template, TemplateValue, ValueSummary } from '../types';
import { findReferences } from '../utils/findReferences';

const MAX_LISTED_ITEMS = 3;

/** Every top-level property of a resource, summarized for the details panel. */
export function summarizeProperties(template: Template, logicalId: string): PropertySummary[] {
  const properties = template.resources.get(logicalId)?.properties;

  if (properties?.kind !== 'object') {
    return [];
  }

  return [...properties.entries].map(([name, value]) => ({ name, value: summarize(value, template) }));
}

function summarize(value: TemplateValue, template: Template): ValueSummary {
  if (value.kind === 'scalar') {
    return { kind: 'text', text: String(value.value ?? '') };
  }

  if (value.kind === 'object') {
    return { kind: 'count', of: 'keys', count: value.entries.size };
  }

  if (value.kind === 'list') {
    return summarizeList(value.items, template);
  }

  return summarizeFunction(value, template);
}

function summarizeList(items: readonly TemplateValue[], template: Template): ValueSummary {
  const summaries = items.map((item) => summarize(item, template));
  const isShort = summaries.length <= MAX_LISTED_ITEMS;
  const isSimple = summaries.every(({ kind }) => kind !== 'count' && kind !== 'list');

  if (!isShort || !isSimple) {
    return { kind: 'count', of: 'items', count: items.length };
  }

  return { kind: 'list', items: summaries };
}

function summarizeFunction(value: TemplateValue & { kind: 'intrinsic' }, template: Template): ValueSummary {
  const isPlainReference = value.fn === 'Ref' || value.fn === 'Fn::GetAtt';
  const [reference] = findReferences(value);

  if (!isPlainReference || !reference) {
    return { kind: 'function', fn: value.fn };
  }

  const { target, attribute } = reference;

  if (template.resources.has(target)) {
    return { kind: 'resource', id: target, attribute };
  }

  if (template.parameters.has(target)) {
    return { kind: 'parameter', name: target };
  }

  if (target.startsWith('AWS::')) {
    return { kind: 'pseudoParameter', name: target };
  }

  return { kind: 'text', text: target };
}
