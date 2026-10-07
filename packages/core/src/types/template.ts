import type { SourceRange } from '.';

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
// https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/mappings-section-structure.html
export type MappingValue = string | readonly string[];

export type Mapping = {
  name: string;
  // Top-level key (e.g. a Region) → attribute name → value, in source order.
  entries: ReadonlyMap<string, ReadonlyMap<string, MappingValue>>;
  nameRange: SourceRange;
  range: SourceRange;
};
type Condition = {};
type Resource = {
  logicalId: string;
  ///AWS::ServiceName::ResourceType https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-template-resource-type-ref.html
  type: string;
  properties: Record<string, unknown>;
};
type Output = {};

export type Template = {
  // '2010-09-09' is only valid for now https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/format-version-structure.html
  formatVersion?: string;
  description?: string;
  // Macro names in execution order; [] when the section is missing.
  transforms: string[];
  resources: ReadonlyMap<string, Resource>;
  parameters: ReadonlyMap<string, Parameter>;
  mappings: ReadonlyMap<string, Mapping>;
  conditions?: ReadonlyMap<string, Condition>;
  outputs?: ReadonlyMap<string, Output>;
};
