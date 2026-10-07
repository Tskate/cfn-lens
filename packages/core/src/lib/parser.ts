import { isMap } from 'yaml';

import type { Template } from '../types/template';
import type { Diagnostic, Format } from '../types';
import { detectFormat } from '../utils/detectFormat';
import { parseYaml } from './parseYaml';
import { ParserContext } from './ParserContext';
import { readDescription } from './readDescription';
import { readFormatVersion } from './readFormatVersion';
import { readParameters } from './readParameters';
import { readTransforms } from './readTransforms';
import { validateParameters } from './validateParameters';

type ParseResult = {
  template: Template | null;
  diagnostics: Diagnostic[];
  format: Format;
};

export function parseTemplate(sourceText: string): ParseResult {
  const { doc, lineCounter } = parseYaml(sourceText);

  const ctx = new ParserContext(lineCounter);
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
    resources: new Map(),
  };

  // Validation runs on the parsed model, once every section has been read.
  ctx.add(validateParameters(template.parameters));

  return result(template);
}
