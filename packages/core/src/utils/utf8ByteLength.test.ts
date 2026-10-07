import { describe, expect, it } from 'vitest';

import { utf8ByteLength } from './utf8ByteLength.ts';

describe('utf8ByteLength', () => {
  it.each([
    ['empty string', '', 0],
    ['ASCII (1 byte each)', 'abc', 3],
    ['Latin accent (2 bytes)', 'é', 2],
    ['Euro sign (3 bytes)', '€', 3],
    ['emoji outside the BMP (4 bytes, 2 UTF-16 units)', '😀', 4],
    ['mixed', 'aé€😀', 10],
  ])('counts %s', (_label, text, bytes) => {
    expect(utf8ByteLength(text)).toBe(bytes);
  });
});
