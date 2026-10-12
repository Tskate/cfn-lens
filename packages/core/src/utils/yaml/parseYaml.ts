import { LineCounter, parseDocument } from 'yaml';

// Single place for YAML options, shared by parseTemplate() and the reader tests.
export function parseYaml(sourceText: string) {
  const lineCounter = new LineCounter();
  // YAML 1.2 is a superset of JSON, so one parser handles both formats.
  // 1.2 (not 1.1) also keeps an unquoted 2010-09-09 a string instead of a date.
  const doc = parseDocument(sourceText, { lineCounter, version: '1.2', prettyErrors: false });
  return { doc, lineCounter };
}
