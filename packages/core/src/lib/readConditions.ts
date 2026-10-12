import { isScalar, isSeq, type ParsedNode, type YAMLMap } from 'yaml';

import type { Condition, ConditionExpression, ConditionOperand } from '../types';
import { readIntrinsicCall, type IntrinsicCall } from '../utils/yaml/intrinsics';
import type { ParserContext } from '../utils/yaml/ParserContext';
import { readSection, type SectionEntry } from '../utils/yaml/readSection';
import { readString } from '../utils/yaml/readString';

// https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/conditions-section-structure.html
export function readConditions(root: YAMLMap.Parsed, ctx: ParserContext): ReadonlyMap<string, Condition> {
  return readSection(root, 'Conditions', ctx, readCondition);
}

function readCondition({ name, nameNode, node, nameRange, range }: SectionEntry, ctx: ParserContext): Condition {
  return { name, expression: readExpression(node ?? nameNode, ctx, node === null), nameRange, range };
}

const CONDITION_FUNCTIONS = 'Fn::Equals, Fn::And, Fn::Or, Fn::Not or Condition';

// Any invalid part makes the whole expression undefined; each problem is reported once, where it is.
function readExpression(node: ParsedNode, ctx: ParserContext, isEmpty = false): ConditionExpression | undefined {
  const call = isEmpty ? undefined : readIntrinsicCall(node, { condition: true });

  if (!call) {
    ctx.error('expected-condition-function', `Expected a condition function (${CONDITION_FUNCTIONS}).`, node);
    return undefined;
  }

  const range = ctx.rangeOf(node);

  switch (call.fn) {
    case 'Fn::And':
    case 'Fn::Or': {
      const operands = readAll(readArguments(call, 2, 10, ctx), (item) => readExpression(item, ctx));
      return operands && { kind: call.fn === 'Fn::And' ? 'and' : 'or', operands, range };
    }
    case 'Fn::Not': {
      const [item] = readArguments(call, 1, 1, ctx) ?? [];
      const operand = item && readExpression(item, ctx);
      return operand && { kind: 'not', operand, range };
    }
    case 'Fn::Equals': {
      const values = readAll(readArguments(call, 2, 2, ctx), (item) => readOperand(item, ctx));
      const [left, right] = values ?? [];
      return left && right && { kind: 'equals', left, right, range };
    }
    case 'Condition': {
      const name = readCallString(call, ctx);
      return name === undefined ? undefined : { kind: 'condition', name, range };
    }
    default:
      reportNotAllowed(call, ctx);
      return undefined;
  }
}

function readOperand(node: ParsedNode, ctx: ParserContext): ConditionOperand | undefined {
  const call = readIntrinsicCall(node, { condition: true });
  const range = ctx.rangeOf(node);

  if (!call) {
    if (isScalar(node) && node.value === null) {
      ctx.error('expected-string', 'Condition values must be strings.', node);
      return undefined;
    }
    // Fn::Equals compares strings, so unquoted numbers and booleans are fine as text.
    const value = readString(node, 'Condition value', ctx, { allowScalars: true })?.value;
    return value === undefined ? undefined : { kind: 'literal', value, range };
  }

  switch (call.fn) {
    case 'Ref': {
      const target = readCallString(call, ctx);
      return target === undefined ? undefined : { kind: 'ref', target, range };
    }
    case 'Fn::FindInMap': {
      const keys = readAll(readArguments(call, 3, 3, ctx), (item) => readOperand(item, ctx));
      const [mapName, topLevelKey, secondLevelKey] = keys ?? [];
      return mapName && topLevelKey && secondLevelKey && { kind: 'findInMap', mapName, topLevelKey, secondLevelKey, range };
    }
    default:
      // Condition functions are allowed as operands too.
      return readExpression(node, ctx);
  }
}

function readArguments(call: IntrinsicCall, min: number, max: number, ctx: ParserContext): ParsedNode[] | undefined {
  const count = min === max ? `${min}` : `${min}–${max}`;

  if (!call.arg || !isSeq(call.arg) || call.arg.items.length < min || call.arg.items.length > max) {
    ctx.error('invalid-arguments', `${call.fn} takes a list of ${count} values.`, call.node);
    return undefined;
  }

  return call.arg.items;
}

// Reads every item, reporting each problem; undefined if any item is invalid.
function readAll<T>(items: ParsedNode[] | undefined, read: (item: ParsedNode) => T | undefined): T[] | undefined {
  if (!items) {
    return undefined;
  }
  const results = items.map(read);
  return results.every((result) => result !== undefined) ? results : undefined;
}

function readCallString(call: IntrinsicCall, ctx: ParserContext): string | undefined {
  if (!call.arg) {
    ctx.error('expected-string', `${call.fn} needs a name.`, call.node);
    return undefined;
  }
  return readString(call.arg, call.fn, ctx)?.value;
}

function reportNotAllowed(call: IntrinsicCall, ctx: ParserContext): void {
  const hint =
    call.fn === 'Fn::If'
      ? ' Fn::If works only in Resources and Outputs.'
      : call.fn === 'Fn::ForEach'
        ? ' Fn::ForEach needs the AWS::LanguageExtensions transform, which cfn-lens does not support yet.'
        : ` Use ${CONDITION_FUNCTIONS}, with Ref or Fn::FindInMap for values.`;
  ctx.error('function-not-allowed', `${call.fn} can't be used in Conditions.${hint}`, call.node);
}
