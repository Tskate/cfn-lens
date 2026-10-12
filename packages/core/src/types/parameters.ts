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
