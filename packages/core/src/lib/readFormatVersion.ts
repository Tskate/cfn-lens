import type { YAMLMap } from 'yaml';

import type { ParserContext } from '../utils/yaml/ParserContext';
import { readOptionalString } from '../utils/yaml/readOptionalString';

const SUPPORTED_FORMAT_VERSION = '2010-09-09';

export function readFormatVersion(root: YAMLMap.Parsed, ctx: ParserContext): string | undefined {
  const field = readOptionalString(root, 'AWSTemplateFormatVersion', ctx);

  if (field && !field.reported && field.value !== SUPPORTED_FORMAT_VERSION) {
    ctx.error(
      'unsupported-format-version',
      `Unsupported AWSTemplateFormatVersion '${field.value}'; the only valid value is '${SUPPORTED_FORMAT_VERSION}'.`,
      field.node,
    );
  }

  return field?.value;
}
