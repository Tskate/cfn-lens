import type { Condition, ConditionOperand, Diagnostic, Mapping, Parameter, SourceRange } from '../types';
import { findCycles, type Edge } from '../utils/findCycles';

// https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/pseudo-parameter-reference.html
const PSEUDO_PARAMETERS = new Set([
  'AWS::AccountId',
  'AWS::NotificationARNs',
  'AWS::NoValue',
  'AWS::Partition',
  'AWS::Region',
  'AWS::StackId',
  'AWS::StackName',
  'AWS::URLSuffix',
]);

type Sections = { parameters: ReadonlyMap<string, Parameter>; mappings: ReadonlyMap<string, Mapping> };

// Pure: checks what conditions reference (parameters, mappings, other conditions) and reports cycles.
export function validateConditions(conditions: ReadonlyMap<string, Condition>, { parameters, mappings }: Sections): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const graph = new Map<string, Edge[]>();

  const visit = (operand: ConditionOperand, references: Edge[]): void => {
    switch (operand.kind) {
      case 'and':
      case 'or':
        operand.operands.forEach((item) => visit(item, references));
        break;
      case 'not':
        visit(operand.operand, references);
        break;
      case 'equals':
        visit(operand.left, references);
        visit(operand.right, references);
        if (operand.left.kind === 'literal' && operand.right.kind === 'literal') {
          const result = operand.left.value === operand.right.value ? 'true' : 'false';
          diagnostics.push({
            severity: 'warning',
            code: 'constant-condition',
            message: `Fn::Equals compares two literals, so it is always ${result}.`,
            range: operand.range,
          });
        }
        break;
      case 'condition':
        if (conditions.has(operand.name)) {
          references.push({ target: operand.name, range: operand.range });
        } else {
          diagnostics.push({
            severity: 'error',
            code: 'unknown-condition',
            message: `Condition '${operand.name}' is not defined.`,
            range: operand.range,
          });
        }
        break;
      case 'ref':
        if (!parameters.has(operand.target) && !PSEUDO_PARAMETERS.has(operand.target)) {
          diagnostics.push({
            severity: 'error',
            code: 'invalid-ref',
            message: `'${operand.target}' is not a parameter; conditions can only reference parameters and pseudo parameters.`,
            range: operand.range,
          });
        }
        break;
      case 'findInMap':
        visit(operand.mapName, references);
        visit(operand.topLevelKey, references);
        visit(operand.secondLevelKey, references);
        diagnostics.push(...checkFindInMap(operand, mappings));
        break;
      case 'literal':
        break;
    }
  };

  for (const condition of conditions.values()) {
    const references: Edge[] = [];
    if (condition.expression) {
      visit(condition.expression, references);
    }
    graph.set(condition.name, references);
  }

  const cycles = findCycles(graph).map(({ path, edge }): Diagnostic => ({
    severity: 'error',
    code: 'circular-condition',
    message: `Circular condition reference: ${path.join(' → ')}.`,
    range: edge.range,
  }));

  return [...diagnostics, ...cycles];
}

// Only literal arguments can be checked; a Ref key is resolved at deploy time.
function checkFindInMap(operand: Extract<ConditionOperand, { kind: 'findInMap' }>, mappings: Sections['mappings']): Diagnostic[] {
  const { mapName, topLevelKey, secondLevelKey } = operand;
  if (mapName.kind !== 'literal') {
    return [];
  }

  const mapping = mappings.get(mapName.value);
  if (!mapping) {
    return [{ severity: 'error', code: 'unknown-mapping', message: `Mapping '${mapName.value}' is not defined.`, range: mapName.range }];
  }

  const unknownKey = (key: string, range: SourceRange): Diagnostic[] => [
    { severity: 'error', code: 'unknown-mapping-key', message: `Mapping '${mapName.value}' has no key '${key}'.`, range },
  ];

  if (topLevelKey.kind === 'literal') {
    const attributes = mapping.entries.get(topLevelKey.value);
    if (!attributes) {
      return unknownKey(topLevelKey.value, topLevelKey.range);
    }
    if (secondLevelKey.kind === 'literal' && !attributes.has(secondLevelKey.value)) {
      return unknownKey(secondLevelKey.value, secondLevelKey.range);
    }
    return [];
  }

  if (secondLevelKey.kind === 'literal' && ![...mapping.entries.values()].some((attributes) => attributes.has(secondLevelKey.value))) {
    return unknownKey(secondLevelKey.value, secondLevelKey.range);
  }
  return [];
}
