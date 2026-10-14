import { describe, expect, it } from 'vitest';

import { parseTemplate, type Diagnostic, type Template } from './index.ts';

// Apps import only from the entry point, so it must expose the parser and the model types.
describe('@cfn-lens/core', () => {
  it('parses a template through the public entry point', () => {
    const { template, diagnostics, format } = parseTemplate(`Resources:\n  Bucket:\n    Type: AWS::S3::Bucket`);
    const resource = (template as Template).resources.get('Bucket');

    expect(format).toBe('yaml');
    expect(resource?.type).toBe('AWS::S3::Bucket');
    expect(diagnostics satisfies Diagnostic[]).toEqual([]);
  });

  it('exports only the parser and diagram builder at runtime; types are erased', async () => {
    expect(Object.keys(await import('./index.ts'))).toEqual(['parseTemplate', 'buildDiagram']);
  });
});
