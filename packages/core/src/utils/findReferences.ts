import type { ReferenceFunction, SourceRange, TemplateValue } from '../types';

// target is a logical ID or pseudo parameter as written; callers decide which ones they care about.
export type ValueReference = {
  target: string;
  attribute?: string;
  conditions?: readonly { name: string; value: boolean }[];
  via: ReferenceFunction;
  range: SourceRange;
};

// ${Name} or ${Name.Attribute}; ${!Literal} is plain text.
const SUB_VARIABLE = /\$\{([^}]*)\}/g;

// https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/intrinsic-functions.html
export function findReferences(value: TemplateValue): ValueReference[] {
  const references: ValueReference[] = [];
  collect(value, references);
  return references;
}

function collect(value: TemplateValue, references: ValueReference[]): void {
  if (value.kind === 'intrinsic' && value.fn === 'Fn::If' && value.arg.kind === 'list') {
    const [condition, yes, no] = value.arg.items;
    const name = nameOf(condition);
    if (name !== undefined) {
      for (const [branch, expected] of [
        [yes, true],
        [no, false],
      ] as const) {
        if (!branch) continue;
        const found: ValueReference[] = [];
        collect(branch, found);
        for (const reference of found) {
          const conditions = [{ name, value: expected }, ...(reference.conditions ?? [])];
          if (!conditions.some((item) => conditions.some((other) => other.name === item.name && other.value !== item.value))) {
            references.push({ ...reference, conditions });
          }
        }
      }
      return;
    }
  }
  if (value.kind === 'list') {
    value.items.forEach((item) => collect(item, references));
    return;
  }

  if (value.kind === 'object') {
    value.entries.forEach((entry) => collect(entry, references));
    return;
  }

  if (value.kind !== 'intrinsic') {
    return;
  }

  if (value.fn === 'Ref') {
    collectRef(value.arg, value.range, references);
    return;
  }

  if (value.fn === 'Fn::GetAtt') {
    collectGetAtt(value.arg, value.range, references);
    return;
  }

  if (value.fn === 'Fn::Sub') {
    collectSub(value.arg, references);
    return;
  }

  collect(value.arg, references);
}

function collectRef(arg: TemplateValue, range: SourceRange, references: ValueReference[]): void {
  const target = nameOf(arg);

  if (target === undefined) {
    collect(arg, references);
    return;
  }

  references.push({ target, via: 'Ref', range });
}

// `Name.Attribute` or [Name, Attribute]; attribute names may contain dots, the logical ID can't.
function collectGetAtt(arg: TemplateValue, range: SourceRange, references: ValueReference[]): void {
  const dotted = nameOf(arg);

  if (dotted !== undefined) {
    const [target, attribute] = splitAtFirstDot(dotted);
    references.push({ target, attribute, via: 'Fn::GetAtt', range });
    return;
  }

  if (arg.kind !== 'list') {
    collect(arg, references);
    return;
  }

  const [resource, attributeName] = arg.items;
  const target = nameOf(resource);

  if (target === undefined) {
    collect(arg, references);
    return;
  }

  references.push({ target, attribute: nameOf(attributeName), via: 'Fn::GetAtt', range });
  arg.items.slice(1).forEach((item) => collect(item, references));
}

// A string, or [string, { Variable: value }] where the variables shadow template names.
function collectSub(arg: TemplateValue, references: ValueReference[]): void {
  if (arg.kind === 'scalar') {
    collectSubVariables(arg, new Set(), references);
    return;
  }

  if (arg.kind !== 'list') {
    collect(arg, references);
    return;
  }

  const [text, variables] = arg.items;
  const localNames = variableNames(variables);

  if (text?.kind === 'scalar') {
    collectSubVariables(text, localNames, references);
  }

  if (variables) {
    collect(variables, references);
  }
}

function collectSubVariables(
  text: TemplateValue & { kind: 'scalar' },
  localNames: ReadonlySet<string>,
  references: ValueReference[],
): void {
  if (typeof text.value !== 'string') {
    return;
  }

  for (const [, variable = ''] of text.value.matchAll(SUB_VARIABLE)) {
    const [target, attribute] = splitAtFirstDot(variable);
    const isLiteral = variable.startsWith('!');
    const isLocal = localNames.has(target);

    if (isLiteral || isLocal) {
      continue;
    }

    references.push({ target, attribute, via: 'Fn::Sub', range: text.range });
  }
}

// Logical IDs may be all digits, so unquoted numbers count as names.
function nameOf(value: TemplateValue | undefined): string | undefined {
  if (value?.kind !== 'scalar') {
    return;
  }

  const isName = typeof value.value === 'string' || typeof value.value === 'number';

  if (!isName) {
    return;
  }

  return String(value.value);
}

function variableNames(variables: TemplateValue | undefined): Set<string> {
  if (variables?.kind !== 'object') {
    return new Set();
  }

  return new Set(variables.entries.keys());
}

function splitAtFirstDot(text: string): [string, string | undefined] {
  const dot = text.indexOf('.');

  if (dot === -1) {
    return [text, undefined];
  }

  return [text.slice(0, dot), text.slice(dot + 1)];
}
