import type { SourceRange } from '.';

type BaseConditionFields = {
  range: SourceRange;
};

// https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/intrinsic-function-reference-conditions.html
export type ConditionOperand =
  | ({ kind: 'literal'; value: string } & BaseConditionFields)
  | ({ kind: 'ref'; target: string } & BaseConditionFields)
  | ({
      kind: 'findInMap';
      mapName: ConditionOperand;
      topLevelKey: ConditionOperand;
      secondLevelKey: ConditionOperand;
    } & BaseConditionFields)
  // The docs allow condition functions inside other condition functions, Fn::Equals included.
  | ConditionExpression;

export type ConditionExpression =
  | ({ kind: 'and' | 'or'; operands: readonly ConditionExpression[] } & BaseConditionFields)
  | ({ kind: 'not'; operand: ConditionExpression } & BaseConditionFields)
  | ({ kind: 'equals'; left: ConditionOperand; right: ConditionOperand } & BaseConditionFields)
  | ({ kind: 'condition'; name: string } & BaseConditionFields);

export type Condition = {
  name: string;
  // undefined when the expression is invalid (already reported); the name stays known, so
  // references to it aren't reported a second time as unknown.
  expression: ConditionExpression | undefined;
  nameRange: SourceRange;
  range: SourceRange;
};
