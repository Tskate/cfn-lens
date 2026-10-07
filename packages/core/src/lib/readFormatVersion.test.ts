import { describe, expect, it } from 'vitest';

import { runReader } from '../fixtures/runReader.ts';
import { readFormatVersion } from './readFormatVersion.ts';

// Shape rules (missing, empty, lists, numbers) are covered in readOptionalString.test.ts.
describe('readFormatVersion', () => {
  it.each([`'2010-09-09'`, `2010-09-09`])('accepts %s without a diagnostic', (version) => {
    const { value, diagnostics } = runReader(readFormatVersion, `AWSTemplateFormatVersion: ${version}`);

    expect(value).toBe('2010-09-09');
    expect(diagnostics).toEqual([]);
  });

  it('keeps an unsupported version and warns at the value', () => {
    const { value, diagnostics } = runReader(readFormatVersion, `AWSTemplateFormatVersion: '2024-01-01'`);

    expect(value).toBe('2024-01-01');
    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: 'warning',
        code: 'unsupported-format-version',
        range: expect.objectContaining({ start: { offset: 26, line: 1, column: 27 } }),
      }),
    ]);
  });

  // One diagnostic per problem: `2010` is also not '2010-09-09', but only the shape warning is reported
  it('does not add an unsupported-version warning on top of string-not-quoted', () => {
    const { value, diagnostics } = runReader(readFormatVersion, `AWSTemplateFormatVersion: 2010`);

    expect(value).toBe('2010');
    expect(diagnostics.map((d) => d.code)).toEqual(['string-not-quoted']);
  });
});
