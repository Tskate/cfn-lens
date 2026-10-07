type Parameter = {};
type Mapping = {};
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
  parameters?: ReadonlyMap<string, Parameter>;
  mappings?: ReadonlyMap<string, Mapping>;
  conditions?: ReadonlyMap<string, Condition>;
  outputs?: ReadonlyMap<string, Output>;
};
