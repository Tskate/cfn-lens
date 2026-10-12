import { describe, expect, it } from 'vitest';

import { checkEntryLimit } from './checkEntryLimit.ts';

describe('checkEntryLimit', () => {
  const entries = (count: number) => new Map(Array.from({ length: count }, (_, i) => [`E${i}`, i]));

  it('accepts exactly the limit', () => {
    expect(checkEntryLimit('Mappings', entries(3), 3)).toEqual([]);
  });

  it('reports one entry over the limit, naming the section', () => {
    expect(checkEntryLimit('Mappings', entries(4), 3)).toEqual([
      expect.objectContaining({ severity: 'error', code: 'too-many-entries', message: expect.stringContaining('Mappings') }),
    ]);
  });
});
