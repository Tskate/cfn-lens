import type { SourceRange } from '.';
import type { TemplateValue } from './values';

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
