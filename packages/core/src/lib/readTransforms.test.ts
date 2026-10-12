import { describe, expect, it } from 'vitest';

import { runReader } from '../fixtures/runReader.ts';
import { readTransforms } from './readTransforms.ts';

// String rules (numbers, nulls, block scalars) are covered in readOptionalString.test.ts.
describe('readTransforms', () => {
  it.each([
    ['a single name', `Transform: AWS::Serverless-2016-10-31`, ['AWS::Serverless-2016-10-31']],
    ['a list, in order', `Transform:\n  - MyMacro\n  - AWS::Serverless-2016-10-31`, ['MyMacro', 'AWS::Serverless-2016-10-31']],
    ['a mapping with Name', `Transform:\n  Name: AWS::Include\n  Parameters:\n    Location: s3://bucket/file.yaml`, ['AWS::Include']],
  ])('reads %s', (_label, source, expected) => {
    const { value, diagnostics } = runReader(readTransforms, source);

    expect(value).toEqual(expected);
    expect(diagnostics).toEqual([]);
  });

  it.each([
    ['missing', `Description: x`],
    ['empty', `Transform:`],
    ['an empty list', `Transform: []`],
  ])('returns [] without a diagnostic when %s', (_label, source) => {
    const { value, diagnostics } = runReader(readTransforms, source);

    expect(value).toEqual([]);
    expect(diagnostics).toEqual([]);
  });

  // One bad item doesn't discard the others; each warning points at its own item
  it('keeps valid list items and warns about each invalid one', () => {
    const { value, diagnostics } = runReader(readTransforms, `Transform: [MyMacro, 42, [x]]`);

    expect(value).toEqual(['MyMacro', '42']);
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: 'string-not-quoted',
        range: expect.objectContaining({ start: expect.objectContaining({ column: 22 }) }),
      }),
      expect.objectContaining({
        code: 'expected-string',
        range: expect.objectContaining({ start: expect.objectContaining({ column: 26 }) }),
      }),
    ]);
  });

  it('skips and reports a mapping without Name', () => {
    const { value, diagnostics } = runReader(readTransforms, `Transform:\n  Parameters:\n    Location: s3://bucket/file.yaml`);

    expect(value).toEqual([]);
    expect(diagnostics).toEqual([expect.objectContaining({ severity: 'error', code: 'transform-missing-name' })]);
  });

  it('warns when Name is not a string', () => {
    const { value, diagnostics } = runReader(readTransforms, `Transform:\n  Name: [AWS::Include]`);

    expect(value).toEqual([]);
    expect(diagnostics.map((d) => d.code)).toEqual(['expected-string']);
  });
});
