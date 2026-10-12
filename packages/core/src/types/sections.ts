import type { SourceRange } from './diagnostics';
import type { TemplateValue } from './template';

// ── Parameters ──────────────────────────────────────────────────────────────
// https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/parameters-section-structure.html

export type ParameterProperty =
  | 'Type'
  | 'Default'
  | 'AllowedValues'
  | 'AllowedPattern'
  | 'ConstraintDescription'
  | 'Description'
  | 'MinLength'
  | 'MaxLength'
  | 'MinValue'
  | 'MaxValue'
  | 'NoEcho';

export type Parameter = {
  name: string;
  type: string;
  // Parameter values are strings in CloudFormation, so numeric defaults are kept as text.
  default?: string;
  allowedValues: readonly string[];
  allowedPattern?: string;
  constraintDescription?: string;
  description?: string;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  noEcho: boolean;
  nameRange: SourceRange;
  range: SourceRange;
  // Where each property's value is in the source, so validation can point at it.
  propertyRanges: Partial<Record<ParameterProperty, SourceRange>>;
};

// ── Mappings ────────────────────────────────────────────────────────────────
// https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/mappings-section-structure.html

export type MappingValue = string | readonly string[];

export type Mapping = {
  name: string;
  // Top-level key (e.g. a Region) → attribute name → value, in source order.
  entries: ReadonlyMap<string, ReadonlyMap<string, MappingValue>>;
  nameRange: SourceRange;
  range: SourceRange;
};

// ── Conditions ──────────────────────────────────────────────────────────────
// https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/intrinsic-function-reference-conditions.html

type BaseConditionFields = {
  range: SourceRange;
};

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

// ── Outputs ─────────────────────────────────────────────────────────────────
// https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/outputs-section-structure.html

export type OutputProperty = 'Value' | 'Description' | 'Export' | 'Condition';

export type Output = {
  name: string;
  value: TemplateValue | undefined;
  description?: string;
  // Export.Name: may use intrinsic functions.
  exportName?: TemplateValue;
  condition?: string;
  nameRange: SourceRange;
  range: SourceRange;
  propertyRanges: Partial<Record<OutputProperty, SourceRange>>;
};

// ── Resources ───────────────────────────────────────────────────────────────
// https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-template-resource-type-ref.html

export type ResourceProperty =
  | 'Type'
  | 'Properties'
  | 'Condition'
  | 'DeletionPolicy'
  | 'UpdateReplacePolicy'
  | 'CreationPolicy'
  | 'UpdatePolicy'
  | 'Metadata'
  | 'DependsOn';

// Placeholder until the Resources section is parsed.
export type Resource = {
  name: string;
  // AWS::ServiceName::ResourceType
  type: string;
  properties?: TemplateValue;
  dependsOn?: readonly string[];
  creationPolicy?: TemplateValue;
  updatePolicy?: TemplateValue;
  updateReplacePolicy?: string;
  deletionPolicy?: string;
  condition?: string;
  metadata?: TemplateValue;
  nameRange: SourceRange;
  range: SourceRange;
  propertyRanges: Partial<Record<ResourceProperty, SourceRange>>;
};
