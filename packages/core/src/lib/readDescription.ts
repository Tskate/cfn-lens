import type { YAMLMap } from 'yaml';

import { utf8ByteLength } from '../utils/utf8ByteLength';
import type { ParserContext } from '../utils/yaml/ParserContext';
import { readOptionalString } from '../utils/yaml/readOptionalString';

// https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/template-description-structure.html
const MAX_DESCRIPTION_BYTES = 1024;

export function readDescription(root: YAMLMap.Parsed, ctx: ParserContext): string | undefined {
  const field = readOptionalString(root, 'Description', ctx);

  if (!field) {
    return;
  }

  const bytes = utf8ByteLength(field.value);

  if (bytes > MAX_DESCRIPTION_BYTES) {
    ctx.error('description-too-long', `Description is ${bytes} bytes; CloudFormation allows at most ${MAX_DESCRIPTION_BYTES}.`, field.node);
  }

  return field?.value;
}
