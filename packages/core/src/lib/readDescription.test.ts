import { describe, expect, it } from 'vitest';

import { runReader } from '../fixtures/runReader.ts';
import { readDescription } from './readDescription.ts';

// Shape rules (missing, empty, lists, numbers, block scalars) are covered in readOptionalString.test.ts.
describe('readDescription', () => {
  it('accepts exactly 1024 bytes', () => {
    const description = 'a'.repeat(1024);
    const { value, diagnostics } = runReader(readDescription, `Description: ${description}`);

    expect(value).toBe(description);
    expect(diagnostics).toEqual([]);
  });

  // The limit is in UTF-8 bytes: 513 × 'é' is 513 characters but 1026 bytes
  it.each([
    ['1025 ASCII characters', 'a'.repeat(1025)],
    ['513 two-byte characters', 'é'.repeat(513)],
  ])('keeps but warns about a description over 1024 bytes (%s)', (_label, description) => {
    const { value, diagnostics } = runReader(readDescription, `Description: ${description}`);

    expect(value).toBe(description);
    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: 'warning',
        code: 'description-too-long',
        range: expect.objectContaining({ start: { offset: 13, line: 1, column: 14 } }),
      }),
    ]);
  });
});
