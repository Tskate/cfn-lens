import type { Format } from '../types';

// A hint for friendlier messages only; parsing never branches on it.
export function detectFormat(sourceText: string): Format {
  const first = sourceText.trimStart()[0];

  if (!first) {
    return 'unknown';
  }

  return first === '{' ? 'json' : 'yaml';
}
