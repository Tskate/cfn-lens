import { isMap, type YAMLMap } from 'yaml';

import { parseYaml } from '../lib/parseYaml';
import { ParserContext } from '../lib/ParserContext';

type Reader<T> = (root: YAMLMap.Parsed, ctx: ParserContext) => T;

// Runs one section reader on a YAML snippet, with the same parse setup as parseTemplate().
export function runReader<T>(reader: Reader<T>, source: string) {
  const { doc, lineCounter } = parseYaml(source);

  if (!isMap(doc.contents)) {
    throw new Error(`Test source must be a YAML mapping:\n${source}`);
  }

  const ctx = new ParserContext(lineCounter);
  return { value: reader(doc.contents, ctx), diagnostics: ctx.diagnostics };
}
