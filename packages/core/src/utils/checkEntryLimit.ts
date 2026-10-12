import type { Diagnostic } from '../types';

// https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cloudformation-limits.html
export function checkEntryLimit(section: string, entries: ReadonlyMap<string, unknown>, max: number): Diagnostic[] {
  if (entries.size <= max) {
    return [];
  }

  return [
    {
      severity: 'error',
      code: 'too-many-entries',
      message: `${section} has ${entries.size} entries; CloudFormation allows at most ${max}.`,
    },
  ];
}
