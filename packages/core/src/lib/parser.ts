import { isMap, LineCounter, parseDocument } from 'yaml';

import type { Template } from '../types/template';
import type { Diagnostic, Format } from '../types';
import { detectFormat } from '../utils/detectFormat';
import { ParserContext } from './ParserContext';
import { readDescription } from './readDescription';
import { readFormatVersion } from './readFormatVersion';

type ParseResult = {
  template: Template | null;
  diagnostics: Diagnostic[];
  format: Format;
};

export function parseTemplate(sourceText: string): ParseResult {
  const lineCounter = new LineCounter();
  // YAML 1.2 is a superset of JSON, so one parser handles both formats.
  // 1.2 (not 1.1) also keeps an unquoted 2010-09-09 a string instead of a date.
  const doc = parseDocument(sourceText, { lineCounter, version: '1.2', prettyErrors: false });

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

  return result({
    formatVersion: readFormatVersion(root, ctx),
    description: readDescription(root, ctx),
    resources: new Map(),
  });
}
