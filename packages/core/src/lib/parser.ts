import { isMap } from 'yaml';

import type { Diagnostic, Format, Template } from '../types';
import { detectFormat } from '../utils/detectFormat';
import { checkEntryLimit } from '../utils/checkEntryLimit';
import { parseYaml } from '../utils/yaml/parseYaml';
import { ParserContext } from '../utils/yaml/ParserContext';
import { readConditions } from './readConditions';
import { readDescription } from './readDescription';
import { readFormatVersion } from './readFormatVersion';
import { readMappings } from './readMappings';
import { readOutputs } from './readOutputs';
import { readParameters } from './readParameters';
import { readTransforms } from './readTransforms';
import { validateConditions } from './validateConditions';
import { validateOutputs } from './validateOutputs';
import { validateParameters } from './validateParameters';
import { readResources } from './readResources';

// https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cloudformation-limits.html
const MAX_MAPPINGS = 200;
const MAX_OUTPUTS = 200;

type ParseResult = {
  template: Template | null;
  diagnostics: Diagnostic[];
  format: Format;
};

export function parseTemplate(sourceText: string): ParseResult {
  const { doc, lineCounter } = parseYaml(sourceText);

  const ctx = new ParserContext(lineCounter, sourceText);
  const format = detectFormat(sourceText);
  const result = (template: Template | null): ParseResult => ({ template, diagnostics: ctx.diagnostics, format });

  for (const error of doc.errors) {
    ctx.error('yaml-syntax', error.message, error.pos);
  }

  const root = doc.contents;

  if (root === null) {
    // No document at all: broken syntax is already reported, otherwise the input is just empty.
    if (!ctx.hasErrors) {
      ctx.warning('empty-template', 'The template is empty.');
    }
    return result(null);
  }

  if (!isMap(root)) {
    ctx.error('root-not-object', 'A template must be a mapping of sections (Resources, Parameters, …) at the top level.', root);
    return result(null);
  }

  const template: Template = {
    formatVersion: readFormatVersion(root, ctx),
    description: readDescription(root, ctx),
    transforms: readTransforms(root, ctx),
    parameters: readParameters(root, ctx),
    mappings: readMappings(root, ctx),
    conditions: readConditions(root, ctx),
    resources: readResources(root, ctx),
    outputs: readOutputs(root, ctx),
  };

  // Validation runs on the parsed model, once every section has been read.
  ctx.add(validateParameters(template.parameters));
  ctx.add(checkEntryLimit('Mappings', template.mappings, MAX_MAPPINGS));
  ctx.add(validateConditions(template.conditions, template));
  ctx.add(checkEntryLimit('Outputs', template.outputs, MAX_OUTPUTS));
  ctx.add(validateOutputs(template.outputs, template));

  return result(template);
}
