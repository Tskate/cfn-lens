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
  transforms?: string[];
  parameters?: ReadonlyMap<string, Parameter>;
  mappings?: ReadonlyMap<string, Mapping>;
  conditions?: ReadonlyMap<string, Condition>;
  resources: ReadonlyMap<string, Resource>;
  outputs?: ReadonlyMap<string, Output>;
};
